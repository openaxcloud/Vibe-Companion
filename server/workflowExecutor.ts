type BroadcastFn = (projectId: string, data: any) => void;
let broadcastFn: BroadcastFn | null = null;

export function setBroadcastFn(fn: BroadcastFn) {
  broadcastFn = fn;
}

export async function fireTrigger(projectId: string, trigger: string) {
  if (broadcastFn) {
    broadcastFn(projectId, { type: "workflow_trigger", trigger });
  }
}

export async function executeWorkflow(workflowId: string, context: any) {
  return { success: true, workflowId };
}
