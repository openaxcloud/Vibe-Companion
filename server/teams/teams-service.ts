// @ts-nocheck
import { 
  Team, 
  TeamMember, 
  TeamInvitation, 
  TeamProject, 
  TeamWorkspace,
  InsertTeam,
  InsertTeamMember,
  InsertTeamInvitation,
  InsertTeamProject,
  InsertTeamWorkspace,
  TeamPermissions,
  ProjectPermissions
} from '@shared/teams-schema';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const logger = createLogger('teams-service');

export class TeamsService {
  private storage = storage;

  // Team management
  async createTeam(ownerId: number, data: { name: string; description?: string; visibility?: 'public' | 'private' }): Promise<Team> {
    try {
      // Generate unique slug
      const baseSlug = this.generateSlug(data.name);
      const slug = await this.ensureUniqueSlug(baseSlug);

      // Create team
      const team = await this.storage.createTeam({
        ...data,
        slug,
        ownerId
      });

      // Add owner as team member
      await this.storage.addTeamMember({
        teamId: team.id,
        userId: ownerId,
        role: 'owner',
        permissions: this.getDefaultPermissions('owner')
      });

      // Create default workspace
      await this.storage.createTeamWorkspace({
        teamId: team.id,
        name: 'Main Workspace',
        description: 'Default workspace for team projects',
        isDefault: true,
        createdBy: ownerId
      });

      // Log activity
      await this.logActivity(team.id, ownerId, 'team_created', 'team', team.id);

      logger.info(`Team created: ${team.name} (${team.slug})`);
      return team;
    } catch (error) {
      logger.error('Error creating team:', error);
      throw error;
    }
  }

  async getTeam(teamId: number): Promise<Team | null> {
    return this.storage.getTeam(teamId);
  }

  async getTeamBySlug(slug: string): Promise<Team | null> {
    return this.storage.getTeamBySlug(slug);
  }

  async getUserTeams(userId: number): Promise<Team[]> {
    return this.storage.getUserTeams(userId);
  }

  async getUserInvitations(userId: string): Promise<any[]> {
    // Team invitations are managed through the addTeamMember method below
    // This method would return pending invitations once invite persistence is added
    return [];
  }

  async updateTeam(teamId: number, userId: number, updates: Partial<Team>): Promise<Team> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, userId, 'canManageProjects');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to update team');
    }

    const team = await this.storage.updateTeam(teamId, updates);
    await this.logActivity(teamId, userId, 'team_updated', 'team', teamId);
    
    return team;
  }

  async deleteTeam(teamId: number, userId: number): Promise<void> {
    // Check if user is owner
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member || member.role !== 'owner') {
      throw new Error('Only team owner can delete the team');
    }

    // Delete all team data
    await this.storage.deleteTeam(teamId);
    await this.logActivity(teamId, userId, 'team_deleted', 'team', teamId);
  }

  // Member management
  async addTeamMember(teamId: number, inviterId: number, email: string, role: string = 'member'): Promise<TeamInvitation> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, inviterId, 'canInviteMembers');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to invite members');
    }

    // Check member limit
    const team = await this.getTeam(teamId);
    const memberCount = await this.storage.getTeamMemberCount(teamId);
    if (team && memberCount >= team.memberLimit) {
      throw new Error('Team member limit reached');
    }

    // Create invitation
    const invitation = await this.storage.createTeamInvitation({
      teamId,
      email,
      role,
      invitedBy: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await this.logActivity(teamId, inviterId, 'member_invited', 'invitation', invitation.id, { email, role });

    // Email invitation would be sent via notification service
    logger.info(`Invitation sent to ${email} for team ${teamId}`);
    
    return invitation;
  }

  async acceptInvitation(token: string, userId: number): Promise<TeamMember> {
    const invitation = await this.storage.getTeamInvitationByToken(token);
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.acceptedAt) {
      throw new Error('Invitation already accepted');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error('Invitation expired');
    }

    // Add user to team
    const member = await this.storage.addTeamMember({
      teamId: invitation.teamId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      permissions: this.getDefaultPermissions(invitation.role)
    });

    // Mark invitation as accepted
    await this.storage.acceptTeamInvitation(invitation.id);

    await this.logActivity(invitation.teamId, userId, 'member_joined', 'member', member.id);

    return member;
  }

  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.storage.getTeamInvitationByToken(token);
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Verify the invitation is for this user
    const user = await this.storage.getUser(userId);
    if (!user || user.email !== invitation.email) {
      throw new Error('This invitation is not for you');
    }

    // Mark invitation as declined
    await this.storage.declineTeamInvitation(invitation.id);
    
    logger.info(`User ${userId} declined invitation to team ${invitation.teamId}`);
  }

  async removeTeamMember(teamId: number, removerId: number, memberId: number): Promise<void> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, removerId, 'canRemoveMembers');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Can't remove team owner
    const member = await this.storage.getTeamMember(teamId, memberId);
    if (member && member.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    await this.storage.removeTeamMember(teamId, memberId);
    await this.logActivity(teamId, removerId, 'member_removed', 'member', memberId);
  }

  async updateMemberRole(teamId: number, updaterId: number, memberId: number, newRole: string): Promise<TeamMember> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, updaterId, 'canRemoveMembers');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to update member roles');
    }

    // Can't change owner role
    const member = await this.storage.getTeamMember(teamId, memberId);
    if (member && member.role === 'owner') {
      throw new Error('Cannot change team owner role');
    }

    const updatedMember = await this.storage.updateTeamMember(teamId, memberId, {
      role: newRole,
      permissions: this.getDefaultPermissions(newRole)
    });

    await this.logActivity(teamId, updaterId, 'member_role_updated', 'member', memberId, { newRole });

    return updatedMember;
  }

  // Project management
  async addProjectToTeam(teamId: number, userId: number, projectId: number): Promise<TeamProject> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, userId, 'canManageProjects');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to add projects');
    }

    // Check if user has access to project
    const project = await this.storage.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      const collaborators = await this.storage.getProjectCollaborators(projectId);
      const isCollaborator = collaborators.some(c => c.userId === userId);
      if (!isCollaborator) {
        throw new Error('You do not have access to this project');
      }
    }

    const teamProject = await this.storage.addProjectToTeam({
      teamId,
      projectId,
      addedBy: userId,
      permissions: {
        canView: true,
        canEdit: true,
        canDelete: false,
        canManageCollaborators: false,
        canDeploy: true
      }
    });

    await this.logActivity(teamId, userId, 'project_added', 'project', projectId);

    return teamProject;
  }

  async removeProjectFromTeam(teamId: number, userId: number, projectId: number): Promise<void> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, userId, 'canManageProjects');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to remove projects');
    }

    await this.storage.removeProjectFromTeam(teamId, projectId);
    await this.logActivity(teamId, userId, 'project_removed', 'project', projectId);
  }

  async getTeamProjects(teamId: number, userId: number): Promise<any[]> {
    // Check if user is team member
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      throw new Error('You are not a member of this team');
    }

    return this.storage.getTeamProjects(teamId);
  }

  // Workspace management
  async createWorkspace(teamId: number, userId: number, data: Omit<InsertTeamWorkspace, 'teamId' | 'createdBy'>): Promise<TeamWorkspace> {
    // Check permissions
    const hasPermission = await this.checkTeamPermission(teamId, userId, 'canManageWorkspaces');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create workspaces');
    }

    const workspace = await this.storage.createTeamWorkspace({
      ...data,
      teamId,
      createdBy: userId
    });

    await this.logActivity(teamId, userId, 'workspace_created', 'workspace', workspace.id);

    return workspace;
  }

  async getTeamWorkspaces(teamId: number, userId: number): Promise<TeamWorkspace[]> {
    // Check if user is team member
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      throw new Error('You are not a member of this team');
    }

    return this.storage.getTeamWorkspaces(teamId);
  }

  async addProjectToWorkspace(workspaceId: number, userId: number, projectId: number): Promise<void> {
    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    const hasPermission = await this.checkTeamPermission(workspace.teamId, userId, 'canManageWorkspaces');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to manage workspace');
    }

    await this.storage.addProjectToWorkspace(workspaceId, projectId);
    await this.logActivity(workspace.teamId, userId, 'project_added_to_workspace', 'workspace', workspaceId, { projectId });
  }

  // Activity tracking
  async getTeamActivity(teamId: number, userId: number, limit: number = 50): Promise<any[]> {
    // Check if user is team member
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      throw new Error('You are not a member of this team');
    }

    return this.storage.getTeamActivity(teamId, limit);
  }

  // Helper methods
  private async checkTeamPermission(teamId: number, userId: number, permission: keyof TeamPermissions): Promise<boolean> {
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member || !member.isActive) {
      return false;
    }

    // Owners have all permissions
    if (member.role === 'owner') {
      return true;
    }

    // Check specific permission
    const permissions = member.permissions as TeamPermissions;
    return permissions[permission] === true;
  }

  private getDefaultPermissions(role: string): TeamPermissions {
    switch (role) {
      case 'owner':
        return {
          canInviteMembers: true,
          canRemoveMembers: true,
          canManageProjects: true,
          canManageWorkspaces: true,
          canManageBilling: true,
          canDeleteTeam: true
        };
      case 'admin':
        return {
          canInviteMembers: true,
          canRemoveMembers: true,
          canManageProjects: true,
          canManageWorkspaces: true,
          canManageBilling: false,
          canDeleteTeam: false
        };
      case 'member':
        return {
          canInviteMembers: false,
          canRemoveMembers: false,
          canManageProjects: true,
          canManageWorkspaces: false,
          canManageBilling: false,
          canDeleteTeam: false
        };
      case 'viewer':
        return {
          canInviteMembers: false,
          canRemoveMembers: false,
          canManageProjects: false,
          canManageWorkspaces: false,
          canManageBilling: false,
          canDeleteTeam: false
        };
      default:
        return {};
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.storage.getTeamBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async logActivity(
    teamId: number, 
    userId: number, 
    action: string, 
    entityType: string, 
    entityId: number,
    metadata: any = {}
  ): Promise<void> {
    await this.storage.logTeamActivity({
      teamId,
      userId,
      action,
      entityType,
      entityId,
      metadata
    });
  }
}

export const teamsService = new TeamsService();