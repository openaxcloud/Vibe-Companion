import type { Express } from "express";

export async function sendSlackNotification(message: string, channel?: string): Promise<void> {}

export async function sendSlackAlert(type: string, data: any): Promise<void> {}

export function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL);
}

export function setExpressApp(app: Express): void {}
