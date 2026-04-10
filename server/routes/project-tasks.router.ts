import { Router, Request, Response, NextFunction } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { projectTasks, projects } from "../../shared/schema";

const router = Router();

async function verifyProjectAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  const { projectId } = req.params;
  if (!projectId) return res.status(400).json({ message: "Project ID required" });
  try {
    const [project] = await db.select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    next();
  } catch {
    res.status(500).json({ message: "Failed to verify project access" });
  }
}

router.get("/:projectId/tasks", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const tasks = await db.select().from(projectTasks)
      .where(eq(projectTasks.projectId, projectId))
      .orderBy(desc(projectTasks.createdAt));
    res.json(tasks);
  } catch {
    res.json([]);
  }
});

router.get("/:projectId/tasks/:taskId", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId, taskId } = req.params;
    const [task] = await db.select().from(projectTasks)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId)));
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch {
    res.status(500).json({ message: "Failed to fetch task" });
  }
});

router.post("/:projectId/tasks", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.session!.userId;

    const [maxResult] = await db.select({
      maxNum: sql<number>`COALESCE(MAX(${projectTasks.taskNumber}), 0)`
    }).from(projectTasks).where(eq(projectTasks.projectId, projectId));
    const nextNumber = (maxResult?.maxNum || 0) + 1;

    const { title, description, status, planContent, planWhatAndWhy, planDoneLooksLike, priority, complexity } = req.body;

    const [task] = await db.insert(projectTasks).values({
      projectId,
      userId,
      taskNumber: nextNumber,
      title: title || "Untitled Task",
      description,
      status: status || "draft",
      planContent,
      planWhatAndWhy,
      planDoneLooksLike,
      priority: priority || "medium",
      complexity: complexity || "medium",
    }).returning();

    res.json(task);
  } catch {
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.post("/:projectId/tasks/bulk", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.session!.userId;
    const { tasks: taskList } = req.body;
    if (!Array.isArray(taskList)) return res.status(400).json({ message: "tasks must be an array" });

    const [maxResult] = await db.select({
      maxNum: sql<number>`COALESCE(MAX(${projectTasks.taskNumber}), 0)`
    }).from(projectTasks).where(eq(projectTasks.projectId, projectId));
    let nextNumber = (maxResult?.maxNum || 0) + 1;

    const created = [];
    for (const t of taskList) {
      const [task] = await db.insert(projectTasks).values({
        projectId,
        userId,
        taskNumber: nextNumber++,
        title: t.title || "Untitled Task",
        description: t.description,
        status: t.status || "draft",
        planContent: t.planContent,
        planWhatAndWhy: t.planWhatAndWhy,
        planDoneLooksLike: t.planDoneLooksLike,
        priority: t.priority || "medium",
        complexity: t.complexity || "medium",
      }).returning();
      created.push(task);
    }
    res.json(created);
  } catch {
    res.status(500).json({ message: "Failed to create tasks" });
  }
});

router.patch("/:projectId/tasks/:taskId", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId, taskId } = req.params;
    const updates: Record<string, any> = { updatedAt: new Date() };
    const allowed = ["title", "description", "status", "planContent", "planWhatAndWhy", "planDoneLooksLike", "priority", "complexity", "filesModified", "checkpointCount", "workDurationSeconds", "reviewStatus"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === "done") updates.completedAt = new Date();

    const [task] = await db.update(projectTasks)
      .set(updates)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId)))
      .returning();
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch {
    res.status(500).json({ message: "Failed to update task" });
  }
});

router.delete("/:projectId/tasks/:taskId", verifyProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId, taskId } = req.params;
    const result = await db.delete(projectTasks)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

export default router;
