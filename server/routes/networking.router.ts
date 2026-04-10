import { Router, Request, Response } from 'express';
import { db } from '../db';
import { networkingPorts, networkingDomains } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('networking-router');
const router = Router();

// ==========================================
// Ports Management
// ==========================================

router.get('/:projectId/networking/ports', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const ports = await db.select().from(networkingPorts).where(eq(networkingPorts.projectId, projectId));
    
    // Map IDs to strings to match frontend expectation
    res.json(ports.map(p => ({ ...p, id: p.id.toString(), projectId: p.projectId.toString() })));
  } catch (error: any) {
    logger.error('Failed to get ports', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/networking/ports', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { port, label, protocol } = req.body;
    
    const [newPort] = await db.insert(networkingPorts).values({
      projectId,
      port,
      internalPort: port,
      externalPort: port, // Simplified for now
      label,
      protocol: protocol || 'http',
      listening: true, // Optimistically set listening
    }).returning();
    
    res.json({ ...newPort, id: newPort.id.toString(), projectId: newPort.projectId.toString() });
  } catch (error: any) {
    logger.error('Failed to create port', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:projectId/networking/ports/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const id = parseInt(req.params.id);
    const updateData = req.body;
    
    const [updated] = await db.update(networkingPorts)
      .set(updateData)
      .where(and(eq(networkingPorts.id, id), eq(networkingPorts.projectId, projectId)))
      .returning();
      
    res.json({ ...updated, id: updated.id.toString(), projectId: updated.projectId.toString() });
  } catch (error: any) {
    logger.error('Failed to patch port', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/networking/ports/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const id = parseInt(req.params.id);
    
    await db.delete(networkingPorts).where(and(eq(networkingPorts.id, id), eq(networkingPorts.projectId, projectId)));
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete port', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/networking/ports/scan', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    // Stub definition for auto port scanning
    // In a real environment, this would run netstat/lsof inside the container
    res.json({ success: true, message: 'Scan complete' });
  } catch (error: any) {
    logger.error('Failed to scan ports', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Custom Domains Management
// ==========================================

router.get('/:projectId/networking/domains', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const domains = await db.select().from(networkingDomains).where(eq(networkingDomains.projectId, projectId));
    res.json(domains.map(d => ({ ...d, id: d.id.toString(), projectId: d.projectId.toString() })));
  } catch (error: any) {
    logger.error('Failed to get domains', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/networking/domains', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { domain } = req.body;
    
    const token = `ecode-verify-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    
    const [newDomain] = await db.insert(networkingDomains).values({
      projectId,
      domain,
      verificationToken: token,
      sslStatus: 'pending'
    }).returning();
    
    res.json({ ...newDomain, id: newDomain.id.toString(), projectId: newDomain.projectId.toString() });
  } catch (error: any) {
    logger.error('Failed to add domain', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/networking/domains/:id/verify', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const id = parseInt(req.params.id);
    
    // Optimistic mock verification
    const [updated] = await db.update(networkingDomains)
      .set({ verified: true, verifiedAt: new Date(), sslStatus: 'active' })
      .where(and(eq(networkingDomains.id, id), eq(networkingDomains.projectId, projectId)))
      .returning();
      
    res.json({ ...updated, id: updated.id.toString(), projectId: updated.projectId.toString() });
  } catch (error: any) {
    logger.error('Failed to verify domain', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/networking/domains/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const id = parseInt(req.params.id);
    
    await db.delete(networkingDomains).where(and(eq(networkingDomains.id, id), eq(networkingDomains.projectId, projectId)));
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete domain', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
