import type { Express } from "express";

export async function initAutomationScheduler(app?: Express): Promise<void> {}

export async function startAutomationScheduler(app?: Express): Promise<void> {}

export function scheduleAutomation(automationId: string, cron: string): void {}

export function cancelAutomation(automationId: string): void {}

export function getScheduledAutomations(): any[] {
  return [];
}
