// @ts-nocheck

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();
const logger = createLogger('sendgrid-webhook');

/**
 * Verify SendGrid webhook signature using ECDSA
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  timestamp: string | undefined
): boolean {
  const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  
  // If no public key configured, reject in production
  if (!publicKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('SendGrid webhook signature verification failed: SENDGRID_WEBHOOK_VERIFICATION_KEY not configured');
      return false;
    }
    logger.warn('SendGrid webhook signature verification skipped in development: SENDGRID_WEBHOOK_VERIFICATION_KEY not configured');
    return true; // Allow in development without key
  }

  if (!signature || !timestamp) {
    logger.warn('SendGrid webhook missing signature or timestamp');
    return false;
  }

  try {
    // SendGrid sends timestamp + payload for verification
    const signedPayload = timestamp + payload;
    
    // Decode the base64 signature
    const decodedSignature = Buffer.from(signature, 'base64');
    
    // Verify using ECDSA with SHA256
    const verifier = crypto.createVerify('sha256');
    verifier.update(signedPayload);
    
    const isValid = verifier.verify(publicKey, decodedSignature);
    
    if (!isValid) {
      logger.warn('SendGrid webhook signature verification failed: invalid signature');
    }
    
    return isValid;
  } catch (error: any) {
    logger.error('SendGrid webhook signature verification error', { error: error.message });
    return false;
  }
}

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'delivered' | 'open' | 'click';
  reason?: string;
  status?: string;
  sg_event_id: string;
  sg_message_id: string;
  type?: string;
}

/**
 * POST /api/webhooks/sendgrid
 * Reçoit les événements SendGrid (bounces, spam, etc.)
 */
router.post('/sendgrid', async (req: Request, res: Response) => {
  try {
    // Log pour confirmer la réception
    logger.info('SendGrid webhook received', {
      timestamp: new Date().toISOString(),
      bodyLength: JSON.stringify(req.body).length
    });
    
    // SECURITY: Verify SendGrid ECDSA signature
    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
    
    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      logger.warn('SendGrid webhook rejected: signature verification failed', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    const events: SendGridEvent[] = Array.isArray(req.body) ? req.body : JSON.parse(req.body);

    if (!Array.isArray(events)) {
      logger.warn('Invalid SendGrid webhook payload - not an array');
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    logger.info(`Processing ${events.length} SendGrid events`);

    for (const event of events) {
      logger.info(`SendGrid event: ${event.event}`, {
        email: event.email,
        eventId: event.sg_event_id,
        timestamp: event.timestamp,
      });

      // Gérer les événements critiques
      switch (event.event) {
        case 'bounce':
        case 'dropped':
          // Marquer l'email comme invalide
          await handleInvalidEmail(event.email, event.reason || event.status);
          break;

        case 'spamreport':
          // Bloquer temporairement l'envoi d'emails
          await handleSpamReport(event.email);
          break;

        case 'unsubscribe':
          // Marquer l'utilisateur comme désinscrit
          await handleUnsubscribe(event.email);
          break;

        case 'delivered':
          logger.debug(`Email delivered to ${event.email}`);
          break;

        case 'open':
        case 'click':
          // Metrics optionnelles
          logger.debug(`Email ${event.event} from ${event.email}`);
          break;
      }
    }

    res.status(200).json({ success: true, processed: events.length });
  } catch (error: any) {
    logger.error('SendGrid webhook error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Gérer les emails invalides (bounce/dropped)
 */
async function handleInvalidEmail(email: string, reason?: string): Promise<void> {
  try {
    await db.update(users)
      .set({
        emailVerified: false,
        metadata: {
          emailBounced: true,
          bounceReason: reason,
          bouncedAt: new Date().toISOString(),
        },
      })
      .where(eq(users.email, email));

    logger.warn(`Email marked as bounced: ${email}`, { reason });
  } catch (error: any) {
    logger.error('Failed to mark email as bounced', { email, error: error.message });
  }
}

/**
 * Gérer les spam reports
 */
async function handleSpamReport(email: string): Promise<void> {
  try {
    await db.update(users)
      .set({
        metadata: {
          spamReported: true,
          spamReportedAt: new Date().toISOString(),
        },
      })
      .where(eq(users.email, email));

    logger.warn(`Spam report received: ${email}`);
  } catch (error: any) {
    logger.error('Failed to handle spam report', { email, error: error.message });
  }
}

/**
 * Gérer les désinscriptions
 */
async function handleUnsubscribe(email: string): Promise<void> {
  try {
    await db.update(users)
      .set({
        metadata: {
          unsubscribed: true,
          unsubscribedAt: new Date().toISOString(),
        },
      })
      .where(eq(users.email, email));

    logger.info(`User unsubscribed: ${email}`);
  } catch (error: any) {
    logger.error('Failed to handle unsubscribe', { email, error: error.message });
  }
}

export default router;
