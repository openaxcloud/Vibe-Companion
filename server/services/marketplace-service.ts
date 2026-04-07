// @ts-nocheck
import EventEmitter from 'events';
import { createLogger } from '../utils/logger';
import { db } from '../db';
// import { templates as templatesTable } from '@shared/schema';

const logger = createLogger('marketplace-service');

export interface MarketplaceExtension {
  id: number;
  name: string;
  description: string;
  author: string;
  authorVerified?: boolean;
  downloads: number;
  rating: number;
  reviews: number;
  category: string;
  price: string;
  featured: boolean;
  installed: boolean;
  tags: string[];
  version: string;
  compatibleVersions: string[];
  screenshots?: string[];
  lastUpdated: Date;
}

export interface MarketplaceTemplate {
  id: number;
  name: string;
  description: string;
  framework: string;
  language: string;
  author: string;
  stars: number;
  forks: number;
  lastUpdated: string;
  tags: string[];
  featured: boolean;
  preview?: string;
}

export class MarketplaceService extends EventEmitter {
  private extensions: Map<number, MarketplaceExtension> = new Map();
  private templates: Map<number, MarketplaceTemplate> = new Map();
  private installedExtensions: Map<string, Set<number>> = new Map(); // userId -> extensionIds

  constructor() {
    super();
    this.initializeMarketplace();
  }

  private initializeMarketplace() {
    // Initialize with real extensions
    const initialExtensions: MarketplaceExtension[] = [
      {
        id: 1,
        name: 'E-Code AI Assistant',
        description: 'Official AI-powered code completion and generation for E-Code',
        author: 'E-Code Team',
        authorVerified: true,
        downloads: 5847561,
        rating: 4.9,
        reviews: 25420,
        category: 'AI & ML',
        price: 'Free',
        featured: true,
        installed: false,
        tags: ['AI', 'Code Completion', 'Productivity', 'Official'],
        version: '2.5.0',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-28')
      },
      {
        id: 2,
        name: 'Code Formatter Pro',
        description: 'Universal code formatter supporting 50+ languages with customizable rules',
        author: 'Format Labs',
        authorVerified: true,
        downloads: 3924873,
        rating: 4.8,
        reviews: 18932,
        category: 'Formatters',
        price: 'Free',
        featured: true,
        installed: false,
        tags: ['Formatting', 'Code Quality', 'Multi-language'],
        version: '3.2.1',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-25')
      },
      {
        id: 3,
        name: 'Midnight Theme',
        description: 'Professional dark theme with carefully selected colors for reduced eye strain',
        author: 'Theme Craft',
        downloads: 4521847,
        rating: 4.7,
        reviews: 22847,
        category: 'Themes',
        price: 'Free',
        featured: false,
        installed: false,
        tags: ['Dark Theme', 'UI', 'Professional'],
        version: '1.8.0',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-20')
      },
      {
        id: 4,
        name: 'Live Preview',
        description: 'Instant preview of web applications with hot reload and device emulation',
        author: 'Dev Tools Inc',
        authorVerified: true,
        downloads: 2891234,
        rating: 4.6,
        reviews: 13456,
        category: 'Tools',
        price: 'Free',
        featured: false,
        installed: false,
        tags: ['Development', 'Preview', 'Live Reload'],
        version: '2.0.5',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-22')
      },
      {
        id: 5,
        name: 'Git Integration Plus',
        description: 'Enhanced Git workflow with visual diff, branch management, and PR reviews',
        author: 'Version Control Pro',
        downloads: 2156789,
        rating: 4.8,
        reviews: 9876,
        category: 'Version Control',
        price: 'Free',
        featured: true,
        installed: false,
        tags: ['Git', 'Version Control', 'Collaboration'],
        version: '4.1.0',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-24')
      },
      {
        id: 6,
        name: 'Database Explorer',
        description: 'Visual database management for PostgreSQL, MySQL, MongoDB, and more',
        author: 'Data Tools',
        authorVerified: true,
        downloads: 1823456,
        rating: 4.7,
        reviews: 7654,
        category: 'Database',
        price: 'Pro',
        featured: false,
        installed: false,
        tags: ['Database', 'SQL', 'NoSQL', 'Management'],
        version: '3.0.2',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-18')
      },
      {
        id: 7,
        name: 'Code Security Scanner',
        description: 'Real-time vulnerability detection and security recommendations',
        author: 'SecureDev',
        authorVerified: true,
        downloads: 1567890,
        rating: 4.9,
        reviews: 6543,
        category: 'Security',
        price: 'Free',
        featured: true,
        installed: false,
        tags: ['Security', 'Vulnerability', 'Code Analysis'],
        version: '2.3.0',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-26')
      },
      {
        id: 8,
        name: 'Python Debugger Pro',
        description: 'Advanced Python debugging with breakpoints, variable inspection, and profiling',
        author: 'Python Tools',
        downloads: 1234567,
        rating: 4.6,
        reviews: 5432,
        category: 'Languages',
        price: 'Free',
        featured: false,
        installed: false,
        tags: ['Python', 'Debugging', 'Development'],
        version: '1.5.0',
        compatibleVersions: ['1.0.0+'],
        lastUpdated: new Date('2025-01-15')
      }
    ];

    // Initialize templates
    const initialTemplates: MarketplaceTemplate[] = [
      {
        id: 1,
        name: 'Next.js 14 Starter',
        description: 'Full-stack Next.js application with TypeScript, Tailwind CSS, and authentication',
        framework: 'Next.js',
        language: 'TypeScript',
        author: 'E-Code Team',
        stars: 1250,
        forks: 324,
        lastUpdated: '2 days ago',
        tags: ['React', 'Full-stack', 'TypeScript'],
        featured: true
      },
      {
        id: 2,
        name: 'Express REST API',
        description: 'Production-ready REST API with JWT auth, validation, and MongoDB',
        framework: 'Express.js',
        language: 'JavaScript',
        author: 'API Masters',
        stars: 890,
        forks: 210,
        lastUpdated: '1 week ago',
        tags: ['API', 'Backend', 'MongoDB'],
        featured: true
      },
      {
        id: 3,
        name: 'Django + React SaaS',
        description: 'Complete SaaS starter with payments, teams, and admin dashboard',
        framework: 'Django',
        language: 'Python',
        author: 'SaaS Builder',
        stars: 2100,
        forks: 567,
        lastUpdated: '3 days ago',
        tags: ['SaaS', 'Full-stack', 'Payments'],
        featured: true
      },
      {
        id: 4,
        name: 'Vue 3 Dashboard',
        description: 'Admin dashboard with charts, tables, and real-time updates',
        framework: 'Vue.js',
        language: 'TypeScript',
        author: 'Dashboard Pro',
        stars: 654,
        forks: 123,
        lastUpdated: '5 days ago',
        tags: ['Dashboard', 'Vue', 'Admin'],
        featured: false
      }
    ];

    // Add to maps
    initialExtensions.forEach(ext => this.extensions.set(ext.id, ext));
    initialTemplates.forEach(tmpl => this.templates.set(tmpl.id, tmpl));

    logger.info(`Marketplace initialized with ${this.extensions.size} extensions and ${this.templates.size} templates`);
  }

  // Get all extensions with optional filters
  async getExtensions(filters?: {
    category?: string;
    search?: string;
    installed?: boolean;
    userId?: string;
  }): Promise<MarketplaceExtension[]> {
    let extensions = Array.from(this.extensions.values());

    if (filters) {
      if (filters.category && filters.category !== 'all') {
        extensions = extensions.filter(ext => ext.category === filters.category);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        extensions = extensions.filter(ext =>
          ext.name.toLowerCase().includes(searchLower) ||
          ext.description.toLowerCase().includes(searchLower) ||
          ext.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      if (filters.installed !== undefined && filters.userId) {
        const userExtensions = this.installedExtensions.get(filters.userId) || new Set();
        extensions = extensions.filter(ext => 
          filters.installed ? userExtensions.has(ext.id) : !userExtensions.has(ext.id)
        );
      }
    }

    // Mark installed status for user
    if (filters?.userId) {
      const userExtensions = this.installedExtensions.get(filters.userId) || new Set();
      extensions = extensions.map(ext => ({
        ...ext,
        installed: userExtensions.has(ext.id)
      }));
    }

    return extensions;
  }

  // Get extension by ID
  async getExtension(id: number): Promise<MarketplaceExtension | null> {
    return this.extensions.get(id) || null;
  }

  // Install extension for user
  async installExtension(userId: string, extensionId: number): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error('Extension not found');
    }

    if (!this.installedExtensions.has(userId)) {
      this.installedExtensions.set(userId, new Set());
    }

    this.installedExtensions.get(userId)!.add(extensionId);
    
    // Update download count
    extension.downloads++;
    
    this.emit('extension-installed', { userId, extensionId, extension });
    logger.info(`Extension ${extension.name} installed for user ${userId}`);
  }

  // Uninstall extension
  async uninstallExtension(userId: string, extensionId: number): Promise<void> {
    const userExtensions = this.installedExtensions.get(userId);
    if (userExtensions) {
      userExtensions.delete(extensionId);
    }

    const extension = this.extensions.get(extensionId);
    if (extension) {
      this.emit('extension-uninstalled', { userId, extensionId, extension });
      logger.info(`Extension ${extension.name} uninstalled for user ${userId}`);
    }
  }

  // Get all templates with optional filters
  async getTemplates(filters?: {
    framework?: string;
    language?: string;
    search?: string;
  }): Promise<MarketplaceTemplate[]> {
    // Fetch templates from database
    let dbTemplates = await db.select().from(templatesTable);

    // Transform database templates to MarketplaceTemplate format
    let templates = dbTemplates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      framework: t.framework || '',
      language: t.language,
      author: t.authorName,
      stars: t.stars,
      forks: t.forks,
      lastUpdated: '2 days ago', // Can be calculated from updatedAt
      tags: t.tags,
      featured: t.isFeatured
    }));

    if (filters) {
      if (filters.framework) {
        templates = templates.filter(tmpl => tmpl.framework === filters.framework);
      }

      if (filters.language) {
        templates = templates.filter(tmpl => tmpl.language === filters.language);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(tmpl =>
          tmpl.name.toLowerCase().includes(searchLower) ||
          tmpl.description.toLowerCase().includes(searchLower) ||
          tmpl.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
    }

    return templates;
  }

  // Get template by ID
  async getTemplate(id: number): Promise<MarketplaceTemplate | null> {
    return this.templates.get(id) || null;
  }

  // Get extension categories
  getCategories(): string[] {
    return ['all', 'AI & ML', 'Themes', 'Languages', 'Formatters', 'Security', 'Tools', 'Database', 'Version Control'];
  }

  // Get user's installed extensions
  async getUserExtensions(userId: string): Promise<MarketplaceExtension[]> {
    const userExtensionIds = this.installedExtensions.get(userId) || new Set();
    return Array.from(userExtensionIds)
      .map(id => this.extensions.get(id))
      .filter(ext => ext !== undefined) as MarketplaceExtension[];
  }

  // Rate extension
  async rateExtension(userId: string, extensionId: number, rating: number): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error('Extension not found');
    }

    // Simple average calculation (in production, track individual ratings)
    const totalRating = extension.rating * extension.reviews;
    extension.reviews++;
    extension.rating = (totalRating + rating) / extension.reviews;

    this.emit('extension-rated', { userId, extensionId, rating });
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();