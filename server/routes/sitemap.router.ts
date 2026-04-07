import { Router, Request, Response } from 'express';

const router = Router();

const BASE_URL = 'https://e-code.ai';

// All public pages with their priorities and change frequencies
const publicPages = [
  // Core pages
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/pricing', priority: 0.9, changefreq: 'weekly' },
  { url: '/features', priority: 0.9, changefreq: 'weekly' },
  { url: '/about', priority: 0.7, changefreq: 'monthly' },
  { url: '/careers', priority: 0.7, changefreq: 'weekly' },
  { url: '/contact', priority: 0.6, changefreq: 'monthly' },
  { url: '/contact-sales', priority: 0.7, changefreq: 'monthly' },

  // Product pages
  { url: '/ai', priority: 0.9, changefreq: 'weekly' },
  { url: '/mobile', priority: 0.8, changefreq: 'monthly' },
  { url: '/desktop', priority: 0.8, changefreq: 'monthly' },
  { url: '/security', priority: 0.7, changefreq: 'monthly' },

  // Solutions - By Use Case
  { url: '/solutions/app-builder', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/website-builder', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/game-builder', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/dashboard-builder', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/chatbot-builder', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/internal-ai-builder', priority: 0.8, changefreq: 'monthly' },

  // Solutions - By Audience
  { url: '/solutions/enterprise', priority: 0.9, changefreq: 'monthly' },
  { url: '/solutions/startups', priority: 0.8, changefreq: 'monthly' },
  { url: '/solutions/freelancers', priority: 0.8, changefreq: 'monthly' },

  // Resources
  { url: '/docs', priority: 0.9, changefreq: 'daily' },
  { url: '/blog', priority: 0.8, changefreq: 'daily' },
  { url: '/tutorials', priority: 0.8, changefreq: 'weekly' },
  { url: '/changelog', priority: 0.7, changefreq: 'weekly' },
  { url: '/case-studies', priority: 0.7, changefreq: 'monthly' },
  { url: '/help-center', priority: 0.7, changefreq: 'weekly' },
  { url: '/templates', priority: 0.8, changefreq: 'weekly' },
  { url: '/community', priority: 0.7, changefreq: 'daily' },
  { url: '/forum', priority: 0.7, changefreq: 'daily' },
  { url: '/languages', priority: 0.7, changefreq: 'monthly' },

  // Compare pages
  { url: '/compare', priority: 0.7, changefreq: 'monthly' },
  { url: '/compare/github-codespaces', priority: 0.7, changefreq: 'monthly' },
  { url: '/compare/codesandbox', priority: 0.7, changefreq: 'monthly' },
  { url: '/compare/heroku', priority: 0.7, changefreq: 'monthly' },
  { url: '/compare/glitch', priority: 0.7, changefreq: 'monthly' },
  { url: '/compare/aws-cloud9', priority: 0.7, changefreq: 'monthly' },

  // Company
  { url: '/press', priority: 0.5, changefreq: 'monthly' },
  { url: '/partners', priority: 0.6, changefreq: 'monthly' },
  { url: '/status', priority: 0.6, changefreq: 'hourly' },

  // Legal
  { url: '/terms', priority: 0.3, changefreq: 'yearly' },
  { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { url: '/dpa', priority: 0.3, changefreq: 'yearly' },
  { url: '/accessibility', priority: 0.4, changefreq: 'yearly' },
];

/**
 * Generate XML sitemap
 */
router.get('/sitemap.xml', (_req: Request, res: Response) => {
  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  xml += '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n';
  xml += '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n';

  for (const page of publicPages) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.send(xml);
});

/**
 * Generate sitemap index (for large sites)
 */
router.get('/sitemap-index.xml', (_req: Request, res: Response) => {
  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '  </sitemap>\n';

  xml += '  <sitemap>\n';
  xml += `    <loc>${BASE_URL}/sitemap-blog.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '  </sitemap>\n';

  xml += '</sitemapindex>';

  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

/**
 * Generate blog sitemap (dynamic from database)
 */
router.get('/sitemap-blog.xml', async (_req: Request, res: Response) => {
  const now = new Date().toISOString();

  // In production, fetch blog posts from database
  const blogPosts = [
    { slug: 'introducing-ai-agents', lastmod: '2024-11-01' },
    { slug: 'enterprise-security-features', lastmod: '2024-10-15' },
    { slug: 'collaborative-coding-best-practices', lastmod: '2024-10-01' },
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const post of blogPosts) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/blog/${post.slug}</loc>\n`;
    xml += `    <lastmod>${post.lastmod}</lastmod>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.6</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

export default router;
