export async function mergeTaskToMain(taskId: string, projectId: string): Promise<any> {
  return { success: true, taskId, merged: true };
}

export async function getTaskDiff(taskId: string): Promise<any> {
  return { files: [], additions: 0, deletions: 0 };
}

export async function resolveConflict(taskId: string, filePath: string, resolution: string): Promise<any> {
  return { success: true, filePath };
}
