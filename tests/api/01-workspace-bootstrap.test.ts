import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { buildBaseApp, createTestUser, deleteTestUser } from "./helpers/app";
import workspaceBootstrapRouter from "../../server/routes/workspace-bootstrap.router";
import { storage } from "../../server/storage";

let app: ReturnType<typeof buildBaseApp>;
let userId: string;
let createdProjectIds: string[] = [];

beforeAll(async () => {
  // CSRF bypass: the csrfProtection middleware checks these at request time
  process.env.NODE_ENV = "development";
  process.env.DISABLE_CSRF = "true";

  const user = await createTestUser();
  userId = user.id;

  app = buildBaseApp();
  // Auth injection middleware: sets session.userId before workspace routes run
  app.use((req, _res, next) => {
    (req.session as any).userId = userId;
    next();
  });
  app.use("/api/workspace", workspaceBootstrapRouter);
});

afterAll(async () => {
  process.env.NODE_ENV = "test";
  delete process.env.DISABLE_CSRF;
  for (const id of createdProjectIds) {
    try { await storage.deleteProject(id, userId); } catch {}
  }
  await deleteTestUser(userId);
});

describe("POST /api/workspace/bootstrap", () => {
  it("happy path — creates project and returns projectId", async () => {
    const res = await request(app)
      .post("/api/workspace/bootstrap")
      .send({ prompt: "Build a todo app with React and TypeScript" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.projectId).toBe("string");
    expect(res.body.bootstrapToken).toBeDefined();
    createdProjectIds.push(res.body.projectId);
  });

  it("missing prompt → 400", async () => {
    const res = await request(app)
      .post("/api/workspace/bootstrap")
      .send({ buildMode: "full-app" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("unauthenticated → 401", async () => {
    const unauthApp = buildBaseApp();
    unauthApp.use("/api/workspace", workspaceBootstrapRouter);
    const res = await request(unauthApp)
      .post("/api/workspace/bootstrap")
      .send({ prompt: "Build something" });

    expect(res.status).toBe(401);
  });

  it("rate-limit exceeded → 429", async () => {
    vi.spyOn(storage, "checkProjectLimit").mockResolvedValueOnce({
      allowed: false,
      current: 10,
      limit: 10,
    });

    const res = await request(app)
      .post("/api/workspace/bootstrap")
      .send({ prompt: "Another project" });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    vi.restoreAllMocks();
  });
});
