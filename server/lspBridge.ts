import type { WebSocket } from "ws";

export function handleLSPConnection(ws: WebSocket, projectId: string, language: string): void {
  console.log(`[lsp] LSP connection for ${language} in project ${projectId}`);
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === "initialize") {
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { triggerCharacters: [".", "/"] },
              hoverProvider: true,
            },
          },
        }));
      }
    } catch (err: any) { console.error("[catch]", err?.message || err);}
  });
  ws.on("close", () => {
    console.log(`[lsp] LSP connection closed for project ${projectId}`);
  });
}
