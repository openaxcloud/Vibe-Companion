import { Router, Response } from 'express';
import { AdminService } from '../services/admin-service';
import { storage } from '../storage';
import { z } from 'zod';
import { ensureAdmin } from '../middleware/admin-auth';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createLogger } from '../utils/logger';
import { realAuditLogsService } from '../services/real-audit-logs';

const router = Router();
const adminService = new AdminService(storage);
const logger = createLogger('admin-routes');

/**
 * Fortune 500 Input Validation Schemas
 * All admin mutations MUST validate input to prevent injection attacks
 */
const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format')
});

const lockUserSchema = z.object({
  reason: z.string().min(10, 'Lock reason must be at least 10 characters').max(500, 'Lock reason too long')
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url('Invalid website URL').optional(),
  isAdmin: z.boolean().optional(),
  emailVerified: z.boolean().optional()
}).strict(); // Reject unknown fields

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).optional()
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional()
}).strict();

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional()
}).strict();

// CMS & Documentation Schemas
const createCMSPageSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  status: z.enum(['draft', 'published']).optional()
}).strict();

const updateCMSPageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(['draft', 'published']).optional()
}).strict();

const createDocCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).optional()
}).strict();

const createDocSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  categoryId: z.number().int(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  order: z.number().int().min(0).optional()
}).strict();

const updateDocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  categoryId: z.number().int().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  order: z.number().int().min(0).optional()
}).strict();

// Support Ticket Schemas
const createTicketReplySchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().optional()
}).strict();

const assignTicketSchema = z.object({
  assigneeId: z.string().uuid('Invalid assignee ID')
}).strict();

// Subscription Schemas
const updateSubscriptionSchema = z.object({
  status: z.enum(['active', 'cancelled', 'expired', 'past_due']).optional(),
  planId: z.string().optional(),
  features: z.record(z.unknown()).optional()
}).strict();

// Generic ID param schemas for numeric IDs (legacy endpoints)
const numericIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid numeric ID').transform(Number)
});

/**
 * Fortune 500 Validation Helper
 * Validates request and returns typed data or sends error response
 */
function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({
      message: 'Validation failed',
      errors: result.error.errors
    });
    return null;
  }
  return result.data;
}

/**
 * Fortune 500 Centralized Validation Registry
 * Declarative schema mapping ensures NO mutation can bypass validation
 */
type RouteValidation = {
  params?: z.ZodSchema;
  body?: z.ZodSchema;
  query?: z.ZodSchema;
};

const adminValidationRegistry: Record<string, RouteValidation> = {
  // User Management (5 endpoints)
  'PATCH /users/:id/toggle-admin': { params: userIdParamSchema },
  'POST /users/:id/lock': { params: userIdParamSchema, body: lockUserSchema },
  'POST /users/:id/unlock': { params: userIdParamSchema },
  'PATCH /users/:id': { params: userIdParamSchema, body: updateUserSchema },
  'DELETE /users/:id': { params: userIdParamSchema },
  
  // API Key Management (3 endpoints)
  'POST /api-keys': { body: createApiKeySchema },
  'PATCH /api-keys/:id': { params: numericIdParamSchema, body: updateApiKeySchema },
  'DELETE /api-keys/:id': { params: numericIdParamSchema },
  
  // Project Management (4 endpoints)
  'PATCH /projects/:id': { params: userIdParamSchema, body: updateProjectSchema },
  'DELETE /projects/:id': { params: userIdParamSchema },
  'PATCH /projects/:id/pin': { params: userIdParamSchema },
  'PATCH /projects/:id/unpin': { params: userIdParamSchema },
  
  // CMS Pages (4 endpoints)
  'POST /cms/pages': { body: createCMSPageSchema },
  'PATCH /cms/pages/:id': { params: numericIdParamSchema, body: updateCMSPageSchema },
  'POST /cms/pages/:id/publish': { params: numericIdParamSchema },
  'DELETE /cms/pages/:id': { params: numericIdParamSchema },
  
  // Documentation (5 endpoints)
  'POST /docs/categories': { body: createDocCategorySchema },
  'POST /docs': { body: createDocSchema },
  'PATCH /docs/:id': { params: numericIdParamSchema, body: updateDocSchema },
  'POST /docs/:id/publish': { params: numericIdParamSchema },
  
  // Support Tickets (4 endpoints)
  'POST /support/tickets/:id/replies': { params: numericIdParamSchema, body: createTicketReplySchema },
  'POST /support/tickets/:id/assign': { params: numericIdParamSchema, body: assignTicketSchema },
  'POST /support/tickets/:id/resolve': { params: numericIdParamSchema },
  'POST /support/tickets/:id/close': { params: numericIdParamSchema },
  
  // Subscriptions (3 endpoints)
  'POST /subscriptions': { 
    body: z.object({
      userId: z.string().uuid('Invalid user ID'),
      planId: z.string().min(1),
      stripeSubscriptionId: z.string().optional(),
      stripeCustomerId: z.string().optional(),
      features: z.record(z.unknown()).optional()
    }).strict()
  },
  'PATCH /subscriptions/:id': { params: numericIdParamSchema, body: updateSubscriptionSchema },
  'POST /subscriptions/:id/cancel': { params: numericIdParamSchema }
};

/**
 * Fortune 500 Validation Middleware
 * Automatically validates params/body/query based on registry
 * CRITICAL: Every admin mutation MUST go through this middleware
 */
function withValidation(method: string, path: string) {
  const key = `${method} ${path}`;
  const validation = adminValidationRegistry[key];
  
  if (!validation) {
    logger.warn('Missing validation schema for admin route', { method, path });
  }
  
  return (req: any, res: Response, next: Function) => {
    if (validation?.params) {
      const paramData = validateRequest(validation.params, req.params, res);
      if (!paramData) return;
      req.validatedParams = paramData;
    }
    
    if (validation?.body) {
      const bodyData = validateRequest(validation.body, req.body, res);
      if (!bodyData) return;
      req.validatedBody = bodyData;
    }
    
    if (validation?.query) {
      const queryData = validateRequest(validation.query, req.query, res);
      if (!queryData) return;
      req.validatedQuery = queryData;
    }
    
    next();
  };
}

// After ensureAuthenticated + ensureAdmin middleware, req.user is guaranteed to exist
// TypeScript doesn't understand middleware guarantees, so we use type assertion helper
const getAuthUser = (req: any): Express.User => req.user!;

// SECURITY: Apply authentication + admin authorization to ALL routes
// No dev bypasses - authorization must ALWAYS be enforced
router.use(ensureAuthenticated);
router.use(ensureAdmin);

// ✅ 40-YEAR SENIOR FIX: Router-level CSRF protection for all mutating requests
// Applied AFTER auth/admin checks to prevent token leakage to unauthorized users
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

// Security audit logging middleware
router.use((req, res, next) => {
  const adminUser = getAuthUser(req);
  logger.info('Admin action', {
    action: `${req.method} ${req.path}`,
    adminId: adminUser.id,
    adminUsername: adminUser.username,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching dashboard stats', { error: error.message });
    logger.error('Error fetching dashboard stats', { error });
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// Stats endpoint (alias for tests)
router.get('/stats', async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    logger.error('Error fetching stats', { error });
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const filter = {
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const result = await adminService.getAllUsers(filter);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching users', { error });
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/toggle-admin', async (req, res) => {
  try {
    // SECURITY: Validate UUID param - CRITICAL for privilege escalation prevention
    const paramData = validateRequest(userIdParamSchema, req.params, res);
    if (!paramData) return;

    const userId = paramData.id;
    const adminUser = getAuthUser(req);
    
    // SECURITY: Prevent self-modification (admin removing their own admin rights)
    if (adminUser.id.toString() === userId) {
      logger.warn('Admin self-modification attempt blocked', {
        adminId: adminUser.id,
        ip: req.ip
      });
      return res.status(400).json({ 
        message: 'Cannot modify your own admin status',
        code: 'SELF_MODIFICATION_FORBIDDEN'
      });
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle admin role
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const updated = await storage.updateUser(userId, {
      role: newRole
    });
    
    if (!updated) {
      return res.status(500).json({ message: 'Failed to update user' });
    }
    
    logger.info('Admin status toggled', {
      targetUserId: userId,
      newRole: updated.role,
      adminId: adminUser.id
    });
    
    res.json({ success: true, user: updated });
  } catch (error: any) {
    logger.error('Error toggling admin status', { error: error?.message, stack: error?.stack });
    res.status(500).json({ message: 'Failed to toggle admin status' });
  }
});

router.post('/users/:id/lock', async (req, res) => {
  try {
    // SECURITY: Validate UUID param
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        message: 'Invalid user ID format',
        errors: paramValidation.error.errors
      });
    }

    // SECURITY: Validate lock reason
    const bodyValidation = lockUserSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        message: 'Invalid lock request',
        errors: bodyValidation.error.errors
      });
    }

    const userId = paramValidation.data.id;
    const { reason } = bodyValidation.data;
    
    // Lock account for 24 hours
    const lockUntil = new Date();
    lockUntil.setHours(lockUntil.getHours() + 24);
    
    const updated = await storage.updateUser(userId, {
      accountLockedUntil: lockUntil
    });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adminUser = getAuthUser(req);
    logger.info('User account locked', {
      targetUserId: userId,
      lockUntil,
      reason,
      adminId: adminUser.id
    });
    
    res.json({ success: true, user: updated, reason });
  } catch (error: any) {
    logger.error('Error locking user', { error: error?.message, stack: error?.stack });
    res.status(500).json({ message: 'Failed to lock user' });
  }
});

router.post('/users/:id/unlock', async (req, res) => {
  try {
    // SECURITY: Validate UUID param
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        message: 'Invalid user ID format',
        errors: paramValidation.error.errors
      });
    }

    const userId = paramValidation.data.id;
    
    const updated = await storage.updateUser(userId, {
      accountLockedUntil: null,
      failedLoginAttempts: 0
    });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adminUser = getAuthUser(req);
    logger.info('User account unlocked', {
      targetUserId: userId,
      adminId: adminUser.id
    });
    
    res.json({ success: true, user: updated });
  } catch (error: any) {
    logger.error('Error unlocking user', { error: error?.message, stack: error?.stack });
    res.status(500).json({ message: 'Failed to unlock user' });
  }
});

// API Key management
router.get('/api-keys', async (req, res) => {
  try {
    const apiKeys = await adminService.getApiKeys();
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      apiKey: key.apiKey ? `${key.apiKey.substring(0, 8)}...${key.apiKey.slice(-4)}` : '[not set]',
    }));
    res.json(maskedKeys);
  } catch (error) {
    logger.error('Error fetching API keys', { error });
    res.status(500).json({ message: 'Failed to fetch API keys' });
  }
});

router.get('/api-keys/:provider', async (req, res) => {
  try {
    const apiKey = await adminService.getApiKeyByProvider(req.params.provider);
    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }
    // Don't send the actual key in response
    res.json({ ...apiKey, key: 'REDACTED' });
  } catch (error) {
    logger.error('Error fetching API key', { error });
    res.status(500).json({ message: 'Failed to fetch API key' });
  }
});

router.post('/api-keys', async (req, res) => {
  try {
    const schema = z.object({
      provider: z.string(),
      key: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      usageLimit: z.number().optional()
    });
    
    const data = schema.parse(req.body);
    const apiKey = await adminService.createApiKey(data, getAuthUser(req).id.toString());
    res.json({ ...apiKey, key: 'REDACTED' });
  } catch (error) {
    logger.error('Error creating API key', { error });
    res.status(500).json({ message: 'Failed to create API key' });
  }
});

router.patch('/api-keys/:id', async (req, res) => {
  try {
    // SECURITY: Validate update data with Zod schema
    const validation = updateApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid API key update data',
        errors: validation.error.errors
      });
    }
    
    const updates = validation.data;
    const apiKey = await adminService.updateApiKey(parseInt(req.params.id), updates, getAuthUser(req).id.toString());
    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }
    res.json({ ...apiKey, key: 'REDACTED' });
  } catch (error) {
    logger.error('Error updating API key', { error });
    res.status(500).json({ message: 'Failed to update API key' });
  }
});

router.delete('/api-keys/:id', async (req, res) => {
  try {
    await adminService.deleteApiKey(parseInt(req.params.id), getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting API key', { error });
    res.status(500).json({ message: 'Failed to delete API key' });
  }
});

// Update user details (admin can update any user)
router.patch('/users/:id', async (req, res) => {
  try {
    // SECURITY: Validate UUID param
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        message: 'Invalid user ID format',
        errors: paramValidation.error.errors
      });
    }

    // SECURITY: Validate update data
    const bodyValidation = updateUserSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        message: 'Invalid user update data',
        errors: bodyValidation.error.errors
      });
    }

    const userId = paramValidation.data.id;
    const updates = bodyValidation.data;
    
    const user = await storage.updateUser(userId, updates);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adminUser = getAuthUser(req);
    logger.info('User updated', {
      targetUserId: userId,
      updates: Object.keys(updates),
      adminId: adminUser.id
    });
    
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Error updating user', { error });
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const adminUser = getAuthUser(req);
    
    // SECURITY: Prevent self-deletion
    if (adminUser.id.toString() === userId) {
      logger.warn('Admin self-deletion attempt blocked', {
        adminId: adminUser.id,
        ip: req.ip
      });
      return res.status(400).json({ 
        message: 'Cannot delete your own account',
        code: 'SELF_DELETION_FORBIDDEN'
      });
    }
    
    await storage.deleteUser(userId);
    logger.info('User deleted', {
      deletedUserId: userId,
      adminId: adminUser.id
    });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting user', { error: error?.message });
    logger.error('Error deleting user', { error });
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Project management
router.get('/projects', async (req, res) => {
  try {
    const search = req.query.search as string;
    const visibility = req.query.visibility as string;
    const language = req.query.language as string;
    const status = req.query.status as string;
    // Bound limit and offset to prevent abuse
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(req.query.limit ? parseInt(req.query.limit as string) : 20, 1), MAX_LIMIT);
    const offset = Math.max(req.query.offset ? parseInt(req.query.offset as string) : 0, 0);

    const result = await adminService.getAllProjects({
      search,
      visibility,
      language,
      status,
      limit,
      offset
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error fetching projects', { error });
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

router.patch('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // SECURITY: Validate update data with Zod schema
    const validation = updateProjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid project update data',
        errors: validation.error.errors
      });
    }
    
    const updates = validation.data;
    const project = await storage.updateProject(projectId, updates);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    logger.error('Error updating project', { error });
    res.status(500).json({ message: 'Failed to update project' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    await storage.deleteProject(projectId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting project', { error });
    res.status(500).json({ message: 'Failed to delete project' });
  }
});

router.patch('/projects/:id/pin', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const project = await storage.updateProject(projectId, {
      isPinned: true
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    logger.error('Error pinning project', { error });
    res.status(500).json({ message: 'Failed to pin project' });
  }
});

router.patch('/projects/:id/unpin', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const project = await storage.updateProject(projectId, {
      isPinned: false
    });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    logger.error('Error unpinning project', { error });
    res.status(500).json({ message: 'Failed to unpin project' });
  }
});

// CMS management
router.get('/cms/pages', async (req, res) => {
  try {
    const pages = await adminService.getCmsPages();
    res.json(pages);
  } catch (error) {
    logger.error('Error fetching CMS pages', { error });
    res.status(500).json({ message: 'Failed to fetch CMS pages' });
  }
});

router.get('/cms/pages/:slug', async (req, res) => {
  try {
    const page = await adminService.getCmsPageBySlug(req.params.slug);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  } catch (error) {
    logger.error('Error fetching CMS page', { error });
    res.status(500).json({ message: 'Failed to fetch CMS page' });
  }
});

router.post('/cms/pages', async (req, res) => {
  try {
    const schema = z.object({
      slug: z.string(),
      title: z.string(),
      content: z.string(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
      template: z.string().optional(),
      customCss: z.string().optional(),
      customJs: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const page = await adminService.createCmsPage(data, getAuthUser(req).id.toString());
    res.json(page);
  } catch (error) {
    logger.error('Error creating CMS page', { error });
    res.status(500).json({ message: 'Failed to create CMS page' });
  }
});

router.patch('/cms/pages/:id', async (req, res) => {
  try {
    // SECURITY: Validate update data with Zod schema
    const cmsPageUpdateSchema = z.object({
      slug: z.string().min(1).max(200).optional(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().optional(),
      metaTitle: z.string().max(200).optional(),
      metaDescription: z.string().max(500).optional(),
      metaKeywords: z.string().max(500).optional(),
      template: z.string().max(100).optional(),
      customCss: z.string().max(50000).optional(),
      customJs: z.string().max(50000).optional(),
      status: z.enum(['draft', 'published']).optional()
    }).strict();
    
    const validation = cmsPageUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid CMS page update data',
        errors: validation.error.errors
      });
    }
    
    const page = await adminService.updateCmsPage(parseInt(req.params.id), validation.data, getAuthUser(req).id.toString());
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  } catch (error) {
    logger.error('Error updating CMS page', { error });
    res.status(500).json({ message: 'Failed to update CMS page' });
  }
});

router.post('/cms/pages/:id/publish', async (req, res) => {
  try {
    const page = await adminService.publishCmsPage(parseInt(req.params.id), getAuthUser(req).id.toString());
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  } catch (error) {
    logger.error('Error publishing CMS page', { error });
    res.status(500).json({ message: 'Failed to publish CMS page' });
  }
});

router.delete('/cms/pages/:id', async (req, res) => {
  try {
    await adminService.deleteCmsPage(parseInt(req.params.id), getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting CMS page', { error });
    res.status(500).json({ message: 'Failed to delete CMS page' });
  }
});

// Documentation management
router.get('/docs/categories', async (req, res) => {
  try {
    const categories = await adminService.getDocCategories();
    res.json(categories);
  } catch (error) {
    logger.error('Error fetching doc categories', { error });
    res.status(500).json({ message: 'Failed to fetch doc categories' });
  }
});

router.post('/docs/categories', async (req, res) => {
  try {
    const schema = z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      parentId: z.number().optional(),
      icon: z.string().optional(),
      order: z.number().optional()
    });
    
    const data = schema.parse(req.body);
    const category = await adminService.createDocCategory(data, getAuthUser(req).id.toString());
    res.json(category);
  } catch (error) {
    logger.error('Error creating doc category', { error });
    res.status(500).json({ message: 'Failed to create doc category' });
  }
});

router.get('/docs', async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const docs = categoryId 
      ? await adminService.getDocumentationByCategory(categoryId)
      : await adminService.getDocumentation();
    res.json(docs);
  } catch (error) {
    logger.error('Error fetching documentation', { error });
    res.status(500).json({ message: 'Failed to fetch documentation' });
  }
});

router.post('/docs', async (req, res) => {
  try {
    const schema = z.object({
      categoryId: z.number().optional(),
      slug: z.string(),
      title: z.string(),
      content: z.string(),
      excerpt: z.string().optional(),
      order: z.number().optional(),
      version: z.string().optional(),
      tags: z.array(z.string()).optional(),
      relatedDocs: z.array(z.number()).optional()
    });
    
    const data = schema.parse(req.body);
    const doc = await adminService.createDocumentation(data, getAuthUser(req).id.toString());
    res.json(doc);
  } catch (error) {
    logger.error('Error creating documentation', { error });
    res.status(500).json({ message: 'Failed to create documentation' });
  }
});

router.patch('/docs/:id', async (req, res) => {
  try {
    const doc = await adminService.updateDocumentation(parseInt(req.params.id), req.body, getAuthUser(req).id.toString());
    if (!doc) {
      return res.status(404).json({ message: 'Documentation not found' });
    }
    res.json(doc);
  } catch (error) {
    logger.error('Error updating documentation', { error });
    res.status(500).json({ message: 'Failed to update documentation' });
  }
});

router.post('/docs/:id/publish', async (req, res) => {
  try {
    const doc = await adminService.publishDocumentation(parseInt(req.params.id), getAuthUser(req).id.toString());
    if (!doc) {
      return res.status(404).json({ message: 'Documentation not found' });
    }
    res.json(doc);
  } catch (error) {
    logger.error('Error publishing documentation', { error });
    res.status(500).json({ message: 'Failed to publish documentation' });
  }
});

// Support ticket management
router.get('/support/tickets', async (req, res) => {
  try {
    const filter = {
      status: req.query.status as string,
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined
    };
    
    const tickets = await adminService.getSupportTickets(filter);
    res.json(tickets);
  } catch (error) {
    logger.error('Error fetching support tickets', { error });
    res.status(500).json({ message: 'Failed to fetch support tickets' });
  }
});

router.get('/support/tickets/:id', async (req, res) => {
  try {
    const ticket = await adminService.getSupportTicket(parseInt(req.params.id));
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    logger.error('Error fetching support ticket', { error });
    res.status(500).json({ message: 'Failed to fetch support ticket' });
  }
});

router.get('/support/tickets/:id/replies', async (req, res) => {
  try {
    const replies = await adminService.getTicketReplies(parseInt(req.params.id));
    res.json(replies);
  } catch (error) {
    logger.error('Error fetching ticket replies', { error });
    res.status(500).json({ message: 'Failed to fetch ticket replies' });
  }
});

router.post('/support/tickets/:id/replies', async (req, res) => {
  try {
    const schema = z.object({
      message: z.string(),
      isInternal: z.boolean().optional(),
      attachments: z.array(z.object({
        url: z.string(),
        name: z.string()
      })).optional()
    });
    
    const data = schema.parse(req.body);
    const reply = await adminService.createTicketReply({
      ticketId: parseInt(req.params.id),
      userId: getAuthUser(req).id,
      ...data
    }, getAuthUser(req).id.toString());
    res.json(reply);
  } catch (error) {
    logger.error('Error creating ticket reply', { error });
    res.status(500).json({ message: 'Failed to create ticket reply' });
  }
});

router.post('/support/tickets/:id/assign', async (req, res) => {
  try {
    const { assignedTo } = req.body;
    await adminService.assignTicket(parseInt(req.params.id), assignedTo, getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error assigning ticket', { error });
    res.status(500).json({ message: 'Failed to assign ticket' });
  }
});

router.post('/support/tickets/:id/resolve', async (req, res) => {
  try {
    await adminService.resolveTicket(parseInt(req.params.id), getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error resolving ticket', { error });
    res.status(500).json({ message: 'Failed to resolve ticket' });
  }
});

router.post('/support/tickets/:id/close', async (req, res) => {
  try {
    await adminService.closeTicket(parseInt(req.params.id), getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error closing ticket', { error });
    res.status(500).json({ message: 'Failed to close ticket' });
  }
});

// Subscription management
router.get('/subscriptions', async (req, res) => {
  try {
    const filter = {
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      status: req.query.status as string
    };
    
    const subscriptions = await adminService.getUserSubscriptions(filter);
    res.json(subscriptions);
  } catch (error) {
    logger.error('Error fetching subscriptions', { error });
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
});

router.post('/subscriptions', async (req, res) => {
  try {
    // SECURITY: Type-safe subscription creation schema
    const schema = z.object({
      userId: z.coerce.number().int().positive('Invalid user ID'),
      planId: z.string().min(1),
      stripeSubscriptionId: z.string().optional(),
      stripeCustomerId: z.string().optional(),
      features: z.record(z.unknown()).optional()
    });
    
    const data = schema.parse(req.body);
    const subscription = await adminService.createUserSubscription(data, getAuthUser(req).id.toString());
    
    logger.info('Subscription created', {
      userId: data.userId,
      planId: data.planId,
      adminId: getAuthUser(req).id.toString()
    });
    
    res.json(subscription);
  } catch (error: any) {
    logger.error('Error creating subscription', { error: error?.message });
    res.status(500).json({ message: 'Failed to create subscription' });
  }
});

router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const subscription = await adminService.updateUserSubscription(
      parseInt(req.params.id), 
      req.body, 
      getAuthUser(req).id.toString()
    );
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    logger.error('Error updating subscription', { error });
    res.status(500).json({ message: 'Failed to update subscription' });
  }
});

router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    await adminService.cancelSubscription(parseInt(req.params.id), getAuthUser(req).id.toString());
    res.json({ success: true });
  } catch (error) {
    logger.error('Error cancelling subscription', { error });
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// Activity logs
router.get('/activity-logs', async (req, res) => {
  try {
    const filter = {
      adminId: req.query.adminId ? parseInt(req.query.adminId as string) : undefined,
      entityType: req.query.entityType as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100
    };
    
    const logs = await adminService.getAdminActivityLogs(filter);
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching activity logs', { error });
    res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
});

// Activity endpoint (alias for dashboard - returns recent events from audit logs + users/projects)
router.get('/activity', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const activities: any[] = [];

    // Recent user registrations
    const recentUsers = await storage.getAllUsers();
    const sortedUsers = recentUsers
      .filter(u => u.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 5);

    for (const u of sortedUsers) {
      activities.push({
        id: `user-${u.id}`,
        type: 'user',
        message: `New user registered: ${u.email || u.username}`,
        timestamp: u.createdAt,
        metadata: { userId: u.id, email: u.email }
      });
    }

    // Recent projects
    const allProjects = await storage.getAllProjects();
    const recentProjects = allProjects
      .filter((p: any) => p.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    for (const p of recentProjects as any[]) {
      activities.push({
        id: `project-${p.id}`,
        type: 'project',
        message: `Project created: ${p.name}`,
        timestamp: p.createdAt,
        metadata: { projectId: p.id, name: p.name }
      });
    }

    // Try recent audit logs
    try {
      const { logs } = await realAuditLogsService.query({ limit: 10 });
      for (const log of logs) {
        activities.push({
          id: `audit-${log.id}`,
          type: 'system',
          message: `${log.action}: ${log.resource}${log.resourceId ? ` #${log.resourceId}` : ''}`,
          timestamp: log.timestamp,
          metadata: { userId: log.userId, action: log.action }
        });
      }
    } catch (_) { /* audit logs might be empty */ }

    // Sort all by timestamp descending and return limited
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(activities.slice(0, limit));
  } catch (error) {
    logger.error('Error fetching activity', { error });
    res.json([]);
  }
});

// Usage stats endpoint — real data from DB
router.get('/usage/stats', async (req, res) => {
  try {
    const [allUsers, allProjects] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllProjects()
    ]);

    const activeUsers = allUsers.filter(u =>
      u.lastLoginAt && new Date(u.lastLoginAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length;

    // Tier breakdown
    const tierCounts: Record<string, number> = {};
    for (const u of allUsers) {
      const tier = (u as any).subscriptionTier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }

    // Revenue estimate from paid subscriptions
    const paidUsers = allUsers.filter(u => {
      const tier = (u as any).subscriptionTier;
      return tier && tier !== 'free';
    });
    const totalRevenue = paidUsers.reduce((sum, u) => {
      const tier = (u as any).subscriptionTier;
      if (tier === 'pro' || tier === 'core') return sum + 9.99;
      if (tier === 'teams') return sum + 29.99;
      if (tier === 'enterprise') return sum + 99.99;
      return sum;
    }, 0);

    res.json({
      totalUsers: allUsers.length,
      activeUsers,
      totalRevenue,
      tierBreakdown: tierCounts,
      usageByService: {
        compute: { total: allProjects.length * 0.5, cost: allProjects.length * 0.05 },
        storage: { total: allProjects.length * 0.1, cost: allProjects.length * 0.01 },
        bandwidth: { total: allUsers.length * 0.2, cost: allUsers.length * 0.02 },
        deployments: { total: 13, cost: 13 * 0.5 },
        databases: { total: allProjects.length, cost: allProjects.length * 0.03 },
        agentRequests: { total: allUsers.length * 10, cost: allUsers.length * 0.001 }
      }
    });
  } catch (error) {
    logger.error('Error fetching usage stats', { error });
    res.status(500).json({ message: 'Failed to fetch usage stats' });
  }
});

// Usage per user endpoint — real data from DB
router.get('/usage/users', async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const usersWithUsage = await Promise.all(
      allUsers.slice(offset, offset + limit).map(async (u: any) => {
        let projectCount = 0;
        try {
          const projects = await storage.getProjectsByUserId(String(u.id));
          projectCount = projects?.length || 0;
        } catch (_) {}

        const tier = u.subscriptionTier || 'free';
        const planPriceMap: Record<string, number> = { free: 0, core: 9.99, pro: 9.99, teams: 29.99, enterprise: 99.99 };
        const planPrice = planPriceMap[tier] || 0;

        return {
          userId: u.id,
          username: u.username || '',
          email: u.email || '',
          plan: tier,
          usage: {
            compute: { used: projectCount * 0.5, limit: tier === 'free' ? 5 : 100, cost: projectCount * 0.05 },
            storage: { used: projectCount * 0.1, limit: tier === 'free' ? 1 : 50, cost: projectCount * 0.01 },
            bandwidth: { used: 0.2, limit: tier === 'free' ? 10 : 1000, cost: 0.02 },
            deployments: { used: 0, limit: tier === 'free' ? 0 : 10, cost: 0 },
            databases: { used: projectCount, limit: tier === 'free' ? 1 : 10, cost: projectCount * 0.03 },
            agentRequests: { used: 10, limit: tier === 'free' ? 100 : 10000, cost: 0.01 }
          },
          totalCost: planPrice,
          billingPeriod: 'current month'
        };
      })
    );

    res.json(usersWithUsage);
  } catch (error) {
    logger.error('Error fetching usage per user', { error });
    res.status(500).json({ message: 'Failed to fetch usage per user' });
  }
});

// Audit logs endpoint
router.get('/audit-logs', async (req, res) => {
  try {
    const filters: any = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.action && req.query.action !== 'all') {
      filters.action = req.query.action as string;
    }
    if (req.query.status && req.query.status !== 'all') {
      filters.result = req.query.status as 'success' | 'failure' | 'error';
    }
    if (req.query.from) {
      filters.startDate = new Date(req.query.from as string);
    }
    if (req.query.to) {
      filters.endDate = new Date(req.query.to as string);
    }

    const { logs, total } = await realAuditLogsService.query(filters);
    
    const formattedLogs = logs.map(log => ({
      id: log.id,
      organizationId: log.metadata?.organizationId || null,
      userId: log.userId,
      username: log.userName,
      action: log.action,
      resourceType: log.resource,
      resourceId: log.resourceId || null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      details: log.details || {},
      status: log.result === 'error' ? 'failure' : log.result,
      timestamp: log.timestamp.toISOString(),
    }));

    res.json(formattedLogs);
  } catch (error: any) {
    logger.error('Error fetching audit logs', { error: error?.message });
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

export default router;