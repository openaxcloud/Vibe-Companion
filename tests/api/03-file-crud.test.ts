import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildBaseApp, requireAuth, createTestUser, deleteTestUser, createTestProject, deleteTestProject } from "./helpers/app";
import { storage } from "../../server/storage";

let app: ReturnType<typeof buildBaseApp>;
let userId: string;
let otherUserId: string;
let projectId: string;
let fileId: string;

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  const other = await createTestUser();
  otherUserId = other.id;
  const proj = await createTestProject(userId);
  projectId = proj.id;

  app = buildBaseApp();
  app.use((req, _res, next) => { (req.session as any).userId = userId; next(); });

  // Minimal file CRUD routes mirroring legacy-files.ts business logic
  app.get("/api/projects/:projectId/files", requireAuth, async (req, res) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.userId !== (req.session as any).userId) return res.status(403).json({ message: "Forbidden" });
    const files = await storage.getFiles(req.params.projectId);
    res.json(files);
  });

  app.post("/api/projects/:projectId/files", requireAuth, async (req, res) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== (req.session as any).userId) return res.status(403).json({ message: "Forbidden" });
    const { filename, content } = req.body;
    if (!filename) return res.status(400).json({ message: "filename required" });
    const file = await storage.createFile(req.params.projectId, { filename, content: content ?? "" });
    res.status(201).json(file);
  });

  app.patch("/api/files/:id", requireAuth, async (req, res) => {
    const existing = await storage.getFile(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const project = await storage.getProject(existing.projectId);
    if (!project || project.userId !== (req.session as any).userId) return res.status(403).json({ message: "Forbidden" });
    const file = await storage.updateFileContent(req.params.id, req.body.content ?? "");
    res.json(file);
  });

  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    const existing = await storage.getFile(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const project = await storage.getProject(existing.projectId);
    if (!project || project.userId !== (req.session as any).userId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteFile(req.params.id);
    res.status(204).end();
  });
});

afterAll(async () => {
  await deleteTestProject(projectId, userId);
  await deleteTestUser(userId);
  await deleteTestUser(otherUserId);
});

describe("File CRUD — /api/projects/:id/files + /api/files/:id", () => {
  it("POST creates a file and returns 201 with id", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .send({ filename: "index.html", content: "<h1>Hello</h1>" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.filename).toBe("index.html");
    fileId = res.body.id;
  });

  it("GET lists project files including the new one", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((f: any) => f.id === fileId);
    expect(found).toBeDefined();
    expect(found.filename).toBe("index.html");
  });

  it("PATCH updates file content", async () => {
    const res = await request(app)
      .patch(`/api/files/${fileId}`)
      .send({ content: "<h1>Updated</h1>" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("<h1>Updated</h1>");
  });

  it("GET returns 403 when project belongs to another user", async () => {
    const otherApp = buildBaseApp();
    otherApp.use((req, _res, next) => { (req.session as any).userId = otherUserId; next(); });
    otherApp.get("/api/projects/:projectId/files", requireAuth, async (req, res) => {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Not found" });
      if (project.userId !== (req.session as any).userId) return res.status(403).json({ message: "Forbidden" });
      res.json([]);
    });

    const res = await request(otherApp).get(`/api/projects/${projectId}/files`);
    expect(res.status).toBe(403);
  });

  it("DELETE removes the file and returns 204", async () => {
    const res = await request(app).delete(`/api/files/${fileId}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/projects/${projectId}/files`);
    const still = check.body.find((f: any) => f.id === fileId);
    expect(still).toBeUndefined();
  });
});
