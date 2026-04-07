// @ts-nocheck
/**
 * Voice/Video WebRTC Router for E-Code Platform
 * Handles real-time voice and video collaboration
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { voiceVideoService } from '../webrtc/voice-video-service';

const createSessionSchema = z.object({
  projectId: z.union([z.string().min(1), z.number()]),
  sessionType: z.enum(['voice', 'video', 'screen']),
  maxParticipants: z.number().int().min(2).max(100).optional().default(10),
  roomName: z.string().min(1).max(100).optional()
});

const roomIdSchema = z.object({
  roomId: z.string().min(1).max(100)
});

const recordingToggleSchema = z.object({
  enable: z.boolean()
});

const projectIdSchema = z.object({
  projectId: z.string().regex(/^\d+$/).transform(Number)
});

const router = Router();

// Create a new voice/video session
router.post('/sessions', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = createSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const userId = (req.user as any)?.id;
    const { projectId, sessionType, maxParticipants } = parseResult.data;

    const session = await voiceVideoService.createSession(
      projectId,
      userId,
      sessionType,
      maxParticipants
    );

    res.json({
      success: true,
      session
    });
  } catch (error: any) {
    console.error('Error creating voice/video session:', error);
    res.status(500).json({ 
      error: 'Failed to create session',
      details: error.message 
    });
  }
});

// Get active sessions for a project
router.get('/projects/:projectId/sessions', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = projectIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const { projectId } = parseResult.data;

    const sessions = await voiceVideoService.getActiveSessions(projectId);

    res.json({
      success: true,
      sessions
    });
  } catch (error: any) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ 
      error: 'Failed to get sessions',
      details: error.message 
    });
  }
});

// Get session details
router.get('/sessions/:roomId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = roomIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const { roomId } = parseResult.data;

    const session = voiceVideoService.getSession(roomId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session: {
        roomId: session.id,
        projectId: session.projectId,
        type: session.type,
        participantCount: session.peers.size,
        isRecording: session.recording,
        hostId: session.hostId
      }
    });
  } catch (error: any) {
    console.error('Error getting session details:', error);
    res.status(500).json({ 
      error: 'Failed to get session details',
      details: error.message 
    });
  }
});

// End a session
router.post('/sessions/:roomId/end', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = roomIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const userId = (req.user as any)?.id;
    const { roomId } = parseResult.data;

    const session = voiceVideoService.getSession(roomId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only host can end the session
    if (session.hostId !== userId) {
      return res.status(403).json({ error: 'Only the host can end the session' });
    }

    await voiceVideoService.endSession(roomId);

    res.json({
      success: true,
      message: 'Session ended'
    });
  } catch (error: any) {
    console.error('Error ending session:', error);
    res.status(500).json({ 
      error: 'Failed to end session',
      details: error.message 
    });
  }
});

// Toggle recording
router.post('/sessions/:roomId/recording', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const paramsResult = roomIdSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: paramsResult.error.errors
      });
    }

    const payloadResult = recordingToggleSchema.safeParse(req.body);
    if (!payloadResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: payloadResult.error.errors
      });
    }

    const userId = (req.user as any)?.id;
    const { roomId } = paramsResult.data;
    const { enable } = payloadResult.data;

    const session = voiceVideoService.getSession(roomId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only host can control recording
    if (session.hostId !== userId) {
      return res.status(403).json({ error: 'Only the host can control recording' });
    }

    if (enable) {
      await voiceVideoService.startRecording(roomId);
    } else {
      await voiceVideoService.stopRecording(roomId);
    }

    res.json({
      success: true,
      recording: enable
    });
  } catch (error: any) {
    console.error('Error toggling recording:', error);
    res.status(500).json({ 
      error: 'Failed to toggle recording',
      details: error.message 
    });
  }
});

// Get session statistics
router.get('/sessions/:roomId/stats', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = roomIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const { roomId } = parseResult.data;

    const stats = await voiceVideoService.getSessionStats(roomId);

    if (!stats) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error getting session stats:', error);
    res.status(500).json({ 
      error: 'Failed to get session stats',
      details: error.message 
    });
  }
});

export default router;
