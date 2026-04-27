import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ensureAuthenticated } from '../middleware/auth';
import {
  createDebugSession,
  getDebugSession,
  cleanupSession,
  connectToInspector,
  handleDebugCommand,
  getInspectPort,
  type DebugSession,
} from '../debugger';
import { getProjectWorkspaceDir } from '../terminal';
import { storage } from '../storage';

const debugRouter = Router();

const debugProcesses = new Map<string, ChildProcess>();

async function verifyProjectOwnerOrCollaborator(projectId: string, userId: string): Promise<boolean> {
  const project = await storage.getProject(projectId);
  if (!project) return false;
  if (String(project.userId) === String(userId)) return true;
  try {
    const guests = await storage.getProjectGuests(projectId);
    return guests.some((g: any) => String(g.userId) === String(userId));
  } catch {
    return false;
  }
}

function sanitizeEntryFile(file: string): string {
  const normalized = path.normalize(file).replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.startsWith('..') || normalized.includes('../')) {
    throw new Error('Invalid entry file path — must be relative and inside the project');
  }
  if (normalized.startsWith('-')) {
    throw new Error('Invalid entry file path — must not start with dash');
  }
  return normalized;
}

async function startDebugProcess(projectId: string, entryFile: string): Promise<{ process: ChildProcess; inspectPort: number }> {
  const existingProc = debugProcesses.get(projectId);
  if (existingProc) {
    try { existingProc.kill('SIGTERM'); } catch {}
    debugProcesses.delete(projectId);
  }

  const safeFile = sanitizeEntryFile(entryFile);
  const inspectPort = getInspectPort(projectId);
  let workspaceDir: string;
  try {
    workspaceDir = getProjectWorkspaceDir(projectId);
  } catch {
    workspaceDir = `/tmp/debug-${projectId}`;
  }

  const child = spawn('node', [`--inspect=127.0.0.1:${inspectPort}`, safeFile], {
    cwd: workspaceDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
    shell: false,
  });

  debugProcesses.set(projectId, child);

  child.on('exit', () => {
    debugProcesses.delete(projectId);
  });

  await new Promise(resolve => setTimeout(resolve, 1200));

  return { process: child, inspectPort };
}

debugRouter.get('/session/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session) {
      return res.json({
        projectId,
        isRunning: false,
        isPaused: false,
        breakpoints: [],
        variables: [],
        callStack: [],
        watchExpressions: [],
      });
    }

    return res.json({
      projectId: session.projectId,
      isRunning: !!session.inspectorWs,
      isPaused: session.paused,
      breakpoints: session.breakpoints.map(bp => ({
        id: bp.id,
        file: bp.file,
        line: bp.line,
        condition: bp.condition,
        isEnabled: bp.enabled,
        hitCount: 0,
      })),
      callStack: session.callFrames.map((cf, i) => ({
        id: cf.callFrameId,
        name: cf.functionName,
        file: cf.url,
        line: cf.lineNumber,
        isActive: i === 0,
      })),
      variables: Object.entries(session.scopeVariables).flatMap(([, vars]) =>
        vars.map(v => ({ name: v.name, value: v.value, type: v.type }))
      ),
      watchExpressions: [],
    });
  } catch (error: any) {
    console.error('[Debug] Get session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get debug session' });
  }
});

debugRouter.post('/start/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const { file } = req.body || {};
    const entryFile = file || 'index.js';

    const session = createDebugSession(projectId);

    const { inspectPort } = await startDebugProcess(projectId, entryFile);

    const connected = await connectToInspector(session, inspectPort);

    if (!connected) {
      return res.json({
        message: 'Debug session started but inspector connection pending — process may need a breakpoint to pause',
        session: {
          projectId,
          isRunning: true,
          isPaused: false,
          inspectPort,
          breakpoints: [],
          callStack: [],
          variables: [],
        },
      });
    }

    return res.json({
      message: 'Debug session started and inspector connected',
      session: {
        projectId,
        isRunning: true,
        isPaused: session.paused,
        inspectPort,
        breakpoints: session.breakpoints,
        callStack: session.callFrames,
        variables: [],
      },
    });
  } catch (error: any) {
    console.error('[Debug] Start error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start debugging' });
  }
});

debugRouter.post('/stop/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const proc = debugProcesses.get(projectId);
    if (proc) {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 2000);
      debugProcesses.delete(projectId);
    }

    const session = getDebugSession(projectId);
    if (session) {
      cleanupSession(session);
    }

    return res.json({ message: 'Debug session stopped', session: { projectId, isRunning: false, isPaused: false } });
  } catch (error: any) {
    console.error('[Debug] Stop error:', error);
    return res.status(500).json({ error: error.message || 'Failed to stop debugging' });
  }
});

debugRouter.post('/pause/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session || !session.inspectorWs) {
      return res.status(400).json({ error: 'No active debug session with inspector connection' });
    }

    handleDebugCommand(session, 'pause', {});

    await new Promise(resolve => setTimeout(resolve, 300));

    return res.json({
      message: session.paused ? 'Paused at breakpoint' : 'Pause requested',
      session: {
        projectId,
        isRunning: true,
        isPaused: session.paused,
        callStack: session.callFrames.map((cf, i) => ({
          id: cf.callFrameId,
          name: cf.functionName,
          file: cf.url,
          line: cf.lineNumber,
          isActive: i === 0,
        })),
        variables: Object.entries(session.scopeVariables).flatMap(([, vars]) =>
          vars.map(v => ({ name: v.name, value: v.value, type: v.type }))
        ),
      },
    });
  } catch (error: any) {
    console.error('[Debug] Pause error:', error);
    return res.status(500).json({ error: error.message || 'Failed to pause' });
  }
});

debugRouter.post('/continue/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session || !session.inspectorWs) {
      return res.status(400).json({ error: 'No active debug session' });
    }

    handleDebugCommand(session, 'resume', {});

    return res.json({ message: 'Resumed execution', session: { projectId, isRunning: true, isPaused: false } });
  } catch (error: any) {
    console.error('[Debug] Continue error:', error);
    return res.status(500).json({ error: error.message || 'Failed to continue' });
  }
});

debugRouter.post('/step-over/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session || !session.paused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }

    handleDebugCommand(session, 'stepOver', {});

    await new Promise(resolve => setTimeout(resolve, 200));

    return res.json({
      message: 'Stepped over',
      session: {
        projectId,
        isRunning: true,
        isPaused: session.paused,
        callStack: session.callFrames.map((cf, i) => ({
          id: cf.callFrameId,
          name: cf.functionName,
          file: cf.url,
          line: cf.lineNumber,
          isActive: i === 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Debug] Step over error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step over' });
  }
});

debugRouter.post('/step-into/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session || !session.paused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }

    handleDebugCommand(session, 'stepInto', {});

    await new Promise(resolve => setTimeout(resolve, 200));

    return res.json({
      message: 'Stepped into',
      session: {
        projectId,
        isRunning: true,
        isPaused: session.paused,
        callStack: session.callFrames.map((cf, i) => ({
          id: cf.callFrameId,
          name: cf.functionName,
          file: cf.url,
          line: cf.lineNumber,
          isActive: i === 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Debug] Step into error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step into' });
  }
});

debugRouter.post('/step-out/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const session = getDebugSession(projectId);

    if (!session || !session.paused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }

    handleDebugCommand(session, 'stepOut', {});

    await new Promise(resolve => setTimeout(resolve, 200));

    return res.json({
      message: 'Stepped out',
      session: {
        projectId,
        isRunning: true,
        isPaused: session.paused,
        callStack: session.callFrames.map((cf, i) => ({
          id: cf.callFrameId,
          name: cf.functionName,
          file: cf.url,
          line: cf.lineNumber,
          isActive: i === 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Debug] Step out error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step out' });
  }
});

const toggleBreakpointSchema = z.object({
  file: z.string(),
  line: z.number(),
  condition: z.string().optional(),
});

debugRouter.post('/breakpoint/toggle/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req.session as any)?.passport?.user || (req.session as any)?.userId;
    if (!userId || !(await verifyProjectOwnerOrCollaborator(projectId, userId))) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const body = toggleBreakpointSchema.parse(req.body);
    const session = getDebugSession(projectId);

    if (!session) {
      return res.status(400).json({ error: 'No active debug session — start debugging first' });
    }

    const existing = session.breakpoints.find(bp => bp.file === body.file && bp.line === body.line);
    if (existing) {
      handleDebugCommand(session, 'removeBreakpoint', { breakpointId: existing.id });
      return res.json({ message: 'Breakpoint removed', breakpoints: session.breakpoints });
    } else {
      handleDebugCommand(session, 'setBreakpoint', { file: body.file, line: body.line, condition: body.condition });
      return res.json({ message: 'Breakpoint added', breakpoints: session.breakpoints });
    }
  } catch (error: any) {
    console.error('[Debug] Toggle breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle breakpoint' });
  }
});

debugRouter.post('/breakpoint/enable/:projectId/:breakpointId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, breakpointId } = req.params;
    const session = getDebugSession(projectId);

    if (!session) {
      return res.status(400).json({ error: 'No active debug session' });
    }

    const bp = session.breakpoints.find(b => b.id === breakpointId);
    if (!bp) {
      return res.status(404).json({ error: 'Breakpoint not found' });
    }

    bp.enabled = !bp.enabled;

    return res.json({ message: 'Breakpoint toggled', breakpoints: session.breakpoints });
  } catch (error: any) {
    console.error('[Debug] Enable breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to enable breakpoint' });
  }
});

debugRouter.delete('/breakpoint/:projectId/:breakpointId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, breakpointId } = req.params;
    const session = getDebugSession(projectId);

    if (!session) {
      return res.status(400).json({ error: 'No active debug session' });
    }

    handleDebugCommand(session, 'removeBreakpoint', { breakpointId });

    return res.json({ message: 'Breakpoint deleted', breakpoints: session.breakpoints });
  } catch (error: any) {
    console.error('[Debug] Delete breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete breakpoint' });
  }
});

const addWatchSchema = z.object({
  expression: z.string(),
});

debugRouter.post('/watch/add/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const body = addWatchSchema.parse(req.body);
    const session = getDebugSession(projectId);

    if (!session) {
      return res.status(400).json({ error: 'No active debug session' });
    }

    handleDebugCommand(session, 'evaluate', { expression: body.expression });

    return res.json({ message: 'Watch expression evaluated' });
  } catch (error: any) {
    console.error('[Debug] Add watch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add watch expression' });
  }
});

debugRouter.delete('/watch/:projectId/:index', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getDebugSession(projectId);

    return res.json({ message: 'Watch expression removed' });
  } catch (error: any) {
    console.error('[Debug] Remove watch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to remove watch expression' });
  }
});

export default debugRouter;
