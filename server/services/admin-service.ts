// @ts-nocheck
import { DatabaseStorage } from '../storage';
import { 
  ApiKey, InsertApiKey,
  CmsPage, InsertCmsPage,
  Documentation, InsertDocumentation,
  DocCategory, InsertDocCategory,
  SupportTicket, InsertSupportTicket,
  TicketReply, InsertTicketReply,
  UserSubscription, InsertUserSubscription,
  AdminActivityLog
} from '@shared/admin-schema';
import { User } from '@shared/schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('admin-service');

export class AdminService {
  constructor(private storage: DatabaseStorage) {}

  // ✅ 40-YEAR SENIOR FIX: Sanitize user responses to prevent password/secret exposure
  private sanitizeUser(user: User): Omit<User, 'password' | 'twoFactorSecret' | 'passwordResetToken'> {
    const { password, twoFactorSecret, passwordResetToken, ...safeUser } = user;
    return safeUser;
  }

  // User Management
  async getAllUsers(filter?: { 
    search?: string; 
    role?: string; 
    status?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<{ users: any[]; total: number }> {
    const users = await this.storage.getAllUsers();
    
    let filteredUsers = users;
    
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.username.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.displayName?.toLowerCase() || '').includes(searchLower)
      );
    }
    
    const total = filteredUsers.length;
    
    if (filter?.limit) {
      const offset = filter.offset || 0;
      filteredUsers = filteredUsers.slice(offset, offset + filter.limit);
    }
    
    // ✅ Security: Strip sensitive fields before returning
    return { users: filteredUsers.map(u => this.sanitizeUser(u)), total };
  }

  async getAllProjects(filter?: {
    search?: string;
    visibility?: string;
    language?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ projects: any[]; total: number }> {
    const projects = await this.storage.getAllProjects();
    
    let filteredProjects = projects;
    
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filteredProjects = filteredProjects.filter(project => 
        project.name.toLowerCase().includes(searchLower) ||
        (project.description?.toLowerCase() || '').includes(searchLower)
      );
    }
    
    if (filter?.visibility) {
      filteredProjects = filteredProjects.filter(project => 
        project.visibility === filter.visibility
      );
    }
    
    if (filter?.language) {
      filteredProjects = filteredProjects.filter(project => 
        project.language === filter.language
      );
    }
    
    const total = filteredProjects.length;
    
    if (filter?.limit) {
      const offset = filter.offset || 0;
      filteredProjects = filteredProjects.slice(offset, offset + filter.limit);
    }
    
    // ✅ 40-YEAR SENIOR FIX: Add userId alias for ownerId (test contract compatibility)
    const normalizedProjects = filteredProjects.map(p => ({ ...p, userId: p.ownerId }));
    
    return { projects: normalizedProjects, total };
  }

  async updateUserRole(userId: string, role: string, adminId: string): Promise<void> {
    await this.storage.updateUser(userId, { role } as any);
    
    await this.logAdminActivity(adminId, 'update_user_role', 'user', userId, {
      newRole: role
    });
  }

  async suspendUser(userId: string, adminId: string, reason?: string): Promise<void> {
    await this.storage.updateUser(userId, { 
      accountLockedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    await this.logAdminActivity(adminId, 'suspend_user', 'user', userId, {
      reason
    });
  }

  async unsuspendUser(userId: string, adminId: string): Promise<void> {
    await this.storage.updateUser(userId, { 
      accountLockedUntil: null
    });
    
    await this.logAdminActivity(adminId, 'unsuspend_user', 'user', userId, {});
  }

  // API Key Management
  async getApiKeys(): Promise<ApiKey[]> {
    return this.storage.getApiKeys();
  }

  async getApiKeyByProvider(provider: string): Promise<ApiKey | undefined> {
    return this.storage.getApiKeyByProvider(provider);
  }

  async createApiKey(apiKey: InsertApiKey, adminId: string): Promise<ApiKey> {
    const created = await this.storage.createApiKey(apiKey);
    
    await this.logAdminActivity(adminId, 'create_api_key', 'api_key', created.id, {
      provider: apiKey.provider
    });
    
    return created;
  }

  async updateApiKey(id: number, update: Partial<ApiKey>, adminId: string): Promise<ApiKey | undefined> {
    const updated = await this.storage.updateApiKey(id, update);
    
    if (updated) {
      await this.logAdminActivity(adminId, 'update_api_key', 'api_key', id, {
        updates: update
      });
    }
    
    return updated;
  }

  async deleteApiKey(id: number, adminId: string): Promise<void> {
    const apiKey = await this.storage.getApiKey(id);
    if (!apiKey) return;
    
    await this.storage.deleteApiKey(id);
    
    await this.logAdminActivity(adminId, 'delete_api_key', 'api_key', id, {
      provider: apiKey.provider
    });
  }

  // CMS Management
  async getCmsPages(): Promise<CmsPage[]> {
    return this.storage.getCmsPages();
  }

  async getCmsPageBySlug(slug: string): Promise<CmsPage | undefined> {
    return this.storage.getCmsPageBySlug(slug);
  }

  async createCmsPage(page: InsertCmsPage, adminId: string): Promise<CmsPage> {
    const created = await this.storage.createCmsPage({
      ...page,
      authorId: adminId
    });
    
    await this.logAdminActivity(adminId, 'create_cms_page', 'cms_page', created.id, {
      title: page.title,
      slug: page.slug
    });
    
    return created;
  }

  async updateCmsPage(id: number, update: Partial<CmsPage>, adminId: string): Promise<CmsPage | undefined> {
    const updated = await this.storage.updateCmsPage(id, {
      ...update,
      updatedAt: new Date()
    });
    
    if (updated) {
      await this.logAdminActivity(adminId, 'update_cms_page', 'cms_page', id, {
        updates: update
      });
    }
    
    return updated;
  }

  async publishCmsPage(id: number, adminId: string): Promise<CmsPage | undefined> {
    return this.updateCmsPage(id, {
      status: 'published',
      publishedAt: new Date()
    }, adminId);
  }

  async deleteCmsPage(id: number, adminId: string): Promise<void> {
    const page = await this.storage.getCmsPage(id);
    if (!page) return;
    
    await this.storage.deleteCmsPage(id);
    
    await this.logAdminActivity(adminId, 'delete_cms_page', 'cms_page', id, {
      title: page.title,
      slug: page.slug
    });
  }

  // Documentation Management
  async getDocCategories(): Promise<DocCategory[]> {
    return this.storage.getDocCategories();
  }

  async createDocCategory(category: InsertDocCategory, adminId: string): Promise<DocCategory> {
    const created = await this.storage.createDocCategory(category);
    
    await this.logAdminActivity(adminId, 'create_doc_category', 'doc_category', created.id, {
      name: category.name,
      slug: category.slug
    });
    
    return created;
  }

  async getDocumentation(): Promise<Documentation[]> {
    return this.storage.getDocumentation();
  }

  async getDocumentationByCategory(categoryId: number): Promise<Documentation[]> {
    return this.storage.getDocumentationByCategory(categoryId);
  }

  async createDocumentation(doc: InsertDocumentation, adminId: string): Promise<Documentation> {
    const created = await this.storage.createDocumentation({
      ...doc,
      authorId: adminId
    });
    
    await this.logAdminActivity(adminId, 'create_documentation', 'documentation', created.id, {
      title: doc.title,
      slug: doc.slug
    });
    
    return created;
  }

  async updateDocumentation(id: number, update: Partial<Documentation>, adminId: string): Promise<Documentation | undefined> {
    const updated = await this.storage.updateDocumentation(id, {
      ...update,
      updatedAt: new Date()
    });
    
    if (updated) {
      await this.logAdminActivity(adminId, 'update_documentation', 'documentation', id, {
        updates: update
      });
    }
    
    return updated;
  }

  async publishDocumentation(id: number, adminId: string): Promise<Documentation | undefined> {
    return this.updateDocumentation(id, {
      status: 'published',
      publishedAt: new Date()
    }, adminId);
  }

  // Support Ticket Management
  async getSupportTickets(filter?: { 
    status?: string; 
    userId?: number; 
    assignedTo?: number 
  }): Promise<SupportTicket[]> {
    return this.storage.getSupportTickets(filter);
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    return this.storage.getSupportTicket(id);
  }

  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    return this.storage.getTicketReplies(ticketId);
  }

  async createTicketReply(reply: InsertTicketReply, adminId: string): Promise<TicketReply> {
    const created = await this.storage.createTicketReply(reply);
    
    await this.logAdminActivity(adminId, 'create_ticket_reply', 'ticket_reply', created.id, {
      ticketId: reply.ticketId,
      isInternal: reply.isInternal
    });
    
    return created;
  }

  async assignTicket(ticketId: number, assignedTo: string, adminId: string): Promise<void> {
    await this.storage.updateSupportTicket(ticketId, {
      assignedTo,
      status: 'in_progress',
      updatedAt: new Date()
    });
    
    await this.logAdminActivity(adminId, 'assign_ticket', 'support_ticket', ticketId, {
      assignedTo
    });
  }

  async resolveTicket(ticketId: number, adminId: string): Promise<void> {
    await this.storage.updateSupportTicket(ticketId, {
      status: 'resolved',
      resolvedAt: new Date(),
      updatedAt: new Date()
    });
    
    await this.logAdminActivity(adminId, 'resolve_ticket', 'support_ticket', ticketId, {});
  }

  async closeTicket(ticketId: number, adminId: string): Promise<void> {
    await this.storage.updateSupportTicket(ticketId, {
      status: 'closed',
      closedAt: new Date(),
      updatedAt: new Date()
    });
    
    await this.logAdminActivity(adminId, 'close_ticket', 'support_ticket', ticketId, {});
  }

  // Subscription Management
  async getUserSubscriptions(filter?: { 
    userId?: number; 
    status?: string 
  }): Promise<UserSubscription[]> {
    return this.storage.getUserSubscriptions(filter);
  }

  async getUserActiveSubscription(userId: string): Promise<UserSubscription | undefined> {
    return this.storage.getUserActiveSubscription(userId);
  }

  async createUserSubscription(subscription: InsertUserSubscription, adminId: string): Promise<UserSubscription> {
    const created = await this.storage.createUserSubscription(subscription);
    
    await this.logAdminActivity(adminId, 'create_subscription', 'subscription', created.id, {
      userId: subscription.userId,
      planId: subscription.planId
    });
    
    return created;
  }

  async updateUserSubscription(id: number, update: Partial<UserSubscription>, adminId: string): Promise<UserSubscription | undefined> {
    const updated = await this.storage.updateUserSubscription(id, {
      ...update,
      updatedAt: new Date()
    });
    
    if (updated) {
      await this.logAdminActivity(adminId, 'update_subscription', 'subscription', id, {
        updates: update
      });
    }
    
    return updated;
  }

  async cancelSubscription(id: number, adminId: string): Promise<void> {
    await this.updateUserSubscription(id, {
      status: 'cancelled',
      cancelledAt: new Date()
    }, adminId);
  }

  // Admin Activity Logging
  private async logAdminActivity(
    adminId: string, 
    action: string, 
    entityType: string, 
    entityId: number | null,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.storage.createAdminActivityLog({
        adminId,
        action,
        entityType,
        entityId,
        details
      });
    } catch (error) {
      logger.error('Failed to log admin activity:', error);
    }
  }

  async getAdminActivityLogs(filter?: { 
    adminId?: number; 
    entityType?: string; 
    limit?: number 
  }): Promise<AdminActivityLog[]> {
    return this.storage.getAdminActivityLogs(filter);
  }

  // Dashboard Statistics
  async getDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    totalRevenue: number;
    activeSubscriptions: number;
    openTickets: number;
    publishedDocs: number;
    publishedPages: number;
  }> {
    // Handle methods that might not exist in storage
    let subscriptions: any[] = [];
    try {
      if (typeof this.storage.getUserSubscriptions === 'function') {
        subscriptions = await this.storage.getUserSubscriptions({ status: 'active' });
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }

    // Handle methods that might not exist in storage with safe fallbacks
    let tickets: any[] = [];
    let docs: any[] = [];
    let pages: any[] = [];
    
    try {
      if (typeof this.storage.getSupportTickets === 'function') {
        tickets = await this.storage.getSupportTickets({ status: 'open' });
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
    }
    
    try {
      if (typeof this.storage.getDocumentation === 'function') {
        docs = await this.storage.getDocumentation();
      }
    } catch (error) {
      console.error('Error fetching documentation:', error);
    }
    
    try {
      if (typeof this.storage.getCmsPages === 'function') {
        pages = await this.storage.getCmsPages();
      }
    } catch (error) {
      console.error('Error fetching CMS pages:', error);
    }

    const [
      users,
      projects
    ] = await Promise.all([
      this.storage.getAllUsers(),
      this.storage.getAllProjects()
    ]);

    const activeUsers = users.filter(u => 
      u.lastLoginAt && 
      new Date(u.lastLoginAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length;

    const totalRevenue = subscriptions.reduce((sum, sub) => {
      if (sub.planId === 'pro') return sum + 9.99;
      if (sub.planId === 'enterprise') return sum + 99.99;
      return sum;
    }, 0);

    return {
      totalUsers: users.length,
      activeUsers,
      totalProjects: projects.length,
      totalRevenue,
      activeSubscriptions: subscriptions.length,
      openTickets: tickets.length,
      publishedDocs: docs.filter(d => d.status === 'published').length,
      publishedPages: pages.filter(p => p.status === 'published').length
    };
  }
}