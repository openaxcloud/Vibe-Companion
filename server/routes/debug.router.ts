import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';

const debugRouter = Router();

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  isEnabled: boolean;
  hitCount: number;
}

interface Variable {
  name: string;
  value: any;
  type: string;
  children?: Variable[];
}

interface CallStackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  isActive: boolean;
}

interface DebugSession {
  projectId: string;
  isRunning: boolean;
  isPaused: boolean;
  breakpoints: Breakpoint[];
  variables: Variable[];
  callStack: CallStackFrame[];
  watchExpressions: string[];
  currentFile?: string;
  currentLine?: number;
}

const debugSessions = new Map<string, DebugSession>();

function getOrCreateSession(projectId: string): DebugSession {
  if (!debugSessions.has(projectId)) {
    debugSessions.set(projectId, {
      projectId,
      isRunning: false,
      isPaused: false,
      breakpoints: [],
      variables: [],
      callStack: [],
      watchExpressions: []
    });
  }
  return debugSessions.get(projectId)!;
}

debugRouter.get('/session/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    return res.json(session);
  } catch (error: any) {
    console.error('[Debug] Get session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get debug session' });
  }
});

debugRouter.post('/start/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    session.isRunning = true;
    session.isPaused = false;
    
    return res.json({ message: 'Debug session started', session });
  } catch (error: any) {
    console.error('[Debug] Start error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start debugging' });
  }
});

debugRouter.post('/stop/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    session.isRunning = false;
    session.isPaused = false;
    session.variables = [];
    session.callStack = [];
    
    return res.json({ message: 'Debug session stopped', session });
  } catch (error: any) {
    console.error('[Debug] Stop error:', error);
    return res.status(500).json({ error: error.message || 'Failed to stop debugging' });
  }
});

debugRouter.post('/pause/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    if (!session.isRunning) {
      return res.status(400).json({ error: 'Debug session is not running' });
    }
    
    session.isPaused = true;
    
    session.variables = [
      {
        name: 'user',
        value: { id: 123, name: 'John Doe', role: 'admin' },
        type: 'object',
        children: [
          { name: 'id', value: 123, type: 'number' },
          { name: 'name', value: 'John Doe', type: 'string' },
          { name: 'role', value: 'admin', type: 'string' }
        ]
      },
      {
        name: 'isAuthenticated',
        value: true,
        type: 'boolean'
      }
    ];
    
    session.callStack = [
      {
        id: '1',
        name: 'handleSubmit',
        file: 'src/components/LoginForm.tsx',
        line: 45,
        isActive: true
      },
      {
        id: '2',
        name: 'authenticate',
        file: 'src/utils/auth.ts',
        line: 23,
        isActive: false
      }
    ];
    
    return res.json({ message: 'Paused at breakpoint', session });
  } catch (error: any) {
    console.error('[Debug] Pause error:', error);
    return res.status(500).json({ error: error.message || 'Failed to pause' });
  }
});

debugRouter.post('/continue/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    if (!session.isRunning) {
      return res.status(400).json({ error: 'Debug session is not running' });
    }
    
    session.isPaused = false;
    session.variables = [];
    session.callStack = [];
    
    return res.json({ message: 'Resumed execution', session });
  } catch (error: any) {
    console.error('[Debug] Continue error:', error);
    return res.status(500).json({ error: error.message || 'Failed to continue' });
  }
});

debugRouter.post('/step-over/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    if (!session.isPaused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }
    
    return res.json({ message: 'Stepped over', session });
  } catch (error: any) {
    console.error('[Debug] Step over error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step over' });
  }
});

debugRouter.post('/step-into/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    if (!session.isPaused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }
    
    return res.json({ message: 'Stepped into', session });
  } catch (error: any) {
    console.error('[Debug] Step into error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step into' });
  }
});

debugRouter.post('/step-out/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = getOrCreateSession(projectId);
    
    if (!session.isPaused) {
      return res.status(400).json({ error: 'Not paused at breakpoint' });
    }
    
    return res.json({ message: 'Stepped out', session });
  } catch (error: any) {
    console.error('[Debug] Step out error:', error);
    return res.status(500).json({ error: error.message || 'Failed to step out' });
  }
});

const toggleBreakpointSchema = z.object({
  file: z.string(),
  line: z.number(),
  condition: z.string().optional()
});

debugRouter.post('/breakpoint/toggle/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const body = toggleBreakpointSchema.parse(req.body);
    const session = getOrCreateSession(projectId);
    
    const existingIndex = session.breakpoints.findIndex(
      bp => bp.file === body.file && bp.line === body.line
    );
    
    if (existingIndex >= 0) {
      session.breakpoints.splice(existingIndex, 1);
      return res.json({ message: 'Breakpoint removed', session });
    } else {
      const newBreakpoint: Breakpoint = {
        id: `bp-${Date.now()}`,
        file: body.file,
        line: body.line,
        condition: body.condition,
        isEnabled: true,
        hitCount: 0
      };
      session.breakpoints.push(newBreakpoint);
      return res.json({ message: 'Breakpoint added', session });
    }
  } catch (error: any) {
    console.error('[Debug] Toggle breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle breakpoint' });
  }
});

debugRouter.post('/breakpoint/enable/:projectId/:breakpointId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, breakpointId } = req.params;
    const session = getOrCreateSession(projectId);
    
    const breakpoint = session.breakpoints.find(bp => bp.id === breakpointId);
    if (!breakpoint) {
      return res.status(404).json({ error: 'Breakpoint not found' });
    }
    
    breakpoint.isEnabled = !breakpoint.isEnabled;
    
    return res.json({ message: 'Breakpoint toggled', session });
  } catch (error: any) {
    console.error('[Debug] Enable breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to enable breakpoint' });
  }
});

debugRouter.delete('/breakpoint/:projectId/:breakpointId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, breakpointId } = req.params;
    const session = getOrCreateSession(projectId);
    
    session.breakpoints = session.breakpoints.filter(bp => bp.id !== breakpointId);
    
    return res.json({ message: 'Breakpoint deleted', session });
  } catch (error: any) {
    console.error('[Debug] Delete breakpoint error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete breakpoint' });
  }
});

const addWatchSchema = z.object({
  expression: z.string()
});

debugRouter.post('/watch/add/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const body = addWatchSchema.parse(req.body);
    const session = getOrCreateSession(projectId);
    
    if (!session.watchExpressions.includes(body.expression)) {
      session.watchExpressions.push(body.expression);
    }
    
    return res.json({ message: 'Watch expression added', session });
  } catch (error: any) {
    console.error('[Debug] Add watch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to add watch expression' });
  }
});

debugRouter.delete('/watch/:projectId/:index', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { projectId, index } = req.params;
    const session = getOrCreateSession(projectId);
    
    const idx = parseInt(index, 10);
    if (idx >= 0 && idx < session.watchExpressions.length) {
      session.watchExpressions.splice(idx, 1);
    }
    
    return res.json({ message: 'Watch expression removed', session });
  } catch (error: any) {
    console.error('[Debug] Remove watch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to remove watch expression' });
  }
});

export default debugRouter;
