import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

async function verifyAccess(projectId: string, userId: any): Promise<boolean> {
  const project = await storage.getProject(projectId);
  if (!project) return false;
  if (String(project.ownerId) === String(userId)) return true;
  const collabs = await storage.getProjectCollaborators(projectId);
  return collabs.some((c: any) => String(c.userId) === String(userId));
}

router.get("/projects/:id/automations", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!await verifyAccess(req.params.id, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });
    const list = await storage.getAutomations(req.params.id);
    const sanitized = list.map((a: any) => ({
      ...a,
      slackBotToken: a.slackBotToken ? "****" + a.slackBotToken.slice(-4) : null,
      slackSigningSecret: a.slackSigningSecret ? "****" + a.slackSigningSecret.slice(-4) : null,
      telegramBotToken: a.telegramBotToken ? "****" + a.telegramBotToken.slice(-4) : null,
    }));
    res.json(sanitized);
  } catch {
    res.status(500).json({ message: "Failed to fetch automations" });
  }
});

router.post("/projects/:id/automations", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!await verifyAccess(req.params.id, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });
    const { name, type, cronExpression, script, language, slackBotToken, slackSigningSecret, telegramBotToken } = req.body;
    if (!name || !type) return res.status(400).json({ message: "Name and type are required" });

    const data: any = {
      projectId: req.params.id, name, type, script: script || "", language: language || "javascript",
    };
    if (type === "cron" && cronExpression) {
      const { validateCronExpression } = await import("./automationScheduler");
      if (!validateCronExpression(cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
      data.cronExpression = cronExpression;
    }
    if (type === "webhook") {
      const { generateWebhookToken } = await import("./automationScheduler");
      data.webhookToken = generateWebhookToken();
    }
    if (type === "slack") {
      if (!slackBotToken || !slackSigningSecret) return res.status(400).json({ message: "Slack bot token and signing secret are required" });
      data.slackBotToken = slackBotToken;
      data.slackSigningSecret = slackSigningSecret;
    }
    if (type === "telegram") {
      if (!telegramBotToken) return res.status(400).json({ message: "Telegram bot token is required" });
      data.telegramBotToken = telegramBotToken;
    }

    const automation = await storage.createAutomation(data);

    if (type === "cron" && cronExpression && automation.enabled) {
      const { scheduleAutomation } = await import("./automationScheduler");
      scheduleAutomation(automation.id, cronExpression);
    }
    if (type === "slack" && automation.enabled && automation.slackBotToken && automation.slackSigningSecret) {
      try {
        const { startSlackBot } = await import("../slackBot");
        await startSlackBot(automation.id, automation.slackBotToken, automation.slackSigningSecret);
      } catch {}
    }
    if (type === "telegram" && automation.enabled && automation.telegramBotToken) {
      try {
        const { startTelegramBot } = await import("../telegramBot");
        await startTelegramBot(automation.id, automation.telegramBotToken);
      } catch {}
    }

    res.status(201).json(automation);
  } catch {
    res.status(500).json({ message: "Failed to create automation" });
  }
});

router.get("/automations", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const projects = await storage.getProjects(userId);
    const allAutomations: any[] = [];
    for (const p of projects.slice(0, 20)) {
      const autos = await storage.getAutomations(p.id);
      allAutomations.push(...autos);
    }
    res.json(allAutomations);
  } catch {
    res.json([]);
  }
});

router.patch("/automations/:automationId", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomation(req.params.automationId);
    if (!automation) return res.status(404).json({ message: "Not found" });
    if (!await verifyAccess(automation.projectId, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });

    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.script !== undefined) updates.script = req.body.script;
    if (req.body.language !== undefined) updates.language = req.body.language;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.cronExpression !== undefined) {
      const { validateCronExpression } = await import("./automationScheduler");
      if (!validateCronExpression(req.body.cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
      updates.cronExpression = req.body.cronExpression;
    }
    if (req.body.slackBotToken !== undefined) updates.slackBotToken = req.body.slackBotToken;
    if (req.body.slackSigningSecret !== undefined) updates.slackSigningSecret = req.body.slackSigningSecret;
    if (req.body.telegramBotToken !== undefined) updates.telegramBotToken = req.body.telegramBotToken;

    const updated = await storage.updateAutomation(req.params.automationId, updates);

    if (updated && updated.type === "cron") {
      const { scheduleAutomation, unscheduleAutomation } = await import("./automationScheduler");
      if (updated.enabled && updated.cronExpression) {
        scheduleAutomation(updated.id, updated.cronExpression);
      } else {
        unscheduleAutomation(updated.id);
      }
    }
    if (updated && updated.type === "slack") {
      try {
        const { startSlackBot, stopSlackBot } = await import("../slackBot");
        if (updated.enabled && updated.slackBotToken && updated.slackSigningSecret) {
          await startSlackBot(updated.id, updated.slackBotToken, updated.slackSigningSecret);
        } else {
          await stopSlackBot(updated.id);
        }
      } catch {}
    }
    if (updated && updated.type === "telegram") {
      try {
        const { startTelegramBot, stopTelegramBot } = await import("../telegramBot");
        if (updated.enabled && updated.telegramBotToken) {
          await startTelegramBot(updated.id, updated.telegramBotToken);
        } else {
          await stopTelegramBot(updated.id);
        }
      } catch {}
    }

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update automation" });
  }
});

router.delete("/automations/:automationId", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomation(req.params.automationId);
    if (!automation) return res.status(404).json({ message: "Not found" });
    if (!await verifyAccess(automation.projectId, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });

    const { unscheduleAutomation, stopBotAutomation } = await import("./automationScheduler");
    unscheduleAutomation(req.params.automationId);
    await stopBotAutomation(req.params.automationId);

    await storage.deleteAutomation(req.params.automationId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete automation" });
  }
});

router.post("/automations/:automationId/trigger", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomation(req.params.automationId);
    if (!automation) return res.status(404).json({ message: "Not found" });
    if (!await verifyAccess(automation.projectId, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });

    const { executeAutomation } = await import("./automationScheduler");
    let triggeredBy = "manual";
    let eventPayload: string | undefined;

    if (req.body.testMessage && (automation.type === "slack" || automation.type === "telegram")) {
      triggeredBy = `${automation.type}-test`;
      if (automation.type === "slack") {
        eventPayload = JSON.stringify({
          type: "slack_message", text: req.body.testMessage, user: "test-user",
          channel: "test-channel", ts: String(Date.now()),
        });
      } else {
        eventPayload = JSON.stringify({
          type: "telegram_message", messageId: Date.now(), text: req.body.testMessage,
          from: { id: 0, firstName: "Test", lastName: "User", username: "test_user" },
          chat: { id: 0, type: "private", title: undefined }, date: Math.floor(Date.now() / 1000),
        });
      }
    }

    const result = await executeAutomation(req.params.automationId, triggeredBy, eventPayload);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to trigger automation" });
  }
});

router.get("/automations/:automationId/runs", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomation(req.params.automationId);
    if (!automation) return res.status(404).json({ message: "Not found" });
    if (!await verifyAccess(automation.projectId, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });

    const runs = await storage.getAutomationRuns(req.params.automationId);
    res.json(runs);
  } catch {
    res.status(500).json({ message: "Failed to fetch runs" });
  }
});

router.all("/webhooks/automation/:token", async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomationByWebhookToken(req.params.token);
    if (!automation) return res.status(404).json({ message: "Webhook not found" });
    if (!automation.enabled) return res.status(403).json({ message: "Automation is disabled" });

    const { executeAutomation } = await import("./automationScheduler");
    const result = await executeAutomation(automation.id, "webhook");
    res.json(result);
  } catch {
    res.status(500).json({ message: "Webhook execution failed" });
  }
});

router.post("/automations/test-slack", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { botToken, signingSecret } = req.body;
    if (!botToken || !signingSecret) return res.status(400).json({ message: "Bot token and signing secret are required" });
    const { testSlackConnection } = await import("../slackBot");
    const result = await testSlackConnection(botToken, signingSecret);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to test Slack connection" });
  }
});

router.post("/automations/test-telegram", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { botToken } = req.body;
    if (!botToken) return res.status(400).json({ message: "Bot token is required" });
    const { testTelegramConnection } = await import("../telegramBot");
    const result = await testTelegramConnection(botToken);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to test Telegram connection" });
  }
});

router.get("/automations/:automationId/bot-status", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const automation = await storage.getAutomation(req.params.automationId);
    if (!automation) return res.status(404).json({ message: "Not found" });
    if (!await verifyAccess(automation.projectId, (req.session as any).userId)) return res.status(403).json({ message: "Access denied" });

    let status = automation.botStatus || "disconnected";
    if (automation.type === "slack") {
      try {
        const { getSlackBotStatus } = await import("../slackBot");
        status = getSlackBotStatus(automation.id);
      } catch {}
    } else if (automation.type === "telegram") {
      try {
        const { getTelegramBotStatus } = await import("../telegramBot");
        status = getTelegramBotStatus(automation.id);
      } catch {}
    }

    res.json({ status });
  } catch {
    res.status(500).json({ message: "Failed to get bot status" });
  }
});

export default router;
