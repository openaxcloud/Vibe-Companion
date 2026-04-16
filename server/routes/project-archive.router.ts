// @ts-nocheck
import { Router, Request, Response } from "express";
import { getStorage } from "../storage";
import { ensureAuthenticated } from "../middleware/auth";
import archiver from "archiver";
import multer from "multer";
import { createLogger } from "../utils/logger";

const logger = createLogger("project-archive");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.get("/projects/:projectId/export", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const storage = getStorage();
    const userId = (req.user as any)?.id;

    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId || project.ownerId) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const files = await storage.getFilesByProject(projectId);
    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No files to export" });
    }

    const projectName = (project.name || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${projectName}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      logger.error("Archive error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Archive failed" });
    });
    archive.pipe(res);

    for (const file of files) {
      const filename = file.filename || file.name || file.path;
      if (!filename) continue;
      const content = file.content ?? "";
      archive.append(content, { name: filename });
    }

    await archive.finalize();
  } catch (err: any) {
    logger.error("Export error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.post("/projects/:projectId/import", ensureAuthenticated, upload.array("files", 100), async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const storage = getStorage();
    const userId = (req.user as any)?.id;

    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (String(project.userId || project.ownerId) !== String(userId)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const uploadedFiles: any[] = (req as any).files || [];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    let imported = 0;

    for (const file of uploadedFiles) {
      const filename = file.originalname || file.name;
      const content = file.buffer ? file.buffer.toString("utf-8") : "";
      
      try {
        await storage.createFile({
          projectId,
          filename,
          content,
          language: "",
        });
        imported++;
      } catch (e: any) {
        logger.warn(`Failed to import ${filename}: ${e.message}`);
      }
    }

    res.json({ success: true, imported });
  } catch (err: any) {
    logger.error("Import error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
