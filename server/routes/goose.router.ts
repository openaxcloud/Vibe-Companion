import { Router, Request, Response } from "express";
import { getGooseClient, resetGooseClient, validateServerUrl } from "../integrations/goose-client";

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
  const client = getGooseClient(getUserId(req));
  const config = client.getConfig();
  res.json({
    configured: client.isConfigured,
    serverUrl: config.serverUrl || null,
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKey,
  });
});

router.post("/config", requireAuth, (req: Request, res: Response) => {
  const { serverUrl, apiKey, provider, model } = req.body;
  const uid = getUserId(req);

  if (serverUrl && !validateServerUrl(serverUrl)) {
    return res.status(400).json({ error: "Invalid server URL. Must be a public HTTPS endpoint." });
  }

  resetGooseClient(uid);
  const client = getGooseClient(uid);
  client.updateConfig({
    serverUrl: serverUrl || process.env.GOOSE_SERVER_URL || "",
    apiKey: apiKey || process.env.GOOSE_API_KEY || "",
    provider: provider || "anthropic",
    model: model || "claude-sonnet-4-20250514",
  });
  res.json({ ok: true, configured: client.isConfigured });
});

router.get("/health", requireAuth, async (req: Request, res: Response) => {
  const client = getGooseClient(getUserId(req));
  if (!client.isConfigured) {
    return res.json({ ok: false, error: "Goose server URL not configured" });
  }
  const result = await client.checkHealth();
  res.json(result);
});

router.post("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getGooseClient(getUserId(req));
    if (!client.isConfigured) {
      return res.status(400).json({ error: "Goose not configured" });
    }
    const { workingDirectory } = req.body;
    const sessionId = await client.createSession(workingDirectory);
    res.json({ sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sessions/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getGooseClient(getUserId(req));
    const { message } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });

    const response = await client.sendMessage(req.params.id, message);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sessions/:id/stream", requireAuth, async (req: Request, res: Response) => {
  const client = getGooseClient(getUserId(req));
  if (!client.isConfigured) {
    return res.status(400).json({ error: "Goose not configured" });
  }

  const { message } = req.query;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message query param required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    for await (const event of client.streamMessage(req.params.id, message)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  }

  res.end();
});

router.post("/sessions/:id/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getGooseClient(getUserId(req));
    await client.stopSession(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getGooseClient(getUserId(req));
    if (!client.isConfigured) return res.json([]);
    const sessions = await client.listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/sessions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const client = getGooseClient(getUserId(req));
    await client.deleteSession(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
