import { Router } from 'express';
import { backgroundTestingService } from '../services/background-testing-service';
import { ensureAuthenticated, ensureAdmin } from '../middleware/auth';
import { z } from 'zod';
import type { Request, Response } from 'express';

const router = Router();

// Validation schemas
const scheduleTestSchema = z.object({
  projectId: z.number().int().positive(),
  changedFiles: z.array(z.string().min(1).max(500)).max(100)
});

// Schedule a background test for a project
router.post('/schedule', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = scheduleTestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
    }
    
    const { projectId, changedFiles } = parseResult.data;
    
    // Schedule the test
    await backgroundTestingService.scheduleTest(projectId, changedFiles);
    
    res.json({ 
      success: true, 
      message: 'Test scheduled successfully',
      projectId 
    });
  } catch (error: any) {
    console.error('[BackgroundTests] Error scheduling test:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule test' });
  }
});

// Get test status for a project
router.get('/status/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId' });
    }
    
    const status = backgroundTestingService.getTestStatus(projectId);
    
    if (!status) {
      return res.status(404).json({ error: 'No test found for this project' });
    }
    
    res.json(status);
  } catch (error: any) {
    console.error('[BackgroundTests] Error getting test status:', error);
    res.status(500).json({ error: error.message || 'Failed to get test status' });
  }
});

// Get all tests (admin/debug endpoint) - SECURITY: Requires admin role
router.get('/all', ensureAdmin, async (req: Request, res: Response) => {
  try {
    const allTests = backgroundTestingService.getAllTests();
    res.json({
      tests: allTests,
      count: Array.isArray(allTests) ? allTests.length : 0
    });
  } catch (error: any) {
    console.error('[BackgroundTests] Error getting all tests:', error);
    res.status(500).json({ error: error.message || 'Failed to get all tests' });
  }
});

export default router;
