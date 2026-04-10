export async function mergeTaskBranch(taskId: string, projectId: string): Promise<any> {
  return { success: true, taskId, projectId };
}

export async function createTaskBranch(taskId: string, projectId: string): Promise<string> {
  return `task-${taskId}`;
}

export function getTaskBranchStatus(taskId: string): string {
  return "idle";
}
