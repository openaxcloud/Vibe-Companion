import { EventEmitter } from "events";

export interface OpenHandsConfig {
  serverUrl: string;
  apiKey?: string;
  model?: string;
  maxIterations?: number;
  timeout?: number;
}

export interface OpenHandsEvent {
  id: number;
  timestamp: string;
  source: "agent" | "user" | "environment";
  action?: string;
  observation?: string;
  message?: string;
  content?: string;
  args?: Record<string, any>;
  extras?: Record<string, any>;
}

export interface OpenHandsSession {
  conversationId: string;
  status: "running" | "paused" | "stopped" | "error" | "completed";
  events: OpenHandsEvent[];
}

export class OpenHandsClient extends EventEmitter {
  private config: OpenHandsConfig;
  private sessions: Map<string, OpenHandsSession> = new Map();

  constructor(config: OpenHandsConfig) {
    super();
    this.config = {
      maxIterations: 50,
      timeout: 300000,
      model: "claude-sonnet-4-20250514",
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
      const data = await res.json();
      return { ok: true, version: data.version || "unknown" };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async createConversation(initialMessage: string): Promise<string> {
    const res = await fetch(`${this.config.serverUrl}/api/conversations`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        initial_user_msg: initialMessage,
        selected_repository: null,
        selected_agent: "CodeActAgent",
        selected_model: this.config.model,
        max_iterations: this.config.maxIterations,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenHands createConversation failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const conversationId = data.conversation_id || data.id;

    this.sessions.set(conversationId, {
      conversationId,
      status: "running",
      events: [],
    });

    return conversationId;
  }

  async sendMessage(conversationId: string, message: string): Promise<void> {
    const res = await fetch(
      `${this.config.serverUrl}/api/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ role: "user", content: message }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!res.ok) {
      throw new Error(`OpenHands sendMessage failed: ${res.status}`);
    }
  }

  async *streamEvents(conversationId: string): AsyncGenerator<OpenHandsEvent> {
    const url = `${this.config.serverUrl}/api/conversations/${conversationId}/events/stream`;

    const res = await fetch(url, {
      headers: { ...this.headers, Accept: "text/event-stream" },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new Error(`OpenHands stream failed: ${res.status}`);
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
              const event: OpenHandsEvent = JSON.parse(line.slice(6));
              const session = this.sessions.get(conversationId);
              if (session) session.events.push(event);
              this.emit("event", conversationId, event);
              yield event;
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getEvents(conversationId: string): Promise<OpenHandsEvent[]> {
    const res = await fetch(
      `${this.config.serverUrl}/api/conversations/${conversationId}/events`,
      { headers: this.headers, signal: AbortSignal.timeout(15000) },
    );

    if (!res.ok) throw new Error(`OpenHands getEvents failed: ${res.status}`);
    return res.json();
  }

  async stopConversation(conversationId: string): Promise<void> {
    await fetch(`${this.config.serverUrl}/api/conversations/${conversationId}/stop`, {
      method: "POST",
      headers: this.headers,
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});

    const session = this.sessions.get(conversationId);
    if (session) session.status = "stopped";
  }

  async listConversations(): Promise<
    { id: string; created_at: string; status: string; title?: string }[]
  > {
    const res = await fetch(`${this.config.serverUrl}/api/conversations`, {
      headers: this.headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.conversations || [];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await fetch(`${this.config.serverUrl}/api/conversations/${conversationId}`, {
      method: "DELETE",
      headers: this.headers,
      signal: AbortSignal.timeout(10000),
    });
    this.sessions.delete(conversationId);
  }

  getSession(conversationId: string): OpenHandsSession | undefined {
    return this.sessions.get(conversationId);
  }

  updateConfig(config: Partial<OpenHandsConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): OpenHandsConfig {
    return { ...this.config };
  }
}

export function validateServerUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === "metadata.google.internal" || host.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

const _instances = new Map<string, OpenHandsClient>();

export function getOpenHandsClient(userId?: string): OpenHandsClient {
  const key = userId || "__default__";
  let client = _instances.get(key);
  if (!client) {
    client = new OpenHandsClient({
      serverUrl: process.env.OPENHANDS_SERVER_URL || "",
      apiKey: process.env.OPENHANDS_API_KEY || "",
      model: process.env.OPENHANDS_MODEL || "claude-sonnet-4-20250514",
    });
    _instances.set(key, client);
  }
  return client;
}

export function resetOpenHandsClient(userId?: string): void {
  const key = userId || "__default__";
  _instances.delete(key);
}
