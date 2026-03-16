import { storage } from "./storage";
import { log } from "./index";
import type { Task, TaskStep } from "@shared/schema";
import { TASK_LIMITS } from "@shared/schema";

interface TaskExecutorOptions {
  onTaskUpdate?: (task: Task) => void;
  onStepUpdate?: (taskId: string, step: TaskStep) => void;
  onMessage?: (taskId: string, role: string, content: string) => void;
}

const activeExecutions = new Map<string, AbortController>();
const taskProjectMap = new Map<string, string>();

export function getActiveTaskCount(projectId: string): number {
  let count = 0;
  for (const [taskId, controller] of activeExecutions) {
    if (!controller.signal.aborted && taskProjectMap.get(taskId) === projectId) count++;
  }
  return count;
}

export function isTaskActive(taskId: string): boolean {
  return activeExecutions.has(taskId);
}

export function cancelTask(taskId: string): boolean {
  const controller = activeExecutions.get(taskId);
  if (controller) {
    controller.abort();
    activeExecutions.delete(taskId);
    return true;
  }
  return false;
}

async function getMaxParallelTasks(userId: string): Promise<number> {
  const quota = await storage.getUserQuota(userId);
  const plan = (quota.plan || "free") as keyof typeof TASK_LIMITS;
  return TASK_LIMITS[plan]?.maxParallelTasks || 2;
}

async function checkDependenciesMet(task: Task): Promise<boolean> {
  const deps = (task.dependsOn as string[]) || [];
  if (deps.length === 0) return true;

  for (const depId of deps) {
    const depTask = await storage.getTask(depId);
    if (!depTask || depTask.status !== "done") return false;
  }
  return true;
}

export async function createFileSnapshot(taskId: string, projectId: string): Promise<void> {
  const projectFiles = await storage.getFiles(projectId);
  for (const file of projectFiles) {
    await storage.createTaskFileSnapshot({
      taskId,
      filename: file.filename,
      content: file.content,
      originalContent: file.content,
    });
  }
  log(`Created file snapshot for task ${taskId} with ${projectFiles.length} files`, "task");
}

export async function executeTask(
  taskId: string,
  options?: TaskExecutorOptions,
): Promise<{ success: boolean; error?: string }> {
  const task = await storage.getTask(taskId);
  if (!task) return { success: false, error: "Task not found" };

  const depsMet = await checkDependenciesMet(task);
  if (!depsMet) {
    await storage.updateTask(taskId, { status: "queued" });
    options?.onTaskUpdate?.({ ...task, status: "queued" });
    return { success: false, error: "Dependencies not met, task queued" };
  }

  const controller = new AbortController();
  activeExecutions.set(taskId, controller);
  taskProjectMap.set(taskId, task.projectId);

  try {
    await storage.updateTask(taskId, { status: "active", startedAt: new Date() });
    const updatedTask = await storage.getTask(taskId);
    if (updatedTask) options?.onTaskUpdate?.(updatedTask);

    await storage.addTaskMessage({ taskId, role: "system", content: `Task started: ${task.title}` });
    options?.onMessage?.(taskId, "system", `Task started: ${task.title}`);

    await createFileSnapshot(taskId, task.projectId);

    const steps = await storage.getTaskSteps(taskId);
    const totalSteps = steps.length || 1;
    let completedSteps = 0;

    if (steps.length === 0) {
      const planSteps = (task.plan as string[]) || [];
      for (let i = 0; i < planSteps.length; i++) {
        if (controller.signal.aborted) throw new Error("Task cancelled");

        const step = await storage.createTaskStep({
          taskId,
          orderIndex: i,
          title: planSteps[i],
          description: planSteps[i],
        });

        await storage.updateTaskStep(step.id, { status: "running", startedAt: new Date() });
        options?.onStepUpdate?.(taskId, { ...step, status: "running" });

        await storage.addTaskMessage({ taskId, role: "assistant", content: `Working on: ${planSteps[i]}` });
        options?.onMessage?.(taskId, "assistant", `Working on: ${planSteps[i]}`);

        await new Promise(resolve => setTimeout(resolve, 500));

        const snapshots = await storage.getTaskFileSnapshots(taskId);
        if (snapshots.length > 0) {
          const targetFile = snapshots[Math.floor(Math.random() * snapshots.length)];
          const marker = `\n// Task ${taskId} - Step ${i + 1}: ${planSteps[i]}\n`;
          await storage.updateTaskFileSnapshot(taskId, targetFile.filename, targetFile.content + marker);
        }

        await storage.updateTaskStep(step.id, { status: "completed", output: `Completed: ${planSteps[i]}`, completedAt: new Date() });
        const completedStep = await storage.getTaskSteps(taskId).then(s => s.find(x => x.id === step.id));
        if (completedStep) options?.onStepUpdate?.(taskId, completedStep);

        completedSteps++;
        const progress = Math.round((completedSteps / planSteps.length) * 100);
        await storage.updateTask(taskId, { progress });
      }
    } else {
      for (const step of steps) {
        if (controller.signal.aborted) throw new Error("Task cancelled");

        await storage.updateTaskStep(step.id, { status: "running", startedAt: new Date() });
        options?.onStepUpdate?.(taskId, { ...step, status: "running" });

        await storage.addTaskMessage({ taskId, role: "assistant", content: `Working on: ${step.title}` });
        options?.onMessage?.(taskId, "assistant", `Working on: ${step.title}`);

        await new Promise(resolve => setTimeout(resolve, 500));

        await storage.updateTaskStep(step.id, { status: "completed", output: `Completed: ${step.title}`, completedAt: new Date() });
        const completedStep = await storage.getTaskSteps(taskId).then(s => s.find(x => x.id === step.id));
        if (completedStep) options?.onStepUpdate?.(taskId, completedStep);

        completedSteps++;
        const progress = Math.round((completedSteps / totalSteps) * 100);
        await storage.updateTask(taskId, { progress });
      }
    }

    await storage.updateTask(taskId, { status: "ready", progress: 100, completedAt: new Date() });
    const readyTask = await storage.getTask(taskId);
    if (readyTask) options?.onTaskUpdate?.(readyTask);

    await storage.addTaskMessage({ taskId, role: "system", content: "Task completed and ready for review" });
    options?.onMessage?.(taskId, "system", "Task completed and ready for review");

    await processQueuedTasks(task.projectId, options);

    return { success: true };
  } catch (err: any) {
    if (err.message === "Task cancelled") {
      await storage.updateTask(taskId, { status: "draft", errorMessage: "Task cancelled" });
      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) options?.onTaskUpdate?.(cancelledTask);
      return { success: false, error: "Task cancelled" };
    }

    await storage.updateTask(taskId, { status: "draft", errorMessage: err.message });
    const failedTask = await storage.getTask(taskId);
    if (failedTask) options?.onTaskUpdate?.(failedTask);

    await storage.addTaskMessage({ taskId, role: "system", content: `Task failed: ${err.message}` });
    options?.onMessage?.(taskId, "system", `Task failed: ${err.message}`);

    return { success: false, error: err.message };
  } finally {
    activeExecutions.delete(taskId);
    taskProjectMap.delete(taskId);
  }
}

async function processQueuedTasks(projectId: string, options?: TaskExecutorOptions): Promise<void> {
  const allTasks = await storage.getProjectTasks(projectId);
  const queuedTasks = allTasks.filter(t => t.status === "queued");
  const activeTasks = allTasks.filter(t => t.status === "active").length;
  const userId = allTasks[0]?.userId;
  if (!userId) return;

  const maxParallel = await getMaxParallelTasks(userId);
  let slotsAvailable = maxParallel - activeTasks;

  for (const task of queuedTasks) {
    if (slotsAvailable <= 0) break;
    const depsMet = await checkDependenciesMet(task);
    if (depsMet) {
      slotsAvailable--;
      executeTask(task.id, options).catch(err => {
        log(`Error executing queued task ${task.id}: ${err.message}`, "task");
      });
    }
  }
}

export async function acceptAndExecuteTask(
  taskId: string,
  userId: string,
  options?: TaskExecutorOptions,
): Promise<{ success: boolean; error?: string }> {
  const task = await storage.getTask(taskId);
  if (!task) return { success: false, error: "Task not found" };
  if (task.status !== "draft") return { success: false, error: "Task is not in draft status" };

  const maxParallel = await getMaxParallelTasks(userId);
  const allTasks = await storage.getProjectTasks(task.projectId);
  const activeTasks = allTasks.filter(t => t.status === "active").length;

  if (activeTasks >= maxParallel) {
    await storage.updateTask(taskId, { status: "queued" });
    const queuedTask = await storage.getTask(taskId);
    if (queuedTask) options?.onTaskUpdate?.(queuedTask);
    return { success: true };
  }

  return executeTask(taskId, options);
}

export async function bulkAcceptTasks(
  taskIds: string[],
  userId: string,
  options?: TaskExecutorOptions,
): Promise<{ accepted: string[]; queued: string[]; errors: { id: string; error: string }[] }> {
  const accepted: string[] = [];
  const queued: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const taskId of taskIds) {
    const result = await acceptAndExecuteTask(taskId, userId, options);
    if (result.success) {
      const task = await storage.getTask(taskId);
      if (task?.status === "queued") queued.push(taskId);
      else accepted.push(taskId);
    } else {
      errors.push({ id: taskId, error: result.error || "Unknown error" });
    }
  }

  return { accepted, queued, errors };
}
