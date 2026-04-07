const activeBots = new Map<string, any>();

export async function startSlackBot(automationId: string, token: string, signingSecret: string) {
  activeBots.set(automationId, { token, running: true });
}

export async function stopSlackBot(automationId: string) {
  activeBots.delete(automationId);
}

export function setExpressApp(_app: any) {}
