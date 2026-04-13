import { Router, Request, Response } from 'express';
import { claudeAgentService, AgentEvent } from '../services/claude-agent-service';

const router = Router();

function getAuthUserId(req: Request): string | null {
  const uid = (req as any).session?.passport?.user || (req as any).session?.userId;
  return uid ? String(uid) : null;
}

router.post('/projects/:projectId/agent/session', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!claudeAgentService.isConfigured()) {
      return res.status(503).json({
        error: 'Claude Agent SDK not configured',
        message: 'Missing ANTHROPIC_API_KEY, CLAUDE_AGENT_ID, or CLAUDE_ENVIRONMENT_ID',
      });
    }

    const { sessionId, claudeSessionId } = await claudeAgentService.getOrCreateSession(projectId, userId);
    res.json({ sessionId, claudeSessionId, configured: true });
  } catch (err: any) {
    console.error('[claude-agent-router] Session creation error:', err.message);
    res.status(500).json({ error: 'Failed to create agent session', message: err.message });
  }
});

router.post('/projects/:projectId/agent/message', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId, claudeSessionId, message } = req.body;

    if (!message || !claudeSessionId) {
      return res.status(400).json({ error: 'Missing sessionId/claudeSessionId or message' });
    }

    const sendResponse = await claudeAgentService.sendMessage(claudeSessionId, message);

    res.json({ success: true, response: sendResponse });
  } catch (err: any) {
    console.error('[claude-agent-router] Message error:', err.message);
    res.status(500).json({ error: 'Failed to send message', message: err.message });
  }
});

router.get('/projects/:projectId/agent/stream', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { projectId } = req.params;
    const { sessionId, claudeSessionId } = req.query;

    if (!claudeSessionId || !sessionId) {
      return res.status(400).json({ error: 'Missing sessionId or claudeSessionId query param' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    const onEvent = (event: AgentEvent) => {
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    const numericUserId = parseInt(userId, 10);
    await claudeAgentService.processAgentEvents(
      claudeSessionId as string,
      projectId,
      sessionId as string,
      onEvent,
      isNaN(numericUserId) ? undefined : numericUserId,
    );

    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'stream_end' })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    console.error('[claude-agent-router] Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed', message: err.message });
    } else if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'agent_error', data: { message: err.message } })}\n\n`);
      res.end();
    }
  }
});

router.post('/projects/:projectId/agent/archive', async (req: Request, res: Response) => {
  try {
    const { sessionId, claudeSessionId } = req.body;

    if (!sessionId || !claudeSessionId) {
      return res.status(400).json({ error: 'Missing sessionId or claudeSessionId' });
    }

    await claudeAgentService.archiveSession(claudeSessionId, sessionId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[claude-agent-router] Archive error:', err.message);
    res.status(500).json({ error: 'Failed to archive session', message: err.message });
  }
});

router.get('/projects/:projectId/agent/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.json({ configured: claudeAgentService.isConfigured(), streaming: false, active: false });
    }

    const status = await claudeAgentService.getSessionStatus(sessionId as string);
    res.json({ configured: claudeAgentService.isConfigured(), ...status });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get status', message: err.message });
  }
});

export default router;
