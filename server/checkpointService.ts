import { storage } from "./storage";

export async function createCheckpoint(
  projectId: string,
  userId: string,
  description?: string,
  triggerType: string = "manual",
): Promise<any> {
  try {
    return await storage.createCheckpoint({
      projectId,
      userId,
      aiDescription: description || "Manual checkpoint",
      triggerType,
      fileCount: 0,
      totalSize: 0,
    });
  } catch (err: any) {
    console.error("[checkpoint] Failed to create:", err?.message);
    throw err;
  }
}

export async function restoreCheckpoint(projectId: string, checkpointId: string): Promise<boolean> {
  try {
    const checkpoint = await storage.getCheckpoint(checkpointId);
    if (!checkpoint || checkpoint.projectId !== projectId) {
      throw new Error("Checkpoint not found");
    }
    return true;
  } catch (err: any) {
    console.error("[checkpoint] Failed to restore:", err?.message);
    throw err;
  }
}

export async function getCheckpointDiff(checkpointId: string): Promise<any> {
  return { added: [], modified: [], deleted: [] };
}
