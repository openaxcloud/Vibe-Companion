import { App as SlackApp, ExpressReceiver } from "@slack/bolt";
import { log } from "./index";
import { storage } from "./storage";
import { executeAutomation } from "./automationScheduler";
import type { Express, Router } from "express";

interface SlackMessagePayload {
  type: "slack_message";
  text: string;
  user: string;
  channel: string;
  ts: string;
  threadTs?: string;
}

interface SlackCommandPayload {
  type: "slack_command";
  command: string;
  text: string;
  user: string;
  userName: string;
  channel: string;
  channelName: string;
}

interface SlackTestResult {
  success: boolean;
  teamName?: string;
  error?: string;
}

interface ActiveBot {
  app: SlackApp;
  receiver: ExpressReceiver;
}

const activeBots = new Map<string, ActiveBot>();
const botRouters = new Map<string, Router>();
let expressApp: Express | null = null;
let dispatchRouterInstalled = false;

export function setExpressApp(app: Express) {
  expressApp = app;

  if (!dispatchRouterInstalled) {
    app.use("/api/slack/events/:automationId", (req, res, next) => {
      const automationId = req.params.automationId;
      const router = botRouters.get(automationId);
      if (router) {
        return router(req, res, next);
      }
      res.status(404).json({ message: "Bot not found or disconnected" });
    });
    dispatchRouterInstalled = true;
  }
}

export async function startSlackBot(automationId: string, botToken: string, signingSecret: string): Promise<{ success: boolean; error?: string }> {
  try {
    await stopSlackBot(automationId);

    const receiver = new ExpressReceiver({
      signingSecret,
      endpoints: "/",
      processBeforeResponse: true,
    });

    const app = new SlackApp({
      token: botToken,
      receiver,
    });

    const handledTimestamps = new Set<string>();

    app.message(async ({ message, say }) => {
      try {
        const msg = message as unknown as Record<string, unknown>;
        const ts = (msg.ts as string) || "";
        if (handledTimestamps.has(ts)) return;
        handledTimestamps.add(ts);
        if (handledTimestamps.size > 1000) {
          const entries = [...handledTimestamps];
          entries.splice(0, entries.length - 500);
          handledTimestamps.clear();
          entries.forEach(e => handledTimestamps.add(e));
        }

        const payload: SlackMessagePayload = {
          type: "slack_message",
          text: (msg.text as string) || "",
          user: (msg.user as string) || "",
          channel: (msg.channel as string) || "",
          ts,
          threadTs: (msg.thread_ts as string) || undefined,
        };

        const result = await executeAutomation(automationId, "slack", JSON.stringify(payload));
        if (result.success && result.response) {
          await say(result.response);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Slack bot message handler error for ${automationId}: ${errMsg}`, "automation");
      }
    });

    app.command(/.*/, async ({ command, ack, respond }) => {
      await ack();
      try {
        const payload: SlackCommandPayload = {
          type: "slack_command",
          command: command.command,
          text: command.text,
          user: command.user_id,
          userName: command.user_name,
          channel: command.channel_id,
          channelName: command.channel_name,
        };

        const result = await executeAutomation(automationId, "slack", JSON.stringify(payload));
        if (result.success && result.response) {
          await respond(result.response);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Slack bot command handler error for ${automationId}: ${errMsg}`, "automation");
      }
    });

    botRouters.set(automationId, receiver.router);
    activeBots.set(automationId, { app, receiver });
    await storage.updateAutomation(automationId, { botStatus: "connected" });
    log(`Slack bot started for automation ${automationId}`, "automation");
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await storage.updateAutomation(automationId, { botStatus: "error" });
    log(`Failed to start Slack bot for ${automationId}: ${errMsg}`, "automation");
    return { success: false, error: errMsg };
  }
}

export async function stopSlackBot(automationId: string): Promise<void> {
  const existing = activeBots.get(automationId);
  if (existing) {
    try {
      await existing.app.stop();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Error stopping Slack bot for ${automationId}: ${errMsg}`, "automation");
    }
    activeBots.delete(automationId);
    botRouters.delete(automationId);
    await storage.updateAutomation(automationId, { botStatus: "disconnected" });
    log(`Slack bot stopped for automation ${automationId}`, "automation");
  }
}

export async function testSlackConnection(botToken: string, _signingSecret: string): Promise<SlackTestResult> {
  try {
    const response = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const data = await response.json() as { ok: boolean; team?: string; error?: string };

    if (data.ok) {
      return { success: true, teamName: data.team };
    }
    return { success: false, error: data.error || "Authentication failed" };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

export function getSlackBotStatus(automationId: string): string {
  return activeBots.has(automationId) ? "connected" : "disconnected";
}

export async function stopAllSlackBots(): Promise<void> {
  for (const [id] of activeBots) {
    await stopSlackBot(id);
  }
}
