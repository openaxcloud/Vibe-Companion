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
    const allAutomations = await getAllEnabledAutomations();
    let cronCount = 0;
    let slackCount = 0;
    let telegramCount = 0;

    for (const automation of allAutomations) {
      if (automation.type === "cron" && automation.cronExpression) {
        scheduleAutomation(automation.id, automation.cronExpression);
        cronCount++;
      } else if (automation.type === "slack" && automation.slackBotToken && automation.slackSigningSecret) {
        const { startSlackBot } = await import("./slackBot");
        await startSlackBot(automation.id, automation.slackBotToken, automation.slackSigningSecret);
        slackCount++;
      } else if (automation.type === "telegram" && automation.telegramBotToken) {
        const { startTelegramBot } = await import("./telegramBot");
        await startTelegramBot(automation.id, automation.telegramBotToken);
        telegramCount++;
      }
    }
    log(`Automation scheduler started: ${cronCount} cron, ${slackCount} slack, ${telegramCount} telegram`, "automation");
  } catch (err: any) {
    log(`Failed to start automation scheduler: ${err.message}`, "automation");
  }
}

async function getAllEnabledAutomations() {
  const { db } = await import("./db");
  const { automations } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  return db.select().from(automations).where(eq(automations.enabled, true));
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

export async function stopBotAutomation(automationId: string) {
  const { stopSlackBot } = await import("./slackBot");
  const { stopTelegramBot } = await import("./telegramBot");
  await stopSlackBot(automationId);
  await stopTelegramBot(automationId);
}

export async function executeAutomation(automationId: string, triggeredBy: string, eventPayload?: string): Promise<{ success: boolean; runId?: string; error?: string; response?: string }> {
  const automation = await storage.getAutomation(automationId);
  if (!automation) return { success: false, error: "Automation not found" };
  if (!automation.enabled) return { success: false, error: "Automation is disabled" };

  const run = await storage.createAutomationRun(automationId, triggeredBy);
  const startTime = Date.now();

  try {
    let scriptToRun = automation.script;
    if (eventPayload) {
      const b64Payload = Buffer.from(eventPayload).toString("base64");
      let payloadInjection: string;
      if (automation.language === "python") {
        payloadInjection = `import json, base64\nEVENT = json.loads(base64.b64decode("${b64Payload}").decode("utf-8"))\n`;
      } else if (automation.language === "bash") {
        payloadInjection = `EVENT=$(echo "${b64Payload}" | base64 -d)\n`;
      } else {
        payloadInjection = `const EVENT = JSON.parse(Buffer.from("${b64Payload}", "base64").toString("utf-8"));\n`;
      }
      scriptToRun = payloadInjection + scriptToRun;
    }

    const result = await executeCode(scriptToRun, automation.language);
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

    const response = result.stdout?.trim() || undefined;

    log(`Automation ${automation.name} (${triggeredBy}): exit=${result.exitCode}, duration=${durationMs}ms`, "automation");
    return { success: result.exitCode === 0, runId: run.id, response };
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

export async function stopAllBots() {
  const { stopAllSlackBots } = await import("./slackBot");
  const { stopAllTelegramBots } = await import("./telegramBot");
  await stopAllSlackBots();
  await stopAllTelegramBots();
}

export function validateCronExpression(expr: string): boolean {
  return cron.validate(expr);
}
