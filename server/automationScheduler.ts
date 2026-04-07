import { randomBytes } from "crypto";

export function validateCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

export function generateWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

export async function startAutomationScheduler() {}
