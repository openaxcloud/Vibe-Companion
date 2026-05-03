import { Router } from 'express';
import { ChildProcess } from 'child_process';
import { ensureAuthenticated } from '../middleware/auth';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { redisSessionManager } from '../terminal/redis-session-manager';
import { getPTYTerminalService } from '../terminal/pty-terminal-service';

const logger = createLogger('shell-router');
const router = Router();

interface ShellSession {
  id: string;
  userId: number;
  process: ChildProcess;
  cwd: string;
  created: Date;
}

const shellSessions = new Map<string, ShellSession>();
const projectSyncCache = new Map<string, number>(); // projectId -> last sync timestamp
const SHELL_SYNC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up stale legacy shell sessions (used by REST routes below)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of Array.from(shellSessions.entries())) {
    if (now - session.created.getTime() > 24 * 60 * 60 * 1000) {
      session.process.kill();
      shellSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

// Register the /shell 410 handler with the central dispatcher.
// The legacy WebSocketServer and connection handler have been removed;
// all terminal traffic now routes through /api/terminal/ws → PTYTerminalService.
function initializeShellWebSocket() {
  
  // /shell WS retired; return 410. REST routes below remain active.
  centralUpgradeDispatcher.register(
    '/shell',
    (_req: IncomingMessage, socket: Duplex) => {
      socket.write('HTTP/1.1 410 Gone\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
    },
    { pathMatch: 'exact', priority: 35 }
  );
}

// Initialize immediately when module loads
initializeShellWebSocket();

// API endpoint to get shell sessions
router.get('/sessions', ensureAuthenticated, (req, res) => {
  const userId = (req.user as any).id;
  const sessions = Array.from(shellSessions.values())
    .filter(session => String(session.userId) === String(userId))
    .map(session => ({
      id: session.id,
      created: session.created,
      cwd: session.cwd,
    }));
  
  res.json(sessions);
});

// API endpoint to create a new shell session
router.post('/sessions', ensureAuthenticated, (req, res) => {
  const sessionId = `shell-${Date.now()}-${process.hrtime.bigint().toString(36).slice(0, 9)}`;
  res.json({ sessionId });
});

// API endpoint to kill a shell session
router.delete('/sessions/:sessionId', ensureAuthenticated, (req, res) => {
  const { sessionId } = req.params;
  const session = shellSessions.get(sessionId);
  
  if (session && session.userId === (req.user as any).id) {
    session.process.kill();
    shellSessions.delete(sessionId);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// API endpoint to generate shell command with AI
router.post('/generate-command', ensureAuthenticated, async (req, res) => {
  try {
    const { prompt, projectId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use OpenAI to generate shell command
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `You are a shell command generator. Given a natural language description, output ONLY the shell command that accomplishes the task. No explanations, no markdown, just the raw command. The command should work in a bash shell on Linux. Be concise and accurate.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const command = completion.choices[0]?.message?.content?.trim() || '';
    
    res.json({ command, prompt });
  } catch (error) {
    logger.error('Shell command generation error:', error);
    res.status(500).json({ error: 'Failed to generate command' });
  }
});

// API endpoint to clear shell output (reset session buffer).
// Requires project ownership — prevents IDOR-style session mutation.
router.post('/clear', ensureAuthenticated, async (req, res) => {
  const { sessionId, projectId } = req.body;
  const userId = (req.user as any)?.id;

  if (!projectId || !sessionId) {
    return res.status(400).json({ error: 'projectId and sessionId are required' });
  }

  // Authorization: verify project ownership before mutating session state.
  // storage.getProject() accepts string IDs; no numeric-only assumption.
  try {
    const project = await storage.getProject(String(projectId));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.ownerId !== userId) {
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
  } catch (authErr) {
    logger.error(`Authorization check failed for clear: ${authErr}`);
    return res.status(500).json({ error: 'Authorization check failed' });
  }

  const sessionKey = `${projectId}:${sessionId}`;
  const ptyService = getPTYTerminalService();
  if (ptyService) {
    await ptyService.clearSessionBuffer(sessionKey).catch(err =>
      logger.error(`Failed to clear session buffer for ${sessionKey}: ${err}`)
    );
  }
  res.json({ success: true, sessionId });
});

// Download the raw output scrollback for a PTY session as a plain-text log file.
// Checks project ownership before reading session data.
router.get('/log/:projectId/:sessionId', ensureAuthenticated, async (req, res) => {
  const { projectId, sessionId } = req.params;
  const userId = (req.user as any)?.id;

  // Authorization: verify project ownership before returning session data.
  // storage.getProject() accepts string IDs; no numeric-only assumption.
  try {
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.ownerId !== userId) {
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
  } catch (authErr) {
    logger.error(`Authorization check failed for log download: ${authErr}`);
    return res.status(500).json({ error: 'Authorization check failed' });
  }

  const sessionKey = `${projectId}:${sessionId}`;
  const redisKey = `terminal-${sessionKey}`;
  try {
    // Prefer live in-memory scrollback; fall back to last Redis checkpoint.
    const ptyService = getPTYTerminalService();
    const liveSnapshot = ptyService?.getOutputSnapshot(sessionKey) ?? null;

    let text: string;
    if (liveSnapshot !== null && liveSnapshot.length > 0) {
      text = liveSnapshot;
    } else {
      const checkpoint = await redisSessionManager.getSession(redisKey);
      text = checkpoint?.outputSnapshot ?? '';
      if (!text && checkpoint?.commandHistory?.length) {
        text = checkpoint.commandHistory.join('\n') + '\n';
      }
      if (!text) {
        text = '# No output recorded for this session.\n';
      }
    }

    const filename = `shell-log-${projectId}-${sessionId}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  } catch (err) {
    logger.error(`Failed to fetch session log for ${redisKey}: ${err}`);
    res.status(500).json({ error: 'Failed to retrieve session log' });
  }
});

export function setupShellWebSocket(_server: any) {
  return null;
}

export default router;
