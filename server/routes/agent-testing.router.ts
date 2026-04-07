/**
 * Agent Testing Routes (ADMIN ONLY)
 * 
 * API endpoints for Phase 2 browser testing and quality infrastructure.
 * 
 * SECURITY: These routes are restricted to admin users only because:
 * 1. Playwright test execution requires trusted code (similar to GitHub Actions, Replit Agent)
 * 2. Admin users can execute arbitrary test scripts within the allowlisted domain boundary
 * 3. This follows industry standard security models for development platforms
 * 
 * Routes:
 * - POST /api/admin/agent/test/execute - Execute a Playwright test
 * - POST /api/admin/agent/test/screenshot - Take a screenshot
 * - GET  /api/admin/agent/test/history/:sessionId - Get test execution history
 * - GET  /api/admin/agent/test/artifacts/:executionId - Get test artifacts
 * - POST /api/admin/agent/selector/generate - Generate element selectors
 * - GET  /api/admin/agent/selector/history/:sessionId - Get selector history
 * - POST /api/admin/agent/recording/start - Start recording
 * - POST /api/admin/agent/recording/stop/:recordingId - Stop recording
 * - POST /api/admin/agent/recording/marker/:recordingId - Add timeline marker
 * - GET  /api/admin/agent/recording/:recordingId - Get recording
 * - GET  /api/admin/agent/recording/session/:sessionId - Get session recordings
 * 
 * Fortune 500 Engineering Standards
 */

import { Router, Request, Response } from 'express';
import { agentTestingOrchestrator } from '../services/agent-testing-orchestrator.service';
import { agentElementSelector } from '../services/agent-element-selector.service';
import { agentRecording } from '../services/agent-recording.service';
import { z } from 'zod';

const router = Router();

// SECURITY: Admin-only middleware - all testing routes require admin access
router.use((req: Request, res: Response, next) => {
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required for testing features' 
    });
  }
  
  if (user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required. Testing features execute trusted code and require elevated permissions.' 
    });
  }
  
  next();
});

// Validation schemas
const executeTestSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  testScript: z.string(),
  options: z.object({
    testType: z.enum(['e2e', 'visual_regression', 'performance', 'accessibility', 'cross_browser']),
    browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
    viewport: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
    headless: z.boolean().optional().default(true),
    recordVideo: z.boolean().optional(),
    captureScreenshots: z.boolean().optional(),
    traceEnabled: z.boolean().optional()
  })
});

const screenshotSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  url: z.string().url(),
  options: z.object({
    fullPage: z.boolean().optional(),
    selector: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number()
    }).optional()
  }).optional()
});

const generateSelectorSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  pageUrl: z.string().url(),
  elementDescription: z.string()
});

const startRecordingSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  options: z.object({
    recordingType: z.enum(['screen', 'browser', 'terminal']).default('browser'),
    resolution: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
    fps: z.number().optional(),
    duration: z.number().optional()
  }).optional()
});

const timelineMarkerSchema = z.object({
  actionType: z.string(),
  description: z.string(),
  screenshotUrl: z.string().optional()
});

/**
 * POST /api/agent/test/execute
 * Execute a Playwright test
 */
router.post('/test/execute', async (req: Request, res: Response) => {
  try {
    const data = executeTestSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'anonymous';

    const execution = await agentTestingOrchestrator.executeTest(
      {
        sessionId: data.sessionId,
        projectId: data.projectId,
        userId,
        projectPath: `/projects/${data.projectId}`
      },
      data.testScript,
      data.options
    );

    res.json({ success: true, execution });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/test/screenshot
 * Take a screenshot
 */
router.post('/test/screenshot', async (req: Request, res: Response) => {
  try {
    const data = screenshotSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'anonymous';

    const result = await agentTestingOrchestrator.takeScreenshot(
      {
        sessionId: data.sessionId,
        projectId: data.projectId,
        userId,
        projectPath: `/projects/${data.projectId}`
      },
      data.url,
      data.options
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/test/history/:sessionId
 * Get test execution history
 */
router.get('/test/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await agentTestingOrchestrator.getExecutionHistory(sessionId, limit);

    res.json({ success: true, history });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/test/artifacts/:executionId
 * Get test artifacts
 */
router.get('/test/artifacts/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const artifacts = await agentTestingOrchestrator.getTestArtifacts(executionId);

    res.json({ success: true, artifacts });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/selector/generate
 * Generate element selectors
 */
router.post('/selector/generate', async (req: Request, res: Response) => {
  try {
    const data = generateSelectorSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'anonymous';

    const result = await agentElementSelector.generateSelector(
      {
        sessionId: data.sessionId,
        projectId: data.projectId,
        userId
      },
      data.pageUrl,
      data.elementDescription
    );

    res.json({ success: true, selector: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/selector/history/:sessionId
 * Get selector history
 */
router.get('/selector/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const history = await agentElementSelector.getSelectorHistory(sessionId);

    res.json({ success: true, history });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/recording/start
 * Start recording
 */
router.post('/recording/start', async (req: Request, res: Response) => {
  try {
    const data = startRecordingSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'anonymous';

    const recordingId = await agentRecording.startRecording(
      {
        sessionId: data.sessionId,
        projectId: data.projectId,
        userId
      },
      data.options
    );

    res.json({ success: true, recordingId });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/recording/stop/:recordingId
 * Stop recording
 */
router.post('/recording/stop/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const recording = await agentRecording.stopRecording(recordingId);

    res.json({ success: true, recording });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/recording/marker/:recordingId
 * Add timeline marker
 */
router.post('/recording/marker/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const marker = timelineMarkerSchema.parse(req.body);

    await agentRecording.addTimelineMarker(recordingId, marker);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/recording/:recordingId
 * Get recording
 */
router.get('/recording/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const recording = await agentRecording.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({ success: false, error: 'Recording not found' });
    }

    res.json({ success: true, recording });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/recording/session/:sessionId
 * Get session recordings
 */
router.get('/recording/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const recordings = await agentRecording.getSessionRecordings(sessionId);

    res.json({ success: true, recordings });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
