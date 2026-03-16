import { storage } from "./storage";
import { db } from "./db";
import { files, projectEnvVars, storageKv, storageObjects, aiConversations, aiMessages, projects } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Checkpoint, CheckpointStateSnapshot } from "@shared/schema";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!_openai) {
    try {
      _openai = new OpenAI();
    } catch {
      return null;
    }
  }
  return _openai;
}

function extractPackagesFromFiles(projectFiles: { filename: string; content: string }[]): string[] {
  const pkgFile = projectFiles.find(f => f.filename === "package.json");
  if (!pkgFile) return [];
  try {
    const pkg = JSON.parse(pkgFile.content);
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    return [...deps, ...devDeps];
  } catch {
    return [];
  }
}

export async function captureProjectState(projectId: string): Promise<CheckpointStateSnapshot> {
  const [projectFiles, envVars, kvEntries, storageObjs, project] = await Promise.all([
    storage.getFiles(projectId),
    storage.getProjectEnvVars(projectId),
    storage.getStorageKvEntries(projectId),
    storage.getStorageObjects(projectId),
    storage.getProject(projectId),
  ]);

  let capturedConversations: CheckpointStateSnapshot["aiConversations"] = [];
  try {
    const allConvs = await db.select().from(aiConversations).where(eq(aiConversations.projectId, projectId));
    for (const conv of allConvs) {
      const messages = await storage.getMessages(conv.id);
      capturedConversations.push({
        userId: conv.userId,
        title: conv.title || "",
        model: conv.model,
        messages: messages.map(m => ({ role: m.role, content: m.content, model: m.model || undefined })),
      });
    }
  } catch {
  }

  const packages = extractPackagesFromFiles(projectFiles.map(f => ({ filename: f.filename, content: f.content })));

  return {
    files: projectFiles.map(f => ({ filename: f.filename, content: f.content })),
    envVars: envVars.map(e => ({ key: e.key, encryptedValue: e.encryptedValue })),
    storageKv: kvEntries.map(kv => ({ key: kv.key, value: kv.value })),
    storageObjectsMeta: storageObjs.map(o => ({
      filename: o.filename,
      mimeType: o.mimeType,
      sizeBytes: o.sizeBytes,
      storagePath: o.storagePath,
    })),
    aiConversations: capturedConversations,
    projectConfig: {
      name: project?.name || "",
      language: project?.language || "",
    },
    packages,
  };
}

async function generateAIDescription(trigger: string, state: CheckpointStateSnapshot): Promise<string> {
  try {
    const fileNames = state.files.map(f => f.filename).slice(0, 20).join(", ");
    const prompt = `Generate a concise 1-sentence description (max 80 chars) for a project checkpoint. Context:
- Trigger: ${trigger}
- Files (${state.files.length}): ${fileNames}
- Packages (${state.packages.length}): ${state.packages.slice(0, 10).join(", ")}
- KV entries: ${state.storageKv.length}, Secrets: ${state.envVars.length}
- Project: ${state.projectConfig.name} (${state.projectConfig.language})
Respond with only the description text, no quotes.`;

    const openai = getOpenAI();
    if (!openai) return generateFallbackDescription(trigger, state);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.3,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (text && text.length > 0) return text;
  } catch {
  }
  return generateFallbackDescription(trigger, state);
}

function generateFallbackDescription(trigger: string, state: CheckpointStateSnapshot): string {
  const fileCount = state.files.length;
  const kvCount = state.storageKv.length;
  const envCount = state.envVars.length;
  const convCount = state.aiConversations.length;
  const pkgCount = state.packages.length;

  const parts: string[] = [];
  parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
  if (pkgCount > 0) parts.push(`${pkgCount} package${pkgCount !== 1 ? "s" : ""}`);
  if (kvCount > 0) parts.push(`${kvCount} KV entr${kvCount !== 1 ? "ies" : "y"}`);
  if (envCount > 0) parts.push(`${envCount} secret${envCount !== 1 ? "s" : ""}`);
  if (convCount > 0) parts.push(`${convCount} AI conversation${convCount !== 1 ? "s" : ""}`);

  const triggerLabels: Record<string, string> = {
    manual: "Manual checkpoint",
    feature_complete: "After AI feature completion",
    deployment: "After successful deployment",
    pre_risky_op: "Before risky operation",
  };

  const label = triggerLabels[trigger] || "Checkpoint";
  return `${label} — ${parts.join(", ")}`;
}

export async function createCheckpoint(
  projectId: string,
  userId: string,
  trigger: string,
  description?: string,
): Promise<Checkpoint> {
  const stateSnapshot = await captureProjectState(projectId);
  const desc = description || await generateAIDescription(trigger, stateSnapshot);

  const cp = await storage.createCheckpoint({
    projectId,
    userId,
    description: desc,
    type: trigger === "manual" ? "manual" : "auto",
    trigger,
    stateSnapshot,
  });

  const position = await storage.getCheckpointPosition(projectId);
  const allCheckpoints = await storage.getCheckpoints(projectId);

  let newDivergedFromId: string | null = position?.divergedFromId || null;

  if (!newDivergedFromId && position?.currentCheckpointId && allCheckpoints.length > 0) {
    const latestId = allCheckpoints[0].id;
    if (position.currentCheckpointId !== latestId) {
      newDivergedFromId = position.currentCheckpointId;
    }
  }

  await storage.setCheckpointPosition(projectId, cp.id, newDivergedFromId);

  return cp;
}

export async function restoreCheckpoint(
  checkpointId: string,
  options: { includeDatabase?: boolean } = {},
): Promise<{ success: boolean; message: string }> {
  const checkpoint = await storage.getCheckpoint(checkpointId);
  if (!checkpoint) {
    return { success: false, message: "Checkpoint not found" };
  }

  const snapshot = checkpoint.stateSnapshot as CheckpointStateSnapshot;
  const pid = checkpoint.projectId;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(files).where(eq(files.projectId, pid));
      for (const file of snapshot.files) {
        await tx.insert(files).values({ projectId: pid, filename: file.filename, content: file.content });
      }

      if (snapshot.projectConfig) {
        await tx.update(projects)
          .set({ name: snapshot.projectConfig.name, language: snapshot.projectConfig.language })
          .where(eq(projects.id, pid));
      }

      if (options.includeDatabase) {
        await tx.delete(storageKv).where(eq(storageKv.projectId, pid));
        for (const kv of snapshot.storageKv) {
          await tx.insert(storageKv).values({ projectId: pid, key: kv.key, value: kv.value });
        }

        await tx.delete(projectEnvVars).where(eq(projectEnvVars.projectId, pid));
        for (const ev of snapshot.envVars) {
          await tx.insert(projectEnvVars).values({ projectId: pid, key: ev.key, encryptedValue: ev.encryptedValue });
        }

        await tx.delete(storageObjects).where(eq(storageObjects.projectId, pid));
        for (const obj of snapshot.storageObjectsMeta) {
          await tx.insert(storageObjects).values({
            projectId: pid,
            filename: obj.filename,
            mimeType: obj.mimeType,
            sizeBytes: obj.sizeBytes,
            storagePath: obj.storagePath || "",
          });
        }

        const existingConvs = await tx.select().from(aiConversations).where(eq(aiConversations.projectId, pid));
        for (const conv of existingConvs) {
          await tx.delete(aiMessages).where(eq(aiMessages.conversationId, conv.id));
        }
        await tx.delete(aiConversations).where(eq(aiConversations.projectId, pid));

        for (const conv of (snapshot.aiConversations || [])) {
          const [newConv] = await tx.insert(aiConversations).values({
            projectId: pid,
            userId: conv.userId || checkpoint.userId,
            title: conv.title,
            model: conv.model,
          }).returning();

          for (const msg of conv.messages) {
            await tx.insert(aiMessages).values({
              conversationId: newConv.id,
              role: msg.role,
              content: msg.content,
              model: msg.model || null,
            });
          }
        }
      }
    });

    await storage.setCheckpointPosition(pid, checkpointId, null);

    return { success: true, message: `Restored to checkpoint: ${checkpoint.description}` };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Restore failed: ${errMsg}` };
  }
}

export async function getCheckpointDiff(
  checkpointId: string,
): Promise<{ added: string[]; removed: string[]; modified: { filename: string; current: string; checkpoint: string }[] } | null> {
  const checkpoint = await storage.getCheckpoint(checkpointId);
  if (!checkpoint) return null;

  const snapshot = checkpoint.stateSnapshot as CheckpointStateSnapshot;
  const currentFiles = await storage.getFiles(checkpoint.projectId);

  const snapshotMap = new Map(snapshot.files.map(f => [f.filename, f.content]));
  const currentMap = new Map(currentFiles.map(f => [f.filename, f.content]));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: { filename: string; current: string; checkpoint: string }[] = [];

  for (const [filename] of currentMap) {
    if (!snapshotMap.has(filename)) {
      added.push(filename);
    }
  }

  for (const [filename, content] of snapshotMap) {
    if (!currentMap.has(filename)) {
      removed.push(filename);
    } else if (currentMap.get(filename) !== content) {
      modified.push({ filename, current: currentMap.get(filename)!, checkpoint: content });
    }
  }

  return { added, removed, modified };
}
