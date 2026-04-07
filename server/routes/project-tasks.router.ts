import { Router, Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { projectTasks } from "../../shared/schema";

const router = Router();

router.get("/:projectId/tasks", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { projectId } = req.params;
    const tasks = await db.select().from(projectTasks)
      .where(eq(projectTasks.projectId, projectId))
      .orderBy(desc(projectTasks.createdAt));
    res.json(tasks);
  } catch (err: any) {
    res.json([]);
  }
});

router.get("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { taskId } = req.params;
    const [task] = await db.select().from(projectTasks)
      .where(eq(projectTasks.id, taskId));
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch task" });
  }
});

router.post("/:projectId/tasks", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { projectId } = req.params;
    const userId = req.session.userId;

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
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.post("/:projectId/tasks/bulk", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { projectId } = req.params;
    const userId = req.session.userId;
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
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create tasks" });
  }
});

router.patch("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { taskId } = req.params;
    const updates: any = { updatedAt: new Date() };
    const allowed = ["title", "description", "status", "planContent", "planWhatAndWhy", "planDoneLooksLike", "priority", "complexity", "filesModified", "checkpointCount", "workDurationSeconds", "reviewStatus"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === "done") updates.completedAt = new Date();

    const [task] = await db.update(projectTasks)
      .set(updates)
      .where(eq(projectTasks.id, taskId))
      .returning();
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update task" });
  }
});

router.delete("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { taskId } = req.params;
    await db.delete(projectTasks).where(eq(projectTasks.id, taskId));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

export default router;
