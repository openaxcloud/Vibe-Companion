export async function connectToMcpServer(config: any) {
  return { connected: false, tools: [], resources: [] };
}

export async function callMcpTool(serverId: string, toolName: string, args: any) {
  return { error: "MCP not configured" };
}

export async function listMcpTools(serverId: string) {
  return [];
}

export async function listMcpResources(serverId: string) {
  return [];
}

export async function disconnectMcpServer(serverId: string) {
  return { success: true };
}
