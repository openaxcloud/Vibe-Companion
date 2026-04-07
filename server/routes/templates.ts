// @ts-nocheck
/**
 * Templates Marketplace API Routes
 * CRUD operations for templates, categories, ratings, and collections
 * 
 * ✅ 40-YEAR SENIOR SECURITY MODEL:
 * - GET routes: PUBLIC (marketplace browsing)
 * - POST/PATCH/DELETE: Auth required + CSRF protection
 */

import { Router } from 'express';
import { db } from '../db';
import { ensureAuthenticated as requireAuth } from '../middleware/auth';
import {
  templates,
  templateCategories,
  templateRatings,
  templateTags,
  templateCollections,
  collectionTemplates,
  templateForks,
  projects,
  insertTemplateSchema,
  insertTemplateCategorySchema,
  insertTemplateRatingSchema,
  insertTemplateTagSchema,
  insertTemplateCollectionSchema,
  insertCollectionTemplateSchema,
  insertTemplateForkSchema,
  type Template,
  type TemplateCategory,
  type TemplateRating,
  type TemplateTag,
  type TemplateFork
} from '@shared/schema';
import { eq, desc, sql, and, or, ilike, gte, lte, asc } from 'drizzle-orm';
import { z } from 'zod';
import { csrfProtection } from '../middleware/csrf';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('templates-routes');

/**
 * CSRF protection for mutating operations
 * Applied selectively to POST/PUT/PATCH/DELETE routes
 */
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

/**
 * GET /api/templates
 * List all templates with filters and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      search,
      featured,
      official,
      minRating,
      maxRating,
      difficulty,
      language,
      limit = '20',
      offset = '0',
      sortBy = 'downloads', // downloads, rating, recent, popular, forks
      sortOrder = 'desc' // asc, desc
    } = req.query;

    let query = db.select().from(templates);

    // Apply filters
    const conditions = [];
    
    if (category) {
      conditions.push(eq(templates.category, category as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(templates.name, `%${search}%`),
          ilike(templates.description, `%${search}%`)
        )!
      );
    }
    
    if (featured === 'true') {
      conditions.push(eq(templates.isFeatured, true));
    }
    
    if (official === 'true') {
      conditions.push(eq(templates.isOfficial, true));
    }

    // Rating range filter
    if (minRating) {
      const min = parseFloat(minRating as string);
      if (!isNaN(min) && min >= 0 && min <= 5) {
        conditions.push(gte(templates.rating, min));
      }
    }
    
    if (maxRating) {
      const max = parseFloat(maxRating as string);
      if (!isNaN(max) && max >= 0 && max <= 5) {
        conditions.push(lte(templates.rating, max));
      }
    }

    // Difficulty filter
    if (difficulty) {
      conditions.push(eq(templates.difficulty, difficulty as string));
    }

    // Language filter
    if (language) {
      conditions.push(eq(templates.language, language as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)!);
    }

    // Sort
    const orderFn = sortOrder === 'asc' ? asc : desc;
    switch (sortBy) {
      case 'rating':
        query = query.orderBy(orderFn(templates.rating));
        break;
      case 'recent':
        query = query.orderBy(orderFn(templates.createdAt));
        break;
      case 'popular':
        query = query.orderBy(orderFn(templates.uses));
        break;
      case 'forks':
        query = query.orderBy(orderFn(templates.forks));
        break;
      case 'downloads':
      default:
        query = query.orderBy(orderFn(templates.downloads));
    }

    // Pagination with bounds
    const MAX_LIMIT = 100;
    const limitNum = Math.min(Math.max(parseInt(limit as string) || 20, 1), MAX_LIMIT);
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);
    
    const results = await query.limit(limitNum).offset(offsetNum);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(conditions.length > 0 ? and(...conditions)! : undefined);

    res.json({
      templates: results,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count)
      }
    });
  } catch (error) {
    logger.error('Error fetching templates', { error });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/templates/featured
 * Get featured templates with customizable limit
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit = '10', category } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    const conditions = [eq(templates.isFeatured, true)];
    
    if (category) {
      conditions.push(eq(templates.category, category as string));
    }

    const featuredTemplates = await db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(desc(templates.rating), desc(templates.downloads))
      .limit(limitNum);

    res.json({
      templates: featuredTemplates,
      total: featuredTemplates.length
    });
  } catch (error) {
    logger.error('Error fetching featured templates', { error });
    res.status(500).json({ error: 'Failed to fetch featured templates' });
  }
});

/**
 * GET /api/templates/:id
 * Get single template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get tags
    const tags = await db
      .select()
      .from(templateTags)
      .where(eq(templateTags.templateId, parseInt(id, 10)));

    // Get ratings
    const [ratingStats] = await db
      .select({
        avgRating: sql<number>`avg(${templateRatings.rating})`,
        totalRatings: sql<number>`count(*)`,
      })
      .from(templateRatings)
      .where(eq(templateRatings.templateId, parseInt(id, 10)));

    res.json({
      ...template,
      tags: tags.map((t: TemplateTag) => t.tag),
      ratingStats: {
        average: ratingStats?.avgRating ? Number(ratingStats.avgRating).toFixed(1) : '0',
        total: Number(ratingStats?.totalRatings || 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching template', { error });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/templates
 * Create new template (authenticated users only)
 */
router.post('/', async (req, res) => {
  try {
    // ✅ SECURITY: Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = insertTemplateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validation.error.errors 
      });
    }

    // ✅ SECURITY: Safe access to req.user properties
    const userId = typeof req.user === 'object' && 'id' in req.user ? req.user.id : null;
    const userRole = typeof req.user === 'object' && 'role' in req.user ? req.user.role : 'user';
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    const templateData = {
      ...validation.data,
      authorId: userId,
      isCommunity: userRole !== 'admin',
      isOfficial: false
    };

    const [newTemplate] = await db
      .insert(templates)
      .values(templateData)
      .returning();

    res.status(201).json(newTemplate);
  } catch (error) {
    logger.error('Error creating template', { error });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * PATCH /api/templates/:id
 * Update existing template (owner or admin only)
 */
router.patch('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check ownership
    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this template' });
    }

    // SECURITY: Filter allowed update fields
    const allowedFields = ['title', 'description', 'category', 'difficulty', 'language', 
                           'tags', 'thumbnail', 'previewUrl', 'isPublished', 'isFeatured'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, parseInt(id, 10)))
      .returning();

    res.json(updated);
  } catch (error) {
    logger.error('Error updating template', { error });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete template (owner or admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check ownership
    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existing.authorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }

    await db.delete(templates).where(eq(templates.id, parseInt(id, 10)));

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Error deleting template', { error });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * GET /api/templates/categories
 * List all template categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await db
      .select()
      .from(templateCategories)
      .orderBy(desc(templateCategories.templateCount));

    res.json(categories);
  } catch (error) {
    logger.error('Error fetching categories', { error });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/templates/:id/rate
 * Rate a template
 */
router.post('/:id/rate', async (req, res) => {
  try {
    // ✅ SECURITY: Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // ✅ SECURITY: Safe access to req.user.id
    const userId = typeof req.user === 'object' && 'id' in req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    // Check if template exists
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Upsert rating
    const [existingRating] = await db
      .select()
      .from(templateRatings)
      .where(
        and(
          eq(templateRatings.templateId, parseInt(id, 10)),
          eq(templateRatings.userId, userId)
        )
      )
      .limit(1);

    let result;
    
    if (existingRating) {
      [result] = await db
        .update(templateRatings)
        .set({ rating, review, updatedAt: new Date() })
        .where(eq(templateRatings.id, existingRating.id))
        .returning();
    } else {
      [result] = await db
        .insert(templateRatings)
        .values({
          templateId: parseInt(id, 10),
          userId,
          rating,
          review
        })
        .returning();
    }

    // Update template average rating and review count
    const [ratingStats] = await db
      .select({ 
        avg: sql<number>`avg(${templateRatings.rating})`,
        count: sql<number>`count(*)`
      })
      .from(templateRatings)
      .where(eq(templateRatings.templateId, parseInt(id, 10)));

    await db
      .update(templates)
      .set({ 
        rating: Number(ratingStats.avg).toFixed(1),
        reviewCount: Number(ratingStats.count)
      })
      .where(eq(templates.id, parseInt(id, 10)));

    res.json({
      ...result,
      templateRating: Number(ratingStats.avg).toFixed(1),
      templateReviewCount: Number(ratingStats.count)
    });
  } catch (error) {
    logger.error('Error rating template', { error });
    res.status(500).json({ error: 'Failed to rate template' });
  }
});

/**
 * POST /api/templates/:id/use
 * Increment usage count when template is used
 * Requires authentication to prevent abuse
 */
router.post('/:id/use', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .update(templates)
      .set({ 
        uses: sql`${templates.uses} + 1`,
        downloads: sql`${templates.downloads} + 1`
      })
      .where(eq(templates.id, parseInt(id, 10)));

    res.json({ success: true });
  } catch (error) {
    logger.error('Error incrementing usage', { error });
    res.status(500).json({ error: 'Failed to update usage count' });
  }
});

/**
 * GET /api/templates/:id/preview
 * Get live preview URL for a template
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;

    const [template] = await db
      .select({
        id: templates.id,
        name: templates.name,
        livePreviewUrl: templates.livePreviewUrl,
        demoUrl: templates.demoUrl,
        thumbnailUrl: templates.thumbnailUrl
      })
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      id: template.id,
      name: template.name,
      previewUrl: template.livePreviewUrl || template.demoUrl,
      thumbnailUrl: template.thumbnailUrl,
      hasLivePreview: !!template.livePreviewUrl
    });
  } catch (error) {
    logger.error('Error fetching template preview', { error });
    res.status(500).json({ error: 'Failed to fetch template preview' });
  }
});

/**
 * POST /api/templates/:id/fork
 * Fork a template to create a new project
 */
router.post('/:id/fork', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { projectName } = req.body;

    const userId = typeof req.user === 'object' && 'id' in req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    // Check if template exists
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Normalize language to match DB enum (lowercase, fallback to javascript)
    const validLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'ruby', 'php', 'html', 'css', 'nodejs'];
    const rawLang = (template.language || 'javascript').toLowerCase();
    const normalizedLang = validLanguages.includes(rawLang) ? rawLang : 'javascript';

    // Create a new project from the template
    const [newProject] = await db
      .insert(projects)
      .values({
        name: projectName || `${template.name} (Fork)`,
        description: template.description || `Forked from ${template.name}`,
        ownerId: userId,
        tenantId: userId,
        visibility: 'private',
        language: normalizedLang as any
      })
      .returning();

    // Record the fork
    const templateIdInt = parseInt(id, 10);
    const [fork] = await db
      .insert(templateForks)
      .values({
        templateId: templateIdInt,
        userId,
        forkedProjectId: newProject.id
      })
      .returning();

    // Increment fork count on template
    await db
      .update(templates)
      .set({ 
        forks: sql`${templates.forks} + 1`
      })
      .where(eq(templates.id, parseInt(id, 10)));

    res.status(201).json({
      success: true,
      fork,
      project: newProject,
      message: `Successfully forked template "${template.name}"`
    });
  } catch (error) {
    logger.error('Error forking template', { error });
    res.status(500).json({ error: 'Failed to fork template' });
  }
});

/**
 * GET /api/templates/:id/forks
 * Get all forks of a template
 */
router.get('/:id/forks', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Check if template exists
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const templateIdInt = parseInt(id, 10);
    const forks = await db
      .select()
      .from(templateForks)
      .where(eq(templateForks.templateId, templateIdInt))
      .orderBy(desc(templateForks.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(templateForks)
      .where(eq(templateForks.templateId, templateIdInt));

    res.json({
      forks,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count)
      }
    });
  } catch (error) {
    logger.error('Error fetching template forks', { error });
    res.status(500).json({ error: 'Failed to fetch template forks' });
  }
});

/**
 * GET /api/templates/:id/ratings
 * Get all ratings for a template
 */
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0', sortBy = 'recent' } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Check if template exists
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, parseInt(id, 10)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let query = db
      .select()
      .from(templateRatings)
      .where(eq(templateRatings.templateId, parseInt(id, 10)));

    // Sort ratings
    switch (sortBy) {
      case 'helpful':
        query = query.orderBy(desc(templateRatings.helpful));
        break;
      case 'highest':
        query = query.orderBy(desc(templateRatings.rating));
        break;
      case 'lowest':
        query = query.orderBy(asc(templateRatings.rating));
        break;
      case 'recent':
      default:
        query = query.orderBy(desc(templateRatings.createdAt));
    }

    const ratings = await query.limit(limitNum).offset(offsetNum);

    // Get rating distribution
    const [distribution] = await db
      .select({
        avgRating: sql<number>`avg(${templateRatings.rating})`,
        totalRatings: sql<number>`count(*)`,
        five: sql<number>`count(*) filter (where ${templateRatings.rating} = 5)`,
        four: sql<number>`count(*) filter (where ${templateRatings.rating} = 4)`,
        three: sql<number>`count(*) filter (where ${templateRatings.rating} = 3)`,
        two: sql<number>`count(*) filter (where ${templateRatings.rating} = 2)`,
        one: sql<number>`count(*) filter (where ${templateRatings.rating} = 1)`
      })
      .from(templateRatings)
      .where(eq(templateRatings.templateId, parseInt(id, 10)));

    res.json({
      ratings,
      stats: {
        average: distribution?.avgRating ? Number(distribution.avgRating).toFixed(1) : '0',
        total: Number(distribution?.totalRatings || 0),
        distribution: {
          5: Number(distribution?.five || 0),
          4: Number(distribution?.four || 0),
          3: Number(distribution?.three || 0),
          2: Number(distribution?.two || 0),
          1: Number(distribution?.one || 0)
        }
      },
      pagination: {
        total: Number(distribution?.totalRatings || 0),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(distribution?.totalRatings || 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching template ratings', { error });
    res.status(500).json({ error: 'Failed to fetch template ratings' });
  }
});

/**
 * GET /api/templates/collections
 * List template collections
 */
router.get('/collections', async (req, res) => {
  try {
    const collections = await db
      .select()
      .from(templateCollections)
      .orderBy(desc(templateCollections.isFeatured), desc(templateCollections.templateCount));

    res.json(collections);
  } catch (error) {
    logger.error('Error fetching collections', { error });
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

/**
 * GET /api/templates/collections/:id
 * Get templates in a collection
 */
router.get('/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [collection] = await db
      .select()
      .from(templateCollections)
      .where(eq(templateCollections.id, id))
      .limit(1);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collectionTemplatesData = await db
      .select({
        template: templates,
        order: collectionTemplates.order
      })
      .from(collectionTemplates)
      .innerJoin(templates, eq(collectionTemplates.templateId, templates.id))
      .where(eq(collectionTemplates.collectionId, id))
      .orderBy(collectionTemplates.order);

    res.json({
      ...collection,
      templates: collectionTemplatesData.map((ct: any) => ct.template)
    });
  } catch (error) {
    logger.error('Error fetching collection templates', { error });
    res.status(500).json({ error: 'Failed to fetch collection templates' });
  }
});

/**
 * GET /api/templates/suggestions
 * Get search suggestions based on partial query
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = '5' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 5, 10);

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get template names that match the query
    const matchingTemplates = await db
      .select({ name: templates.name })
      .from(templates)
      .where(ilike(templates.name, `%${q}%`))
      .orderBy(desc(templates.downloads))
      .limit(limitNum);

    // Get unique category names that match
    const matchingCategories = await db
      .select({ name: templateCategories.name })
      .from(templateCategories)
      .where(ilike(templateCategories.name, `%${q}%`))
      .limit(3);

    const suggestions = [
      ...matchingTemplates.map(t => t.name),
      ...matchingCategories.map(c => `${c.name} templates`)
    ].slice(0, limitNum);

    res.json({ suggestions });
  } catch (error) {
    logger.error('Error fetching template suggestions', { error });
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

export default router;
