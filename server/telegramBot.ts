const activeBots = new Map<string, any>();

export async function startTelegramBot(automationId: string, token: string) {
  activeBots.set(automationId, { token, running: true });
}

export async function stopTelegramBot(automationId: string) {
  activeBots.delete(automationId);
}
