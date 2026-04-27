import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildBaseApp, createTestUser, deleteTestUser, createTestProject, deleteTestProject } from "./helpers/app";
import { storage } from "../../server/storage";
import previewRouter from "../../server/routes/preview";

let app: ReturnType<typeof buildBaseApp>;
let userId: string;
let projectId: string;
let fileId: string;

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  const proj = await createTestProject(userId);
  projectId = proj.id;

  // Create index.html in the project
  const file = await storage.createFile(projectId, {
    filename: "index.html",
    content: "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
  });
  fileId = String(file.id);

  app = buildBaseApp();
  // Inject auth into session so preview router's requireAuth passes
  app.use((req, _res, next) => {
    (req.session as any).userId = userId;
    next();
  });
  app.use("/api/preview", previewRouter);
});

afterAll(async () => {
  try { await storage.deleteFile(fileId); } catch {}
  await deleteTestProject(projectId, userId);
  await deleteTestUser(userId);
});

describe("GET /api/preview/projects/:id/preview/", () => {
  it("returns 200 with Content-Type text/html for project with index.html", async () => {
    const res = await request(app)
      .get(`/api/preview/projects/${projectId}/preview/`)
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<h1>Test</h1>");
  });

  it("unauthenticated → 401", async () => {
    const unauthApp = buildBaseApp();
    unauthApp.use("/api/preview", previewRouter);
    const res = await request(unauthApp)
      .get(`/api/preview/projects/${projectId}/preview/`);
    expect(res.status).toBe(401);
  });

  it("non-existent project → 404", async () => {
    const res = await request(app)
      .get("/api/preview/projects/00000000-0000-0000-0000-000000000000/preview/");
    expect(res.status).toBe(404);
  });
});
