import { Telegraf } from "telegraf";
import { log } from "./index";
import { storage } from "./storage";
import { executeAutomation } from "./automationScheduler";

interface TelegramUser {
  id: number | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  username: string | undefined;
}

interface TelegramChat {
  id: number;
  type: string;
  title: string | undefined;
}

interface TelegramMessagePayload {
  type: "telegram_message";
  messageId: number;
  text: string;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
}

interface TelegramCommandPayload {
  type: "telegram_command";
  command: string;
  args: string;
  text: string;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
}

interface TelegramTestResult {
  success: boolean;
  botName?: string;
  error?: string;
}

const activeBots = new Map<string, Telegraf>();

function extractUser(from: Record<string, unknown> | undefined): TelegramUser {
  return {
    id: from?.id as number | undefined,
    firstName: from?.first_name as string | undefined,
    lastName: from?.last_name as string | undefined,
    username: from?.username as string | undefined,
  };
}

function extractChat(chat: Record<string, unknown>): TelegramChat {
  return {
    id: chat.id as number,
    type: chat.type as string,
    title: chat.title as string | undefined,
  };
}

export async function startTelegramBot(automationId: string, botToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    await stopTelegramBot(automationId);

    const bot = new Telegraf(botToken);

    bot.on("message", async (ctx) => {
      try {
        const msg = ctx.message as unknown as Record<string, unknown>;
        const text = (msg.text as string) || "";

        if (text.startsWith("/")) {
          const commandMatch = text.match(/^\/(\S+)\s*(.*)?$/);
          const payload: TelegramCommandPayload = {
            type: "telegram_command",
            command: commandMatch ? commandMatch[1] : "",
            args: commandMatch ? (commandMatch[2] || "").trim() : "",
            text,
            from: extractUser(msg.from as Record<string, unknown> | undefined),
            chat: extractChat(msg.chat as Record<string, unknown>),
            date: msg.date as number,
          };

          const result = await executeAutomation(automationId, "telegram", JSON.stringify(payload));
          if (result.success && result.response) {
            await ctx.reply(result.response);
          }
          return;
        }

        const payload: TelegramMessagePayload = {
          type: "telegram_message",
          messageId: msg.message_id as number,
          text,
          from: extractUser(msg.from as Record<string, unknown> | undefined),
          chat: extractChat(msg.chat as Record<string, unknown>),
          date: msg.date as number,
        };

        const result = await executeAutomation(automationId, "telegram", JSON.stringify(payload));
        if (result.success && result.response) {
          await ctx.reply(result.response);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Telegram bot message handler error for ${automationId}: ${errMsg}`, "automation");
      }
    });

    bot.catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Telegram bot error for ${automationId}: ${errMsg}`, "automation");
    });

    await bot.launch({ dropPendingUpdates: true });
    activeBots.set(automationId, bot);
    await storage.updateAutomation(automationId, { botStatus: "connected" });
    log(`Telegram bot started for automation ${automationId}`, "automation");
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await storage.updateAutomation(automationId, { botStatus: "error" });
    log(`Failed to start Telegram bot for ${automationId}: ${errMsg}`, "automation");
    return { success: false, error: errMsg };
  }
}

export async function stopTelegramBot(automationId: string): Promise<void> {
  const existing = activeBots.get(automationId);
  if (existing) {
    try {
      existing.stop("stopTelegramBot");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Error stopping Telegram bot for ${automationId}: ${errMsg}`, "automation");
    }
    activeBots.delete(automationId);
    await storage.updateAutomation(automationId, { botStatus: "disconnected" });
    log(`Telegram bot stopped for automation ${automationId}`, "automation");
  }
}

export async function testTelegramConnection(botToken: string): Promise<TelegramTestResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json() as { ok: boolean; result?: { username: string }; description?: string };

    if (data.ok && data.result) {
      return { success: true, botName: data.result.username };
    }
    return { success: false, error: data.description || "Authentication failed" };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

export function getTelegramBotStatus(automationId: string): string {
  return activeBots.has(automationId) ? "connected" : "disconnected";
}

export async function stopAllTelegramBots(): Promise<void> {
  for (const [id] of activeBots) {
    await stopTelegramBot(id);
  }
}
