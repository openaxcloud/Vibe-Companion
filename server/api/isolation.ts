// @ts-nocheck
/**
 * API endpoints for project isolation management
 */

import { Router } from 'express';
import { isolationManager } from '../isolation/process-isolation';
import { ensureAuthenticated } from '../middleware/auth';
import { db } from '../db';
import { projects } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Create isolated environment for a project
 */
router.post('/projects/:id/environment', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.user?.id;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project || project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if environment already exists
    const existing = isolationManager.getProjectEnvironments(projectId);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }

    // Create new isolated environment
    const environment = await isolationManager.createEnvironment(projectId, {
      language: project.language || 'nodejs',
      memory: req.body.memory || 512,
      cpu: req.body.cpu || 25,
      packages: req.body.packages || []
    });

    res.json({
      success: true,
      environment: {
        id: environment.id,
        projectId: environment.projectId,
        port: environment.port,
        status: environment.status,
        resourceLimits: environment.resourceLimits,
        networkNamespace: environment.networkNamespace,
        databaseNamespace: environment.databaseNamespace
      }
    });
  } catch (error) {
    console.error('Failed to create environment:', error);
    res.status(500).json({ error: 'Failed to create isolated environment' });
  }
});

/**
 * Get environment status
 */
router.get('/projects/:id/environment', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const environments = isolationManager.getProjectEnvironments(projectId);
    
    if (environments.length === 0) {
      return res.status(404).json({ error: 'No environment found for project' });
    }

    const env = environments[0];
    const usage = await isolationManager.getResourceUsage(env.id);

    res.json({
      id: env.id,
      projectId: env.projectId,
      port: env.port,
      status: env.status,
      resourceLimits: env.resourceLimits,
      resourceUsage: usage,
      networkNamespace: env.networkNamespace,
      databaseNamespace: env.databaseNamespace,
      createdAt: env.createdAt,
      lastActivity: env.lastActivity
    });
  } catch (error) {
    console.error('Failed to get environment:', error);
    res.status(500).json({ error: 'Failed to get environment status' });
  }
});

/**
 * Stop environment
 */
router.delete('/projects/:id/environment', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.user?.id;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project || project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const environments = isolationManager.getProjectEnvironments(projectId);
    
    for (const env of environments) {
      await isolationManager.stopEnvironment(env.id);
    }

    res.json({ success: true, message: 'Environment stopped' });
  } catch (error) {
    console.error('Failed to stop environment:', error);
    res.status(500).json({ error: 'Failed to stop environment' });
  }
});

/**
 * List all environments (admin only)
 */
router.get('/admin/environments', ensureAuthenticated, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const environments = isolationManager.listEnvironments();
    
    const details = await Promise.all(
      environments.map(async (env) => {
        const usage = await isolationManager.getResourceUsage(env.id);
        return {
          id: env.id,
          projectId: env.projectId,
          port: env.port,
          status: env.status,
          resourceLimits: env.resourceLimits,
          resourceUsage: usage,
          createdAt: env.createdAt,
          lastActivity: env.lastActivity
        };
      })
    );

    res.json({
      total: details.length,
      environments: details
    });
  } catch (error) {
    console.error('Failed to list environments:', error);
    res.status(500).json({ error: 'Failed to list environments' });
  }
});

/**
 * Get resource usage for environment
 */
router.get('/environments/:id/usage', ensureAuthenticated, async (req, res) => {
  try {
    const envId = req.params.id;
    const env = isolationManager.getEnvironment(envId);
    
    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const usage = await isolationManager.getResourceUsage(envId);
    
    res.json({
      environmentId: envId,
      projectId: env.projectId,
      usage: {
        cpu: {
          used: usage.cpu,
          limit: env.resourceLimits.cpu,
          percentage: (usage.cpu / env.resourceLimits.cpu) * 100
        },
        memory: {
          used: usage.memory,
          limit: env.resourceLimits.memory,
          percentage: (usage.memory / env.resourceLimits.memory) * 100
        },
        disk: {
          used: usage.disk,
          unit: 'MB'
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to get resource usage:', error);
    res.status(500).json({ error: 'Failed to get resource usage' });
  }
});

/**
 * Update network policy for environment
 */
router.put('/environments/:id/network-policy', ensureAuthenticated, async (req, res) => {
  try {
    const envId = req.params.id;
    const { allowedPorts, allowedHosts } = req.body;
    
    const env = isolationManager.getEnvironment(envId);
    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    await isolationManager.createNetworkPolicy(envId, {
      allowedPorts: allowedPorts || [80, 443],
      allowedHosts: allowedHosts || ['*']
    });

    res.json({
      success: true,
      message: 'Network policy updated',
      policy: {
        allowedPorts,
        allowedHosts
      }
    });
  } catch (error) {
    console.error('Failed to update network policy:', error);
    res.status(500).json({ error: 'Failed to update network policy' });
  }
});

export default router;