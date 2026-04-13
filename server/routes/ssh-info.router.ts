import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { storage } from '../storage';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/ssh-keys', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const keys = await storage.listSshKeysByUser(userId);
    return res.json(keys.map(k => ({ id: k.id, label: k.label, fingerprint: k.fingerprint, createdAt: k.createdAt })));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch SSH keys' });
  }
});

router.post('/ssh-keys', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const schema = z.object({
      label: z.string().min(1).max(100),
      publicKey: z.string().min(1).max(10000),
    });
    const data = schema.parse(req.body);

    const keyStr = data.publicKey.trim();
    const sshKeyRegex = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/=]+/;
    if (!sshKeyRegex.test(keyStr)) {
      return res.status(400).json({ message: 'Invalid SSH public key format. Must be a valid ssh-rsa, ssh-ed25519, or ecdsa key.' });
    }

    const parts = keyStr.split(/\s+/);
    const keyData = Buffer.from(parts[1], 'base64');
    const fingerprint = crypto.createHash('sha256').update(keyData).digest('base64');
    const fingerprintFormatted = `SHA256:${fingerprint.replace(/=+$/, '')}`;

    const existing = await storage.findSshKeyByFingerprint(fingerprintFormatted);
    if (existing && existing.userId === userId) {
      return res.status(409).json({ message: 'This SSH key is already added to your account.' });
    }

    const key = await storage.createSshKey(userId, data.label, keyStr, fingerprintFormatted);
    return res.status(201).json({ id: key.id, label: key.label, fingerprint: key.fingerprint, createdAt: key.createdAt });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    if (error?.code === '23505') {
      return res.status(409).json({ message: 'This SSH key is already added to your account.' });
    }
    return res.status(500).json({ message: 'Failed to add SSH key' });
  }
});

router.delete('/ssh-keys/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const deleted = await storage.deleteSshKey(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ message: 'SSH key not found' });
    }
    return res.json({ message: 'SSH key deleted' });
  } catch {
    return res.status(500).json({ message: 'Failed to delete SSH key' });
  }
});

export default router;
