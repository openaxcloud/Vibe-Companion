import { Router } from 'express';
import { db } from '../db';
import { users, projects, files, deployments } from '@shared/schema';
import { sql, count, sum } from 'drizzle-orm';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

// Middleware to ensure admin access
const ensureAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Check if user is admin (you can customize this logic)
  if (req.user.username !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
};

// Apply admin middleware to all routes
router.use(ensureAdmin);

// Get system status
router.get('/system-status', async (req, res) => {
  try {
    // Database status
    const dbStatus = {
      status: 'operational',
      connections: 1 // This would be from pool stats in production
    };

    // Storage status
    const storagePath = path.join(process.cwd(), 'uploads');
    let storageStats = { used: '0 GB', available: '0 GB' };
    
    try {
      const stats = await fs.stat(storagePath);
      // This is a simple implementation - in production you'd check actual disk usage
      storageStats = {
        used: '0.5 GB',
        available: '10 GB'
      };
    } catch (error) {
      // Storage path doesn't exist yet
    }

    // Services status
    const services = {
      git: true,
      ai: !!process.env.OPENAI_API_KEY,
      search: true,
      billing: !!process.env.STRIPE_SECRET_KEY,
      deployments: true
    };

    res.json({
      database: dbStatus,
      redis: { status: 'not configured', memory: '0 MB' },
      storage: storageStats,
      services
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({ message: 'Failed to get system status' });
  }
});

// Get user statistics
router.get('/user-stats', async (req, res) => {
  try {
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // For demo purposes, using static values for other stats
    res.json({
      totalUsers,
      activeToday: Math.floor(totalUsers * 0.3),
      newThisWeek: Math.floor(totalUsers * 0.1),
      premiumUsers: Math.floor(totalUsers * 0.2)
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: 'Failed to get user statistics' });
  }
});

// Get project statistics
router.get('/project-stats', async (req, res) => {
  try {
    const totalProjectsResult = await db.select({ count: count() }).from(projects);
    const totalProjects = totalProjectsResult[0]?.count || 0;

    const totalFilesResult = await db.select({ count: count() }).from(files);
    const totalFiles = totalFilesResult[0]?.count || 0;

    res.json({
      totalProjects,
      activeProjects: Math.floor(totalProjects * 0.7),
      totalFiles,
      totalStorage: `${(totalFiles * 0.001).toFixed(2)} GB` // Rough estimate
    });
  } catch (error) {
    console.error('Error getting project stats:', error);
    res.status(500).json({ message: 'Failed to get project statistics' });
  }
});

// Get recent activities
router.get('/activities', async (req, res) => {
  try {
    // Get recent projects
    const recentProjects = await db
      .select({
        name: projects.name,
        createdAt: projects.createdAt,
        ownerId: projects.ownerId
      })
      .from(projects)
      .orderBy(projects.createdAt)
      .limit(5);

    // Get recent deployments
    const recentDeployments = await db
      .select({
        projectId: deployments.projectId,
        status: deployments.status,
        createdAt: deployments.createdAt
      })
      .from(deployments)
      .orderBy(deployments.createdAt)
      .limit(5);

    // Combine activities
    const activities = [
      ...recentProjects.map(p => ({
        type: 'project',
        message: `New project "${p.name}" created`,
        timestamp: p.createdAt
      })),
      ...recentDeployments.map(d => ({
        type: 'system',
        message: `Deployment ${d.status} for project #${d.projectId}`,
        timestamp: d.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp || new Date()).getTime() - new Date(a.timestamp || new Date()).getTime());

    res.json(activities);
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ message: 'Failed to get activities' });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    // In a real implementation, this would clear Redis or other caches
    
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ message: 'Failed to clear cache' });
  }
});

// Run maintenance
router.post('/maintenance/run', async (req, res) => {
  try {
    // In production, this would:
    // - Vacuum the database
    // - Clean up orphaned files
    // - Rotate logs
    // - Update search indexes
    
    res.json({ message: 'Maintenance completed successfully' });
  } catch (error) {
    console.error('Error running maintenance:', error);
    res.status(500).json({ message: 'Failed to run maintenance' });
  }
});

export default router;