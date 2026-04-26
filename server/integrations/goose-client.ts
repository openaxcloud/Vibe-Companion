import { EventEmitter } from "events";

export interface GooseConfig {
  serverUrl: string;
  apiKey?: string;
  provider?: string;
  model?: string;
  timeout?: number;
}

export interface GooseMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | GooseContentBlock[];
}

export interface GooseContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  content?: string;
  is_error?: boolean;
}

export interface GooseSession {
  sessionId: string;
  status: "active" | "completed" | "error" | "stopped";
  messages: GooseMessage[];
  workingDirectory?: string;
}

export interface GooseToolEvent {
  type: "tool_use" | "tool_result" | "text" | "error" | "status";
  name?: string;
  content?: string;
  args?: Record<string, any>;
  is_error?: boolean;
}

export class GooseClient extends EventEmitter {
  private config: GooseConfig;
  private sessions: Map<string, GooseSession> = new Map();

  constructor(config: GooseConfig) {
    super();
    this.config = {
      provider: "anthropic",
      model: "claude-opus-4-7",
      timeout: 300000,
      ...config,
    };
  }

  get isConfigured(): boolean {
    return !!this.config.serverUrl;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) h["Authorization"] = `Bearer ${this.config.apiKey}`;
    return h;
  }

  async checkHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const res = await fetch(`${this.config.serverUrl}/api/health`, {
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json().catch(() => ({}));
      return { ok: true, version: data.version || "unknown" };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async createSession(workingDirectory?: string): Promise<string> {
    const res = await fetch(`${this.config.serverUrl}/api/sessions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        working_directory: workingDirectory || "/workspace",
        provider: this.config.provider,
        model: this.config.model,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Goose createSession failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const sessionId = data.session_id || data.id;

    this.sessions.set(sessionId, {
      sessionId,
      status: "active",
      messages: [],
      workingDirectory,
    });

    return sessionId;
  }

  async sendMessage(sessionId: string, message: string): Promise<GooseMessage> {
    const res = await fetch(`${this.config.serverUrl}/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        role: "user",
        content: [{ type: "text", text: message }],
      }),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new Error(`Goose sendMessage failed: ${res.status}`);
    }

    const data = await res.json();
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push({ role: "user", content: message });
      session.messages.push(data);
    }

    return data;
  }

  async *streamMessage(sessionId: string, message: string): AsyncGenerator<GooseToolEvent> {
    const res = await fetch(`${this.config.serverUrl}/api/sessions/${sessionId}/messages/stream`, {
      method: "POST",
      headers: { ...this.headers, Accept: "text/event-stream" },
      body: JSON.stringify({
        role: "user",
        content: [{ type: "text", text: message }],
      }),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new Error(`Goose stream failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: GooseToolEvent = JSON.parse(line.slice(6));
              this.emit("event", sessionId, event);
              yield event;
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    await fetch(`${this.config.serverUrl}/api/sessions/${sessionId}/stop`, {
      method: "POST",
      headers: this.headers,
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});

    const session = this.sessions.get(sessionId);
    if (session) session.status = "stopped";
  }

  async listSessions(): Promise<{ id: string; status: string; created_at?: string }[]> {
    const res = await fetch(`${this.config.serverUrl}/api/sessions`, {
      headers: this.headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.sessions || [];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`${this.config.serverUrl}/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.headers,
      signal: AbortSignal.timeout(10000),
    });
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): GooseSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateConfig(config: Partial<GooseConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): GooseConfig {
    return { ...this.config };
  }
}

import { validateServerUrl } from "./openhands-client";
export { validateServerUrl };

const _instances = new Map<string, GooseClient>();

export function getGooseClient(userId?: string): GooseClient {
  const key = userId || "__default__";
  let client = _instances.get(key);
  if (!client) {
    client = new GooseClient({
      serverUrl: process.env.GOOSE_SERVER_URL || "",
      apiKey: process.env.GOOSE_API_KEY || "",
      provider: process.env.GOOSE_PROVIDER || "anthropic",
      model: process.env.GOOSE_MODEL || "claude-opus-4-7",
    });
    _instances.set(key, client);
  }
  return client;
}

export function resetGooseClient(userId?: string): void {
  const key = userId || "__default__";
  _instances.delete(key);
}
