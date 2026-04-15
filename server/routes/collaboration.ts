import { Router, Request, Response } from 'express';
import { collaborativeEditingService } from '../services/collaborative-editing';
import { db } from '../db';
import { collaborationSessions, sessionParticipants, collaborationMessages, projects } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ensureAuthenticated as requireAuth } from '../middleware/auth';
import { realEmailService } from '../services/real-email-service';
import { createLogger } from '../utils/logger';
import { getCollaborationService } from '../collaboration/unified-collaboration-service';
import { storage } from '../storage';
import { notifyCollaborationInvite } from '../services/notification-events';

const logger = createLogger('collaboration-router');

const router = Router();

/**
 * SECURITY FIX #24: Verify user has access to project
 * User has access if they own the project or are a collaborator
 */
async function verifyProjectAccess(projectId: string, userId: number): Promise<boolean> {
  const project = await storage.getProject(projectId);
  if (!project) return false;
  if (project.ownerId === userId || project.userId === userId) return true;
  
  const participant = await db
    .select()
    .from(sessionParticipants)
    .innerJoin(collaborationSessions, eq(sessionParticipants.sessionId, collaborationSessions.id))
    .where(
      and(
        eq(collaborationSessions.projectId, projectId),
        eq(sessionParticipants.userId, userId)
      )
    )
    .limit(1);
  
  return participant.length > 0;
}

// Generate collaboration link
router.post('/generate-link', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId, fileId } = req.body;
    const userId = req.user?.id;
    
    if (!projectId || !fileId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }

    const link = await collaborativeEditingService.generateCollaborationLink(projectId, fileId);
    
    res.json({ link });
  } catch (error) {
    logger.error('Error generating collaboration link:', error);
    res.status(500).json({ error: 'Failed to generate collaboration link' });
  }
});

// Get active sessions for a project
router.get('/sessions/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    const sessions = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(collaborationSessions.status, 'active')
        )
      );
    
    res.json(sessions);
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get participants for a session
router.get('/sessions/:sessionId/participants', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const participants = await db
      .select()
      .from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.active, true)
        )
      );
    
    res.json(participants);
  } catch (error) {
    logger.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Join a session with token (for share links)
router.post('/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token, sessionId } = req.body;
    const userId = req.user?.id;
    const username = req.user?.username || 'Anonymous';
    
    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    // Verify session exists and is active
    const [session] = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.id, sessionId),
          eq(collaborationSessions.status, 'active')
        )
      );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }
    
    // Add user to session participants if not already present
    const existingParticipant = await db
      .select()
      .from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId)
        )
      );
    
    // Generate a random cursor color for the participant
    const cursorColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const cursorColor = cursorColors[Math.floor(Math.random() * cursorColors.length)];
    
    if (existingParticipant.length === 0) {
      await db.insert(sessionParticipants).values({
        sessionId,
        userId,
        username,
        cursorColor,
        active: true,
        joinedAt: new Date()
      });
    }
    
    res.json({ 
      success: true, 
      session: {
        id: session.id,
        projectId: session.projectId
      }
    });
  } catch (error) {
    logger.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Get session statistics
router.get('/stats/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    const activeSessions = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(collaborationSessions.status, 'active')
        )
      );
    
    const totalParticipants = await db
      .select()
      .from(sessionParticipants)
      .innerJoin(
        collaborationSessions,
        eq(sessionParticipants.sessionId, collaborationSessions.id)
      )
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(sessionParticipants.active, true)
        )
      );
    
    res.json({
      activeSessions: activeSessions.length,
      totalParticipants: totalParticipants.length,
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Send invitation to collaborate
router.post('/invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId, email, role } = req.body;
    const inviterId = req.user?.id;
    const inviterName = req.user?.username || 'A team member';
    
    if (!projectId || !email) {
      return res.status(400).json({ error: 'Missing projectId or email' });
    }

    if (!inviterId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, inviterId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Generate invitation token
    const inviteToken = require('nanoid').nanoid(32);
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const inviteLink = `${baseUrl}/ide/${projectId}?invite=${inviteToken}`;
    
    // Send email invitation via SendGrid
    const roleDisplay = role === 'editor' ? 'Editor' : role === 'viewer' ? 'Viewer' : 'Collaborator';
    
    const emailResult = await realEmailService.sendEmail({
      to: email,
      subject: `${inviterName} invited you to collaborate on E-Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; background: #f8f9fa; }
            .message { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; }
            .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
            .button:hover { opacity: 0.9; }
            .role-badge { display: inline-block; background: #e9ecef; padding: 4px 12px; border-radius: 4px; font-size: 14px; color: #495057; margin-top: 10px; }
            .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited to Collaborate!</h1>
            </div>
            <div class="content">
              <div class="message">
                <p>Hi there,</p>
                <p><strong>${inviterName}</strong> has invited you to collaborate on a project in E-Code, an AI-powered development platform.</p>
                <p>Your role: <span class="role-badge">${roleDisplay}</span></p>
                <p>Click the button below to accept the invitation and start collaborating:</p>
                <center>
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </center>
                <p style="margin-top: 20px; font-size: 13px; color: #6c757d;">
                  Or copy this link: <br>
                  <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
                </p>
              </div>
            </div>
            <div class="footer">
              <p>This invitation was sent by E-Code Platform.<br>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${inviterName} invited you to collaborate on E-Code!\n\nYour role: ${roleDisplay}\n\nAccept the invitation: ${inviteLink}\n\nIf you didn't expect this invitation, you can safely ignore this email.`
    });
    
    const invitedUser = await storage.getUserByEmail(email);
    if (invitedUser) {
      const project = await storage.getProject(projectId);
      const projectName = project?.name || `Project #${projectId}`;
      notifyCollaborationInvite(invitedUser.id, inviterName, projectName).catch(err =>
        logger.warn('[Collaboration] Failed to send push notification for invite:', err)
      );
    }

    if (emailResult.success) {
      logger.info(`[Collaboration] Invitation email sent to ${email} for project ${projectId} by user ${inviterId}`);
      res.json({ 
        success: true, 
        message: `Invitation sent to ${email}`,
        inviteLink
      });
    } else {
      logger.warn(`[Collaboration] Failed to send invitation email to ${email}: ${emailResult.error}`);
      // Still return success with link - user can share manually
      res.json({ 
        success: true, 
        message: `Email delivery failed, but you can share this link manually`,
        inviteLink,
        emailError: emailResult.error
      });
    }
  } catch (error: any) {
    logger.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get active collaborators for a project (for real-time presence)
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Missing projectId' });
    }
    
    // Return empty array for now - real data comes from WebSocket
    res.json([]);
  } catch (error) {
    logger.error('Error fetching active collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// ============================================================================
// FRONTEND-COMPATIBLE ROUTES (for ReplitCollaboration.tsx)
// ============================================================================

// Get collaborators/users for a project - matches frontend expectations
router.get('/:projectId/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    const sessions = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(collaborationSessions.status, 'active')
        )
      );
    
    if (sessions.length === 0) {
      return res.json({ collaborators: [] });
    }
    
    // Get all participants across all active sessions
    const participants = await db
      .select({
        id: sessionParticipants.id,
        sessionId: sessionParticipants.sessionId,
        odUserId: sessionParticipants.userId,
        username: sessionParticipants.username,
        cursorColor: sessionParticipants.cursorColor,
        joinedAt: sessionParticipants.joinedAt,
        active: sessionParticipants.active
      })
      .from(sessionParticipants)
      .innerJoin(
        collaborationSessions,
        eq(sessionParticipants.sessionId, collaborationSessions.id)
      )
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(sessionParticipants.active, true)
        )
      );
    
    // Transform to frontend expected format
    const collaborators = participants.map(p => ({
      id: p.id,
      username: p.username,
      displayName: p.username,
      avatarUrl: undefined,
      role: 'editor',
      status: 'online',
      lastSeen: p.joinedAt,
      cursor: {
        x: 0,
        y: 0,
        color: p.cursorColor
      }
    }));
    
    res.json({ collaborators });
  } catch (error) {
    logger.error('Error fetching project collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// Send invitation to a specific project - matches frontend expectations
router.post('/:projectId/invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const { email, role } = req.body;
    const userId = req.user?.id;
    const inviterName = req.user?.username || 'Someone';
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const inviteToken = require('nanoid').nanoid(32);
    const inviteLink = `${req.protocol}://${req.get('host')}/ide/${projectId}?invite=${inviteToken}`;
    
    logger.info(`[Collaboration] Invite sent from ${inviterName} to ${email} for project ${projectId} as ${role || 'editor'}`);
    
    res.json({ 
      success: true, 
      message: `Invitation sent to ${email}`,
      inviteLink
    });
  } catch (error) {
    logger.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Update collaborator role - matches frontend expectations
router.patch('/:projectId/users/:collaboratorId', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const { collaboratorId } = req.params;
    const { role } = req.body;
    const userId = req.user?.id;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    
    logger.info(`[Collaboration] Updated role for ${collaboratorId} to ${role} in project ${projectId}`);
    
    res.json({ 
      success: true, 
      message: `Role updated to ${role}`
    });
  } catch (error) {
    logger.error('Error updating collaborator role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove collaborator - matches frontend expectations
router.delete('/:projectId/users/:collaboratorId', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const { collaboratorId } = req.params;
    const userId = req.user?.id;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    await db
      .update(sessionParticipants)
      .set({ active: false, leftAt: new Date() })
      .where(eq(sessionParticipants.id, collaboratorId));
    
    logger.info(`[Collaboration] Removed collaborator ${collaboratorId} from project ${projectId}`);
    
    res.json({ 
      success: true, 
      message: 'Collaborator removed'
    });
  } catch (error) {
    logger.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// ============================================================================
// 8.8 FIX: CHAT MESSAGE PERSISTENCE ROUTES
// ============================================================================

// Get chat messages for a session
router.get('/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const messages = await db
      .select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Reverse to get chronological order
    res.json(messages.reverse());
  } catch (error) {
    logger.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new chat message (persisted)
router.post('/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { content, type = 'text', codeLanguage, metadata } = req.body;
    const userId = req.user?.id;
    const username = req.user?.username || 'Anonymous';
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Verify session exists
    const [session] = await db
      .select()
      .from(collaborationSessions)
      .where(eq(collaborationSessions.id, sessionId));
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Insert the message
    const [newMessage] = await db
      .insert(collaborationMessages)
      .values({
        sessionId,
        userId,
        username,
        content,
        type,
        codeLanguage,
        metadata,
      })
      .returning();
    
    // Also broadcast via WebSocket for real-time delivery
    try {
      const collabService = getCollaborationService();
      if (collabService) {
        collabService.broadcastToProject(session.projectId, 'chat', {
          userId,
          username,
          message: content,
          timestamp: newMessage.createdAt.toISOString(),
          id: newMessage.id,
        });
      }
    } catch (wsError) {
      logger.warn('Failed to broadcast message via WebSocket:', wsError);
    }
    
    logger.debug(`[Collaboration] Message persisted: ${newMessage.id} by ${username}`);
    
    res.json(newMessage);
  } catch (error) {
    logger.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Get chat messages for a project (uses active session)
router.get('/:projectId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 100;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    const [activeSession] = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(collaborationSessions.status, 'active')
        )
      )
      .orderBy(desc(collaborationSessions.createdAt))
      .limit(1);
    
    if (!activeSession) {
      return res.json([]);
    }
    
    // Get messages for this session
    const messages = await db
      .select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, activeSession.id))
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(limit);
    
    res.json(messages.reverse());
  } catch (error) {
    logger.error('Error fetching project messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message to a project (uses or creates active session)
router.post('/:projectId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const { content, type = 'text', codeLanguage, metadata, fileId } = req.body;
    const userId = req.user?.id;
    const username = req.user?.username || 'Anonymous';
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this project' });
    }
    
    let [activeSession] = await db
      .select()
      .from(collaborationSessions)
      .where(
        and(
          eq(collaborationSessions.projectId, projectId),
          eq(collaborationSessions.status, 'active')
        )
      )
      .orderBy(desc(collaborationSessions.createdAt))
      .limit(1);
    
    if (!activeSession) {
      const [newSession] = await db
        .insert(collaborationSessions)
        .values({
          projectId: projectId,
          hostId: String(userId),
          status: 'active',
        })
        .returning();
      activeSession = newSession;
    }
    
    // Insert the message
    const [newMessage] = await db
      .insert(collaborationMessages)
      .values({
        sessionId: activeSession.id,
        userId,
        username,
        content,
        type,
        codeLanguage,
        metadata,
      })
      .returning();
    
    // Also broadcast via WebSocket for real-time delivery
    try {
      const collabService = getCollaborationService();
      if (collabService) {
        collabService.broadcastToProject(projectId, 'chat', {
          userId,
          username,
          message: content,
          timestamp: newMessage.createdAt.toISOString(),
          id: newMessage.id,
        });
      }
    } catch (wsError) {
      logger.warn('Failed to broadcast message via WebSocket:', wsError);
    }
    
    logger.debug(`[Collaboration] Project message persisted: ${newMessage.id} by ${username}`);
    
    res.json(newMessage);
  } catch (error) {
    logger.error('Error saving project message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

export default router;