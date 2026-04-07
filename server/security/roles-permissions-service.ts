/**
 * Custom Roles & Permissions Service
 * Provides enterprise-grade role-based access control (RBAC)
 */

import { db } from '../db';
import { roles, userRoles, permissions, users, auditLogs } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface PermissionDefinition {
  resource: string;
  action: string;
  description: string;
  category: string;
}

// System-defined permissions
export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Project Management
  { resource: 'project', action: 'create', description: 'Create new projects', category: 'project_management' },
  { resource: 'project', action: 'read', description: 'View projects', category: 'project_management' },
  { resource: 'project', action: 'update', description: 'Edit project settings', category: 'project_management' },
  { resource: 'project', action: 'delete', description: 'Delete projects', category: 'project_management' },
  { resource: 'project', action: 'deploy', description: 'Deploy projects', category: 'project_management' },
  { resource: 'project', action: 'manage_env', description: 'Manage environment variables', category: 'project_management' },
  
  // User Management
  { resource: 'user', action: 'create', description: 'Create new users', category: 'user_management' },
  { resource: 'user', action: 'read', description: 'View user profiles', category: 'user_management' },
  { resource: 'user', action: 'update', description: 'Edit user information', category: 'user_management' },
  { resource: 'user', action: 'delete', description: 'Delete users', category: 'user_management' },
  { resource: 'user', action: 'manage_roles', description: 'Assign/remove roles', category: 'user_management' },
  
  // Team Management
  { resource: 'team', action: 'create', description: 'Create teams', category: 'team_management' },
  { resource: 'team', action: 'read', description: 'View team information', category: 'team_management' },
  { resource: 'team', action: 'update', description: 'Edit team settings', category: 'team_management' },
  { resource: 'team', action: 'delete', description: 'Delete teams', category: 'team_management' },
  { resource: 'team', action: 'manage_members', description: 'Add/remove team members', category: 'team_management' },
  
  // Billing & Subscription
  { resource: 'billing', action: 'view', description: 'View billing information', category: 'billing' },
  { resource: 'billing', action: 'manage', description: 'Manage payment methods', category: 'billing' },
  { resource: 'subscription', action: 'manage', description: 'Change subscription plans', category: 'billing' },
  
  // System Administration
  { resource: 'system', action: 'manage_sso', description: 'Configure SSO providers', category: 'system' },
  { resource: 'system', action: 'view_audit_logs', description: 'View audit logs', category: 'system' },
  { resource: 'system', action: 'manage_api_keys', description: 'Manage API keys', category: 'system' },
  { resource: 'system', action: 'manage_organization', description: 'Organization settings', category: 'system' },
];

// Built-in roles
export const SYSTEM_ROLES = {
  OWNER: {
    name: 'Owner',
    description: 'Full access to all resources and settings',
    permissions: SYSTEM_PERMISSIONS.map(p => `${p.resource}:${p.action}`)
  },
  ADMIN: {
    name: 'Admin',
    description: 'Administrative access excluding billing and organization deletion',
    permissions: SYSTEM_PERMISSIONS
      .filter(p => !['billing:manage', 'system:manage_organization'].includes(`${p.resource}:${p.action}`))
      .map(p => `${p.resource}:${p.action}`)
  },
  DEVELOPER: {
    name: 'Developer',
    description: 'Create and manage projects, view team resources',
    permissions: [
      'project:create', 'project:read', 'project:update', 'project:deploy', 'project:manage_env',
      'team:read', 'user:read'
    ]
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to projects and resources',
    permissions: ['project:read', 'team:read', 'user:read']
  }
};

export class RolesPermissionsService {
  async initializeSystemPermissions(): Promise<void> {
    // Insert system permissions if they don't exist
    for (const perm of SYSTEM_PERMISSIONS) {
      const existing = await db.select()
        .from(permissions)
        .where(and(
          eq(permissions.resource, perm.resource),
          eq(permissions.action, perm.action)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(permissions).values({
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
          category: perm.category,
          isSystem: true
        });
      }
    }
  }

  async createRole(organizationId: number, data: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<any> {
    const [role] = await db.insert(roles).values({
      organizationId,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      isSystem: false
    }).returning();

    await this.logAuditEvent(organizationId, null, 'role_created', { roleId: role.id, roleName: role.name });
    
    return role;
  }

  async updateRole(roleId: number, updates: {
    name?: string;
    description?: string;
    permissions?: string[];
  }): Promise<any> {
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot modify system roles');

    const [updated] = await db.update(roles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(roles.id, roleId))
      .returning();

    await this.logAuditEvent(role.organizationId, null, 'role_updated', { roleId, changes: updates });
    
    return updated;
  }

  async deleteRole(roleId: number): Promise<void> {
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete system roles');

    // Remove role from all users first
    await db.delete(userRoles).where(eq(userRoles.roleId, roleId));
    
    // Delete the role
    await db.delete(roles).where(eq(roles.id, roleId));

    await this.logAuditEvent(role.organizationId, null, 'role_deleted', { roleId, roleName: role.name });
  }

  async assignRole(userId: number, roleId: number, organizationId: number, assignedBy: number): Promise<void> {
    // Check if user already has this role
    const existing = await db.select()
      .from(userRoles)
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId),
        eq(userRoles.organizationId, organizationId)
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('User already has this role');
    }

    await db.insert(userRoles).values({
      userId,
      roleId,
      organizationId,
      assignedBy,
      assignedAt: new Date()
    });

    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
    await this.logAuditEvent(organizationId, assignedBy, 'role_assigned', {
      userId,
      roleId,
      roleName: role?.name
    });
  }

  async removeRole(userId: number, roleId: number, organizationId: number, removedBy: number): Promise<void> {
    const result = await db.delete(userRoles)
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId),
        eq(userRoles.organizationId, organizationId)
      ));

    const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
    await this.logAuditEvent(organizationId, removedBy, 'role_removed', {
      userId,
      roleId,
      roleName: role?.name
    });
  }

  async getUserRoles(userId: number, organizationId: number): Promise<any[]> {
    const userRoleRecords = await db.select({
      role: roles,
      assignment: userRoles
    })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.organizationId, organizationId)
      ));

    return userRoleRecords.map(r => ({
      ...r.role,
      assignedAt: r.assignment.assignedAt,
      assignedBy: r.assignment.assignedBy
    }));
  }

  async getUserPermissions(userId: number, organizationId: number): Promise<string[]> {
    const userRolesList = await this.getUserRoles(userId, organizationId);
    const allPermissions = new Set<string>();

    for (const role of userRolesList) {
      const perms = role.permissions as string[];
      perms.forEach(p => allPermissions.add(p));
    }

    return Array.from(allPermissions);
  }

  async hasPermission(userId: number, organizationId: number, resource: string, action: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, organizationId);
    return userPermissions.includes(`${resource}:${action}`);
  }

  async checkPermissions(userId: number, organizationId: number, requiredPermissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, organizationId);
    return requiredPermissions.every(p => userPermissions.includes(p));
  }

  async listRoles(organizationId: number): Promise<any[]> {
    return db.select()
      .from(roles)
      .where(eq(roles.organizationId, organizationId))
      .orderBy(roles.name);
  }

  async listPermissions(): Promise<any[]> {
    return db.select()
      .from(permissions)
      .orderBy(permissions.category, permissions.resource, permissions.action);
  }

  async getRoleUsers(roleId: number, organizationId: number): Promise<any[]> {
    const roleUsers = await db.select({
      user: users,
      assignment: userRoles
    })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(
        eq(userRoles.roleId, roleId),
        eq(userRoles.organizationId, organizationId)
      ));

    return roleUsers.map(r => ({
      ...r.user,
      assignedAt: r.assignment.assignedAt,
      assignedBy: r.assignment.assignedBy
    }));
  }

  async createSystemRoles(organizationId: number): Promise<void> {
    // Create built-in roles for the organization
    for (const [key, roleData] of Object.entries(SYSTEM_ROLES)) {
      const existing = await db.select()
        .from(roles)
        .where(and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, roleData.name),
          eq(roles.isSystem, true)
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(roles).values({
          organizationId,
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
          isSystem: true
        });
      }
    }
  }

  private async logAuditEvent(
    organizationId: number,
    userId: number | null,
    action: string,
    details: any
  ): Promise<void> {
    await db.insert(auditLogs).values({
      userId: userId?.toString() ?? 'system',
      action,
      resource: 'role',
      resourceId: details?.roleId?.toString(),
      metadata: {
        organizationId,
        status: 'success',
        ...details
      },
      timestamp: new Date()
    });
  }
}

// Export singleton instance
export const rolesPermissionsService = new RolesPermissionsService();