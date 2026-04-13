export {
  startAutomationScheduler,
  scheduleAutomation,
  unscheduleAutomation,
  stopBotAutomation,
  executeAutomation,
  generateWebhookToken,
  validateCronExpression,
} from "../automationScheduler";

export function initAutomationScheduler(): Promise<void> {
  return Promise.resolve();
}

export function cancelAutomation(_id: string): void {}

export function getScheduledAutomations(): any[] {
  return [];
}
