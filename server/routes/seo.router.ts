import { Router, Request, Response } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('seo-router');

const BASE_URL = 'https://e-code.ai';

const seoConfig: Record<string, {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
  ogType?: string;
}> = {
  landing: {
    title: 'E-Code - AI-Powered Development Platform | Build & Deploy in Minutes',
    description: 'Build and deploy production-ready applications in minutes with AI agents. Enterprise-grade security, real-time collaboration, and global edge deployment. Start building today.',
    keywords: ['AI development platform', 'code editor online', 'cloud IDE', 'AI code generation', 'deploy applications', 'enterprise development', 'collaborative coding', 'browser IDE', 'no-code builder'],
    ogImage: '/assets/og/landing.png',
    ogType: 'website'
  },
  pricing: {
    title: 'Pricing Plans - E-Code | Free to Enterprise',
    description: 'Transparent pricing for individuals, teams, and enterprises. Start free, scale to millions. Compare Core, Teams, and Enterprise plans with AI credits included.',
    keywords: ['E-Code pricing', 'development platform cost', 'cloud IDE pricing', 'enterprise development pricing', 'AI development cost', 'team collaboration pricing'],
    ogImage: '/assets/og/pricing.png',
    canonicalUrl: `${BASE_URL}/pricing`
  },
  features: {
    title: 'Features - E-Code | Enterprise-Grade Development Tools',
    description: 'Discover powerful features: AI-powered code generation, real-time collaboration, instant deployment, 40+ languages, and enterprise security. Built for Fortune 500 standards.',
    keywords: ['IDE features', 'AI code assistant', 'real-time collaboration', 'instant deployment', 'multi-language support', 'enterprise security'],
    ogImage: '/assets/og/features.png',
    canonicalUrl: `${BASE_URL}/features`
  },
  about: {
    title: 'About E-Code - Our Mission & Leadership Team',
    description: 'E-Code is revolutionizing software development with AI. Learn about our mission to democratize coding and meet our world-class leadership team.',
    keywords: ['E-Code company', 'about E-Code', 'E-Code team', 'software development mission', 'AI development company'],
    ogImage: '/assets/og/about.png',
    canonicalUrl: `${BASE_URL}/about`
  },
  careers: {
    title: 'Careers at E-Code - Join Our Global Team',
    description: 'Build the future of software development. Join our distributed team working on cutting-edge AI and cloud technologies. Remote-first culture, competitive benefits.',
    keywords: ['E-Code jobs', 'software engineering careers', 'remote developer jobs', 'AI company careers', 'tech startup jobs'],
    ogImage: '/assets/og/careers.png',
    canonicalUrl: `${BASE_URL}/careers`
  },
  ai: {
    title: 'AI Platform - E-Code | Enterprise AI Development',
    description: 'Build with AI agents that understand your codebase. Generate production code, debug automatically, and deploy with confidence. SOC 2 compliant AI governance.',
    keywords: ['AI code generation', 'AI pair programmer', 'GPT coding', 'AI development tools', 'automated coding', 'AI code review'],
    ogImage: '/assets/og/ai.png',
    canonicalUrl: `${BASE_URL}/ai`
  },
  desktop: {
    title: 'Desktop App - E-Code | Native Performance, Cloud Power',
    description: 'The full E-Code experience on your desktop. Offline support, secure device sync, and native performance. Available for Windows, macOS, and Linux.',
    keywords: ['E-Code desktop', 'native IDE', 'offline code editor', 'desktop development app', 'cross-platform IDE'],
    ogImage: '/assets/og/desktop.png',
    canonicalUrl: `${BASE_URL}/desktop`
  },
  mobile: {
    title: 'Mobile App - E-Code | Code Anywhere',
    description: 'Ship from anywhere with our fully-featured mobile IDE. iOS and Android apps with full code editing, debugging, and deployment capabilities.',
    keywords: ['mobile IDE', 'code on mobile', 'iOS code editor', 'Android development app', 'mobile programming'],
    ogImage: '/assets/og/mobile.png',
    canonicalUrl: `${BASE_URL}/mobile`
  },
  security: {
    title: 'Security & Compliance - E-Code | Enterprise-Grade Protection',
    description: 'Bank-level security for your code. SOC 2 Type II certified, GDPR compliant, end-to-end encryption. Built for Fortune 500 security requirements.',
    keywords: ['code security', 'SOC 2 compliance', 'GDPR development', 'enterprise security', 'secure code hosting', 'data protection'],
    ogImage: '/assets/og/security.png',
    canonicalUrl: `${BASE_URL}/security`
  },
  'solutions/app-builder': {
    title: 'App Builder - E-Code | Build Full-Stack Applications',
    description: 'Rapidly prototype and deploy full-stack applications with AI assistance. From idea to production in hours. React, Node.js, databases, and more.',
    keywords: ['app builder', 'full-stack development', 'rapid prototyping', 'AI app development', 'no-code app builder', 'web app creator'],
    ogImage: '/assets/og/solutions/app-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/app-builder`
  },
  'solutions/website-builder': {
    title: 'Website Builder - E-Code | Professional Sites in Minutes',
    description: 'Create polished marketing sites, landing pages, and portfolios with zero setup. AI-generated content, responsive design, instant deployment.',
    keywords: ['website builder', 'landing page creator', 'AI website builder', 'marketing site builder', 'portfolio creator', 'responsive web design'],
    ogImage: '/assets/og/solutions/website-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/website-builder`
  },
  'solutions/enterprise': {
    title: 'Enterprise Solutions - E-Code | Fortune 500 Development Platform',
    description: 'Enterprise-grade development platform with SSO, audit logs, custom roles, dedicated support, and 99.99% SLA. Trusted by Fortune 500 companies.',
    keywords: ['enterprise development', 'Fortune 500 IDE', 'enterprise cloud IDE', 'corporate development platform', 'enterprise software development'],
    ogImage: '/assets/og/solutions/enterprise.png',
    canonicalUrl: `${BASE_URL}/solutions/enterprise`
  },
  'solutions/startups': {
    title: 'Startup Solutions - E-Code | Ship 10x Faster',
    description: 'Build your MVP in days, not months. AI-powered development, instant deployment, and pricing that scales with your growth.',
    keywords: ['startup development', 'MVP builder', 'rapid prototyping', 'startup tools', 'fast development', 'scale startup'],
    ogImage: '/assets/og/solutions/startups.png',
    canonicalUrl: `${BASE_URL}/solutions/startups`
  },
  docs: {
    title: 'Documentation - E-Code | Guides & API Reference',
    description: 'Comprehensive documentation for E-Code. Quick start guides, API reference, tutorials, and best practices for developers.',
    keywords: ['E-Code documentation', 'API reference', 'developer guides', 'coding tutorials', 'platform documentation'],
    ogImage: '/assets/og/docs.png',
    canonicalUrl: `${BASE_URL}/docs`
  },
  blog: {
    title: 'Blog - E-Code | Engineering & Product Updates',
    description: 'Stories on shipping software at global scale. Engineering insights, product updates, and best practices from the E-Code team.',
    keywords: ['E-Code blog', 'software engineering blog', 'development tips', 'tech blog', 'product updates'],
    ogImage: '/assets/og/blog.png',
    ogType: 'article',
    canonicalUrl: `${BASE_URL}/blog`
  },
  community: {
    title: 'Community - E-Code | Connect with Developers',
    description: 'Join the E-Code community of developers and creators. Share projects, get help, and collaborate with builders worldwide.',
    keywords: ['developer community', 'coding community', 'E-Code users', 'programming forum', 'developer network'],
    ogImage: '/assets/og/community.png',
    canonicalUrl: `${BASE_URL}/community`
  },
  templates: {
    title: 'Templates - E-Code | Start with Curated Starters',
    description: 'Launch faster with industry-specific templates. React, Node.js, Python, and 100+ pre-built starters ready to deploy.',
    keywords: ['code templates', 'project starters', 'boilerplate code', 'React templates', 'Node.js templates', 'project templates'],
    ogImage: '/assets/og/templates.png',
    canonicalUrl: `${BASE_URL}/templates`
  },
  changelog: {
    title: 'Changelog - E-Code | Product Updates & Releases',
    description: 'Stay updated with the latest E-Code features, improvements, and bug fixes. Detailed release notes and version history.',
    keywords: ['E-Code changelog', 'product updates', 'release notes', 'new features', 'version history'],
    ogImage: '/assets/og/changelog.png',
    canonicalUrl: `${BASE_URL}/changelog`
  },
  contact: {
    title: 'Contact Us - E-Code | Get in Touch',
    description: 'Contact E-Code for sales inquiries, support, partnerships, or general questions. We respond within 24 hours.',
    keywords: ['contact E-Code', 'sales inquiry', 'support contact', 'partnership inquiry', 'get in touch'],
    ogImage: '/assets/og/contact.png',
    canonicalUrl: `${BASE_URL}/contact`
  },
  compare: {
    title: 'Compare E-Code - See How We Stack Up',
    description: 'Compare E-Code with other development platforms. See why developers choose E-Code over GitHub Codespaces, Replit, and more.',
    keywords: ['E-Code comparison', 'IDE comparison', 'cloud IDE compare', 'development platform comparison'],
    ogImage: '/assets/og/compare.png',
    canonicalUrl: `${BASE_URL}/compare`
  },
  status: {
    title: 'Platform Status - E-Code | System Health',
    description: 'E-Code platform status and uptime. Real-time monitoring of all services. 99.99% SLA guaranteed.',
    keywords: ['E-Code status', 'platform uptime', 'service status', 'system health', 'downtime alerts'],
    ogImage: '/assets/og/status.png',
    canonicalUrl: `${BASE_URL}/status`
  }
};

interface PageSEO {
  path: string;
  title: string;
  description: string;
  score: number;
  status: 'excellent' | 'good' | 'needs-work' | 'critical';
  issues: string[];
  lastUpdated: string;
  trend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  hasRealData: boolean;
}

interface SEOAnalyticsResponse {
  pages: PageSEO[];
  hasRealAnalytics: boolean;
  lastSyncedAt: string | null;
}

const calculateSEOScore = (config: typeof seoConfig[string]): { score: number; issues: string[] } => {
  const issues: string[] = [];
  let score = 100;

  if (!config.title) { issues.push("Missing title"); score -= 25; }
  else if (config.title.length < 30) { issues.push("Title too short (< 30 chars)"); score -= 10; }
  else if (config.title.length > 60) { issues.push("Title too long (> 60 chars)"); score -= 5; }

  if (!config.description) { issues.push("Missing meta description"); score -= 25; }
  else if (config.description.length < 120) { issues.push("Description too short (< 120 chars)"); score -= 10; }
  else if (config.description.length > 160) { issues.push("Description too long (> 160 chars)"); score -= 5; }

  if (!config.keywords || config.keywords.length < 3) { issues.push("Needs more keywords (< 3)"); score -= 10; }
  if (!config.ogImage) { issues.push("Missing Open Graph image"); score -= 15; }
  if (!config.canonicalUrl) { issues.push("Missing canonical URL"); score -= 5; }

  return { score: Math.max(0, score), issues };
};

router.use(ensureAuthenticated);
router.use(ensureAdmin);

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching SEO analytics', { userId: req.user?.id });

    const pages: PageSEO[] = Object.entries(seoConfig).map(([key, config]) => {
      const { score, issues } = calculateSEOScore(config);
      let status: 'excellent' | 'good' | 'needs-work' | 'critical';
      if (score >= 90) status = 'excellent';
      else if (score >= 70) status = 'good';
      else if (score >= 50) status = 'needs-work';
      else status = 'critical';

      return {
        path: key === 'landing' ? '/' : `/${key}`,
        title: config.title,
        description: config.description,
        score,
        status,
        issues,
        lastUpdated: new Date().toISOString().split('T')[0],
        trend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        hasRealData: false
      };
    });

    const response: SEOAnalyticsResponse = {
      pages,
      hasRealAnalytics: false,
      lastSyncedAt: null
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching SEO analytics', { error });
    res.status(500).json({ message: 'Failed to fetch SEO analytics' });
  }
});

export default router;
