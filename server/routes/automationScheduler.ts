import type { Express } from "express";

export function initAutomationScheduler(app?: Express): void {}

export function startAutomationScheduler(app?: Express): void {}

export function scheduleAutomation(automationId: string, cron: string): void {}

export function cancelAutomation(automationId: string): void {}

export function getScheduledAutomations(): any[] {
  return [];
}
