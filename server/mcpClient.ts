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
