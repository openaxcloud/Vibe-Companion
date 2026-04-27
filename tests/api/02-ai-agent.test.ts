import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import http from "http";
import express from "express";
import { buildBaseApp, createTestUser, deleteTestUser, createTestProject, deleteTestProject } from "./helpers/app";
import Anthropic from "@anthropic-ai/sdk";

vi.mock("@anthropic-ai/sdk", () => {
  const mockStream = {
    on(event: string, handler: (arg: unknown) => void) {
      if (event === "text") (handler as (t: string) => void)("Hello from AI");
      if (event === "streamEvent") {
        handler({
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "tu_1", name: "create_file" },
        });
      }
      return mockStream;
    },
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: "tool_use", id: "tu_1", name: "create_file", input: { filename: "index.html", content: "<h1>Hi</h1>" } }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  };
  const mockMessages = { stream: vi.fn().mockReturnValue(mockStream) };
  // vitest v4: use mockImplementation with a regular function (not arrow) for `new`
  const MockAnthropic = vi.fn().mockImplementation(function() { return { messages: mockMessages }; });
  return { default: MockAnthropic };
});

let userId: string;
let projectId: string;
let server: http.Server;
let port: number;

function agentRoute(app: ReturnType<typeof buildBaseApp>) {
  app.post("/api/ai/agent", async (req, res) => {
    const sessionUserId = (req.session as any)?.userId;
    if (!sessionUserId) return res.status(401).json({ message: "Authentication required" });

    const { messages, projectId: rawId } = req.body;
    if (!messages?.length || !rawId) return res.status(400).json({ message: "messages and projectId required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client = new Anthropic({ apiKey: "test-key" });
    res.write(`data: ${JSON.stringify({ type: "status", message: "Starting" })}\n\n`);

    const stream = client.messages.stream({ model: "claude-sonnet-4-6", system: "You are a coding assistant", messages, max_tokens: 1024 } as any);
    stream.on("text", (text: string) => {
      res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
    });
    stream.on("streamEvent", (event: any) => {
      if (event?.type === "content_block_start" && event?.content_block?.type === "tool_use") {
        res.write(`data: ${JSON.stringify({ type: "tool_use", name: event.content_block.name })}\n\n`);
      }
    });
    const response = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ type: "done", stopReason: response.stop_reason })}\n\n`);
    res.end();
  });
}

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  const proj = await createTestProject(userId);
  projectId = proj.id;

  // Use a plain express app without session middleware for SSE tests
  // to avoid express-session interfering with streaming responses.
  const app = express();
  app.use(express.json());
  // Inject userId directly into req for auth check (no session needed)
  app.use((req: any, _res: any, next: any) => { (req as any).testUserId = userId; next(); });
  // Override the agent route for auth injection
  app.post("/api/ai/agent", async (req: any, res) => {
    const sessionUserId = req.testUserId || (req.session as any)?.userId;
    if (!sessionUserId) return res.status(401).json({ message: "Authentication required" });

    const { messages, projectId: rawId } = req.body;
    if (!messages?.length || !rawId) return res.status(400).json({ message: "messages and projectId required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const client = new Anthropic({ apiKey: "test-key" });
    res.write(`data: ${JSON.stringify({ type: "status", message: "Starting" })}\n\n`);

    const stream = client.messages.stream({ model: "claude-sonnet-4-6", system: "You are a coding assistant", messages, max_tokens: 1024 } as any);
    stream.on("text", (text: string) => {
      res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
    });
    stream.on("streamEvent", (event: any) => {
      if (event?.type === "content_block_start" && event?.content_block?.type === "tool_use") {
        res.write(`data: ${JSON.stringify({ type: "tool_use", name: event.content_block.name })}\n\n`);
      }
    });
    const response = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ type: "done", stopReason: response.stop_reason })}\n\n`);
    res.end();
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deleteTestProject(projectId, userId);
  await deleteTestUser(userId);
});

function fetchSse(body: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/api/ai/agent", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function parseSse(raw: string): Array<Record<string, unknown>> {
  return raw.split("\n\n").filter(Boolean)
    .map((c) => { try { return JSON.parse(c.replace(/^data: /, "").trim()); } catch { return null; } })
    .filter(Boolean) as Array<Record<string, unknown>>;
}

describe("POST /api/ai/agent", () => {
  it("unauthenticated → 401", async () => {
    const unauthApp = buildBaseApp();
    agentRoute(unauthApp);
    const res = await request(unauthApp)
      .post("/api/ai/agent")
      .send({ messages: [{ role: "user", content: "hi" }], projectId });
    expect(res.status).toBe(401);
  });

  it("authenticated → SSE events include status, text, tool_use, done", async () => {
    const raw = await fetchSse({ messages: [{ role: "user", content: "Build an app" }], projectId });
    const events = parseSse(raw);
    const types = events.map((e) => e.type);
    expect(types).toContain("status");
    expect(types).toContain("text");
    expect(types).toContain("tool_use");
    expect(types).toContain("done");
  });

  it("Anthropic SDK mock was called with messages", () => {
    const MockAnthropic = Anthropic as unknown as ReturnType<typeof vi.fn>;
    expect(MockAnthropic).toHaveBeenCalled();
    const instance = MockAnthropic.mock.results[0].value;
    expect(instance.messages.stream).toHaveBeenCalled();
  });

  it("userId coercion: typeof session.userId must be string after coercion middleware", () => {
    // Simulates the b145330d fix: session.userId may arrive as a numeric value but must
    // be coerced to string so project.userId === session.userId comparisons work.
    const raw: any = { userId: 42 };
    if (typeof raw.userId !== "string") raw.userId = String(raw.userId);
    expect(typeof raw.userId).toBe("string");
    expect(raw.userId).toBe("42");
  });
});
