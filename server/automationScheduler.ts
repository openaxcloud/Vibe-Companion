import cron from "node-cron";
import { storage } from "./storage";
import { executeCode } from "./executor";
import { log } from "./index";
import crypto from "crypto";

const scheduledJobs = new Map<string, cron.ScheduledTask>();

export function generateWebhookToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function startAutomationScheduler() {
  try {
    const allAutomations = await getAllEnabledCronAutomations();
    for (const automation of allAutomations) {
      scheduleAutomation(automation.id, automation.cronExpression!);
    }
    log(`Automation scheduler started with ${allAutomations.length} cron jobs`, "automation");
  } catch (err: any) {
    log(`Failed to start automation scheduler: ${err.message}`, "automation");
  }
}

async function getAllEnabledCronAutomations() {
  const { db } = await import("./db");
  const { automations } = await import("@shared/schema");
  const { eq, and } = await import("drizzle-orm");
  return db.select().from(automations)
    .where(and(eq(automations.enabled, true), eq(automations.type, "cron")));
}

export function scheduleAutomation(automationId: string, cronExpression: string) {
  unscheduleAutomation(automationId);

  if (!cron.validate(cronExpression)) {
    log(`Invalid cron expression for automation ${automationId}: ${cronExpression}`, "automation");
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    await executeAutomation(automationId, "cron");
  });

  scheduledJobs.set(automationId, task);
  log(`Scheduled automation ${automationId} with cron: ${cronExpression}`, "automation");
}

export function unscheduleAutomation(automationId: string) {
  const existing = scheduledJobs.get(automationId);
  if (existing) {
    existing.stop();
    scheduledJobs.delete(automationId);
  }
}

export async function executeAutomation(automationId: string, triggeredBy: string): Promise<{ success: boolean; runId?: string; error?: string }> {
  const automation = await storage.getAutomation(automationId);
  if (!automation) return { success: false, error: "Automation not found" };
  if (!automation.enabled) return { success: false, error: "Automation is disabled" };

  const run = await storage.createAutomationRun(automationId, triggeredBy);
  const startTime = Date.now();

  try {
    const result = await executeCode(automation.script, automation.language);
    const durationMs = Date.now() - startTime;

    await storage.updateAutomationRun(run.id, {
      status: result.exitCode === 0 ? "success" : "failed",
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode,
      durationMs,
      finishedAt: new Date(),
    });

    await storage.updateAutomation(automationId, { lastRunAt: new Date() });

    log(`Automation ${automation.name} (${triggeredBy}): exit=${result.exitCode}, duration=${durationMs}ms`, "automation");
    return { success: result.exitCode === 0, runId: run.id };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    await storage.updateAutomationRun(run.id, {
      status: "failed",
      stderr: err.message,
      exitCode: 1,
      durationMs,
      finishedAt: new Date(),
    });
    return { success: false, runId: run.id, error: err.message };
  }
}

export function stopAllScheduledJobs() {
  for (const [id, task] of scheduledJobs) {
    task.stop();
  }
  scheduledJobs.clear();
}

export function validateCronExpression(expr: string): boolean {
  return cron.validate(expr);
}
