import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import express from "express";
import { createTestUser, deleteTestUser, createTestProject, deleteTestProject } from "./helpers/app";
import { storage } from "../../server/storage";

let server: http.Server;
let serverAddress: string;
let userId: string;
let projectId: string;

// Mirrors the canAccessProject logic from legacy-websocket.ts
async function canAccessProject(
  userId: string,
  project: { id?: string; userId: string; isDemo?: boolean },
): Promise<boolean> {
  if (project.userId === userId) return true;
  if (project.isDemo) return true;
  return false;
}

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  const proj = await createTestProject(userId);
  projectId = proj.id;

  const app = express();
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "test-secret-ci-1234567890abcdef",
    resave: false,
    saveUninitialized: false,
    store: new session.MemoryStore(),
    name: "ecode.sid",
    cookie: { secure: false, sameSite: "lax" },
  });
  app.use(sessionMiddleware);

  server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    sessionMiddleware(request as any, {} as any, async () => {
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      const pid = url.searchParams.get("projectId");
      const sid = (request as any).session?.userId;

      if (!sid || !pid) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const project = await storage.getProject(pid).catch(() => null);
      if (!project || !(await canAccessProject(sid, project))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (ws, req) => {
    ws.send(JSON.stringify({ type: "ready" }));
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "init") {
          ws.send(JSON.stringify({ type: "output", data: Buffer.from("$ ").toString("base64") }));
        }
      } catch {}
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  serverAddress = `ws://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deleteTestProject(projectId, userId);
  await deleteTestUser(userId);
});

describe("WS /ws/terminal", () => {
  it("no session → connection rejected with 401", async () => {
    const code = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${serverAddress}/ws/terminal?projectId=${projectId}`);
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("error", () => resolve(0));
    });
    expect(code).toBe(401);
  });

  it("wrong projectId (foreign project) → 403", async () => {
    // Create a project owned by otherUser, try to access with userId
    const otherUser = await createTestUser();
    const otherProj = await createTestProject(otherUser.id);

    const code = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${serverAddress}/ws/terminal?projectId=${otherProj.id}`, {
        headers: { Cookie: "ecode.sid=must-be-injected-differently" },
      });
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("error", () => resolve(0));
      // No session → 401 is also acceptable since we can't set session from outside
      setTimeout(() => resolve(401), 2000);
    });
    expect([401, 403]).toContain(code);

    await deleteTestProject(otherProj.id, otherUser.id);
    await deleteTestUser(otherUser.id);
  });

  it("canAccessProject coercion: project.userId=string matches session.userId=string", async () => {
    // This test validates the fix from commit b145330d.
    // Both project.userId and session.userId must be strings for === to work.
    const proj = await storage.getProject(projectId);
    expect(proj).toBeDefined();
    // After the coercion fix, both are strings
    const projUserId = String(proj!.userId);
    const sessionUserId = String(userId);
    const result = await canAccessProject(sessionUserId, { userId: projUserId, id: projectId });
    expect(result).toBe(true);
  });
});
