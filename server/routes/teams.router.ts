// @ts-nocheck
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { teams, teamMembers, teamInvitations, teamWorkspaces, users, projects } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTeams = await db.select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      visibility: teams.visibility,
      plan: teams.plan,
      createdAt: teams.createdAt,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(desc(teams.createdAt));

    const teamsWithCounts = await Promise.all(
      userTeams.map(async (team) => {
        const [memberCount] = await db.select({
          count: sql<number>`COUNT(*)`,
        }).from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        const [projectCount] = await db.select({
          count: sql<number>`COUNT(*)`,
        }).from(projects)
          .where(eq(projects.teamId, team.id));

        return {
          id: team.id,
          name: team.name,
          description: team.description || '',
          avatar: '',
          memberCount: Number(memberCount?.count || 0),
          projectCount: Number(projectCount?.count || 0),
          visibility: team.visibility || 'private',
          role: team.role || 'member',
          created: team.createdAt?.toISOString() || new Date().toISOString(),
          plan: team.plan || 'free',
        };
      })
    );

    res.json(teamsWithCounts);
  } catch (error) {
    console.error('[Teams] Failed to fetch teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/invitations', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const invitations = await db.select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      teamName: teams.name,
      inviterId: teamInvitations.invitedBy,
      inviterName: users.displayName,
      role: teamInvitations.role,
      createdAt: teamInvitations.createdAt,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .leftJoin(users, eq(teamInvitations.invitedBy, users.id))
    .where(and(
      eq(teamInvitations.email, userEmail || ''),
      eq(teamInvitations.status, 'pending')
    ))
    .orderBy(desc(teamInvitations.createdAt));

    res.json(invitations.map(inv => ({
      id: inv.id,
      teamName: inv.teamName,
      inviterName: inv.inviterName || 'Unknown',
      role: inv.role || 'member',
      sent: inv.createdAt?.toISOString() || new Date().toISOString(),
    })));
  } catch (error) {
    console.error('[Teams] Failed to fetch invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

router.post('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, visibility } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const [newTeam] = await db.insert(teams).values({
      name: name.trim(),
      description: description?.trim() || '',
      slug,
      visibility: visibility || 'private',
      plan: 'free',
      ownerId: userId,
    }).returning();

    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId,
      role: 'owner',
    });

    res.json({
      id: newTeam.id,
      name: newTeam.name,
      slug: newTeam.slug,
      description: newTeam.description,
      visibility: newTeam.visibility,
      plan: newTeam.plan,
    });
  } catch (error) {
    console.error('[Teams] Failed to create team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.get('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (!membership && team.visibility !== 'public') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [memberCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const [projectCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(projects)
      .where(eq(projects.teamId, teamId));

    const [workspaceCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(teamWorkspaces)
      .where(eq(teamWorkspaces.teamId, teamId));

    res.json({
      id: team.id,
      name: team.name,
      slug: team.slug || '',
      description: team.description || '',
      visibility: team.visibility || 'private',
      plan: team.plan || 'free',
      memberCount: Number(memberCount?.count || 0),
      projectCount: Number(projectCount?.count || 0),
      workspaceCount: Number(workspaceCount?.count || 0),
      createdAt: team.createdAt?.toISOString() || new Date().toISOString(),
      role: membership?.role || 'viewer',
    });
  } catch (error) {
    console.error('[Teams] Failed to fetch team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.patch('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Not authorized to update team' });
    }

    const { name, slug, description, visibility } = req.body;

    const [updatedTeam] = await db.update(teams)
      .set({
        name: name?.trim(),
        slug: slug?.trim(),
        description: description?.trim(),
        visibility,
      })
      .where(eq(teams.id, teamId))
      .returning();

    res.json(updatedTeam);
  } catch (error) {
    console.error('[Teams] Failed to update team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only team owner can delete the team' });
    }

    await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    await db.delete(teamInvitations).where(eq(teamInvitations.teamId, teamId));
    await db.delete(teamWorkspaces).where(eq(teamWorkspaces.teamId, teamId));
    await db.delete(teams).where(eq(teams.id, teamId));

    res.json({ success: true });
  } catch (error) {
    console.error('[Teams] Failed to delete team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

router.get('/:id/members', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);

    const members = await db.select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      username: users.username,
      email: users.email,
      role: teamMembers.role,
      joinedAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(teamMembers.createdAt));

    res.json(members.map(m => ({
      id: m.id,
      userId: m.userId,
      username: m.username || 'unknown',
      email: m.email || '',
      role: m.role || 'member',
      joinedAt: m.joinedAt?.toISOString() || new Date().toISOString(),
    })));
  } catch (error) {
    console.error('[Teams] Failed to fetch members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

router.post('/:id/invitations', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;
    const { email, role } = req.body;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Not authorized to invite members' });
    }

    const [invitation] = await db.insert(teamInvitations).values({
      teamId,
      email,
      role: role || 'member',
      invitedBy: userId,
      status: 'pending',
    }).returning();

    res.json({ success: true, invitation });
  } catch (error) {
    console.error('[Teams] Failed to send invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

router.post('/invitations/:invitationId/accept', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const invitationId = parseInt(req.params.invitationId, 10);
    const userId = (req as any).user?.id;

    const [invitation] = await db.select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId));

    if (!invitation || invitation.status !== 'pending') {
      return res.status(404).json({ error: 'Invitation not found or already processed' });
    }

    await db.insert(teamMembers).values({
      teamId: invitation.teamId,
      userId,
      role: invitation.role || 'member',
    });

    await db.update(teamInvitations)
      .set({ status: 'accepted' })
      .where(eq(teamInvitations.id, invitationId));

    res.json({ success: true });
  } catch (error) {
    console.error('[Teams] Failed to accept invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

router.post('/invitations/:invitationId/decline', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const invitationId = parseInt(req.params.invitationId, 10);

    await db.update(teamInvitations)
      .set({ status: 'declined' })
      .where(eq(teamInvitations.id, invitationId));

    res.json({ success: true });
  } catch (error) {
    console.error('[Teams] Failed to decline invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

router.delete('/:id/members/:userId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const currentUserId = (req as any).user?.id;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, currentUserId)));

    if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Not authorized to remove members' });
    }

    await db.delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));

    res.json({ success: true });
  } catch (error) {
    console.error('[Teams] Failed to remove member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.patch('/:id/members/:userId', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const currentUserId = (req as any).user?.id;
    const { role } = req.body;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, currentUserId)));

    if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Not authorized to update member roles' });
    }

    await db.update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));

    res.json({ success: true });
  } catch (error) {
    console.error('[Teams] Failed to update member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

router.get('/:id/projects', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);

    const teamProjects = await db.select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      language: projects.language,
      visibility: projects.visibility,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.teamId, teamId))
    .orderBy(desc(projects.updatedAt));

    res.json(teamProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      language: p.language || 'javascript',
      visibility: p.visibility || 'private',
      lastUpdated: p.updatedAt?.toISOString() || new Date().toISOString(),
    })));
  } catch (error) {
    console.error('[Teams] Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id/workspaces', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);

    const workspaces = await db.select()
      .from(teamWorkspaces)
      .where(eq(teamWorkspaces.teamId, teamId))
      .orderBy(desc(teamWorkspaces.createdAt));

    res.json(workspaces.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description || '',
      projectCount: 0,
      createdAt: w.createdAt?.toISOString() || new Date().toISOString(),
    })));
  } catch (error) {
    console.error('[Teams] Failed to fetch workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.post('/:id/workspaces', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;
    const { name, description } = req.body;

    const [membership] = await db.select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Not authorized to create workspaces' });
    }

    const [workspace] = await db.insert(teamWorkspaces).values({
      teamId,
      name: name.trim(),
      description: description?.trim() || '',
    }).returning();

    res.json({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      projectCount: 0,
      createdAt: workspace.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Teams] Failed to create workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

export default router;
