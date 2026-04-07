import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/usage/:projectId', ensureAuthenticated, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId);
  
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const report = {
    userId: req.user?.id || 0,
    projectId,
    period: {
      start: startOfMonth,
      end: now
    },
    totalEffort: {
      tokensUsed: 0,
      apiCalls: 0,
      computeTime: 0,
      filesProcessed: 0,
      codeGenerated: 0,
      testsRun: 0,
      deploymentsCreated: 0,
      errorsRecovered: 0,
      checkpointsCreated: 0,
      totalEffortScore: 0
    },
    totalCost: 0,
    dailyBreakdown: []
  };

  res.json({ report });
});

export default router;
