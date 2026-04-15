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

      const startTime = Date.now();
      const modifiedFiles = new Set<string>();

      try {
        for await (const event of client.streamEvents(convId)) {
          if (event.action === "run") {
            res.write(`data: ${JSON.stringify({ type: "tool_use", name: "execute_command", input: { command: event.args?.command || "" } })}\n\n`);
          } else if (event.action === "write") {
            const filePath = event.args?.path || "";
            if (filePath) modifiedFiles.add(filePath);
            res.write(`data: ${JSON.stringify({ type: "tool_use", name: "create_file", input: { filename: filePath, content: event.args?.content || "" } })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "file_created", file: { filename: filePath } })}\n\n`);
          } else if (event.action === "read") {
            res.write(`data: ${JSON.stringify({ type: "tool_use", name: "read_file", input: { filename: event.args?.path || "" } })}\n\n`);
          } else if (event.action === "browse") {
            res.write(`data: ${JSON.stringify({ type: "tool_use", name: "web_browse", input: { url: event.args?.url || "" } })}\n\n`);
          } else if (event.action === "message") {
            const text = event.message || event.args?.content || event.content || "";
            if (text) res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
          } else if (event.observation) {
            const obsText = event.message || event.content || event.observation || "";
            if (obsText) {
              const truncated = obsText.length > 2000 ? obsText.slice(0, 2000) + "\n...(truncated)" : obsText;
              res.write(`data: ${JSON.stringify({ type: "tool_result", content: truncated })}\n\n`);
            }
          } else if (event.action) {
            res.write(`data: ${JSON.stringify({ type: "tool_use", name: event.action, input: event.args || {} })}\n\n`);
          } else {
            const text = event.content || event.message || "";
            if (text) res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
          }
        }
      } catch (streamErr: any) {
        res.write(`data: ${JSON.stringify({ type: "error", message: streamErr.message })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "usage_stats", duration: Date.now() - startTime, provider: "openhands", model: "openhands", filesModified: modifiedFiles.size })}\n\n`);
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

      const gooseStartTime = Date.now();
      const gooseModifiedFiles = new Set<string>();

      try {
        for await (const event of client.streamMessage(sId, message)) {
          if (event.type === "action") {
            if (event.action === "run") {
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: "execute_command", input: { command: event.args?.command || "" } })}\n\n`);
            } else if (event.action === "write") {
              const fp = event.args?.path || "";
              if (fp) gooseModifiedFiles.add(fp);
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: "create_file", input: { filename: fp } })}\n\n`);
              res.write(`data: ${JSON.stringify({ type: "file_created", file: { filename: fp } })}\n\n`);
            } else if (event.action === "read") {
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: "read_file", input: { filename: event.args?.path || "" } })}\n\n`);
            } else if (event.action === "message") {
              const txt = event.message || event.content || "";
              if (txt) res.write(`data: ${JSON.stringify({ type: "text", content: txt })}\n\n`);
            } else {
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: event.action || "unknown", input: event.args || {} })}\n\n`);
            }
          } else if (event.type === "observation") {
            const obs = event.message || event.content || "";
            if (obs) {
              const trunc = obs.length > 2000 ? obs.slice(0, 2000) + "\n...(truncated)" : obs;
              res.write(`data: ${JSON.stringify({ type: "tool_result", content: trunc })}\n\n`);
            }
          } else if (event.type === "text" || event.type === "content") {
            const txt = event.content || event.text || event.message || "";
            if (txt) res.write(`data: ${JSON.stringify({ type: "text", content: txt })}\n\n`);
          } else if (event.type === "error") {
            res.write(`data: ${JSON.stringify({ type: "error", message: event.message || "Goose error" })}\n\n`);
          } else if (event.message || event.content) {
            res.write(`data: ${JSON.stringify({ type: "text", content: event.message || event.content })}\n\n`);
          }
        }
      } catch (streamErr: any) {
        res.write(`data: ${JSON.stringify({ type: "error", message: streamErr.message })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "usage_stats", duration: Date.now() - gooseStartTime, provider: "goose", model: "goose", filesModified: gooseModifiedFiles.size })}\n\n`);
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
