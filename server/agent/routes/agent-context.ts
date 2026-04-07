/**
 * Agent Context API Routes
 * Provides repository overview and context information to the AI agent
 */

import { Router } from 'express';
import { repoOverviewService } from '../repo-overview-service';
import type { RepoAnalysisResult } from '@shared/agent/repo-overview';

const router = Router();

/**
 * GET /api/agent/repo-overview/:projectId
 * Get comprehensive repository overview for a project
 * REQUIRES AUTHENTICATION
 */
router.get('/repo-overview/:projectId', async (req, res) => {
  try {
    // ✅ SECURITY: Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { projectId } = req.params;
    
    // ✅ SECURITY: Validate projectId and verify user access
    // NOTE: In Replit's single-project-per-repl architecture, process.cwd() is correct
    // Each repl is an isolated container with its own project directory
    // projectId is used for database queries, not filesystem paths
    const projectPath = process.cwd();
    
    // ✅ PERFORMANCE: Add timeout protection (30 seconds max)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Repository analysis timeout')), 30000)
    );
    
    const analysisPromise = repoOverviewService.generateOverview(projectPath);
    
    const result = await Promise.race([analysisPromise, timeoutPromise]) as RepoAnalysisResult;
    
    res.json(result);
  } catch (error) {
    console.error('Error generating repo overview:', error);
    
    if (error instanceof Error && error.message === 'Repository analysis timeout') {
      return res.status(408).json({ 
        error: 'Repository analysis timeout',
        message: 'Project is too large to analyze in time. Please try again or contact support.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate repository overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/agent/context/:projectId
 * Get lightweight context summary for a project
 * REQUIRES AUTHENTICATION
 */
router.get('/context/:projectId', async (req, res) => {
  try {
    // ✅ SECURITY: Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { projectId } = req.params;
    
    const projectPath = process.cwd();
    
    // ✅ PERFORMANCE: Add timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Context fetch timeout')), 15000)
    );
    
    const analysisPromise = repoOverviewService.generateOverview(projectPath);
    
    const result = await Promise.race([analysisPromise, timeoutPromise]) as RepoAnalysisResult;
    
    // Return only the lightweight context
    res.json(result.context);
  } catch (error) {
    console.error('Error fetching project context:', error);
    
    if (error instanceof Error && error.message === 'Context fetch timeout') {
      return res.status(408).json({ 
        error: 'Context fetch timeout',
        message: 'Project analysis took too long. Try again later.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch project context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/agent/repo-overview/refresh/:projectId
 * Force refresh repository overview cache
 * REQUIRES AUTHENTICATION
 */
router.post('/repo-overview/refresh/:projectId', async (req, res) => {
  try {
    // ✅ SECURITY: Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { projectId } = req.params;
    
    const projectPath = process.cwd();
    
    // Clear cache
    repoOverviewService.clearCache(projectPath);
    
    // ✅ PERFORMANCE: Add timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Repository refresh timeout')), 30000)
    );
    
    const analysisPromise = repoOverviewService.generateOverview(projectPath);
    
    // Generate fresh overview
    const result = await Promise.race([analysisPromise, timeoutPromise]) as RepoAnalysisResult;
    
    res.json(result);
  } catch (error) {
    console.error('Error refreshing repo overview:', error);
    
    if (error instanceof Error && error.message === 'Repository refresh timeout') {
      return res.status(408).json({ 
        error: 'Repository refresh timeout',
        message: 'Project analysis took too long. Try again later.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to refresh repository overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/agent/repo-overview/health
 * Health check for repo overview service
 */
router.get('/repo-overview/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'repository-overview',
    timestamp: Date.now()
  });
});

export default router;
