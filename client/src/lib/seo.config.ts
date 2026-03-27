import { SEOProps } from '@/components/seo/SEOHead';

const BASE_URL = 'https://e-code.ai';

/**
 * Centralized SEO configuration for all public pages
 * Fortune 500-grade SEO optimization
 */
export const seoConfig: Record<string, SEOProps> = {
  // ============================================
  // CORE PAGES
  // ============================================
  landing: {
    title: 'E-Code - AI-Powered Development Platform | Build & Deploy in Minutes',
    description: 'Build and deploy production-ready applications in minutes with AI agents. Enterprise-grade security, real-time collaboration, and global edge deployment. Start building today.',
    keywords: [
      'AI development platform', 'code editor online', 'cloud IDE',
      'AI code generation', 'deploy applications', 'enterprise development',
      'collaborative coding', 'browser IDE', 'no-code builder'
    ],
    ogImage: '/assets/og/landing.png',
    ogType: 'website'
  },

  pricing: {
    title: 'Pricing Plans - E-Code | Free to Enterprise',
    description: 'Transparent pricing for individuals, teams, and enterprises. Start free, scale to millions. Compare Core, Teams, and Enterprise plans with AI credits included.',
    keywords: [
      'E-Code pricing', 'development platform cost', 'cloud IDE pricing',
      'enterprise development pricing', 'AI development cost', 'team collaboration pricing'
    ],
    ogImage: '/assets/og/pricing.png',
    canonicalUrl: `${BASE_URL}/pricing`
  },

  features: {
    title: 'Features - E-Code | Enterprise-Grade Development Tools',
    description: 'Discover powerful features: AI-powered code generation, real-time collaboration, instant deployment, 40+ languages, and enterprise security. Built for Fortune 500 standards.',
    keywords: [
      'IDE features', 'AI code assistant', 'real-time collaboration',
      'instant deployment', 'multi-language support', 'enterprise security'
    ],
    ogImage: '/assets/og/features.png',
    canonicalUrl: `${BASE_URL}/features`
  },

  about: {
    title: 'About E-Code - Our Mission & Leadership Team',
    description: 'E-Code is revolutionizing software development with AI. Learn about our mission to democratize coding and meet our world-class leadership team.',
    keywords: [
      'E-Code company', 'about E-Code', 'E-Code team',
      'software development mission', 'AI development company'
    ],
    ogImage: '/assets/og/about.png',
    canonicalUrl: `${BASE_URL}/about`
  },

  careers: {
    title: 'Careers at E-Code - Join Our Global Team',
    description: 'Build the future of software development. Join our distributed team working on cutting-edge AI and cloud technologies. Remote-first culture, competitive benefits.',
    keywords: [
      'E-Code jobs', 'software engineering careers', 'remote developer jobs',
      'AI company careers', 'tech startup jobs'
    ],
    ogImage: '/assets/og/careers.png',
    canonicalUrl: `${BASE_URL}/careers`
  },

  // ============================================
  // PRODUCT PAGES
  // ============================================
  ai: {
    title: 'AI Platform - E-Code | Enterprise AI Development',
    description: 'Build with AI agents that understand your codebase. Generate production code, debug automatically, and deploy with confidence. SOC 2 compliant AI governance.',
    keywords: [
      'AI code generation', 'AI pair programmer', 'GPT coding',
      'AI development tools', 'automated coding', 'AI code review'
    ],
    ogImage: '/assets/og/ai.png',
    canonicalUrl: `${BASE_URL}/ai`
  },

  desktop: {
    title: 'Desktop App - E-Code | Native Performance, Cloud Power',
    description: 'The full E-Code experience on your desktop. Offline support, secure device sync, and native performance. Available for Windows, macOS, and Linux.',
    keywords: [
      'E-Code desktop', 'native IDE', 'offline code editor',
      'desktop development app', 'cross-platform IDE'
    ],
    ogImage: '/assets/og/desktop.png',
    canonicalUrl: `${BASE_URL}/desktop`
  },

  mobile: {
    title: 'Mobile App - E-Code | Code Anywhere',
    description: 'Ship from anywhere with our fully-featured mobile IDE. iOS and Android apps with full code editing, debugging, and deployment capabilities.',
    keywords: [
      'mobile IDE', 'code on mobile', 'iOS code editor',
      'Android development app', 'mobile programming'
    ],
    ogImage: '/assets/og/mobile.png',
    canonicalUrl: `${BASE_URL}/mobile`
  },

  security: {
    title: 'Security & Compliance - E-Code | Enterprise-Grade Protection',
    description: 'Bank-level security for your code. SOC 2 Type II certified, GDPR compliant, end-to-end encryption. Built for Fortune 500 security requirements.',
    keywords: [
      'code security', 'SOC 2 compliance', 'GDPR development',
      'enterprise security', 'secure code hosting', 'data protection'
    ],
    ogImage: '/assets/og/security.png',
    canonicalUrl: `${BASE_URL}/security`
  },

  // ============================================
  // SOLUTIONS BY USE CASE
  // ============================================
  'solutions/app-builder': {
    title: 'App Builder - E-Code | Build Full-Stack Applications',
    description: 'Rapidly prototype and deploy full-stack applications with AI assistance. From idea to production in hours. React, Node.js, databases, and more.',
    keywords: [
      'app builder', 'full-stack development', 'rapid prototyping',
      'AI app development', 'no-code app builder', 'web app creator'
    ],
    ogImage: '/assets/og/solutions/app-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/app-builder`
  },

  'solutions/website-builder': {
    title: 'Website Builder - E-Code | Professional Sites in Minutes',
    description: 'Create polished marketing sites, landing pages, and portfolios with zero setup. AI-generated content, responsive design, instant deployment.',
    keywords: [
      'website builder', 'landing page creator', 'AI website builder',
      'marketing site builder', 'portfolio creator', 'responsive web design'
    ],
    ogImage: '/assets/og/solutions/website-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/website-builder`
  },

  'solutions/game-builder': {
    title: 'Game Builder - E-Code | Create Interactive Experiences',
    description: 'Design and launch interactive games and experiences powered by AI. 2D/3D engines, multiplayer support, and instant publishing.',
    keywords: [
      'game builder', 'game development platform', 'AI game creation',
      'online game maker', 'interactive experience builder'
    ],
    ogImage: '/assets/og/solutions/game-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/game-builder`
  },

  'solutions/dashboard-builder': {
    title: 'Dashboard Builder - E-Code | Data Visualization Made Easy',
    description: 'Build data-rich dashboards with real-time collaboration. Charts, graphs, KPIs, and analytics. Connect to any data source.',
    keywords: [
      'dashboard builder', 'data visualization', 'analytics dashboard',
      'business intelligence', 'real-time dashboard', 'KPI tracking'
    ],
    ogImage: '/assets/og/solutions/dashboard-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/dashboard-builder`
  },

  'solutions/chatbot-builder': {
    title: 'Chatbot Builder - E-Code | Deploy AI Assistants',
    description: 'Deploy conversational AI assistants across your organization. GPT-powered, trainable on your data, enterprise-ready.',
    keywords: [
      'chatbot builder', 'AI assistant', 'conversational AI',
      'GPT chatbot', 'customer support bot', 'enterprise chatbot'
    ],
    ogImage: '/assets/og/solutions/chatbot-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/chatbot-builder`
  },

  'solutions/internal-ai-builder': {
    title: 'Internal AI Builder - E-Code | Private AI for Teams',
    description: 'Bring private AI agents to every team safely and securely. Custom training, data isolation, and enterprise governance.',
    keywords: [
      'internal AI', 'private AI', 'enterprise AI',
      'custom AI agents', 'AI governance', 'secure AI'
    ],
    ogImage: '/assets/og/solutions/internal-ai-builder.png',
    canonicalUrl: `${BASE_URL}/solutions/internal-ai-builder`
  },

  // ============================================
  // SOLUTIONS BY AUDIENCE
  // ============================================
  'solutions/enterprise': {
    title: 'Enterprise Solutions - E-Code | Fortune 500 Development Platform',
    description: 'Enterprise-grade development platform with SSO, audit logs, custom roles, dedicated support, and 99.99% SLA. Trusted by Fortune 500 companies.',
    keywords: [
      'enterprise development', 'Fortune 500 IDE', 'enterprise cloud IDE',
      'corporate development platform', 'enterprise software development'
    ],
    ogImage: '/assets/og/solutions/enterprise.png',
    canonicalUrl: `${BASE_URL}/solutions/enterprise`
  },

  'solutions/startups': {
    title: 'Startup Solutions - E-Code | Ship 10x Faster',
    description: 'Build your MVP in days, not months. AI-powered development, instant deployment, and pricing that scales with your growth.',
    keywords: [
      'startup development', 'MVP builder', 'rapid prototyping',
      'startup tools', 'fast development', 'scale startup'
    ],
    ogImage: '/assets/og/solutions/startups.png',
    canonicalUrl: `${BASE_URL}/solutions/startups`
  },

  'solutions/freelancers': {
    title: 'Freelancer Solutions - E-Code | Deliver Projects Faster',
    description: 'Impress clients with faster delivery. AI-assisted development, professional deployments, and portfolio hosting included.',
    keywords: [
      'freelancer tools', 'freelance development', 'client projects',
      'portfolio hosting', 'contractor development'
    ],
    ogImage: '/assets/og/solutions/freelancers.png',
    canonicalUrl: `${BASE_URL}/solutions/freelancers`
  },

  'solutions/education': {
    title: 'Education Solutions - E-Code | Learn to Code Better',
    description: 'The best platform for learning to code. Interactive tutorials, AI tutoring, instant feedback, and collaborative classrooms.',
    keywords: [
      'learn to code', 'coding education', 'programming tutorials',
      'computer science education', 'coding bootcamp'
    ],
    ogImage: '/assets/og/solutions/education.png',
    canonicalUrl: `${BASE_URL}/solutions/education`
  },

  // ============================================
  // RESOURCES
  // ============================================
  docs: {
    title: 'Documentation - E-Code | Guides & API Reference',
    description: 'Comprehensive documentation for E-Code. Quick start guides, API reference, tutorials, and best practices for developers.',
    keywords: [
      'E-Code documentation', 'API reference', 'developer guides',
      'coding tutorials', 'platform documentation'
    ],
    ogImage: '/assets/og/docs.png',
    canonicalUrl: `${BASE_URL}/docs`
  },

  blog: {
    title: 'Blog - E-Code | Engineering & Product Updates',
    description: 'Stories on shipping software at global scale. Engineering insights, product updates, and best practices from the E-Code team.',
    keywords: [
      'E-Code blog', 'software engineering blog', 'development tips',
      'tech blog', 'product updates'
    ],
    ogImage: '/assets/og/blog.png',
    ogType: 'article',
    canonicalUrl: `${BASE_URL}/blog`
  },

  community: {
    title: 'Community - E-Code | Connect with Developers',
    description: 'Join the E-Code community of developers and creators. Share projects, get help, and collaborate with builders worldwide.',
    keywords: [
      'developer community', 'coding community', 'E-Code users',
      'programming forum', 'developer network'
    ],
    ogImage: '/assets/og/community.png',
    canonicalUrl: `${BASE_URL}/community`
  },

  templates: {
    title: 'Templates - E-Code | Start with Curated Starters',
    description: 'Launch faster with industry-specific templates. React, Node.js, Python, and 100+ pre-built starters ready to deploy.',
    keywords: [
      'code templates', 'project starters', 'boilerplate code',
      'React templates', 'Node.js templates', 'project templates'
    ],
    ogImage: '/assets/og/templates.png',
    canonicalUrl: `${BASE_URL}/templates`
  },

  changelog: {
    title: 'Changelog - E-Code | Product Updates & Releases',
    description: 'Stay updated with the latest E-Code features, improvements, and bug fixes. Detailed release notes and version history.',
    keywords: [
      'E-Code changelog', 'product updates', 'release notes',
      'new features', 'version history'
    ],
    ogImage: '/assets/og/changelog.png',
    canonicalUrl: `${BASE_URL}/changelog`
  },

  tutorials: {
    title: 'Tutorials - E-Code | Step-by-Step Learning',
    description: 'Learn to build real-world applications with guided tutorials. From beginner to advanced, covering all major technologies.',
    keywords: [
      'coding tutorials', 'programming guides', 'learn development',
      'step-by-step coding', 'developer tutorials'
    ],
    ogImage: '/assets/og/tutorials.png',
    canonicalUrl: `${BASE_URL}/tutorials`
  },

  'case-studies': {
    title: 'Case Studies - E-Code | Customer Success Stories',
    description: 'See how leading companies build with E-Code. Real-world success stories from startups to Fortune 500 enterprises.',
    keywords: [
      'customer success', 'case studies', 'enterprise testimonials',
      'development success stories', 'E-Code customers'
    ],
    ogImage: '/assets/og/case-studies.png',
    canonicalUrl: `${BASE_URL}/case-studies`
  },

  'help-center': {
    title: 'Help Center - E-Code | Support & FAQ',
    description: 'Get help with E-Code. Browse FAQs, troubleshooting guides, and contact our support team for assistance.',
    keywords: [
      'E-Code help', 'customer support', 'FAQ',
      'troubleshooting', 'support center'
    ],
    ogImage: '/assets/og/help-center.png',
    canonicalUrl: `${BASE_URL}/help-center`
  },

  // ============================================
  // COMPANY
  // ============================================
  press: {
    title: 'Press & Media - E-Code | News & Media Kit',
    description: 'E-Code press resources. Download media kit, brand assets, and find recent press coverage and announcements.',
    keywords: [
      'E-Code press', 'media kit', 'brand assets',
      'press releases', 'company news'
    ],
    ogImage: '/assets/og/press.png',
    canonicalUrl: `${BASE_URL}/press`
  },

  partners: {
    title: 'Partners - E-Code | Strategic Alliances',
    description: 'Partner with E-Code. Explore integration partnerships, reseller programs, and strategic alliance opportunities.',
    keywords: [
      'E-Code partners', 'technology partners', 'integration partners',
      'reseller program', 'partner program'
    ],
    ogImage: '/assets/og/partners.png',
    canonicalUrl: `${BASE_URL}/partners`
  },

  contact: {
    title: 'Contact Us - E-Code | Get in Touch',
    description: 'Contact E-Code for sales inquiries, support, partnerships, or general questions. We respond within 24 hours.',
    keywords: [
      'contact E-Code', 'sales inquiry', 'support contact',
      'partnership inquiry', 'get in touch'
    ],
    ogImage: '/assets/og/contact.png',
    canonicalUrl: `${BASE_URL}/contact`
  },

  'contact-sales': {
    title: 'Contact Sales - E-Code | Enterprise Inquiries',
    description: 'Talk to our sales team about enterprise solutions. Custom pricing, dedicated support, and tailored solutions for your organization.',
    keywords: [
      'enterprise sales', 'E-Code sales', 'custom pricing',
      'enterprise inquiry', 'sales contact'
    ],
    ogImage: '/assets/og/contact-sales.png',
    canonicalUrl: `${BASE_URL}/contact-sales`
  },

  // ============================================
  // LEGAL
  // ============================================
  terms: {
    title: 'Terms of Service - E-Code',
    description: 'E-Code Terms of Service. Read our terms and conditions for using the E-Code platform and services.',
    keywords: ['terms of service', 'E-Code terms', 'legal terms'],
    ogImage: '/assets/og/legal.png',
    canonicalUrl: `${BASE_URL}/terms`
  },

  privacy: {
    title: 'Privacy Policy - E-Code',
    description: 'E-Code Privacy Policy. Learn how we collect, use, and protect your data. GDPR and CCPA compliant.',
    keywords: ['privacy policy', 'data protection', 'GDPR', 'E-Code privacy'],
    ogImage: '/assets/og/legal.png',
    canonicalUrl: `${BASE_URL}/privacy`
  },

  dpa: {
    title: 'Data Processing Agreement - E-Code',
    description: 'E-Code Data Processing Agreement for enterprise customers. GDPR-compliant data handling terms.',
    keywords: ['DPA', 'data processing', 'GDPR compliance', 'enterprise agreement'],
    ogImage: '/assets/og/legal.png',
    canonicalUrl: `${BASE_URL}/dpa`
  },

  accessibility: {
    title: 'Accessibility Statement - E-Code',
    description: 'E-Code accessibility commitment. WCAG 2.1 AA compliance and our efforts to make development accessible to everyone.',
    keywords: ['accessibility', 'WCAG', 'inclusive design', 'a11y'],
    ogImage: '/assets/og/legal.png',
    canonicalUrl: `${BASE_URL}/accessibility`
  },

  // ============================================
  // COMPARISON PAGES
  // ============================================
  compare: {
    title: 'Compare E-Code - See How We Stack Up',
    description: 'Compare E-Code with other development platforms. See why developers choose E-Code over GitHub Codespaces, Replit, and more.',
    keywords: [
      'E-Code comparison', 'IDE comparison', 'cloud IDE compare',
      'development platform comparison'
    ],
    ogImage: '/assets/og/compare.png',
    canonicalUrl: `${BASE_URL}/compare`
  },

  'compare/github-codespaces': {
    title: 'E-Code vs GitHub Codespaces - Feature Comparison',
    description: 'Compare E-Code with GitHub Codespaces. Better AI, faster deployment, and more flexible pricing. See the full comparison.',
    keywords: [
      'E-Code vs Codespaces', 'GitHub Codespaces alternative',
      'cloud IDE comparison', 'Codespaces competitor'
    ],
    ogImage: '/assets/og/compare/github-codespaces.png',
    canonicalUrl: `${BASE_URL}/compare/github-codespaces`
  },

  'compare/codesandbox': {
    title: 'E-Code vs CodeSandbox - Feature Comparison',
    description: 'Compare E-Code with CodeSandbox. More languages, better AI, and enterprise features. See why developers switch.',
    keywords: [
      'E-Code vs CodeSandbox', 'CodeSandbox alternative',
      'online IDE comparison'
    ],
    ogImage: '/assets/og/compare/codesandbox.png',
    canonicalUrl: `${BASE_URL}/compare/codesandbox`
  },

  'compare/heroku': {
    title: 'E-Code vs Heroku - Platform Comparison',
    description: 'Compare E-Code with Heroku. Full development environment plus deployment. Better DX and more control.',
    keywords: [
      'E-Code vs Heroku', 'Heroku alternative',
      'deployment platform comparison'
    ],
    ogImage: '/assets/og/compare/heroku.png',
    canonicalUrl: `${BASE_URL}/compare/heroku`
  },

  // ============================================
  // STATUS & SUPPORT
  // ============================================
  status: {
    title: 'Platform Status - E-Code | System Health',
    description: 'E-Code platform status and uptime. Real-time monitoring of all services. 99.99% SLA guaranteed.',
    keywords: [
      'E-Code status', 'platform uptime', 'service status',
      'system health', 'downtime alerts'
    ],
    ogImage: '/assets/og/status.png',
    canonicalUrl: `${BASE_URL}/status`
  },

  forum: {
    title: 'Forum - E-Code | Community Support',
    description: 'Get help from E-Code experts and peers. Ask questions, share solutions, and discuss best practices.',
    keywords: [
      'E-Code forum', 'developer forum', 'community support',
      'coding help', 'Q&A'
    ],
    ogImage: '/assets/og/forum.png',
    canonicalUrl: `${BASE_URL}/forum`
  }
};

/**
 * Get SEO config for a page by key
 */
export function getSEOConfig(pageKey: string): SEOProps {
  return seoConfig[pageKey] || {
    title: 'E-Code - AI-Powered Development Platform',
    description: 'Build and deploy production-ready applications in minutes with AI agents.',
    keywords: ['E-Code', 'development platform', 'AI coding']
  };
}

/**
 * Generate dynamic SEO for blog posts
 */
export function generateBlogSEO(post: {
  title: string;
  excerpt: string;
  slug: string;
  author: string;
  publishedAt: string;
  image?: string;
  tags?: string[];
}): SEOProps {
  return {
    title: `${post.title} - E-Code Blog`,
    description: post.excerpt.slice(0, 155),
    keywords: post.tags || ['E-Code', 'development', 'engineering'],
    canonicalUrl: `${BASE_URL}/blog/${post.slug}`,
    ogImage: post.image || '/assets/og/blog.png',
    ogType: 'article',
    author: post.author,
    publishedTime: post.publishedAt
  };
}

/**
 * Generate dynamic SEO for user profiles
 */
export function generateProfileSEO(user: {
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
}): SEOProps {
  const name = user.displayName || user.username;
  return {
    title: `${name} - E-Code Developer Profile`,
    description: user.bio?.slice(0, 155) || `${name}'s developer profile on E-Code. View projects, contributions, and more.`,
    canonicalUrl: `${BASE_URL}/u/${user.username}`,
    ogImage: user.avatar || '/assets/og/profile.png',
    noIndex: false
  };
}

/**
 * Generate dynamic SEO for projects
 */
export function generateProjectSEO(project: {
  name: string;
  description?: string;
  owner: string;
  language?: string;
  image?: string;
}): SEOProps {
  return {
    title: `${project.name} by ${project.owner} - E-Code`,
    description: project.description?.slice(0, 155) || `${project.name} - A ${project.language || 'code'} project on E-Code.`,
    canonicalUrl: `${BASE_URL}/u/${project.owner}/${project.name}`,
    ogImage: project.image || '/assets/og/project.png',
    keywords: [project.language || 'code', 'open source', 'project', project.owner]
  };
}

export default seoConfig;
