import { Router, Request, Response } from 'express';
import { expoSnackService } from '../services/expo-snack.service';
import { createLogger } from '../utils/logger';
import { z } from 'zod';

const logger = createLogger('expo-snack-router');

const router = Router();

const createSessionSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  files: z.record(z.string()),
  dependencies: z.record(z.string()).optional(),
  sdkVersion: z.string().optional(),
});

const updateFilesSchema = z.object({
  files: z.record(z.string()),
});

const generateEmbedSchema = z.object({
  snackId: z.string().optional(),
  code: z.string().optional(),
  dependencies: z.string().optional(),
  name: z.string().optional(),
  platform: z.enum(['web', 'ios', 'android']).optional(),
  preview: z.boolean().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  height: z.number().optional(),
});

router.post('/session/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const validatedBody = createSessionSchema.parse(req.body);

    const session = await expoSnackService.createSession(projectId, validatedBody);
    res.json({ success: true, session });
  } catch (error) {
    logger.error('Failed to create Expo Snack session:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create session' 
    });
  }
});

router.get('/session/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const session = await expoSnackService.getSessionState(projectId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, session });
  } catch (error) {
    logger.error('Failed to get Expo Snack session:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get session' 
    });
  }
});

router.patch('/session/:projectId/files', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const validatedBody = updateFilesSchema.parse(req.body);

    await expoSnackService.updateFiles(projectId, validatedBody.files);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update Expo Snack files:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update files' 
    });
  }
});

router.delete('/session/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await expoSnackService.closeSession(projectId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to close Expo Snack session:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to close session' 
    });
  }
});

router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = expoSnackService.getActiveSessions();
    res.json({ success: true, sessions });
  } catch (error) {
    logger.error('Failed to list Expo Snack sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to list sessions' 
    });
  }
});

router.post('/embed', async (req: Request, res: Response) => {
  try {
    const validatedBody = generateEmbedSchema.parse(req.body);
    const embedHtml = expoSnackService.generateEmbedHtml(validatedBody);
    res.json({ success: true, html: embedHtml });
  } catch (error) {
    logger.error('Failed to generate Expo Snack embed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate embed' 
    });
  }
});

router.post('/iframe-url', async (req: Request, res: Response) => {
  try {
    const options = req.body;
    const url = expoSnackService.generateIframeUrl(options);
    res.json({ success: true, url });
  } catch (error) {
    logger.error('Failed to generate Expo Snack iframe URL:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate iframe URL' 
    });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const isConfigured = expoSnackService.isConfigured();
    const activeSessions = expoSnackService.getActiveSessions();
    
    res.json({ 
      success: true, 
      configured: isConfigured,
      activeSessionCount: activeSessions.length,
      sdkVersion: '51.0.0',
    });
  } catch (error) {
    logger.error('Failed to get Expo Snack status:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get status' 
    });
  }
});

export const expoSnackRouter = router;
