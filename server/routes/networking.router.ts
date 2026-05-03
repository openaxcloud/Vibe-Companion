import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { networkingPorts, networkingDomains } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import {
  listPortsWithLiveness,
  createPort,
  updatePort,
  deletePort,
  scanPorts,
} from '../services/port-management-service';

const logger = createLogger('networking-router');
const router = Router();

// ==========================================
// Rate limiter for the scan endpoint (per project)
// ==========================================
const scanLastCalled = new Map<string, number>();
const SCAN_RATE_LIMIT_MS = 10_000;

// ==========================================
// Zod validation schemas
// ==========================================
const PROTOCOL_VALUES = ['http', 'https', 'tcp', 'udp', 'ws', 'wss'] as const;

const createPortSchema = z.object({
  port: z.number().int().min(1).max(65535),
  label: z.string().max(100).optional(),
  protocol: z.enum(PROTOCOL_VALUES).optional(),
});

const patchPortSchema = z.object({
  isPublic: z.boolean().optional(),
  exposeLocalhost: z.boolean().optional(),
  label: z.string().max(100).optional(),
  protocol: z.enum(PROTOCOL_VALUES).optional(),
});

const createDomainSchema = z.object({
  domain: z.string()
    .min(3)
    .max(253)
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/, 'Invalid domain name'),
});

// ==========================================
// URL helpers
// ==========================================
function getAppBaseUrl(req: Request): string {
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Build the external preview URL for a port.
 * Matches the actual preview proxy route registered in preview-service.ts:
 *   /preview/:projectId/:port/{*proxyPath}
 */
function buildExternalUrl(req: Request, projectId: string | number, internalPort: number): string {
  const base = getAppBaseUrl(req);
  return `${base}/preview/${projectId}/${internalPort}/`;
}

// ==========================================
// Project authorization middleware
// Verifies that the authenticated user owns or collaborates on :projectId.
// Must run after ensureAuthenticated (req.user is populated).
// ==========================================
async function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const userId = String((req as any).user?.id ?? (req as any).session?.userId ?? '');
    if (!userId) return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });

    const ownsProject =
      String((project as any).userId) === userId ||
      String((project as any).ownerId) === userId;

    if (!ownsProject) {
      const collaborators = await storage.getProjectCollaborators?.(projectId);
      const isCollaborator = collaborators?.some((c: any) => String(c.userId) === userId);
      if (!isCollaborator) {
        return res.status(403).json({ error: 'Access denied: not the project owner or collaborator.' });
      }
    }

    next();
  } catch (err: any) {
    logger.error('requireProjectAccess error', err);
    res.status(500).json({ error: 'Failed to verify project access' });
  }
}

// ==========================================
// Port Visibility Access Gate (public advisory endpoint)
// Checks whether a port is public; verifies project access for private ports.
// Used by external clients to know whether to offer open-in-new-tab.
// ==========================================
router.get('/:projectId/networking/ports/:port/access-check', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const internalPort = parseInt(req.params.port, 10);

    if (isNaN(projectId) || isNaN(internalPort)) {
      return res.status(400).json({ error: 'Invalid projectId or port' });
    }

    const [portRecord] = await db.select()
      .from(networkingPorts)
      .where(and(eq(networkingPorts.projectId, projectId), eq(networkingPorts.internalPort, internalPort)));

    if (!portRecord) {
      return res.status(404).json({ error: `Port ${internalPort} is not registered for this project.` });
    }

    if (portRecord.isPublic) {
      return res.json({
        allowed: true,
        isPublic: true,
        internalPort: portRecord.internalPort,
        protocol: portRecord.protocol,
        label: portRecord.label,
      });
    }

    // Private port: require authenticated session + project ownership
    const userId = (req as any).user?.id ?? (req as any).session?.userId;
    if (!userId) {
      return res.status(401).json({
        allowed: false,
        isPublic: false,
        error: `Port ${internalPort} is private. Authentication required.`,
      });
    }

    // Verify project ownership/collaborator
    const project = await storage.getProject(String(projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const sUid = String(userId);
    const ownsProject =
      String((project as any).userId) === sUid ||
      String((project as any).ownerId) === sUid;

    if (!ownsProject) {
      const collaborators = await storage.getProjectCollaborators?.(String(projectId));
      const isCollaborator = collaborators?.some((c: any) => String(c.userId) === sUid);
      if (!isCollaborator) {
        return res.status(403).json({ allowed: false, isPublic: false, error: 'Access denied.' });
      }
    }

    return res.json({
      allowed: true,
      isPublic: false,
      internalPort: portRecord.internalPort,
      protocol: portRecord.protocol,
      label: portRecord.label,
    });
  } catch (error: any) {
    logger.error('Port access-check failed', error);
    res.status(500).json({ error: 'Access check failed' });
  }
});

// ==========================================
// Ports CRUD — all protected by auth + project ownership
// ==========================================

router.get(
  '/:projectId/networking/ports',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const ports = await listPortsWithLiveness(projectId);
      res.json(ports.map((p) => ({
        ...p,
        externalUrl: buildExternalUrl(req, p.projectId, p.internalPort),
        proxyUrl: `/preview/${p.projectId}/${p.internalPort}/`,
      })));
    } catch (error: any) {
      logger.error('Failed to get ports', error);
      res.status(500).json({ error: 'Failed to load port configurations' });
    }
  }
);

router.post(
  '/:projectId/networking/ports',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const body = createPortSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      }

      const projectId = parseInt(req.params.projectId, 10);
      const { port, label, protocol } = body.data;

      const result = await createPort(projectId, port, label, protocol);
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      const p = result.port;
      res.status(201).json({
        ...p,
        externalUrl: buildExternalUrl(req, p.projectId, p.internalPort),
        proxyUrl: `/preview/${p.projectId}/${p.internalPort}/`,
      });
    } catch (error: any) {
      logger.error('Failed to create port', error);
      res.status(500).json({ error: 'Failed to create port configuration' });
    }
  }
);

router.patch(
  '/:projectId/networking/ports/:id',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const body = patchPortSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      }

      const projectId = parseInt(req.params.projectId, 10);
      const portId = parseInt(req.params.id, 10);
      if (isNaN(portId)) return res.status(400).json({ error: 'Invalid port id' });

      const result = await updatePort(projectId, portId, body.data);
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      const p = result.port;
      res.json({
        ...p,
        externalUrl: buildExternalUrl(req, p.projectId, p.internalPort),
        proxyUrl: `/preview/${p.projectId}/${p.internalPort}/`,
      });
    } catch (error: any) {
      logger.error('Failed to patch port', error);
      res.status(500).json({ error: 'Failed to update port configuration' });
    }
  }
);

router.delete(
  '/:projectId/networking/ports/:id',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const portId = parseInt(req.params.id, 10);
      if (isNaN(portId)) return res.status(400).json({ error: 'Invalid port id' });

      const result = await deletePort(projectId, portId);
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete port', error);
      res.status(500).json({ error: 'Failed to delete port configuration' });
    }
  }
);

router.post(
  '/:projectId/networking/ports/scan',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId;

      // Rate limit: one scan per project per 10 seconds
      const lastScan = scanLastCalled.get(projectId) || 0;
      if (Date.now() - lastScan < SCAN_RATE_LIMIT_MS) {
        return res.status(429).json({ error: 'Scan rate limit exceeded. Please wait before scanning again.' });
      }
      scanLastCalled.set(projectId, Date.now());

      const results = await scanPorts(projectId);
      const listeningPorts = results.filter((r) => r.listening);
      const method = results.length > 0 ? results[0].source : 'tcp-probe';

      res.json({
        success: true,
        message: `Scan complete — ${listeningPorts.length} port(s) listening (method: ${method})`,
        ports: listeningPorts,  // Only return actually listening ports
      });
    } catch (error: any) {
      logger.error('Failed to scan ports', error);
      res.status(500).json({ error: 'Port scan failed' });
    }
  }
);

// ==========================================
// Custom Domains CRUD — all protected by auth + project ownership
// ==========================================

router.get(
  '/:projectId/networking/domains',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const domains = await db.select().from(networkingDomains).where(eq(networkingDomains.projectId, projectId));
      res.json(domains.map((d) => ({ ...d, id: d.id.toString(), projectId: d.projectId.toString() })));
    } catch (error: any) {
      logger.error('Failed to get domains', error);
      res.status(500).json({ error: 'Failed to load custom domains' });
    }
  }
);

router.post(
  '/:projectId/networking/domains',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const body = createDomainSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: 'Invalid domain name', details: body.error.flatten() });
      }

      const projectId = parseInt(req.params.projectId, 10);
      const domain = body.data.domain.trim().toLowerCase();
      const token = `ecode-verify-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

      const [newDomain] = await db.insert(networkingDomains).values({
        projectId,
        domain,
        verificationToken: token,
        sslStatus: 'not-provisioned',
      }).returning();

      res.status(201).json({ ...newDomain, id: newDomain.id.toString(), projectId: newDomain.projectId.toString() });
    } catch (error: any) {
      logger.error('Failed to add domain', error);
      res.status(500).json({ error: 'Failed to add custom domain' });
    }
  }
);

router.post(
  '/:projectId/networking/domains/:id/verify',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid domain id' });

      const [domainRecord] = await db.select()
        .from(networkingDomains)
        .where(and(eq(networkingDomains.id, id), eq(networkingDomains.projectId, projectId)));

      if (!domainRecord) return res.status(404).json({ error: 'Domain not found' });

      let verified = false;
      let verificationMessage = 'DNS TXT record not found. Please add the verification token to your DNS settings.';

      try {
        const dns = await import('dns/promises');
        const txtRecords = await dns.resolveTxt(domainRecord.domain);
        const flat = txtRecords.flat();
        if (flat.some((r) => r === domainRecord.verificationToken)) {
          verified = true;
          verificationMessage = 'Domain verified successfully.';
        }
      } catch (dnsErr: any) {
        logger.warn(`DNS lookup failed for ${domainRecord.domain}: ${dnsErr.message}`);
        verificationMessage = `DNS lookup failed: ${dnsErr.code || dnsErr.message}. Ensure the TXT record is set and DNS has propagated (can take up to 48 hours).`;
      }

      if (verified) {
        const [updated] = await db.update(networkingDomains)
          .set({ verified: true, verifiedAt: new Date(), sslStatus: 'not-provisioned' })
          .where(and(eq(networkingDomains.id, id), eq(networkingDomains.projectId, projectId)))
          .returning();
        return res.json({ ...updated, id: updated.id.toString(), projectId: updated.projectId.toString(), message: verificationMessage });
      }

      res.json({ ...domainRecord, id: domainRecord.id.toString(), projectId: domainRecord.projectId.toString(), verified: false, message: verificationMessage });
    } catch (error: any) {
      logger.error('Failed to verify domain', error);
      res.status(500).json({ error: 'Domain verification failed' });
    }
  }
);

router.delete(
  '/:projectId/networking/domains/:id',
  ensureAuthenticated,
  requireProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid domain id' });

      const deleted = await db.delete(networkingDomains)
        .where(and(eq(networkingDomains.id, id), eq(networkingDomains.projectId, projectId)))
        .returning();

      if (deleted.length === 0) return res.status(404).json({ error: 'Domain not found' });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete domain', error);
      res.status(500).json({ error: 'Failed to delete custom domain' });
    }
  }
);

export default router;
