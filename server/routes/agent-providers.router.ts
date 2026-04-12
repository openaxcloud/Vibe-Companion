import { Router, Request, Response } from "express";
import { getOpenHandsClient } from "../integrations/openhands-client";
import { getGooseClient } from "../integrations/goose-client";

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

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  const uid = getUserId(req);
  const oh = getOpenHandsClient(uid);
  const goose = getGooseClient(uid);

  const [ohHealth, gooseHealth] = await Promise.all([
    oh.isConfigured ? oh.checkHealth().catch(() => ({ ok: false, error: "unreachable" })) : Promise.resolve({ ok: false, error: "not configured" }),
    goose.isConfigured ? goose.checkHealth().catch(() => ({ ok: false, error: "unreachable" })) : Promise.resolve({ ok: false, error: "not configured" }),
  ]);

  res.json({
    providers: {
      builtin: { available: true, healthy: true, name: "E-Code AI", description: "Built-in GPT-4 / Claude agent" },
      openhands: {
        available: oh.isConfigured,
        healthy: ohHealth.ok,
        version: (ohHealth as any).version,
        error: (ohHealth as any).error,
        name: "OpenHands",
        description: "Autonomous AI engineer (MIT, 70k+ stars)",
      },
      goose: {
        available: goose.isConfigured,
        healthy: gooseHealth.ok,
        version: (gooseHealth as any).version,
        error: (gooseHealth as any).error,
        name: "Goose",
        description: "AI agent by Block / Linux Foundation (Apache 2.0)",
      },
    },
  });
});

router.post("/message", requireAuth, async (req: Request, res: Response) => {
  const { provider, message, sessionId, projectId } = req.body;
  const uid = getUserId(req);

  if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });

  if (provider === "openhands") {
    const client = getOpenHandsClient(uid);
    if (!client.isConfigured) {
      return res.status(400).json({ error: "OpenHands not configured. Set server URL in settings." });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      let convId = sessionId;
      if (!convId) {
        res.write(`data: ${JSON.stringify({ type: "text", content: "> Starting OpenHands sandbox...\n" })}\n\n`);
        convId = await client.createConversation(message);
      } else {
        await client.sendMessage(convId, message);
      }

      res.write(`data: ${JSON.stringify({ type: "session", conversationId: convId })}\n\n`);

      res.write(`data: ${JSON.stringify({ type: "text", content: "> Waiting for agent response...\n" })}\n\n`);

      try {
        for await (const event of client.streamEvents(convId)) {
          const mapped = {
            type: event.action ? "action" : event.observation ? "observation" : "text",
            source: event.source,
            action: event.action,
            observation: event.observation,
            message: event.message || event.content,
            content: event.content || event.message,
            args: event.args,
            extras: event.extras,
          };
          res.write(`data: ${JSON.stringify(mapped)}\n\n`);
        }
      } catch (streamErr: any) {
        res.write(`data: ${JSON.stringify({ type: "error", message: streamErr.message })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
      }
    }

  } else if (provider === "goose") {
    const client = getGooseClient(uid);
    if (!client.isConfigured) {
      return res.status(400).json({ error: "Goose not configured. Set server URL in settings." });
    }

    try {
      let sId = sessionId;
      if (!sId) {
        sId = await client.createSession(`/workspace/projects/${projectId || "default"}`);
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      res.write(`data: ${JSON.stringify({ type: "session", sessionId: sId })}\n\n`);

      try {
        for await (const event of client.streamMessage(sId, message)) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (streamErr: any) {
        res.write(`data: ${JSON.stringify({ type: "error", message: streamErr.message })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        res.end();
      }
    }

  } else {
    return res.status(400).json({ error: "Use /api/ai/* for the built-in provider" });
  }
});

export default router;
