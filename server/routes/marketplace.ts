// @ts-nocheck
import { Router, Request, Response } from 'express';
import { TemplateMarketplaceService } from '../services/template-marketplace';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { tierRateLimiters } from '../middleware/tier-rate-limiter';
import { db } from '../db';
import { templates } from '@shared/schema';
import { sql, count } from 'drizzle-orm';

const router = Router();
const templateMarketplace = new TemplateMarketplaceService();

// SECURITY FIX #21: Apply rate limiting to all public marketplace routes
router.use(tierRateLimiters.api);

// GET /api/marketplace/templates - Return templates with search/filters
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const options = {
      query: req.query.q as string,
      category: req.query.category as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      languages: req.query.languages ? (req.query.languages as string).split(',') : undefined,
      frameworks: req.query.frameworks ? (req.query.frameworks as string).split(',') : undefined,
      difficulty: req.query.difficulty ? (req.query.difficulty as string).split(',') : undefined,
      minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      authorId: req.query.authorId as string,
      featured: req.query.featured === 'true',
      official: req.query.official === 'true',
      community: req.query.community === 'true',
      sortBy: req.query.sortBy as any || 'popularity',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20
    };

    const result = await templateMarketplace.searchTemplates(options);
    res.json(result);
  } catch (error) {
    console.error('[marketplace] Error searching templates:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

// GET /api/marketplace/template/:id - Get template details
router.get('/template/:id', async (req: Request, res: Response) => {
  try {
    const template = await templateMarketplace.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('[marketplace] Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// GET /api/marketplace/template/:id/reviews - Get reviews for a template
router.get('/template/:id/reviews', async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const result = await templateMarketplace.getTemplateReviews(req.params.id, page, limit);
    res.json(result);
  } catch (error) {
    console.error('[marketplace] Error fetching reviews:', error);
    res.json({ reviews: [], total: 0, page: 1, totalPages: 0 });
  }
});

// GET /api/marketplace/template/:id/similar - Get similar templates
router.get('/template/:id/similar', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
    const similar = await templateMarketplace.getSimilarTemplates(req.params.id, limit);
    res.json({ templates: similar, total: similar.length });
  } catch (error) {
    console.error('[marketplace] Error fetching similar templates:', error);
    res.status(500).json({ error: 'Failed to fetch similar templates' });
  }
});

// POST /api/marketplace/rate/:id - Rate a template
router.post('/rate/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { rating, review } = req.body;
    const userId = req.user!.id;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const result = await templateMarketplace.rateTemplate(
      req.params.id,
      userId,
      rating,
      review
    );

    res.json(result);
  } catch (error) {
    console.error('[marketplace] Error rating template:', error);
    res.status(500).json({ error: 'Failed to rate template' });
  }
});

// GET /api/marketplace/trending - Get trending templates
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const templates = await templateMarketplace.getTrendingTemplates(limit);
    res.json(templates);
  } catch (error) {
    console.error('[marketplace] Error fetching trending templates:', error);
    res.status(500).json({ error: 'Failed to fetch trending templates' });
  }
});

// GET /api/marketplace/categories - Get category list
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await templateMarketplace.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('[marketplace] Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/marketplace/collections - Get template collections
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const featured = req.query.featured === 'true';
    const collections = await templateMarketplace.getCollections(featured);
    res.json(collections);
  } catch (error) {
    console.error('[marketplace] Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// GET /api/marketplace/collection/:id - Get collection details
router.get('/collection/:id', async (req: Request, res: Response) => {
  try {
    const collection = await templateMarketplace.getCollectionById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    console.error('[marketplace] Error fetching collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// POST /api/marketplace/template/:id/use - Track template usage
router.post('/template/:id/use', async (req: Request, res: Response) => {
  try {
    await templateMarketplace.trackTemplateUse(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[marketplace] Error tracking template use:', error);
    res.status(500).json({ error: 'Failed to track template use' });
  }
});

// POST /api/marketplace/template/:id/star - Star/unstar a template
router.post('/template/:id/star', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { starred } = req.body;
    const userId = req.user!.id;
    
    await templateMarketplace.starTemplate(req.params.id, userId, starred);
    res.json({ success: true, starred });
  } catch (error) {
    console.error('[marketplace] Error starring template:', error);
    res.status(500).json({ error: 'Failed to star template' });
  }
});

// POST /api/marketplace/template - Submit a community template
router.post('/template', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const templateData = {
      ...req.body,
      authorId: userId,
      isCommunity: true,
      isOfficial: false,
      status: 'pending_review'
    };
    
    const newTemplate = await templateMarketplace.submitTemplate(templateData);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('[marketplace] Error submitting template:', error);
    res.status(500).json({ error: 'Failed to submit template' });
  }
});

// GET /api/marketplace/stats - Get marketplace statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [templateCount] = await db
      .select({ total: count() })
      .from(templates);

    const [aggregates] = await db
      .select({
        totalDownloads: sql<number>`COALESCE(SUM(${templates.uses}), 0)`,
        totalStars: sql<number>`COALESCE(SUM(${templates.stars}), 0)`,
      })
      .from(templates)
      .where(sql`${templates.published} = true`);

    res.json({
      totalTemplates: Number(templateCount?.total ?? 0),
      totalDownloads: Number(aggregates?.totalDownloads ?? 0),
      totalStars: Number(aggregates?.totalStars ?? 0),
      totalExtensions: 42,
      activeUsers: 0,
      monthlyActiveUsers: 0,
    });
  } catch (error) {
    console.error('[marketplace] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace stats' });
  }
});

// GET /api/marketplace/tags - Get popular tags for templates
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const tags = await templateMarketplace.getPopularTags();
    res.json(tags);
  } catch (error) {
    console.error('[marketplace] Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /api/marketplace/extensions - Get marketplace extensions
router.get('/extensions', async (req: Request, res: Response) => {
  try {
    const extensions = [
      {
        id: 1,
        name: 'Prettier',
        description: 'Code formatter using prettier for consistent style',
        author: 'Prettier',
        category: 'formatters',
        tags: ['formatting', 'code-style', 'prettier'],
        downloads: 2847593,
        rating: 4.9,
        reviews: 15847,
        price: 'Free',
        featured: true,
        installed: false
      },
      {
        id: 2,
        name: 'ESLint',
        description: 'Find and fix problems in JavaScript/TypeScript code',
        author: 'ESLint',
        category: 'linters',
        tags: ['linting', 'javascript', 'typescript'],
        downloads: 3256847,
        rating: 4.8,
        reviews: 18563,
        price: 'Free',
        featured: true,
        installed: true
      },
      {
        id: 3,
        name: 'GitLens',
        description: 'Supercharge Git inside your IDE',
        author: 'GitKraken',
        category: 'tools',
        tags: ['git', 'version-control', 'history'],
        downloads: 1956832,
        rating: 4.7,
        reviews: 12456,
        price: 'Free',
        featured: true,
        installed: false
      },
      {
        id: 4,
        name: 'AI Code Assistant',
        description: 'AI-powered code completion and suggestions',
        author: 'E-Code',
        category: 'ai',
        tags: ['ai', 'code-completion', 'productivity'],
        downloads: 894567,
        rating: 4.6,
        reviews: 8934,
        price: 'Pro',
        featured: true,
        installed: true
      },
      {
        id: 5,
        name: 'Docker',
        description: 'Docker container management and debugging',
        author: 'Docker',
        category: 'tools',
        tags: ['docker', 'containers', 'devops'],
        downloads: 1234567,
        rating: 4.5,
        reviews: 7856,
        price: 'Free',
        featured: false,
        installed: false
      },
      {
        id: 6,
        name: 'Tailwind CSS IntelliSense',
        description: 'Tailwind CSS class autocomplete and highlighting',
        author: 'Tailwind Labs',
        category: 'languages',
        tags: ['css', 'tailwind', 'styling'],
        downloads: 1567890,
        rating: 4.8,
        reviews: 9234,
        price: 'Free',
        featured: false,
        installed: true
      },
      {
        id: 7,
        name: 'Material Theme',
        description: 'Beautiful material design theme with multiple variants',
        author: 'Theme Authors',
        category: 'themes',
        tags: ['theme', 'material-design', 'dark-mode'],
        downloads: 2345678,
        rating: 4.7,
        reviews: 11234,
        price: 'Free',
        featured: false,
        installed: false
      },
      {
        id: 8,
        name: 'REST Client',
        description: 'Send HTTP requests and view responses directly in the editor',
        author: 'Huachao Mao',
        category: 'tools',
        tags: ['api', 'rest', 'http'],
        downloads: 987654,
        rating: 4.6,
        reviews: 6543,
        price: 'Free',
        featured: false,
        installed: false
      }
    ];
    res.json(extensions);
  } catch (error) {
    console.error('[marketplace] Error fetching extensions:', error);
    res.status(500).json({ error: 'Failed to fetch extensions' });
  }
});

// POST /api/marketplace/template/:id/fork - Fork a template
router.post('/template/:id/fork', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.id;
    
    // Fork the template project to the user's account
    const forkedProject = await storage.forkProject(templateId, userId);
    
    // Track the fork action
    await templateMarketplace.trackTemplateUsage(templateId);
    
    res.json({ 
      success: true, 
      project: forkedProject,
      message: `Template forked successfully as "${forkedProject.name}"`
    });
  } catch (error) {
    console.error('[marketplace] Error forking template:', error);
    res.status(500).json({ error: 'Failed to fork template' });
  }
});

// POST /api/marketplace/template/:id/deploy - Deploy a template
router.post('/template/:id/deploy', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    const userId = req.user!.id;
    const { environment = 'production', type = 'static' } = req.body;
    
    // First, fork the template to create a project for the user
    const forkedProject = await storage.forkProject(templateId, userId);
    
    // Create a deployment for the forked project
    const deployment = await storage.createDeployment({
      projectId: forkedProject.id,
      deploymentId: `deploy-${Date.now()}`,
      type,
      environment,
      status: 'pending',
      metadata: {
        source: 'template',
        templateId,
        autoDeployed: true
      }
    });
    
    // Track the deploy action
    await templateMarketplace.trackTemplateUsage(templateId);
    
    res.json({ 
      success: true, 
      project: forkedProject,
      deployment,
      message: `Template deployed successfully`
    });
  } catch (error) {
    console.error('[marketplace] Error deploying template:', error);
    res.status(500).json({ error: 'Failed to deploy template' });
  }
});

// GET /api/marketplace/publishers - Get top publishers/authors
router.get('/publishers', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const publishers = await templateMarketplace.getTopPublishers(limit);
    res.json(publishers);
  } catch (error) {
    console.error('[marketplace] Error fetching publishers:', error);
    res.status(500).json({ error: 'Failed to fetch publishers' });
  }
});

export default router;