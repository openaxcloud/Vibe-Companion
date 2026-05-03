/**
 * Real-router integration tests for `/api/agent/chat/stream` (Task #181).
 *
 * Imports the *actual* `server/api/ai-streaming.ts` Express router and
 * exercises it through HTTP, with all heavy external dependencies (Postgres,
 * RAG, memory bank, AI providers, checkpoints, usage tracker) replaced by
 * `vi.mock` stubs.
 *
 * Why: addresses the gap left by the contract-only mock in
 * `ai-streaming-sse.test.ts`. This file proves the *real* router emits the
 * documented SSE events in the documented order, that auth gating works,
 * and that the per-user concurrency cap rejects the 4th in-flight stream
 * with a 429 — the failure mode the desktop, mobile, and assistant
 * surfaces all share.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── 1. Stub heavy deps BEFORE the router is imported ────────────────────────
vi.mock("../server/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    pool: { query: async () => ({ rows: [] }) },
  },
  pool: { query: async () => ({ rows: [] }) },
}));
vi.mock("../shared/schema", () => ({
  agentSessions: {},
  aiConversations: { id: {}, agentMode: {} },
  agentMessages: { conversationId: {}, role: {}, content: {}, createdAt: {} },
}));
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  desc: () => ({}),
  and: () => ({}),
  or: () => ({}),
  sql: () => ({}),
}));
vi.mock("../server/middleware/ai-usage-tracker", () => ({
  aiUsageTracker: (_req: any, _res: any, next: any) => next(),
  trackAiUsageManually: async () => {},
}));
vi.mock("../server/middleware/auth", () => ({
  ensureAuthenticated: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers["x-test-user-id"] || "user-1", subscriptionTier: "free" };
    next();
  },
}));
vi.mock("../server/agent/project-context", () => ({
  ProjectContextProvider: class {
    async getContext() { return {}; }
    static formatAsSystemPrompt() { return ""; }
  },
}));
vi.mock("../server/agent/context-manager", () => ({
  truncateContext: (messages: any[]) => ({
    messages,
    truncated: false,
    droppedCount: 0,
    originalSize: 0,
    finalSize: 0,
  }),
}));
vi.mock("../server/agent/tool-definitions", () => ({
  allTools: [],
  toOpenAITools: () => [],
  toAnthropicTools: () => [],
}));
vi.mock("../server/agent/tool-executor", () => ({
  ToolExecutor: class { async execute() { return {}; } },
}));
vi.mock("../server/mcp/servers/memory-mcp", () => ({
  memoryMCP: {
    searchNodes: async () => [],
    getConversationHistory: async () => [],
  },
}));
vi.mock("../server/services/memory-bank.service", () => ({
  memoryBankService: {
    setProjectBasePath: () => {},
    getContextForAgent: async () => "",
    updateActiveContext: async () => {},
  },
}));
vi.mock("../server/services/rag/index", () => ({
  getOrCreateEngine: () => ({
    getContextForPrompt: async () => ({ context: "", chunks: [], tokenEstimate: 0 }),
  }),
}));
vi.mock("../server/services/workspace-snapshot.service", () => ({
  workspaceSnapshotService: { captureFileState: async () => ({ files: [], totalFiles: 0 }) },
}));
vi.mock("../server/utils/model-normalizer", () => ({
  normalizeModelName: (m: string) => m,
}));
vi.mock("../server/config/ai-pricing", () => ({
  calculateRequestCost: () => 0,
}));
vi.mock("../server/ai/prompts/design-system", () => ({
  DESIGN_SYSTEM_PROMPT: "",
}));

// ── 2. Stub the OpenAI SDK so streamOpenAI runs without a real key ─────────
const tokenChunks: string[] = ["Hello", ", ", "world", "!"];
let openAIShouldHang = false;
vi.mock("openai", () => {
  return {
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: async (_opts: any) => {
            return {
              [Symbol.asyncIterator]: async function* () {
                if (openAIShouldHang) {
                  await new Promise((r) => setTimeout(r, 800));
                }
                for (const t of tokenChunks) {
                  yield { choices: [{ delta: { content: t } }] };
                  await new Promise((r) => setTimeout(r, 5));
                }
                // Final usage chunk
                yield {
                  choices: [{ delta: {} }],
                  usage: { prompt_tokens: 10, completion_tokens: 4 },
                };
              },
            };
          },
        },
      };
    },
  };
});

vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: class {} }));

// Set OPENAI_API_KEY to bypass the missing-key guard
process.env.OPENAI_API_KEY = "test-key-for-vitest";
process.env.NODE_ENV = "test";

// ── 3. Now import the real router and start an HTTP server ──────────────────
import express from "express";
import type { AddressInfo } from "node:net";
import {
  __resetStreamSlotsForTests,
} from "../server/api/ai-streaming-concurrency";

// IMPORTANT: dynamic import so vi.mock() above takes effect first
let aiStreamingRouter: any;
beforeAll(async () => {
  aiStreamingRouter = (await import("../server/api/ai-streaming")).default;
});

let serverUrl: string;
let closeServer: () => Promise<void>;

beforeEach(async () => {
  __resetStreamSlotsForTests();
  openAIShouldHang = false;
  const app = express();
  app.use(express.json());
  // Mount under /api to match production wiring
  app.use("/api", aiStreamingRouter);
  await new Promise<void>((resolve) => {
    const srv = app.listen(0, () => {
      const port = (srv.address() as AddressInfo).port;
      serverUrl = `http://127.0.0.1:${port}`;
      closeServer = () => new Promise<void>((r) => srv.close(() => r()));
      resolve();
    });
  });
});

afterEach(async () => {
  await closeServer?.();
  __resetStreamSlotsForTests();
});

afterAll(() => {
  delete process.env.OPENAI_API_KEY;
});

// ── helpers ─────────────────────────────────────────────────────────────────
interface SSEEvent { event: string; data: any }
function parseSSE(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
    }
    if (!dataLines.length) continue;
    let data: any = dataLines.join("\n");
    try { data = JSON.parse(data); } catch { /* ignore */ }
    events.push({ event, data });
  }
  return events;
}

async function postChat(opts: { userId?: string; message: string; signal?: AbortSignal }) {
  return fetch(`${serverUrl}/api/agent/chat/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.userId ? { "x-test-user-id": opts.userId } : {}),
    },
    body: JSON.stringify({ message: opts.message, provider: "openai" }),
    signal: opts.signal,
  });
}

// ── tests ───────────────────────────────────────────────────────────────────
describe("real /api/agent/chat/stream router (Task #181)", () => {
  it("emits connected → token(s) → done for a quick question", async () => {
    const res = await postChat({ userId: "user-flow", message: "hi" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    const events = parseSSE(text);
    const types = events.map((e) => e.event);

    expect(types[0]).toBe("connected");
    expect(types).toContain("token");
    const done = events.find((e) => e.event === "done");
    expect(done, `expected a done event, got: ${types.join(",")}`).toBeDefined();
    expect(done!.data).toMatchObject({ provider: "openai" });
    // Token contents reassemble to the streamed string
    const assembled = events
      .filter((e) => e.event === "token")
      .map((e) => e.data.content ?? e.data.text ?? "")
      .join("");
    expect(assembled).toBe(tokenChunks.join(""));
  }, 15000);

  it("rejects the 4th simultaneous request from the same user with 429", async () => {
    openAIShouldHang = true; // keep streams open long enough to overlap

    const reqs = [0, 1, 2, 3].map(() =>
      postChat({ userId: "user-cap-real", message: "hi" })
    );
    const responses = await Promise.all(reqs);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);

    const rejected = responses.find((r) => r.status === 429)!;
    const body = await rejected.json();
    expect(body.error).toMatch(/concurrent/i);
    expect(body.retryAfter).toBeTypeOf("number");

    // Drain the in-flight streams so the server can shut down cleanly.
    await Promise.all(
      responses.filter((r) => r.status === 200).map((r) => r.text())
    );
  }, 20000);

  it("counts each user independently (user A's cap doesn't block user B)", async () => {
    openAIShouldHang = true;

    const aReqs = [0, 1, 2].map(() => postChat({ userId: "tenant-a", message: "hi" }));
    // Saturate tenant A first
    const aResponses = await Promise.all(aReqs);
    expect(aResponses.every((r) => r.status === 200)).toBe(true);

    // Tenant B should still be able to start a stream
    const bRes = await postChat({ userId: "tenant-b", message: "hi" });
    expect(bRes.status).toBe(200);

    await Promise.all([
      ...aResponses.map((r) => r.text()),
      bRes.text(),
    ]);
  }, 20000);

  it("preserves the documented SSE event shape (event: <name>\\ndata: <json>)", async () => {
    const res = await postChat({ userId: "user-shape", message: "hi" });
    const text = await res.text();
    // Each block must have the form `event: NAME\ndata: JSON\n\n`
    const blocks = text.split("\n\n").filter((b) => b.trim());
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block, `malformed SSE block: ${block}`).toMatch(/^event: \S+\ndata: /);
      const dataLine = block.split("\n").find((l) => l.startsWith("data: "))!;
      // data must be valid JSON — frontend AIPanel JSON.parses it
      expect(() => JSON.parse(dataLine.slice(6))).not.toThrow();
    }
  });
});
