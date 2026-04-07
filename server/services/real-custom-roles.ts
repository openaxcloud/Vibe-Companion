// @ts-nocheck
import { db } from '../db';
import { users, projects } from '@shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

const logger = {
  info: (message: string, ...args: any[]) => {},
  error: (message: string, ...args: any[]) => console.error(`[real-custom-roles] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[real-custom-roles] WARN: ${message}`, ...args),
};

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
}

export interface RoleAssignment {
  id: number;
  roleId: number;
  userId: number;
  scope: 'global' | 'organization' | 'team' | 'project';
  scopeId?: number;
  assignedBy: number;
  assignedAt: Date;
  expiresAt?: Date;
}

export interface PolicyRule {
  effect: 'allow' | 'deny';
  actions: string[];
  resources: string[];
  conditions?: Record<string, any>;
}

export interface Policy {
  id: number;
  name: string;
  description: string;
  rules: PolicyRule[];
  roleId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RealCustomRolesService {
  private roles = new Map<number, Role>();
  private assignments = new Map<number, RoleAssignment>();
  private policies = new Map<number, Policy>();
  private nextRoleId = 1;
  private nextAssignmentId = 1;
  private nextPolicyId = 1;

  // Predefined system roles
  private systemRoles: Role[] = [
    {
      id: -1,
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      permissions: [{ 
        id: 'all', 
        name: 'All Permissions', 
        description: 'Access to all system resources', 
        resource: '*', 
        actions: ['*'] 
      }],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: -2,
      name: 'Organization Admin',
      description: 'Full access within organization scope',
      permissions: [
        {
          id: 'org_manage',
          name: 'Organization Management',
          description: 'Manage organization settings and members',
          resource: 'organization:*',
          actions: ['read', 'write', 'delete', 'admin'],
        },
        {
          id: 'team_manage',
          name: 'Team Management',
          description: 'Create and manage teams',
          resource: 'team:*',
          actions: ['create', 'read', 'write', 'delete'],
        },
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: -3,
      name: 'Developer',
      description: 'Standard developer permissions',
      permissions: [
        {
          id: 'project_access',
          name: 'Project Access',
          description: 'Access to assigned projects',
          resource: 'project:*',
          actions: ['read', 'write', 'execute'],
        },
        {
          id: 'deployment_manage',
          name: 'Deployment Management',
          description: 'Deploy and manage applications',
          resource: 'deployment:*',
          actions: ['create', 'read', 'update'],
        },
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: -4,
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        {
          id: 'readonly',
          name: 'Read Only',
          description: 'View resources without modification',
          resource: '*',
          actions: ['read'],
        },
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  constructor() {
    // Initialize system roles
    for (const role of this.systemRoles) {
      this.roles.set(role.id, role);
    }
    
    logger.info('Real Custom Roles Service initialized with system roles');
  }

  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>): Promise<Role> {
    const newRole: Role = {
      ...role,
      id: this.nextRoleId++,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.roles.set(newRole.id, newRole);
    logger.info(`Created custom role: ${newRole.name} (ID: ${newRole.id})`);
    
    return newRole;
  }

  async updateRole(roleId: number, updates: Partial<Role>): Promise<Role> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const updatedRole = {
      ...role,
      ...updates,
      id: role.id,
      isSystem: role.isSystem,
      updatedAt: new Date(),
    };

    this.roles.set(roleId, updatedRole);
    logger.info(`Updated role: ${updatedRole.name} (ID: ${roleId})`);
    
    return updatedRole;
  }

  async deleteRole(roleId: number): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    // Remove all assignments for this role
    for (const [assignmentId, assignment] of this.assignments.entries()) {
      if (assignment.roleId === roleId) {
        this.assignments.delete(assignmentId);
      }
    }

    // Remove all policies for this role
    for (const [policyId, policy] of this.policies.entries()) {
      if (policy.roleId === roleId) {
        this.policies.delete(policyId);
      }
    }

    this.roles.delete(roleId);
    logger.info(`Deleted role: ${role.name} (ID: ${roleId})`);
  }

  async getRoles(filters?: { isSystem?: boolean; search?: string }): Promise<Role[]> {
    let roles = Array.from(this.roles.values());

    if (filters?.isSystem !== undefined) {
      roles = roles.filter(role => role.isSystem === filters.isSystem);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      roles = roles.filter(role => 
        role.name.toLowerCase().includes(searchLower) ||
        role.description.toLowerCase().includes(searchLower)
      );
    }

    return roles;
  }

  async getRole(roleId: number): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async assignRole(assignment: Omit<RoleAssignment, 'id' | 'assignedAt'>): Promise<RoleAssignment> {
    const role = this.roles.get(assignment.roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // Check if user already has this role in the same scope
    const existingAssignment = Array.from(this.assignments.values()).find(
      a => a.userId === assignment.userId && 
           a.roleId === assignment.roleId && 
           a.scope === assignment.scope &&
           a.scopeId === assignment.scopeId
    );

    if (existingAssignment) {
      throw new Error('User already has this role in the specified scope');
    }

    const newAssignment: RoleAssignment = {
      ...assignment,
      id: this.nextAssignmentId++,
      assignedAt: new Date(),
    };

    this.assignments.set(newAssignment.id, newAssignment);
    logger.info(`Assigned role ${role.name} to user ${assignment.userId} in ${assignment.scope} scope`);
    
    return newAssignment;
  }

  async revokeRole(assignmentId: number): Promise<void> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error('Role assignment not found');
    }

    this.assignments.delete(assignmentId);
    logger.info(`Revoked role assignment ${assignmentId}`);
  }

  async getUserRoles(userId: number, scope?: 'global' | 'organization' | 'team' | 'project', scopeId?: number): Promise<RoleAssignment[]> {
    let assignments = Array.from(this.assignments.values()).filter(a => a.userId === userId);

    if (scope) {
      assignments = assignments.filter(a => a.scope === scope);
      if (scopeId !== undefined) {
        assignments = assignments.filter(a => a.scopeId === scopeId);
      }
    }

    // Filter out expired assignments
    const now = new Date();
    assignments = assignments.filter(a => !a.expiresAt || a.expiresAt > now);

    return assignments;
  }

  async getUserPermissions(userId: number, resource: string, scope?: 'global' | 'organization' | 'team' | 'project', scopeId?: number): Promise<Permission[]> {
    const userAssignments = await this.getUserRoles(userId, scope, scopeId);
    const permissions: Permission[] = [];
    const seen = new Set<string>();

    for (const assignment of userAssignments) {
      const role = this.roles.get(assignment.roleId);
      if (!role) continue;

      for (const permission of role.permissions) {
        // Check if permission applies to the requested resource
        if (this.matchResource(resource, permission.resource)) {
          const permissionKey = `${permission.id}:${permission.resource}`;
          if (!seen.has(permissionKey)) {
            seen.add(permissionKey);
            permissions.push(permission);
          }
        }
      }
    }

    return permissions;
  }

  async checkPermission(
    userId: number, 
    action: string, 
    resource: string, 
    scope?: 'global' | 'organization' | 'team' | 'project', 
    scopeId?: number,
    context?: Record<string, any>
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, resource, scope, scopeId);

    for (const permission of permissions) {
      if (permission.actions.includes('*') || permission.actions.includes(action)) {
        // Check conditions if any
        if (permission.conditions && context) {
          if (!this.evaluateConditions(permission.conditions, context)) {
            continue;
          }
        }
        return true;
      }
    }

    return false;
  }

  private matchResource(requestedResource: string, permissionResource: string): boolean {
    if (permissionResource === '*') return true;

    const requestedParts = requestedResource.split(':');
    const permissionParts = permissionResource.split(':');

    for (let i = 0; i < permissionParts.length; i++) {
      if (permissionParts[i] === '*') return true;
      if (i >= requestedParts.length) return false;
      if (permissionParts[i] !== requestedParts[i]) return false;
    }

    return requestedParts.length === permissionParts.length;
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const contextValue = context[key];

      if (typeof condition === 'object' && condition !== null) {
        // Handle operators
        if ('$eq' in condition && contextValue !== condition.$eq) return false;
        if ('$ne' in condition && contextValue === condition.$ne) return false;
        if ('$in' in condition && !condition.$in.includes(contextValue)) return false;
        if ('$nin' in condition && condition.$nin.includes(contextValue)) return false;
        if ('$gt' in condition && contextValue <= condition.$gt) return false;
        if ('$gte' in condition && contextValue < condition.$gte) return false;
        if ('$lt' in condition && contextValue >= condition.$lt) return false;
        if ('$lte' in condition && contextValue > condition.$lte) return false;
      } else {
        // Simple equality check
        if (contextValue !== condition) return false;
      }
    }

    return true;
  }

  // Policy management
  async createPolicy(policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    const role = this.roles.get(policy.roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    const newPolicy: Policy = {
      ...policy,
      id: this.nextPolicyId++,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(newPolicy.id, newPolicy);
    logger.info(`Created policy: ${newPolicy.name} for role ${role.name}`);
    
    return newPolicy;
  }

  async getPolicies(roleId: number): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.roleId === roleId);
  }

  async evaluatePolicy(userId: number, action: string, resource: string, context?: Record<string, any>): Promise<boolean> {
    const userAssignments = await this.getUserRoles(userId);
    let decision = false;

    for (const assignment of userAssignments) {
      const policies = await this.getPolicies(assignment.roleId);

      for (const policy of policies) {
        for (const rule of policy.rules) {
          // Check if rule applies to this action and resource
          const actionMatches = rule.actions.includes('*') || rule.actions.includes(action);
          const resourceMatches = rule.resources.some(r => this.matchResource(resource, r));

          if (actionMatches && resourceMatches) {
            // Evaluate conditions
            if (rule.conditions && context) {
              if (!this.evaluateConditions(rule.conditions, context)) {
                continue;
              }
            }

            // Apply effect
            if (rule.effect === 'allow') {
              decision = true;
            } else if (rule.effect === 'deny') {
              return false; // Deny takes precedence
            }
          }
        }
      }
    }

    return decision;
  }

  // Bulk operations
  async bulkAssignRole(roleId: number, userIds: number[], scope: 'global' | 'organization' | 'team' | 'project', scopeId?: number, assignedBy: number): Promise<RoleAssignment[]> {
    const assignments: RoleAssignment[] = [];

    for (const userId of userIds) {
      try {
        const assignment = await this.assignRole({
          roleId,
          userId,
          scope,
          scopeId,
          assignedBy,
        });
        assignments.push(assignment);
      } catch (error) {
        logger.warn(`Failed to assign role to user ${userId}:`, error);
      }
    }

    return assignments;
  }

  async cloneRole(roleId: number, newName: string, createdBy: number): Promise<Role> {
    const sourceRole = this.roles.get(roleId);
    if (!sourceRole) {
      throw new Error('Source role not found');
    }

    return this.createRole({
      name: newName,
      description: `Cloned from ${sourceRole.name}`,
      permissions: [...sourceRole.permissions],
      createdBy,
    });
  }

  // Audit and compliance
  async getRoleAuditLog(roleId: number): Promise<any[]> {
    // In production, this would query an audit log table
    return [];
  }

  async getPermissionMatrix(scope: 'global' | 'organization' | 'team' | 'project', scopeId?: number): Promise<any> {
    const matrix: Record<string, Record<string, string[]>> = {};
    const assignments = Array.from(this.assignments.values()).filter(a => {
      if (a.scope !== scope) return false;
      if (scopeId !== undefined && a.scopeId !== scopeId) return false;
      return true;
    });

    for (const assignment of assignments) {
      const role = this.roles.get(assignment.roleId);
      if (!role) continue;

      const userKey = `user_${assignment.userId}`;
      if (!matrix[userKey]) {
        matrix[userKey] = {};
      }

      for (const permission of role.permissions) {
        if (!matrix[userKey][permission.resource]) {
          matrix[userKey][permission.resource] = [];
        }
        matrix[userKey][permission.resource].push(...permission.actions);
      }
    }

    return matrix;
  }
}

// Export singleton instance
export const realCustomRolesService = new RealCustomRolesService();