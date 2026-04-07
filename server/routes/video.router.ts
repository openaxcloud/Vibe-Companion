import { Router, Request, Response } from 'express';
import { db } from '../db';
import { videoProjects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('video-router');
const router = Router();

router.get('/:projectId/video', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [project] = await db.select().from(videoProjects).where(eq(videoProjects.projectId, projectId));
    
    if (!project) {
      return res.json({ scenes: [], audioTracks: [], resolution: { width: 1920, height: 1080 }, fps: 30 });
    }
    
    res.json(project);
  } catch (error: any) {
    logger.error('Failed to get video project', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:projectId/video', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { scenes, audioTracks, resolution, fps } = req.body;
    
    const existing = await db.select().from(videoProjects).where(eq(videoProjects.projectId, projectId));
    
    if (existing.length === 0) {
      await db.insert(videoProjects).values({
        projectId,
        scenes: scenes || [],
        audioTracks: audioTracks || [],
        resolution: resolution || { width: 1920, height: 1080 },
        fps: fps || 30,
      });
    } else {
      await db.update(videoProjects)
        .set({ 
          scenes: scenes || [], 
          audioTracks: audioTracks || [], 
          resolution: resolution || { width: 1920, height: 1080 }, 
          fps: fps || 30,
          updatedAt: new Date()
        })
        .where(eq(videoProjects.projectId, projectId));
    }
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to save video project', error);
    res.status(500).json({ error: error.message });
  }
});

// Mock export route simply responds with a message or redirects to a rendered file
router.get('/:projectId/video/export', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html>
        <body style="background: #0D0D0D; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
          <h1>Export Initialization</h1>
          <p>Video export render farm service is processing your video.</p>
          <script>setTimeout(() => window.close(), 3000)</script>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
