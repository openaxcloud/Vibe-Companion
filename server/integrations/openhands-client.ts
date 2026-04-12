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
    return !!this.config.serverUrl && !!this.config.apiKey;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) h["Authorization"] = `Bearer ${this.config.apiKey}`;
    return h;
  }

  async checkHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const healthEndpoints = [
        `${this.config.serverUrl}/api/health`,
        `${this.config.serverUrl}/api/options/defaults`,
      ];
      for (const url of healthEndpoints) {
        try {
          const res = await fetch(url, {
            headers: this.headers,
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const data = await res.json();
              return { ok: true, version: data.version || "cloud" };
            }
            return { ok: true, version: "cloud" };
          }
        } catch {}
      }
      const listRes = await fetch(`${this.config.serverUrl}/api/conversations`, {
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });
      if (listRes.ok || listRes.status === 401 || listRes.status === 403) {
        return { ok: listRes.ok, version: "cloud", error: listRes.ok ? undefined : "auth failed" };
      }
      return { ok: false, error: `HTTP ${listRes.status}` };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async createConversation(initialMessage: string): Promise<string> {
    const body: Record<string, any> = {
      initial_user_msg: initialMessage,
    };

    let res = await fetch(`${this.config.serverUrl}/api/conversations`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok && res.status === 422) {
      res = await fetch(`${this.config.serverUrl}/api/conversations`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000),
      });
    }

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

    if (initialMessage && conversationId) {
      try {
        await this.sendMessage(conversationId, initialMessage);
      } catch {}
    }

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

  async waitForReady(conversationId: string, maxWaitMs = 120000): Promise<string> {
    const start = Date.now();
    const interval = 3000;
    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(
          `${this.config.serverUrl}/api/conversations/${conversationId}`,
          { headers: this.headers, signal: AbortSignal.timeout(10000) },
        );
        if (res.ok) {
          const data = await res.json();
          const status = (data.status || "").toUpperCase();
          if (status === "RUNNING" || status === "AWAITING_USER_INPUT" || status === "FINISHED") {
            return status;
          }
          if (status === "ERROR" || status === "STOPPED") {
            throw new Error(`OpenHands conversation ${status}`);
          }
        }
      } catch (err: any) {
        if (err.message?.includes("conversation")) throw err;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error("OpenHands sandbox startup timed out");
  }

  async *streamEvents(conversationId: string): AsyncGenerator<OpenHandsEvent> {
    await this.waitForReady(conversationId);

    const pollUrl = `${this.config.serverUrl}/api/conversations/${conversationId}/events`;
    let lastEventId = -1;
    let emptyPolls = 0;
    const maxEmptyPolls = 40;

    while (emptyPolls < maxEmptyPolls) {
      try {
        const res = await fetch(
          `${pollUrl}?start_id=${lastEventId + 1}&limit=50`,
          { headers: this.headers, signal: AbortSignal.timeout(15000) },
        );

        if (!res.ok) {
          emptyPolls++;
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const data = await res.json();
        const events: any[] = data.events || (Array.isArray(data) ? data : []);

        if (events.length === 0) {
          emptyPolls++;
          const statusRes = await fetch(
            `${this.config.serverUrl}/api/conversations/${conversationId}`,
            { headers: this.headers, signal: AbortSignal.timeout(10000) },
          ).catch(() => null);
          if (statusRes?.ok) {
            const statusData = await statusRes.json();
            const s = (statusData.status || "").toUpperCase();
            if (s === "FINISHED" || s === "STOPPED" || s === "ERROR") break;
            if (s === "AWAITING_USER_INPUT") break;
          }
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        emptyPolls = 0;
        for (const event of events) {
          const eid = event.id ?? event.event_id ?? -1;
          if (typeof eid === "number" && eid > lastEventId) lastEventId = eid;

          const mapped: OpenHandsEvent = {
            id: eid,
            timestamp: event.timestamp || new Date().toISOString(),
            source: event.source || "agent",
            action: event.action,
            observation: event.observation,
            message: event.message || event.content,
            content: event.content,
            args: event.args,
            extras: event.extras,
          };

          const session = this.sessions.get(conversationId);
          if (session) session.events.push(mapped);
          this.emit("event", conversationId, mapped);
          yield mapped;

          const act = event.action || event.observation || "";
          if (act === "finish" || act === "agent_finish") return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") break;
        emptyPolls++;
        await new Promise((r) => setTimeout(r, 2000));
      }
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
    const apiKey = process.env.OPENHANDS_API_KEY || "";
    const serverUrl = process.env.OPENHANDS_SERVER_URL || (apiKey ? "https://app.all-hands.dev" : "");
    client = new OpenHandsClient({
      serverUrl,
      apiKey,
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
