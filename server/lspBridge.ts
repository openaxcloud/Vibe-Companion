import { WebSocket } from "ws";
import { log } from "./index";
import {
  startLSPServer,
  sendToLSP,
  stopLSPServer,
  stopAllLSPServers,
  isLSPRunning,
  getLSPStatus,
  detectProjectLanguage,
  isLSPInitialized,
  markLSPInitialized,
  onLSPCrash,
  type LSPLanguage,
} from "./lspManager";
import * as path from "path";

let clientIdCounter = 0;
let crashHandlerRegistered = false;

function ensureCrashHandler(): void {
  if (crashHandlerRegistered) return;
  crashHandlerRegistered = true;
  onLSPCrash((projectId, language, restarting) => {
    initializedServers.delete(serverInitKey(projectId, language));
    broadcastToProjectClients(projectId, {
      type: "lsp:serverCrashed",
      language,
      restarting,
      status: getLSPStatus(projectId),
    });
  });
}

interface LSPClientConnection {
  ws: WebSocket;
  clientId: number;
  projectId: string;
  userId: string;
  activeLanguages: Set<LSPLanguage>;
  openDocuments: Set<string>;
}

const lspClients = new Map<WebSocket, LSPClientConnection>();
const projectLSPClients = new Map<string, Set<WebSocket>>();

const requestIdMap = new Map<string, { ws: WebSocket; originalId: number | string; isInitialize?: boolean }>();
let globalRequestIdCounter = 0;
const initializedServers = new Set<string>();
const serverCapabilities = new Map<string, any>();

function serverInitKey(projectId: string, language: string): string {
  return `${projectId}:${language}`;
}

function makeGlobalRequestId(): number {
  return ++globalRequestIdCounter;
}

function remapRequestKey(globalId: number): string {
  return `req:${globalId}`;
}

export function handleLSPConnection(
  ws: WebSocket,
  projectId: string,
  userId: string,
): void {
  ensureCrashHandler();

  const client: LSPClientConnection = {
    ws,
    clientId: ++clientIdCounter,
    projectId,
    userId,
    activeLanguages: new Set(),
    openDocuments: new Set(),
  };

  lspClients.set(ws, client);

  if (!projectLSPClients.has(projectId)) {
    projectLSPClients.set(projectId, new Set());
  }
  projectLSPClients.get(projectId)!.add(ws);

  log(`LSP Bridge: Client ${client.clientId} connected for project ${projectId}`, "lsp");

  ws.send(JSON.stringify({
    type: "lsp:connected",
    projectId,
    status: getLSPStatus(projectId),
  }));

  ws.on("message", (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      handleLSPMessage(client, data);
    } catch (err) {
      log(`LSP Bridge: Invalid message from client ${client.clientId}: ${err}`, "lsp");
    }
  });

  ws.on("close", () => {
    handleLSPDisconnect(ws);
  });

  ws.on("error", () => {
    handleLSPDisconnect(ws);
  });
}

function handleLSPMessage(client: LSPClientConnection, data: any): void {
  switch (data.type) {
    case "lsp:start":
      handleStartServer(client, data);
      break;

    case "lsp:stop":
      handleStopServer(client, data);
      break;

    case "lsp:request":
    case "lsp:notification":
      handleLSPRequest(client, data);
      break;

    case "lsp:status":
      client.ws.send(JSON.stringify({
        type: "lsp:status",
        status: getLSPStatus(client.projectId),
      }));
      break;

    default:
      break;
  }
}

function handleStartServer(client: LSPClientConnection, data: any): void {
  const language = data.language as LSPLanguage;
  if (!language) return;

  const allowedBase = `/home/runner/workspace`;
  const rawPath = data.rootPath || allowedBase;
  const resolved = path.resolve("/", rawPath);
  const safePath = (resolved === allowedBase || resolved.startsWith(allowedBase + "/")) ? resolved : allowedBase;

  const onMessage = (msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      const hasId = parsed.id !== undefined && parsed.id !== null;
      const hasMethod = !!parsed.method;

      if (hasMethod) {
        broadcastToProjectClients(client.projectId, {
          type: "lsp:message",
          language,
          message: parsed,
        });
      } else if (hasId) {
        const key = remapRequestKey(parsed.id as number);
        const mapping = requestIdMap.get(key);
        requestIdMap.delete(key);

        if (mapping?.isInitialize && !parsed.error) {
          const initKey = serverInitKey(client.projectId, language);
          markLSPInitialized(client.projectId, language);
          initializedServers.add(initKey);
          if (parsed.result?.capabilities) {
            serverCapabilities.set(initKey, parsed.result.capabilities);
          }
        }

        if (mapping && mapping.ws.readyState === WebSocket.OPEN) {
          parsed.id = mapping.originalId;
          try {
            mapping.ws.send(JSON.stringify({
              type: "lsp:message",
              language,
              message: parsed,
            }));
          } catch {}
        }
      }
    } catch (err) {
      log(`LSP Bridge: Failed to parse LSP response: ${err}`, "lsp");
    }
  };

  const alreadyInitialized = isLSPInitialized(client.projectId, language);
  const success = startLSPServer(client.projectId, language, safePath, onMessage);

  client.activeLanguages.add(language);

  const initKey = serverInitKey(client.projectId, language);
  client.ws.send(JSON.stringify({
    type: "lsp:serverStarted",
    language,
    success,
    alreadyInitialized,
    capabilities: alreadyInitialized ? serverCapabilities.get(initKey) : undefined,
    status: getLSPStatus(client.projectId),
  }));
}

function countClientsForLanguage(projectId: string, language: LSPLanguage): number {
  const clients = projectLSPClients.get(projectId);
  if (!clients) return 0;
  let count = 0;
  for (const ws of clients) {
    const c = lspClients.get(ws);
    if (c && c.activeLanguages.has(language)) count++;
  }
  return count;
}

function handleStopServer(client: LSPClientConnection, data: any): void {
  const language = data.language as LSPLanguage;
  if (!language) return;

  client.activeLanguages.delete(language);

  const remainingClients = countClientsForLanguage(client.projectId, language);
  if (remainingClients === 0) {
    const stopKey = serverInitKey(client.projectId, language);
    stopLSPServer(client.projectId, language);
    initializedServers.delete(stopKey);
    serverCapabilities.delete(stopKey);

    broadcastToProjectClients(client.projectId, {
      type: "lsp:serverStopped",
      language,
      status: getLSPStatus(client.projectId),
    });
  }
}

function handleLSPRequest(client: LSPClientConnection, data: any): void {
  const language = data.language as LSPLanguage;
  const message = data.message;

  if (!language || !message) return;

  if (message.method === "textDocument/didOpen") {
    const uri = message.params?.textDocument?.uri;
    if (uri) client.openDocuments.add(uri);
  } else if (message.method === "textDocument/didClose") {
    const uri = message.params?.textDocument?.uri;
    if (uri) client.openDocuments.delete(uri);
  }

  if (message.method === "initialized") {
    const initKey = serverInitKey(client.projectId, language);
    if (initializedServers.has(initKey)) {
      return;
    }
    initializedServers.add(initKey);
  }

  if (data.type === "lsp:request" && message.id !== undefined) {
    const isInit = message.method === "initialize";
    const globalId = makeGlobalRequestId();
    const key = remapRequestKey(globalId);
    requestIdMap.set(key, { ws: client.ws, originalId: message.id, isInitialize: isInit });
    message.id = globalId;
  }

  const msgStr = JSON.stringify(message);
  const sent = sendToLSP(client.projectId, language, msgStr);

  if (!sent && data.type === "lsp:request" && message.id !== undefined) {
    const key = remapRequestKey(message.id as number);
    const mapping = requestIdMap.get(key);
    requestIdMap.delete(key);
    const originalId = mapping ? mapping.originalId : message.id;
    client.ws.send(JSON.stringify({
      type: "lsp:message",
      language,
      message: {
        jsonrpc: "2.0",
        id: originalId,
        error: {
          code: -32600,
          message: `LSP server for ${language} is not running`,
        },
      },
    }));
  }
}

function handleLSPDisconnect(ws: WebSocket): void {
  const client = lspClients.get(ws);
  if (!client) return;

  lspClients.delete(ws);

  for (const [key, mapping] of requestIdMap) {
    if (mapping.ws === ws) {
      requestIdMap.delete(key);
    }
  }

  const projectClients = projectLSPClients.get(client.projectId);
  if (projectClients) {
    projectClients.delete(ws);
    if (projectClients.size === 0) {
      projectLSPClients.delete(client.projectId);
      stopAllLSPServers(client.projectId);
      log(`LSP Bridge: Last client disconnected, stopping all servers for project ${client.projectId}`, "lsp");
    }
  }

  log(`LSP Bridge: Client ${client.clientId} disconnected for project ${client.projectId}`, "lsp");
}

function broadcastToProjectClients(projectId: string, message: any): void {
  const clients = projectLSPClients.get(projectId);
  if (!clients) return;

  const msgStr = JSON.stringify(message);
  for (const ws of clients) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    } catch {}
  }
}

export function cleanupProjectLSP(projectId: string): void {
  stopAllLSPServers(projectId);

  for (const lang of ["typescript", "javascript", "python", "go"] as LSPLanguage[]) {
    const k = serverInitKey(projectId, lang);
    initializedServers.delete(k);
    serverCapabilities.delete(k);
  }

  const clients = projectLSPClients.get(projectId);
  if (clients) {
    for (const ws of clients) {
      lspClients.delete(ws);
    }
    projectLSPClients.delete(projectId);
  }
}
