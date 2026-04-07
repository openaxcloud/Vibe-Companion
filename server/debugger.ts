const sessions = new Map<string, { port: number; startedAt: Date; breakpoints: any[] }>();

export function createDebugSession(projectId: string, port?: number): { sessionId: string; port: number } {
  const p = port || 9229;
  sessions.set(projectId, { port: p, startedAt: new Date(), breakpoints: [] });
  return { sessionId: projectId, port: p };
}

export function connectToInspector(projectId: string): { connected: boolean; wsUrl?: string } {
  const session = sessions.get(projectId);
  if (!session) return { connected: false };
  return { connected: true, wsUrl: `ws://localhost:${session.port}` };
}

export async function handleDebugCommand(projectId: string, command: string, params?: any): Promise<any> {
  return { command, status: "ok", result: null };
}

export function getDebugSession(projectId: string): any {
  return sessions.get(projectId) || null;
}

export function cleanupSession(projectId: string): void {
  sessions.delete(projectId);
}

export function getInspectPort(projectId: string): number {
  return sessions.get(projectId)?.port || 9229;
}
