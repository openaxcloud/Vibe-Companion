export async function executeTask(taskId: string, context: any): Promise<any> {
  return { taskId, status: "completed", result: null };
}

export async function cancelTask(taskId: string): Promise<void> {}

export function getTaskStatus(taskId: string): string {
  return "idle";
}
