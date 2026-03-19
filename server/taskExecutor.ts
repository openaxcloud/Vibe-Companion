import { storage } from "./storage";
import { log } from "./index";
import type { Task, TaskStep } from "@shared/schema";
import { TASK_LIMITS } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

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

/**
 * Build a system prompt for the AI to implement a specific step of a task.
 * The AI receives the full file context and returns JSON with file modifications.
 */
function buildStepPrompt(
  task: Task,
  stepTitle: string,
  stepIndex: number,
  totalSteps: number,
  files: { filename: string; content: string }[],
  previousStepOutputs: string[],
): string {
  const fileContext = files
    .filter(f => !f.filename.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp3|mp4|zip|tar|gz)$/i))
    .map(f => `--- ${f.filename} ---\n${f.content}`)
    .join("\n\n");

  return `You are an expert software engineer implementing a task step-by-step.

## Task: ${task.title}
${task.description ? `Description: ${task.description}` : ""}

## Current Step (${stepIndex + 1}/${totalSteps}): ${stepTitle}

${previousStepOutputs.length > 0 ? `## Previous Steps Completed:\n${previousStepOutputs.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n` : ""}

## Current Project Files:
${fileContext}

## Instructions:
Implement ONLY the current step. Return a JSON object with the files you need to create or modify.

IMPORTANT RULES:
- Only include files that actually need changes for this step
- Return the COMPLETE new content for each modified file (not a diff)
- For new files, include the full content
- Do NOT modify files that don't need changes
- Write clean, production-quality code
- Follow existing code style and conventions

Respond with ONLY a JSON object in this exact format, no other text:
{
  "files": {
    "path/to/file.ts": "full file content here",
    "path/to/new-file.ts": "full new file content here"
  },
  "summary": "Brief description of what was done"
}`;
}

/**
 * Call the AI API to execute a single task step.
 * Tries Anthropic first, falls back to OpenAI.
 */
async function executeStepWithAI(
  task: Task,
  stepTitle: string,
  stepIndex: number,
  totalSteps: number,
  currentFiles: { filename: string; content: string }[],
  previousOutputs: string[],
  signal: AbortSignal,
): Promise<{ files: Record<string, string>; summary: string }> {
  const systemPrompt = buildStepPrompt(task, stepTitle, stepIndex, totalSteps, currentFiles, previousOutputs);

  let responseText = "";

  // Try Anthropic first
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
    const result = await anthropic.messages.create({
      model: process.env.TASK_AI_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: `Implement step: ${stepTitle}` }],
    });

    if (signal.aborted) throw new Error("Task cancelled");

    responseText = result.content
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("");
  } catch (anthropicErr: any) {
    if (signal.aborted || anthropicErr.message === "Task cancelled") throw new Error("Task cancelled");

    // Fallback to OpenAI
    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const result = await openai.chat.completions.create({
        model: process.env.TASK_AI_MODEL_OPENAI || "gpt-4o",
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Implement step: ${stepTitle}` },
        ],
      });

      if (signal.aborted) throw new Error("Task cancelled");

      responseText = result.choices[0]?.message?.content || "";
    } catch (openaiErr: any) {
      if (signal.aborted) throw new Error("Task cancelled");
      throw new Error(`AI unavailable: ${anthropicErr.message} / ${openaiErr.message}`);
    }
  }

  // Parse the JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned invalid response format");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      files: parsed.files || {},
      summary: parsed.summary || stepTitle,
    };
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
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

    // Snapshot project files at task start
    await createFileSnapshot(taskId, task.projectId);

    // Resolve steps — use existing steps or create from plan
    let steps = await storage.getTaskSteps(taskId);
    if (steps.length === 0) {
      const planSteps = (task.plan as string[]) || [];
      if (planSteps.length === 0) {
        // Single-step task: use the task title as the step
        const step = await storage.createTaskStep({
          taskId,
          orderIndex: 0,
          title: task.title,
          description: task.description || task.title,
        });
        steps = [step];
      } else {
        for (let i = 0; i < planSteps.length; i++) {
          const step = await storage.createTaskStep({
            taskId,
            orderIndex: i,
            title: planSteps[i],
            description: planSteps[i],
          });
          steps.push(step);
        }
      }
    }

    const previousOutputs: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (controller.signal.aborted) throw new Error("Task cancelled");

      // Mark step running
      await storage.updateTaskStep(step.id, { status: "running", startedAt: new Date() });
      options?.onStepUpdate?.(taskId, { ...step, status: "running" });

      await storage.addTaskMessage({ taskId, role: "assistant", content: `Working on: ${step.title}` });
      options?.onMessage?.(taskId, "assistant", `Working on: ${step.title}`);

      // Get current file state (includes changes from previous steps)
      const snapshots = await storage.getTaskFileSnapshots(taskId);
      const currentFiles = snapshots.map(s => ({ filename: s.filename, content: s.content }));

      // Call AI to implement this step
      const result = await executeStepWithAI(
        task,
        step.title,
        i,
        steps.length,
        currentFiles,
        previousOutputs,
        controller.signal,
      );

      if (controller.signal.aborted) throw new Error("Task cancelled");

      // Apply AI-generated file changes to snapshots
      let filesChanged = 0;
      for (const [filename, content] of Object.entries(result.files)) {
        const existingSnapshot = snapshots.find(s => s.filename === filename);
        if (existingSnapshot) {
          if (existingSnapshot.content !== content) {
            await storage.updateTaskFileSnapshot(taskId, filename, content);
            filesChanged++;
          }
        } else {
          // New file — create snapshot with empty original
          await storage.createTaskFileSnapshot({
            taskId,
            filename,
            content,
            originalContent: "",
          });
          filesChanged++;
        }
      }

      previousOutputs.push(result.summary);

      // Mark step complete
      const output = `${result.summary} (${filesChanged} file${filesChanged !== 1 ? "s" : ""} changed)`;
      await storage.updateTaskStep(step.id, { status: "completed", output, completedAt: new Date() });
      const completedStep = await storage.getTaskSteps(taskId).then(s => s.find(x => x.id === step.id));
      if (completedStep) options?.onStepUpdate?.(taskId, completedStep);

      await storage.addTaskMessage({ taskId, role: "assistant", content: output });
      options?.onMessage?.(taskId, "assistant", output);

      // Update progress
      const progress = Math.round(((i + 1) / steps.length) * 100);
      await storage.updateTask(taskId, { progress });
      const progressTask = await storage.getTask(taskId);
      if (progressTask) options?.onTaskUpdate?.(progressTask);
    }

    // Task complete — mark as ready for review
    await storage.updateTask(taskId, { status: "ready", progress: 100, completedAt: new Date() });
    const readyTask = await storage.getTask(taskId);
    if (readyTask) options?.onTaskUpdate?.(readyTask);

    await storage.addTaskMessage({ taskId, role: "system", content: "Task completed and ready for review" });
    options?.onMessage?.(taskId, "system", "Task completed and ready for review");

    // Process any queued tasks now that a slot is freed
    await processQueuedTasks(task.projectId, options);

    return { success: true };
  } catch (err: any) {
    if (err.message === "Task cancelled") {
      await storage.updateTask(taskId, { status: "draft", errorMessage: "Task cancelled" });
      const cancelledTask = await storage.getTask(taskId);
      if (cancelledTask) options?.onTaskUpdate?.(cancelledTask);
      return { success: false, error: "Task cancelled" };
    }

    log(`Task ${taskId} failed: ${err.message}`, "task");
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
