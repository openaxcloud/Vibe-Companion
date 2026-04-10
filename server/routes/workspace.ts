// @ts-nocheck
import express, { Request, Response } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { insertLspDiagnosticSchema, insertSecurityScanSchema, insertVulnerabilitySchema, insertResourceMetricSchema } from '@shared/schema';

export function createWorkspaceRoutes(storage: IStorage) {
  const router = express.Router();

  // ============================================================================
  // LSP DIAGNOSTICS ROUTES - For Problems Panel
  // ============================================================================

  // Get all diagnostics for a project
  router.get('/projects/:projectId/diagnostics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { filePath } = req.query;

      const diagnostics = await storage.getLspDiagnostics(
        projectId,
        filePath as string | undefined
      );

      res.json(diagnostics);
    } catch (error) {
      console.error('[API] Error fetching diagnostics:', error);
      res.status(500).json({ error: 'Failed to fetch diagnostics' });
    }
  });

  // Get diagnostic statistics
  router.get('/projects/:projectId/diagnostics/stats', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const diagnostics = await storage.getLspDiagnostics(projectId);

      const stats = {
        total: diagnostics.length,
        errors: diagnostics.filter(d => d.severity === 'error').length,
        warnings: diagnostics.filter(d => d.severity === 'warning').length,
        info: diagnostics.filter(d => d.severity === 'info').length,
        hints: diagnostics.filter(d => d.severity === 'hint').length,
      };

      res.json(stats);
    } catch (error) {
      console.error('[API] Error fetching diagnostic stats:', error);
      res.status(500).json({ error: 'Failed to fetch diagnostic statistics' });
    }
  });

  // Create a new diagnostic
  router.post('/projects/:projectId/diagnostics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const diagnosticData = insertLspDiagnosticSchema.parse({
        ...req.body,
        projectId,
      });

      const diagnostic = await storage.createLspDiagnostic(diagnosticData);
      res.status(201).json(diagnostic);
    } catch (error) {
      console.error('[API] Error creating diagnostic:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid diagnostic data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create diagnostic' });
      }
    }
  });

  // Update a diagnostic
  router.patch('/diagnostics/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const diagnostic = await storage.updateLspDiagnostic(id, req.body);
      res.json(diagnostic);
    } catch (error) {
      console.error('[API] Error updating diagnostic:', error);
      res.status(500).json({ error: 'Failed to update diagnostic' });
    }
  });

  // Delete a diagnostic
  router.delete('/diagnostics/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteLspDiagnostic(id);
      res.status(204).send();
    } catch (error) {
      console.error('[API] Error deleting diagnostic:', error);
      res.status(500).json({ error: 'Failed to delete diagnostic' });
    }
  });

  // Clear all diagnostics for a project or file
  router.delete('/projects/:projectId/diagnostics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { filePath } = req.query;

      await storage.clearLspDiagnostics(projectId, filePath as string | undefined);
      res.status(204).send();
    } catch (error) {
      console.error('[API] Error clearing diagnostics:', error);
      res.status(500).json({ error: 'Failed to clear diagnostics' });
    }
  });

  // ============================================================================
  // BUILD LOGS ROUTES - For Output Panel
  // ============================================================================

  // Helper function to check project access authorization
  async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    try {
      const project = await storage.getProject(projectId);
      if (!project) return false;

      // Check if user owns the project
      if (project.ownerId === userId) return true;

      // Check team membership
      try {
        const teamMember = await storage.getTeamMemberByUserAndProject?.(userId, projectId);
        if (teamMember) return true;
      } catch (error) {
        console.debug('[API] Team membership check skipped:', error);
      }

      return false;
    } catch (error) {
      console.error('[API] Authorization error:', error);
      return false;
    }
  }

  // Get build logs for a project
  router.get('/projects/:projectId/build-logs', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { buildId, limit } = req.query;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SECURITY: Verify user has access to project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      const logs = await storage.getBuildLogs(
        projectId,
        buildId as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );

      res.json(logs);
    } catch (error) {
      console.error('[API] Error fetching build logs:', error);
      res.status(500).json({ error: 'Failed to fetch build logs' });
    }
  });

  // Create a build log entry
  router.post('/projects/:projectId/build-logs', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SECURITY: Verify user has access to project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      const log = await storage.createBuildLog({
        ...req.body,
        projectId,
      });
      res.status(201).json(log);
    } catch (error) {
      console.error('[API] Error creating build log:', error);
      res.status(500).json({ error: 'Failed to create build log' });
    }
  });

  // Clear build logs
  router.delete('/projects/:projectId/build-logs', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { buildId } = req.query;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SECURITY: Verify user has access to project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      await storage.clearBuildLogs(projectId, buildId as string | undefined);
      res.status(204).send();
    } catch (error) {
      console.error('[API] Error clearing build logs:', error);
      res.status(500).json({ error: 'Failed to clear build logs' });
    }
  });

  // ============================================================================
  // TEST RUNS ROUTES - For Testing Panel
  // ============================================================================

  // Get test runs for a project
  router.get('/projects/:projectId/test-runs', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit } = req.query;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SECURITY: Verify user has access to project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      const runs = await storage.getTestRuns(
        projectId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json(runs);
    } catch (error) {
      console.error('[API] Error fetching test runs:', error);
      res.status(500).json({ error: 'Failed to fetch test runs' });
    }
  });

  // Get a specific test run with cases
  router.get('/test-runs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const run = await storage.getTestRun(id);
      
      if (!run) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      // SECURITY: Verify user has access to the project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, run.projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      const cases = await storage.getTestCases(id);
      res.json({ ...run, cases });
    } catch (error) {
      console.error('[API] Error fetching test run:', error);
      res.status(500).json({ error: 'Failed to fetch test run' });
    }
  });

  // Create a test run
  router.post('/projects/:projectId/test-runs', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SECURITY: Verify user has access to project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      // Use TestRunsService if available for real-time broadcasting
      const testRunsService = (global as any).testRunsService;
      if (testRunsService) {
        const run = await testRunsService.createTestRun({
          ...req.body,
          projectId,
        });
        res.status(201).json(run);
      } else {
        const run = await storage.createTestRun({
          ...req.body,
          projectId,
        });
        res.status(201).json(run);
      }
    } catch (error) {
      console.error('[API] Error creating test run:', error);
      res.status(500).json({ error: 'Failed to create test run' });
    }
  });

  // Update a test run
  router.patch('/test-runs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // SECURITY: Verify user is authenticated
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get the test run to verify project access
      const existingRun = await storage.getTestRun(id);
      if (!existingRun) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      // SECURITY: Verify user has access to the project
      const userId = (typeof req.user === 'object' && 'id' in req.user ? req.user.id : req.user) as string;
      const hasAccess = await checkProjectAccess(userId, existingRun.projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      // Use TestRunsService if available for real-time broadcasting
      const testRunsService = (global as any).testRunsService;
      if (testRunsService) {
        const run = await testRunsService.updateTestRun(id, req.body);
        res.json(run);
      } else {
        const run = await storage.updateTestRun(id, req.body);
        res.json(run);
      }
    } catch (error) {
      console.error('[API] Error updating test run:', error);
      res.status(500).json({ error: 'Failed to update test run' });
    }
  });

  // ============================================================================
  // RESOURCE METRICS ROUTES - For Resources Panel
  // ============================================================================

  // Get resource metrics for a project
  router.get('/projects/:projectId/resource-metrics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit } = req.query;

      const metrics = await storage.getResourceMetrics(
        projectId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json(metrics);
    } catch (error) {
      console.error('[API] Error fetching resource metrics:', error);
      res.status(500).json({ error: 'Failed to fetch resource metrics' });
    }
  });

  // Get latest resource metrics
  router.get('/projects/:projectId/resource-metrics/latest', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const metric = await storage.getLatestResourceMetrics(projectId);
      
      if (!metric) {
        return res.status(404).json({ error: 'No metrics found' });
      }

      res.json(metric);
    } catch (error) {
      console.error('[API] Error fetching latest metrics:', error);
      res.status(500).json({ error: 'Failed to fetch latest metrics' });
    }
  });

  // ============================================================================
  // SECURITY SCANNER ROUTES - For Security Scanner Panel
  // ============================================================================

  // Get security scans for a project
  router.get('/projects/:projectId/security-scans', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit } = req.query;
      
      const scans = await storage.getSecurityScans(
        projectId,
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json(scans);
    } catch (error) {
      console.error('[API] Error fetching security scans:', error);
      res.status(500).json({ error: 'Failed to fetch security scans' });
    }
  });

  // Get a single security scan
  router.get('/security-scans/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const scan = await storage.getSecurityScan(id);
      
      if (!scan) {
        return res.status(404).json({ error: 'Security scan not found' });
      }
      
      res.json(scan);
    } catch (error) {
      console.error('[API] Error fetching security scan:', error);
      res.status(500).json({ error: 'Failed to fetch security scan' });
    }
  });

  // Create a new security scan
  router.post('/projects/:projectId/security-scans', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const scanData = insertSecurityScanSchema.parse({
        ...req.body,
        projectId: parseInt(projectId),
      });
      
      const scan = await storage.createSecurityScan(scanData);
      
      // Broadcast to connected clients via WebSocket
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService) {
        await securityScannerService.broadcastScanUpdate(projectId, scan);
      }
      
      // Queue the scan for actual execution
      const scanExecutor = (global as any).scanExecutor;
      if (scanExecutor) {
        scanExecutor.queueScan(scan);
      }
      
      res.status(201).json(scan);
    } catch (error) {
      console.error('[API] Error creating security scan:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid scan data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create security scan' });
      }
    }
  });

  // Update a security scan
  router.patch('/security-scans/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const scan = await storage.updateSecurityScan(id, req.body);
      
      // Broadcast to connected clients via WebSocket
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService && scan) {
        await securityScannerService.broadcastScanUpdate(scan.projectId, scan);
      }
      
      res.json(scan);
    } catch (error) {
      console.error('[API] Error updating security scan:', error);
      res.status(500).json({ error: 'Failed to update security scan' });
    }
  });

  // Get vulnerabilities for a security scan
  router.get('/security-scans/:scanId/vulnerabilities', async (req: Request, res: Response) => {
    try {
      const { scanId } = req.params;
      const vulnerabilities = await storage.getVulnerabilities(scanId);
      res.json(vulnerabilities);
    } catch (error) {
      console.error('[API] Error fetching vulnerabilities:', error);
      res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
    }
  });

  // Get all vulnerabilities for a project (optionally filter by status)
  router.get('/projects/:projectId/vulnerabilities', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { status } = req.query;
      
      const vulnerabilities = await storage.getProjectVulnerabilities(
        projectId,
        status as string | undefined
      );
      
      res.json(vulnerabilities);
    } catch (error) {
      console.error('[API] Error fetching project vulnerabilities:', error);
      res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
    }
  });

  // Create a new vulnerability
  router.post('/security-scans/:scanId/vulnerabilities', async (req: Request, res: Response) => {
    try {
      const { scanId } = req.params;
      
      // First get the scan to retrieve projectId
      const scan = await storage.getSecurityScan(scanId);
      if (!scan) {
        return res.status(404).json({ error: 'Security scan not found' });
      }
      
      const vulnerabilityData = insertVulnerabilitySchema.parse({
        ...req.body,
        scanId,
        projectId: scan.projectId,
      });
      
      const vulnerability = await storage.createVulnerability(vulnerabilityData);
      
      // Broadcast to connected clients via WebSocket
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService) {
        await securityScannerService.broadcastVulnerabilityUpdate(scan.projectId, vulnerability);
      }
      
      res.status(201).json(vulnerability);
    } catch (error) {
      console.error('[API] Error creating vulnerability:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid vulnerability data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create vulnerability' });
      }
    }
  });

  // Update a vulnerability
  router.patch('/vulnerabilities/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the vulnerability to find its project
      const oldVulnerability = await storage.getVulnerabilities(req.body.scanId || '');
      const targetVuln = oldVulnerability.find(v => v.id === id);
      
      const vulnerability = await storage.updateVulnerability(id, req.body);
      
      // Broadcast to connected clients via WebSocket
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService && vulnerability && targetVuln) {
        await securityScannerService.broadcastVulnerabilityUpdate(targetVuln.projectId, vulnerability);
      }
      
      res.json(vulnerability);
    } catch (error) {
      console.error('[API] Error updating vulnerability:', error);
      res.status(500).json({ error: 'Failed to update vulnerability' });
    }
  });

  // Get vulnerabilities by hidden status (for Active/Hidden Issues tabs)
  router.get('/projects/:projectId/vulnerabilities/by-hidden', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { hidden } = req.query;
      const isHidden = hidden === 'true';
      
      const vulnerabilities = await storage.getProjectVulnerabilitiesByHidden(projectId, isHidden);
      res.json(vulnerabilities);
    } catch (error) {
      console.error('[API] Error fetching vulnerabilities by hidden status:', error);
      res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
    }
  });

  // Hide/unhide a vulnerability
  router.patch('/vulnerabilities/:id/hide', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isHidden } = req.body;
      
      const vulnerability = await storage.updateVulnerability(id, { isHidden: !!isHidden });
      
      // Broadcast to connected clients
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService && vulnerability) {
        await securityScannerService.broadcastVulnerabilityUpdate(vulnerability.projectId, vulnerability);
      }
      
      res.json(vulnerability);
    } catch (error) {
      console.error('[API] Error updating vulnerability hidden status:', error);
      res.status(500).json({ error: 'Failed to update vulnerability' });
    }
  });

  // ============================================================================
  // SECURITY SCAN SETTINGS ROUTES - For Scan Settings panel
  // ============================================================================

  // Get security scan settings for a project
  router.get('/projects/:projectId/security-settings', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      let settings = await storage.getSecurityScanSettings(projectId);
      
      // Return default settings if none exist
      if (!settings) {
        settings = {
          id: '',
          projectId: parseInt(projectId),
          privacyDetectionEnabled: true,
          securityDetectionEnabled: true,
          autoScanOnPush: false,
          updatedAt: new Date(),
        };
      }
      
      res.json(settings);
    } catch (error) {
      console.error('[API] Error fetching security settings:', error);
      res.status(500).json({ error: 'Failed to fetch security settings' });
    }
  });

  // Update security scan settings for a project
  router.patch('/projects/:projectId/security-settings', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { privacyDetectionEnabled, securityDetectionEnabled, autoScanOnPush } = req.body;
      
      const settings = await storage.upsertSecurityScanSettings(projectId, {
        privacyDetectionEnabled,
        securityDetectionEnabled,
        autoScanOnPush,
      });
      
      res.json(settings);
    } catch (error) {
      console.error('[API] Error updating security settings:', error);
      res.status(500).json({ error: 'Failed to update security settings' });
    }
  });

  // ============================================================================
  // RESOURCE METRICS ROUTES - For Resources Panel
  // ============================================================================

  // Get resource metrics for a project
  router.get('/projects/:projectId/resource-metrics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit } = req.query;
      
      const metrics = await storage.getResourceMetrics(
        projectId,
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json(metrics);
    } catch (error) {
      console.error('[API] Error fetching resource metrics:', error);
      res.status(500).json({ error: 'Failed to fetch resource metrics' });
    }
  });

  // Get latest resource metrics for a project
  router.get('/projects/:projectId/resource-metrics/latest', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const latest = await storage.getLatestResourceMetrics(projectId);
      
      if (!latest) {
        return res.status(404).json({ error: 'No metrics found' });
      }
      
      res.json(latest);
    } catch (error) {
      console.error('[API] Error fetching latest metrics:', error);
      res.status(500).json({ error: 'Failed to fetch latest metrics' });
    }
  });

  // Create a new resource metric (typically called by system monitoring)
  router.post('/projects/:projectId/resource-metrics', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const metricData = insertResourceMetricSchema.parse({
        ...req.body,
        projectId,
      });
      
      const metric = await storage.createResourceMetric(metricData);
      
      // Broadcast to connected clients via WebSocket
      const resourcesService = (global as any).resourcesService;
      if (resourcesService) {
        await resourcesService.broadcastMetricUpdate(projectId, metric);
      }
      
      res.status(201).json(metric);
    } catch (error) {
      console.error('[API] Error creating resource metric:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid metric data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create resource metric' });
      }
    }
  });

  // ============================================================================
  // PANE CONFIGURATIONS ROUTES - For Split Editor
  // ============================================================================

  // Get user's pane configurations
  router.get('/users/:userId/pane-configs', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { projectId } = req.query;

      const configs = await storage.getUserPaneConfigurations(
        userId,
        projectId as string | undefined
      );

      res.json(configs);
    } catch (error) {
      console.error('[API] Error fetching pane configs:', error);
      res.status(500).json({ error: 'Failed to fetch pane configurations' });
    }
  });

  // Create pane configuration
  router.post('/users/:userId/pane-configs', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const config = await storage.createPaneConfiguration({
        ...req.body,
        userId,
      });
      res.status(201).json(config);
    } catch (error) {
      console.error('[API] Error creating pane config:', error);
      res.status(500).json({ error: 'Failed to create pane configuration' });
    }
  });

  // Update pane configuration
  router.patch('/pane-configs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await storage.updatePaneConfiguration(id, req.body);
      res.json(config);
    } catch (error) {
      console.error('[API] Error updating pane config:', error);
      res.status(500).json({ error: 'Failed to update pane configuration' });
    }
  });

  // Delete pane configuration
  router.delete('/pane-configs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deletePaneConfiguration(id);
      res.status(204).send();
    } catch (error) {
      console.error('[API] Error deleting pane config:', error);
      res.status(500).json({ error: 'Failed to delete pane configuration' });
    }
  });

  return router;
}
