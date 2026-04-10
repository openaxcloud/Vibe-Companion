// @ts-nocheck
import { db } from '../db';
import { 
  templates, templateCategories, templateRatings, templateTags,
  templateCollections, collectionTemplates, users
} from '@shared/schema';
import { eq, and, or, like, ilike, desc, asc, sql, inArray, gte, lte, not } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import Fuse from 'fuse.js';

const logger = createLogger('template-marketplace');

export interface TemplateSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  languages?: string[];
  frameworks?: string[];
  difficulty?: string[];
  minRating?: number;
  maxPrice?: number;
  authorId?: string;
  featured?: boolean;
  official?: boolean;
  community?: boolean;
  sortBy?: 'popularity' | 'recent' | 'trending' | 'rating' | 'downloads' | 'price';
  page?: number;
  limit?: number;
}

export interface TemplateWithDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    id?: string;
    name: string;
    verified: boolean;
    avatar?: string;
  };
  stats: {
    uses: number;
    stars: number;
    forks: number;
    downloads: number;
    rating: number;
    reviewCount: number;
  };
  technical: {
    language: string;
    framework?: string;
    difficulty: string;
    estimatedTime: number;
    version: string;
    license: string;
  };
  urls: {
    github?: string;
    demo?: string;
    thumbnail?: string;
  };
  features: string[];
  price: number;
  flags: {
    featured: boolean;
    official: boolean;
    community: boolean;
    published: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateMarketplaceService {
  private searchCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private fuseInstance: Fuse<any> | null = null;

  constructor() {
    this.initializeFuzzySearch();
  }

  private async initializeFuzzySearch() {
    try {
      // Initialize Fuse.js for fuzzy searching
      const allTemplates = await db.select().from(templates).where(eq(templates.published, true));
      
      this.fuseInstance = new Fuse(allTemplates, {
        keys: ['name', 'description', 'tags', 'category', 'language', 'framework'],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
        shouldSort: true,
      });
    } catch (error) {
      logger.error('Failed to initialize fuzzy search:', error);
    }
  }

  /**
   * Search templates with advanced filtering and fuzzy matching
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<{
    templates: TemplateWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const {
      query = '',
      category,
      tags = [],
      languages = [],
      frameworks = [],
      difficulty = [],
      minRating = 0,
      maxPrice,
      authorId,
      featured,
      official,
      community,
      sortBy = 'popularity',
      page = 1,
      limit = 20,
    } = options;

    try {
      // Check cache
      const cacheKey = JSON.stringify(options);
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Build query conditions
      const conditions = [];
      
      // Always filter published templates
      conditions.push(eq(templates.published, true));

      // Text search with fuzzy matching
      if (query) {
        // Use PostgreSQL full-text search if available
        const searchCondition = or(
          ilike(templates.name, `%${query}%`),
          ilike(templates.description, `%${query}%`),
          sql`EXISTS (SELECT 1 FROM unnest(${templates.tags}) AS tag WHERE tag ILIKE ${'%' + query + '%'})`
        );
        conditions.push(searchCondition);
      }

      // Category filter
      if (category) {
        conditions.push(eq(templates.category, category));
      }

      // Tags filter (match any)
      if (tags.length > 0) {
        const tagConditions = tags.map(tag => 
          sql`${tag} = ANY(${templates.tags})`
        );
        conditions.push(or(...tagConditions));
      }

      // Language filter
      if (languages.length > 0) {
        conditions.push(inArray(templates.language, languages));
      }

      // Framework filter
      if (frameworks.length > 0) {
        conditions.push(inArray(templates.framework, frameworks));
      }

      // Difficulty filter
      if (difficulty.length > 0) {
        conditions.push(inArray(templates.difficulty, difficulty));
      }

      // Rating filter
      if (minRating > 0) {
        conditions.push(gte(templates.rating, minRating));
      }

      // Price filter
      if (maxPrice !== undefined) {
        conditions.push(lte(templates.price, maxPrice.toString()));
      }

      // Author filter
      if (authorId) {
        conditions.push(eq(templates.authorId, authorId));
      }

      // Feature flags
      if (featured !== undefined) {
        conditions.push(eq(templates.isFeatured, featured));
      }
      if (official !== undefined) {
        conditions.push(eq(templates.isOfficial, official));
      }
      if (community !== undefined) {
        conditions.push(eq(templates.isCommunity, community));
      }

      // Build the main query
      let baseQuery = db.select({
        template: templates,
        author: users,
      })
      .from(templates)
      .leftJoin(users, eq(templates.authorId, users.id))
      .where(and(...conditions));

      // Apply sorting
      const orderBy = this.getSortOrder(sortBy);
      baseQuery = baseQuery.orderBy(...orderBy);

      // Get total count
      const countQuery = db.select({ count: sql<number>`count(*)` })
        .from(templates)
        .where(and(...conditions));
      
      const [{ count: total }] = await countQuery;

      // Apply pagination
      const offset = (page - 1) * limit;
      baseQuery = baseQuery.limit(limit).offset(offset);

      // Execute query
      const results = await baseQuery;

      // Transform results
      const templatesWithDetails = results.map(({ template, author }) => 
        this.transformToTemplateWithDetails(template, author)
      );

      // Calculate trending score for templates if sorting by trending
      if (sortBy === 'trending') {
        await this.calculateTrendingScores(templatesWithDetails);
      }

      // Update cache
      const response = {
        templates: templatesWithDetails,
        total,
        page,
        pageSize: limit,
        hasMore: offset + limit < total,
      };

      this.searchCache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      logger.error('Template search failed:', error);
      throw error;
    }
  }

  /**
   * Get template by ID or slug
   */
  async getTemplate(idOrSlug: string): Promise<TemplateWithDetails | null> {
    try {
      const template = await db.select({
        template: templates,
        author: users,
      })
      .from(templates)
      .leftJoin(users, eq(templates.authorId, users.id))
      .where(or(
        eq(templates.id, idOrSlug),
        eq(templates.slug, idOrSlug)
      ))
      .limit(1);

      if (!template.length) {
        return null;
      }

      const [{ template: tpl, author }] = template;

      // Increment view count
      await db.update(templates)
        .set({ uses: sql`${templates.uses} + 1` })
        .where(eq(templates.id, tpl.id));

      return this.transformToTemplateWithDetails(tpl, author);
    } catch (error) {
      logger.error('Failed to get template:', error);
      throw error;
    }
  }

  /**
   * Get trending templates based on recent activity
   */
  async getTrendingTemplates(limit: number = 10): Promise<TemplateWithDetails[]> {
    try {
      const trending = await db.select({
        template: templates,
        author: users,
        score: sql<number>`
          (templates.stars * 0.3 + templates.forks * 0.2 + COALESCE(templates.downloads, 0) * 0.1 + templates.uses * 0.05) * 
          CASE 
            WHEN templates.created_at > NOW() - INTERVAL '7 days' THEN 2.0
            WHEN templates.updated_at > NOW() - INTERVAL '7 days' THEN 1.5
            ELSE 1.0
          END
        `.as('trending_score')
      })
      .from(templates)
      .leftJoin(users, eq(templates.authorId, users.id))
      .where(eq(templates.published, true))
      .orderBy(desc(sql`trending_score`))
      .limit(limit);

      return trending.map(({ template, author }) => 
        this.transformToTemplateWithDetails(template, author)
      );
    } catch (error) {
      logger.error('Failed to get trending templates:', error);
      throw error;
    }
  }

  /**
   * Get template categories with counts
   */
  async getCategories(): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    color: string;
    count: number;
  }>> {
    try {
      const categories = await db.select({
        category: templateCategories,
        count: sql<number>`
          (SELECT COUNT(*) FROM ${templates} 
           WHERE ${templates.category} = ${templateCategories.slug} 
           AND ${templates.published} = true)
        `.as('count')
      })
      .from(templateCategories)
      .where(eq(templateCategories.isActive, true))
      .orderBy(asc(templateCategories.order));

      return categories.map(({ category, count }) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon,
        color: category.color,
        count,
      }));
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Get popular search tags
   */
  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    try {
      const tags = await db.select({
        tag: templateTags.tag,
        count: sql<number>`count(*)`.as('count')
      })
      .from(templateTags)
      .innerJoin(templates, eq(templateTags.templateId, templates.id))
      .where(eq(templates.published, true))
      .groupBy(templateTags.tag)
      .orderBy(desc(sql`count`))
      .limit(limit);

      return tags;
    } catch (error) {
      logger.error('Failed to get popular tags:', error);
      throw error;
    }
  }

  /**
   * Get template reviews
   */
  async getTemplateReviews(templateId: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;

      const reviews = await db.select({
        rating: templateRatings,
        user: users,
      })
      .from(templateRatings)
      .innerJoin(users, eq(templateRatings.userId, users.id))
      .where(eq(templateRatings.templateId, templateId))
      .orderBy(desc(templateRatings.helpful), desc(templateRatings.createdAt))
      .limit(limit)
      .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(templateRatings)
        .where(eq(templateRatings.templateId, templateId));

      return {
        reviews: reviews.map(({ rating, user }) => ({
          id: rating.id,
          rating: rating.rating,
          review: rating.review,
          helpful: rating.helpful,
          isVerifiedPurchase: rating.isVerifiedPurchase,
          createdAt: rating.createdAt,
          user: {
            id: user.id,
            username: user.username || 'Anonymous',
            avatar: user.profileImageUrl,
          },
        })),
        total: count,
        page,
        pageSize: limit,
        hasMore: offset + limit < count,
      };
    } catch (error) {
      logger.error('Failed to get template reviews:', error);
      throw error;
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(templateId: string, userId: string, rating: number, review?: string) {
    try {
      // Check if user has already rated
      const existing = await db.select()
        .from(templateRatings)
        .where(and(
          eq(templateRatings.templateId, templateId),
          eq(templateRatings.userId, userId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing rating
        await db.update(templateRatings)
          .set({
            rating,
            review,
            updatedAt: new Date(),
          })
          .where(eq(templateRatings.id, existing[0].id));
      } else {
        // Create new rating
        await db.insert(templateRatings).values({
          templateId,
          userId,
          rating,
          review,
        });
      }

      // Update template average rating
      await this.updateTemplateRating(templateId);

      return { success: true };
    } catch (error) {
      logger.error('Failed to rate template:', error);
      throw error;
    }
  }

  /**
   * Get similar templates
   */
  async getSimilarTemplates(templateId: string, limit: number = 6): Promise<TemplateWithDetails[]> {
    try {
      // Get the source template
      const source = await db.select()
        .from(templates)
        .where(eq(templates.id, templateId))
        .limit(1);

      if (!source.length) {
        return [];
      }

      const [sourceTemplate] = source;

      // Find similar templates based on category, tags, and language
      const similar = await db.select({
        template: templates,
        author: users,
        score: sql<number>`
          CASE WHEN ${templates.category} = ${sourceTemplate.category} THEN 3 ELSE 0 END +
          CASE WHEN ${templates.language} = ${sourceTemplate.language} THEN 2 ELSE 0 END +
          CASE WHEN ${templates.framework} = ${sourceTemplate.framework} THEN 2 ELSE 0 END +
          CASE WHEN ${templates.difficulty} = ${sourceTemplate.difficulty} THEN 1 ELSE 0 END
        `.as('score')
      })
      .from(templates)
      .leftJoin(users, eq(templates.authorId, users.id))
      .where(and(
        not(eq(templates.id, templateId)),
        eq(templates.published, true)
      ))
      .orderBy(desc(sql`score`), desc(templates.stars))
      .limit(limit);

      return similar.map(({ template, author }) => 
        this.transformToTemplateWithDetails(template, author)
      );
    } catch (error) {
      logger.error('Failed to get similar templates:', error);
      throw error;
    }
  }

  /**
   * Track template usage (fork, deploy, etc.)
   */
  async trackTemplateUsage(templateId: string, action: 'view' | 'fork' | 'deploy' | 'download') {
    try {
      const updates: any = {};

      switch (action) {
        case 'view':
          updates.uses = sql`${templates.uses} + 1`;
          break;
        case 'fork':
          updates.forks = sql`${templates.forks} + 1`;
          break;
        case 'download':
        case 'deploy':
          updates.downloads = sql`${templates.downloads} + 1`;
          break;
      }

      await db.update(templates)
        .set(updates)
        .where(eq(templates.id, templateId));

      return { success: true };
    } catch (error) {
      logger.error('Failed to track template usage:', error);
      throw error;
    }
  }

  // Helper methods

  private getSortOrder(sortBy: string) {
    switch (sortBy) {
      case 'recent':
        return [desc(templates.createdAt)];
      case 'rating':
        return [desc(templates.rating), desc(templates.reviewCount)];
      case 'downloads':
        return [desc(templates.downloads)];
      case 'price':
        return [asc(templates.price)];
      case 'trending':
        // Trending will be calculated separately
        return [desc(templates.updatedAt)];
      case 'popularity':
      default:
        return [desc(templates.stars), desc(templates.forks), desc(templates.downloads)];
    }
  }

  private transformToTemplateWithDetails(template: any, author: any): TemplateWithDetails {
    return {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description || '',
      category: template.category,
      tags: template.tags || [],
      author: {
        id: template.authorId,
        name: template.authorName,
        verified: template.authorVerified,
        avatar: author?.profileImageUrl,
      },
      stats: {
        uses: template.uses,
        stars: template.stars,
        forks: template.forks,
        downloads: template.downloads,
        rating: template.rating,
        reviewCount: template.reviewCount,
      },
      technical: {
        language: template.language,
        framework: template.framework,
        difficulty: template.difficulty,
        estimatedTime: template.estimatedTime,
        version: template.version,
        license: template.license,
      },
      urls: {
        github: template.githubUrl,
        demo: template.demoUrl,
        thumbnail: template.thumbnailUrl,
      },
      features: template.features || [],
      price: parseFloat(template.price || '0'),
      flags: {
        featured: template.isFeatured,
        official: template.isOfficial,
        community: template.isCommunity,
        published: template.published,
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private async calculateTrendingScores(templates: TemplateWithDetails[]) {
    // Calculate trending scores based on recent activity
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    templates.forEach(template => {
      const age = now - new Date(template.createdAt).getTime();
      const recency = Math.max(0, 1 - age / oneWeek);
      
      // Trending score combines multiple factors with time decay
      const trendingScore = (
        template.stats.stars * 0.3 +
        template.stats.forks * 0.2 +
        template.stats.downloads * 0.1 +
        template.stats.uses * 0.05
      ) * (1 + recency);

      (template as any).trendingScore = trendingScore;
    });

    // Sort by trending score
    templates.sort((a, b) => (b as any).trendingScore - (a as any).trendingScore);
  }

  private async updateTemplateRating(templateId: string) {
    try {
      const ratings = await db.select({
        avg: sql<number>`avg(${templateRatings.rating})`.as('avg'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(templateRatings)
      .where(eq(templateRatings.templateId, templateId));

      if (ratings.length > 0) {
        const { avg, count } = ratings[0];
        await db.update(templates)
          .set({
            rating: avg || 0,
            reviewCount: count || 0,
          })
          .where(eq(templates.id, templateId));
      }
    } catch (error) {
      logger.error('Failed to update template rating:', error);
    }
  }

  /**
   * Get top publishers with their statistics
   */
  async getTopPublishers(limit: number = 10): Promise<Array<{
    id: string;
    name: string;
    extensions: number;
    downloads: number;
    verified: boolean;
    avatar: string;
  }>> {
    try {
      const publishers = await db.select({
        id: users.id,
        name: sql<string>`COALESCE(${users.displayName}, ${users.username}, 'Publisher')`,
        avatar: sql<string>`COALESCE(LEFT(COALESCE(${users.displayName}, ${users.username}), 2), 'PB')`,
        extensions: sql<number>`COUNT(${templates.id})`,
        downloads: sql<number>`COALESCE(SUM(${templates.downloads}), 0)`,
      })
      .from(users)
      .innerJoin(templates, eq(templates.authorId, users.id))
      .where(eq(templates.published, true))
      .groupBy(users.id, users.displayName, users.username)
      .orderBy(desc(sql`SUM(${templates.downloads})`))
      .limit(limit);

      return publishers.map((p, index) => ({
        id: String(p.id),
        name: String(p.name),
        extensions: Number(p.extensions || 0),
        downloads: Number(p.downloads || 0),
        verified: index < 3,
        avatar: String(p.avatar || 'PB'),
      }));
    } catch (error) {
      logger.error('Failed to get top publishers:', error);
      return [];
    }
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
  }
}

export const templateMarketplaceService = new TemplateMarketplaceService();