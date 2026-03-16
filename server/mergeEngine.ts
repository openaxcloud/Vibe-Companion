import { storage } from "./storage";
import { log } from "./index";

export interface MergeConflict {
  filename: string;
  type: "modified_both" | "deleted_in_main" | "deleted_in_task";
  mainContent?: string;
  taskContent?: string;
  originalContent?: string;
}

export interface MergeResult {
  success: boolean;
  appliedFiles: string[];
  conflicts: MergeConflict[];
  error?: string;
}

function threeWayMerge(original: string, main: string, task: string): { merged: string; hasConflict: boolean } {
  if (main === task) return { merged: main, hasConflict: false };
  if (main === original) return { merged: task, hasConflict: false };
  if (task === original) return { merged: main, hasConflict: false };

  const origLines = original.split("\n");
  const mainLines = main.split("\n");
  const taskLines = task.split("\n");

  const result: string[] = [];
  let hasConflict = false;
  const maxLen = Math.max(origLines.length, mainLines.length, taskLines.length);

  for (let i = 0; i < maxLen; i++) {
    const origLine = i < origLines.length ? origLines[i] : undefined;
    const mainLine = i < mainLines.length ? mainLines[i] : undefined;
    const taskLine = i < taskLines.length ? taskLines[i] : undefined;

    if (mainLine === taskLine) {
      if (mainLine !== undefined) result.push(mainLine);
    } else if (mainLine === origLine) {
      if (taskLine !== undefined) result.push(taskLine);
    } else if (taskLine === origLine) {
      if (mainLine !== undefined) result.push(mainLine);
    } else {
      hasConflict = true;
      result.push(`<<<<<<< MAIN`);
      if (mainLine !== undefined) result.push(mainLine);
      result.push(`=======`);
      if (taskLine !== undefined) result.push(taskLine);
      result.push(`>>>>>>> TASK`);
    }
  }

  return { merged: result.join("\n"), hasConflict };
}

export async function mergeTaskToMain(
  taskId: string,
  projectId: string,
): Promise<MergeResult> {
  try {
    const snapshots = await storage.getTaskFileSnapshots(taskId);
    const modifiedSnapshots = snapshots.filter(s => s.isModified);

    if (modifiedSnapshots.length === 0) {
      return { success: true, appliedFiles: [], conflicts: [] };
    }

    const mainFiles = await storage.getFiles(projectId);
    const mainFileMap = new Map(mainFiles.map(f => [f.filename, f]));

    const appliedFiles: string[] = [];
    const conflicts: MergeConflict[] = [];

    for (const snapshot of modifiedSnapshots) {
      const mainFile = mainFileMap.get(snapshot.filename);

      if (!mainFile) {
        const newFile = await storage.createFile(projectId, {
          filename: snapshot.filename,
          content: snapshot.content,
          isBinary: false,
        });
        appliedFiles.push(snapshot.filename);
        continue;
      }

      if (mainFile.content === snapshot.originalContent) {
        await storage.updateFileContent(mainFile.id, snapshot.content);
        appliedFiles.push(snapshot.filename);
        continue;
      }

      const { merged, hasConflict } = threeWayMerge(
        snapshot.originalContent,
        mainFile.content,
        snapshot.content,
      );

      if (hasConflict) {
        conflicts.push({
          filename: snapshot.filename,
          type: "modified_both",
          mainContent: mainFile.content,
          taskContent: snapshot.content,
          originalContent: snapshot.originalContent,
        });
      } else {
        await storage.updateFileContent(mainFile.id, merged);
        appliedFiles.push(snapshot.filename);
      }
    }

    log(`Merged task ${taskId}: ${appliedFiles.length} files applied, ${conflicts.length} conflicts`, "task");

    return {
      success: conflicts.length === 0,
      appliedFiles,
      conflicts,
    };
  } catch (err: any) {
    log(`Merge failed for task ${taskId}: ${err.message}`, "task");
    return {
      success: false,
      appliedFiles: [],
      conflicts: [],
      error: err.message,
    };
  }
}

export async function getTaskDiff(taskId: string): Promise<{ filename: string; added: number; removed: number; modified: boolean }[]> {
  const snapshots = await storage.getTaskFileSnapshots(taskId);
  const diffs: { filename: string; added: number; removed: number; modified: boolean }[] = [];

  for (const snapshot of snapshots) {
    if (!snapshot.isModified) continue;

    const origLines = snapshot.originalContent.split("\n");
    const newLines = snapshot.content.split("\n");

    let added = 0;
    let removed = 0;

    const origSet = new Set(origLines);
    const newSet = new Set(newLines);

    for (const line of newLines) {
      if (!origSet.has(line)) added++;
    }
    for (const line of origLines) {
      if (!newSet.has(line)) removed++;
    }

    diffs.push({
      filename: snapshot.filename,
      added,
      removed,
      modified: true,
    });
  }

  return diffs;
}
