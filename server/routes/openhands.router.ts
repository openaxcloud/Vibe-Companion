import { Router, Request, Response } from "express";
import { getOpenHandsClient, resetOpenHandsClient, validateServerUrl } from "../integrations/openhands-client";

const router = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!(req as any).session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function getUserId(req: Request): string {
  return (req as any).session.userId;
}

router.get("/config", requireAuth, (req: Request, res: Response) => {
  const client = getOpenHandsClient(getUserId(req));
  const config = client.getConfig();
  res.json({
    configured: client.isConfigured,
    serverUrl: config.serverUrl || null,
    model: config.model,
    hasApiKey: !!config.apiKey,
  });
});

router.post("/config", requireAuth, (req: Request, res: Response) => {
  const { serverUrl, apiKey, model, maxIterations } = req.body;
  const uid = getUserId(req);

  if (serverUrl && !validateServerUrl(serverUrl)) {
    return res.status(400).json({ error: "Invalid server URL. Must be a public HTTPS endpoint." });
  }

  resetOpenHandsClient(uid);
  const client = getOpenHandsClient(uid);
  client.updateConfig({
    serverUrl: serverUrl || process.env.OPENHANDS_SERVER_URL || "",
    apiKey: apiKey || process.env.OPENHANDS_API_KEY || "",
    model: model || "claude-sonnet-4-6",
    maxIterations: maxIterations || 50,
  });
  res.json({ ok: true, configured: client.isConfigured });
});

router.get("/health", requireAuth, async (req: Request, res: Response) => {
  const client = getOpenHandsClient(getUserId(req));
  if (!client.isConfigured) {
    return res.json({ ok: false, error: "OpenHands server URL not configured" });
  }
  const result = await client.checkHealth();
  res.json(result);
});

router.post("/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    if (!client.isConfigured) {
      return res.status(400).json({ error: "OpenHands not configured" });
    }
    const { message } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });

    const conversationId = await client.createConversation(message);
    res.json({ conversationId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    const { message } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });

    await client.sendMessage(req.params.id, message);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/conversations/:id/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    const events = await client.getEvents(req.params.id);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/conversations/:id/stream", requireAuth, async (req: Request, res: Response) => {
  const client = getOpenHandsClient(getUserId(req));
  if (!client.isConfigured) {
    return res.status(400).json({ error: "OpenHands not configured" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    for await (const event of client.streamEvents(req.params.id)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  }

  res.end();
});

router.post("/conversations/:id/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    await client.stopConversation(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    if (!client.isConfigured) return res.json([]);
    const conversations = await client.listConversations();
    res.json(conversations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getOpenHandsClient(getUserId(req));
    await client.deleteConversation(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
