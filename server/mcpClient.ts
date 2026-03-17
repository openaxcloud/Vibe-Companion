import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface McpToolCallResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, any>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class McpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private rawBuffer = Buffer.alloc(0);
  private nextId = 1;
  private pendingRequests = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private initialized = false;
  private _status: "stopped" | "starting" | "running" | "error" = "stopped";
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private idleTimeoutMs = 5 * 60 * 1000;
  private _logs: string[] = [];
  private maxLogs = 200;

  get status() { return this._status; }
  get logs() { return this._logs; }

  private addLog(msg: string): void {
    const ts = new Date().toISOString();
    this._logs.push(`[${ts}] ${msg}`);
    if (this._logs.length > this.maxLogs) this._logs = this._logs.slice(-this.maxLogs);
    this.emit("log", msg);
  }

  constructor(command: string, args: string[] = [], env: Record<string, string> = {}) {
    super();
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "starting";
    this.emit("status", this._status);

    return new Promise((resolve, reject) => {
      try {
        const ALLOWED_ENV_KEYS = new Set([
          "PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "NODE_PATH",
          "NODE_ENV", "TMPDIR", "TMP", "TEMP",
          "MCP_DATABASE_URL", "PROJECT_DATABASE_URL",
        ]);
        const safeEnv: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (ALLOWED_ENV_KEYS.has(k) && v !== undefined) safeEnv[k] = v;
        }
        Object.assign(safeEnv, this.env);

        this.process = spawn(this.command, this.args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: safeEnv,
        });

        this.process.stdout!.on("data", (data: Buffer) => {
          this.rawBuffer = Buffer.concat([this.rawBuffer, data]);
          this.processBuffer();
        });

        this.process.stderr!.on("data", (data: Buffer) => {
          this.addLog(data.toString().trim());
        });

        this.process.on("error", (err) => {
          this._status = "error";
          this.emit("status", this._status);
          this.emit("error", err);
          reject(err);
        });

        this.process.on("exit", (code) => {
          const wasRunning = this._status === "running";
          this._status = "stopped";
          this.emit("status", this._status);
          this.emit("exit", code);
          this.cleanup();
          if (wasRunning && code !== 0) {
            this.addLog(`MCP server exited unexpectedly (code ${code}), attempting restart...`);
            setTimeout(() => {
              this.start().catch((err) => {
                this.addLog(`Auto-restart failed: ${err.message}`);
                this._status = "error";
                this.emit("status", this._status);
              });
            }, 2000);
          }
        });

        this.initialize()
          .then(() => {
            this._status = "running";
            this.emit("status", this._status);
            this.startHealthCheck();
            this.resetIdleTimer();
            resolve();
          })
          .catch((err) => {
            this._status = "error";
            this.emit("status", this._status);
            this.stop();
            reject(err);
          });
      } catch (err: any) {
        this._status = "error";
        this.emit("status", this._status);
        reject(err);
      }
    });
  }

  async stop(): Promise<void> {
    this.stopHealthCheck();
    this.stopIdleTimer();
    if (this.process) {
      this.process.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process) this.process.kill("SIGKILL");
          resolve();
        }, 5000);
        this.process!.on("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.cleanup();
    this._status = "stopped";
    this.emit("status", this._status);
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(async () => {
      this.addLog("MCP server idle timeout reached, stopping");
      await this.stop().catch(() => {});
    }, this.idleTimeoutMs);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.initialized) throw new Error("MCP server not initialized");
    this.resetIdleTimer();
    const result = await this.sendRequest("tools/list", {});
    return (result.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || {},
    }));
  }

  async callTool(name: string, args: Record<string, any>): Promise<McpToolCallResult> {
    if (!this.initialized) throw new Error("MCP server not initialized");
    this.resetIdleTimer();
    const result = await this.sendRequest("tools/call", { name, arguments: args });
    return {
      content: result.content || [{ type: "text", text: JSON.stringify(result) }],
      isError: result.isError || false,
    };
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "replit-ide", version: "1.0.0" },
    });
    this.initialized = true;
    await this.sendNotification("notifications/initialized", {});
    return result;
  }

  private writeMessage(msg: object): void {
    if (!this.process?.stdin?.writable) return;
    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.process.stdin.write(header + body);
  }

  private sendRequest(method: string, params: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        return reject(new Error("MCP server not running"));
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.writeMessage(request);
    });
  }

  private sendNotification(method: string, params: Record<string, any>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        return reject(new Error("MCP server not running"));
      }
      const notification = { jsonrpc: "2.0", method, params };
      this.writeMessage(notification);
      resolve();
    });
  }

  private processBuffer(): void {
    const SEPARATOR = Buffer.from("\r\n\r\n");
    const NEWLINE = 0x0a;
    const CL_PREFIX = Buffer.from("Content-Length:");

    while (this.rawBuffer.length > 0) {
      const sepIdx = this.rawBuffer.indexOf(SEPARATOR);

      if (sepIdx === -1) {
        if (!this.rawBuffer.slice(0, Math.min(20, this.rawBuffer.length)).includes(CL_PREFIX[0])) {
          const nlIdx = this.rawBuffer.indexOf(NEWLINE);
          if (nlIdx !== -1) {
            const line = this.rawBuffer.slice(0, nlIdx).toString("utf8").trim();
            this.rawBuffer = this.rawBuffer.slice(nlIdx + 1);
            if (line) this.handleJsonMessage(line);
            continue;
          }
        }
        break;
      }

      const headerStr = this.rawBuffer.slice(0, sepIdx).toString("utf8");
      const clMatch = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!clMatch) {
        this.rawBuffer = this.rawBuffer.slice(sepIdx + 4);
        continue;
      }
      const contentLength = parseInt(clMatch[1], 10);
      const bodyStart = sepIdx + 4;
      if (this.rawBuffer.length - bodyStart < contentLength) break;

      const body = this.rawBuffer.slice(bodyStart, bodyStart + contentLength).toString("utf8");
      this.rawBuffer = this.rawBuffer.slice(bodyStart + contentLength);
      this.handleJsonMessage(body);
    }
  }

  private handleJsonMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as JsonRpcResponse;
      if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch {
      this.addLog(`MCP parse error: ${raw.slice(0, 200)}`);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      if (this.process && !this.process.killed) {
        return;
      }
      this._status = "error";
      this.emit("status", this._status);
      this.stopHealthCheck();
    }, 10000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private cleanup(): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("MCP server stopped"));
    }
    this.pendingRequests.clear();
    this.rawBuffer = Buffer.alloc(0);
    this.initialized = false;
    this.process = null;
  }
}

const activeClients = new Map<string, McpClient>();

export function getClient(serverId: string): McpClient | undefined {
  return activeClients.get(serverId);
}

export async function startClient(serverId: string, command: string, args: string[], env: Record<string, string>): Promise<McpClient> {
  let client = activeClients.get(serverId);
  if (client && client.status === "running") return client;

  if (client) {
    await client.stop().catch(() => {});
  }

  client = new McpClient(command, args, env);
  activeClients.set(serverId, client);
  await client.start();
  return client;
}

export async function stopClient(serverId: string): Promise<void> {
  const client = activeClients.get(serverId);
  if (client) {
    await client.stop();
    activeClients.delete(serverId);
  }
}

export async function stopAllClients(): Promise<void> {
  for (const [id] of activeClients) {
    await stopClient(id);
  }
}

export function getActiveClientIds(): string[] {
  return Array.from(activeClients.keys());
}

const SUSPICIOUS_TOOL_PATTERNS = [
  /exec(ute)?[_\s]?(command|shell|bash|sh|cmd)/i,
  /run[_\s]?(command|shell|process)/i,
  /system[_\s]?(call|exec)/i,
  /eval(uate)?[_\s]?code/i,
  /file[_\s]?(delete|remove|write|overwrite)/i,
  /drop[_\s]?(table|database|collection)/i,
  /rm\s+-rf/i,
  /format[_\s]?disk/i,
  /\bsudo\b/i,
  /password|secret|credential|private[_\s]?key/i,
];

const SUSPICIOUS_DESCRIPTION_PATTERNS = [
  /execute arbitrary/i,
  /run any command/i,
  /unrestricted access/i,
  /bypass security/i,
  /delete all/i,
  /root access/i,
  /admin privilege/i,
];

export function scanToolSecurity(tool: McpToolDefinition): { safe: boolean; reason?: string } {
  for (const pattern of SUSPICIOUS_TOOL_PATTERNS) {
    if (pattern.test(tool.name)) {
      return { safe: false, reason: `Tool name matches suspicious pattern: ${tool.name}` };
    }
  }
  for (const pattern of SUSPICIOUS_DESCRIPTION_PATTERNS) {
    if (pattern.test(tool.description)) {
      return { safe: false, reason: `Tool description contains suspicious content` };
    }
  }
  if (tool.inputSchema) {
    const schemaStr = JSON.stringify(tool.inputSchema);
    if (schemaStr.length > 50000) {
      return { safe: false, reason: "Tool schema is suspiciously large" };
    }
  }
  return { safe: true };
}

export function scanAllTools(tools: McpToolDefinition[]): { safe: McpToolDefinition[]; blocked: { tool: McpToolDefinition; reason: string }[] } {
  const safe: McpToolDefinition[] = [];
  const blocked: { tool: McpToolDefinition; reason: string }[] = [];
  for (const tool of tools) {
    const result = scanToolSecurity(tool);
    if (result.safe) {
      safe.push(tool);
    } else {
      blocked.push({ tool, reason: result.reason! });
    }
  }
  return { safe, blocked };
}

const DANGEROUS_ARG_PATTERNS = [
  /;\s*(rm|del|format|shutdown|reboot|kill|pkill)\b/i,
  /\|\s*(bash|sh|cmd|powershell)\b/i,
  /`[^`]*`/,
  /\$\([^)]+\)/,
  /&&\s*(rm|del|curl|wget|nc)\b/i,
  />\s*\/dev\//i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /__proto__|constructor\s*\[|prototype\s*\[/i,
];

export function scanToolCallArgs(toolName: string, args: Record<string, unknown>): { safe: boolean; reason?: string } {
  const argsStr = JSON.stringify(args);

  if (argsStr.length > 100000) {
    return { safe: false, reason: "Tool call arguments are suspiciously large" };
  }

  for (const pattern of DANGEROUS_ARG_PATTERNS) {
    if (pattern.test(argsStr)) {
      return { safe: false, reason: `Tool call arguments contain potentially dangerous content matching: ${pattern.source}` };
    }
  }

  const stringValues = extractStringValues(args);
  for (const val of stringValues) {
    for (const pattern of DANGEROUS_ARG_PATTERNS) {
      if (pattern.test(val)) {
        return { safe: false, reason: `Argument value contains potentially dangerous content` };
      }
    }
  }

  return { safe: true };
}

function extractStringValues(obj: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  if (typeof obj === "string") return [obj];
  if (Array.isArray(obj)) return obj.flatMap(v => extractStringValues(v, depth + 1));
  if (obj && typeof obj === "object") return Object.values(obj).flatMap(v => extractStringValues(v, depth + 1));
  return [];
}

interface RemoteMcpClient {
  serverId: string;
  baseUrl: string;
  headers: Record<string, string>;
  tools: McpToolDefinition[];
  connected: boolean;
  messageEndpoint: string | null;
}

const remoteClients = new Map<string, RemoteMcpClient>();

function validateRemoteUrl(baseUrl: string): { valid: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
  if (url.protocol !== "https:") {
    return { valid: false, error: "MCP server URL must use HTTPS" };
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
      host === "[::1]" || host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".local") || host.endsWith(".internal")) {
    return { valid: false, error: "URL must not point to internal/private hosts" };
  }
  return { valid: true };
}

function validateDiscoveredEndpoint(discoveredUrl: string, originalSseUrl: string): string | null {
  let resolved: URL;
  try {
    resolved = new URL(discoveredUrl, originalSseUrl);
  } catch {
    return null;
  }

  if (resolved.protocol !== "https:") {
    return null;
  }

  const originalHost = new URL(originalSseUrl).hostname.toLowerCase();
  const discoveredHost = resolved.hostname.toLowerCase();
  if (discoveredHost !== originalHost) {
    return null;
  }

  const hostValidation = validateRemoteUrl(resolved.toString());
  if (!hostValidation.valid) {
    return null;
  }

  return resolved.toString();
}

async function discoverSseMessageEndpoint(sseUrl: string, headers: Record<string, string>): Promise<string | null> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); resolve(null); }, 10000);

    function resolveEndpoint(rawEndpoint: string): void {
      const validated = validateDiscoveredEndpoint(rawEndpoint, sseUrl);
      clearTimeout(timeout);
      controller.abort();
      resolve(validated);
    }

    fetch(sseUrl, {
      method: "GET",
      headers: { Accept: "text/event-stream", ...headers },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok || !response.body) {
          clearTimeout(timeout);
          resolve(null);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read(): void {
          reader.read().then(({ done, value }) => {
            if (done) { clearTimeout(timeout); resolve(null); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.endpoint || parsed.messageEndpoint || parsed.uri) {
                    const endpoint = parsed.endpoint || parsed.messageEndpoint || parsed.uri;
                    resolveEndpoint(endpoint);
                    return;
                  }
                } catch {}
              }
              if (line.startsWith("event: endpoint")) {
                const nextDataLine = lines[lines.indexOf(line) + 1];
                if (nextDataLine?.startsWith("data:")) {
                  const endpoint = nextDataLine.slice(5).trim();
                  resolveEndpoint(endpoint);
                  return;
                }
              }
            }
            buffer = lines[lines.length - 1] || "";
            read();
          }).catch(() => { clearTimeout(timeout); resolve(null); });
        }
        read();
      })
      .catch(() => { clearTimeout(timeout); resolve(null); });
  });
}

async function sendJsonRpc(url: string, method: string, params: Record<string, unknown> | undefined, headers: Record<string, string>, timeoutMs = 15000): Promise<JsonRpcResponse | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", method, id: Date.now(), params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function testRemoteConnection(baseUrl: string, headers: Record<string, string> = {}): Promise<{ success: boolean; message: string; toolCount?: number }> {
  const validation = validateRemoteUrl(baseUrl);
  if (!validation.valid) {
    return { success: false, message: validation.error! };
  }

  try {
    const isSseUrl = /\/sse\/?$/.test(baseUrl);

    if (isSseUrl) {
      const messageEndpoint = await discoverSseMessageEndpoint(baseUrl, headers);
      if (messageEndpoint) {
        const initResp = await sendJsonRpc(messageEndpoint, "initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "replit-agent", version: "1.0.0" },
        }, headers);
        if (initResp?.result?.serverInfo) {
          return { success: true, message: `Connected via SSE to ${initResp.result.serverInfo.name || "MCP server"} v${initResp.result.serverInfo.version || "unknown"}` };
        }
        return { success: true, message: "Connected via SSE (message endpoint discovered)" };
      }
    }

    const httpUrl = baseUrl.replace(/\/sse\/?$/, "");
    const initResp = await sendJsonRpc(httpUrl, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "replit-agent", version: "1.0.0" },
    }, headers);

    if (initResp?.result?.serverInfo) {
      return { success: true, message: `Connected to ${initResp.result.serverInfo.name || "MCP server"} v${initResp.result.serverInfo.version || "unknown"}` };
    }

    if (initResp?.result) {
      return { success: true, message: "Server responded to MCP initialize" };
    }

    return { success: false, message: "Server did not respond to MCP initialize handshake. Ensure it supports the MCP protocol." };
  } catch (err: any) {
    const msg = err.name === "TimeoutError" ? "Connection timed out" : (err.message || "Connection failed");
    return { success: false, message: msg };
  }
}

export async function connectRemoteServer(
  serverId: string,
  baseUrl: string,
  headers: Record<string, string> = {}
): Promise<{ success: boolean; tools: McpToolDefinition[]; blocked: { tool: McpToolDefinition; reason: string }[]; error?: string }> {
  const validation = validateRemoteUrl(baseUrl);
  if (!validation.valid) {
    return { success: false, tools: [], blocked: [], error: validation.error };
  }

  try {
    let messageEndpoint: string | null = null;
    const isSseUrl = /\/sse\/?$/.test(baseUrl);

    if (isSseUrl) {
      messageEndpoint = await discoverSseMessageEndpoint(baseUrl, headers);
    }

    const rpcUrl = messageEndpoint || baseUrl.replace(/\/sse\/?$/, "");

    const initResp = await sendJsonRpc(rpcUrl, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "replit-agent", version: "1.0.0" },
    }, headers);

    if (!initResp || initResp.error) {
      const errMsg = initResp?.error?.message || "Server did not respond to initialize handshake";
      return { success: false, tools: [], blocked: [], error: errMsg };
    }

    await sendJsonRpc(rpcUrl, "notifications/initialized", undefined, headers).catch(() => {});

    let rawTools: McpToolDefinition[] = [];

    const toolsResp = await sendJsonRpc(rpcUrl, "tools/list", undefined, headers);
    if (toolsResp?.result?.tools) {
      rawTools = (toolsResp.result.tools as any[]).map((t: any) => ({
        name: t.name,
        description: t.description || "",
        inputSchema: t.inputSchema || {},
      }));
    }

    if (rawTools.length === 0 && !messageEndpoint) {
      const altUrl = `${rpcUrl}/tools/list`;
      const altResp = await sendJsonRpc(altUrl, "tools/list", undefined, headers);
      if (altResp?.result?.tools) {
        rawTools = (altResp.result.tools as any[]).map((t: any) => ({
          name: t.name,
          description: t.description || "",
          inputSchema: t.inputSchema || {},
        }));
      }
    }

    const { safe, blocked } = scanAllTools(rawTools);

    const client: RemoteMcpClient = {
      serverId,
      baseUrl,
      headers,
      tools: safe,
      connected: true,
      messageEndpoint,
    };
    remoteClients.set(serverId, client);

    return { success: true, tools: safe, blocked };
  } catch (err: any) {
    const errorMsg = err.name === "TimeoutError" ? "Connection timed out (15s)" : (err.message || "Unknown error");
    return { success: false, tools: [], blocked: [], error: errorMsg };
  }
}

export async function callRemoteTool(
  serverId: string,
  toolName: string,
  args: Record<string, any>,
  baseUrl?: string,
  headers?: Record<string, string>
): Promise<string> {
  let client = remoteClients.get(serverId);

  if (!client && baseUrl) {
    const result = await connectRemoteServer(serverId, baseUrl, headers || {});
    if (!result.success) {
      throw new Error(`Failed to connect to MCP server: ${result.error}`);
    }
    client = remoteClients.get(serverId);
  }

  if (!client) {
    throw new Error("MCP server not connected");
  }

  const argScan = scanToolCallArgs(toolName, args);
  if (!argScan.safe) {
    throw new Error(`Security scanner blocked tool call: ${argScan.reason}`);
  }

  const rpcUrl = client.messageEndpoint || client.baseUrl.replace(/\/sse\/?$/, "");

  const data = await sendJsonRpc(rpcUrl, "tools/call", { name: toolName, arguments: args }, client.headers, 30000);

  if (!data) {
    throw new Error("Tool call failed: no response from server");
  }

  if (data.error) {
    throw new Error(data.error.message || "Tool call returned an error");
  }

  const content = data.result?.content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => {
        if (c.type === "text") return c.text;
        if (c.type === "image") return `[Image: ${c.mimeType || "image"}]`;
        return JSON.stringify(c);
      })
      .join("\n");
  }

  return JSON.stringify(data.result || data);
}

export function getRemoteClient(serverId: string): RemoteMcpClient | undefined {
  return remoteClients.get(serverId);
}

export function disconnectRemoteClient(serverId: string): void {
  remoteClients.delete(serverId);
}
