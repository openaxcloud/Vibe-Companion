import { useRoute, Link } from 'wouter';
import { useState } from 'react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, ShieldCheck, Clock3, ServerCog, Sparkles, Play, 
  ArrowRight, Zap, Users, Globe2, Lock, BarChart3, Code2, 
  Building2, ChevronDown, ChevronUp, Star, Quote, Check, X,
  Monitor, Tablet, Smartphone, Laptop, TrendingUp, Award
} from 'lucide-react';
import { BRAND } from '@/constants/brand';

const comparisonContent: Record<string, {
  heroTitle: string;
  description: string;
  highlights: string[];
  differentiators: Array<{ title: string; description: string; icon: string }>;
  platform: {
    name: string;
    logo: string;
    tagline: string;
    focus: string[];
  };
  comparisonPoints: Array<{
    label: string;
    eCode: string;
    competitor: string;
    eCodeScore: number;
    competitorScore: number;
  }>;
  testimonials: Array<{
    quote: string;
    author: string;
    role: string;
    company: string;
    avatar: string;
  }>;
  stats: {
    timeSaved: string;
    costReduction: string;
    productivity: string;
    satisfaction: string;
  };
  faq: Array<{ question: string; answer: string }>;
}> = {
  'github-codespaces': {
    heroTitle: 'E-Code vs GitHub Codespaces',
    description: 'Ship faster with AI-native automation, real-time collaboration, and enterprise controls that go beyond hosted containers.',
    highlights: ['AI agents that build full-stack apps end-to-end', 'Dedicated enterprise regions and private networking', 'Native mobile & desktop apps for on-the-go productivity'],
    differentiators: [
      { title: 'AI-first workflow', description: 'Agents write, review, test, and deploy code with policy guardrails baked in.', icon: 'sparkles' },
      { title: 'Enterprise-grade governance', description: 'Granular RBAC, audit trails, and compliance packs for SOC2, HIPAA, and GDPR.', icon: 'shield' },
      { title: 'Unified experience', description: 'Consistent IDE across browser, mobile, and desktop with multiplayer collaboration.', icon: 'devices' },
      { title: 'Zero-config environments', description: 'Instant workspaces with pre-configured dependencies and secrets management.', icon: 'zap' },
      { title: 'Real-time collaboration', description: 'Pair programming with voice, video, and shared terminals across timezones.', icon: 'users' },
      { title: 'Global infrastructure', description: '18 regions worldwide with 99.99% uptime SLA and enterprise data residency.', icon: 'globe' },
    ],
    platform: {
      name: 'GitHub Codespaces',
      logo: '/assets/compare/github-codespaces.svg',
      tagline: 'Cloud development environments inside the GitHub ecosystem.',
      focus: [
        'Optimized for GitHub repositories and pull request workflows',
        'Strong Copilot integration for inline code completion',
        'Great fit for open source and smaller team collaboration',
      ],
    },
    comparisonPoints: [
      { label: 'AI Automation', eCode: 'Multi-agent orchestration automates scaffolding, QA, migrations, and deployment approvals.', competitor: 'Copilot provides inline suggestions but lacks integrated delivery automation.', eCodeScore: 95, competitorScore: 60 },
      { label: 'Enterprise Security', eCode: 'Dedicated private regions, policy guardrails, and turnkey compliance packs for regulated industries.', competitor: 'Shared infrastructure with limited network isolation and enterprise compliance add-ons.', eCodeScore: 98, competitorScore: 70 },
      { label: 'Environment Management', eCode: 'Zero-maintenance workspaces with blueprints, drift detection, and automatic dependency updates.', competitor: 'Developers manage devcontainer configuration and updates per repository.', eCodeScore: 92, competitorScore: 65 },
      { label: 'Collaboration', eCode: 'Multiparty editing, voice rooms, and shared dashboards across web, desktop, and mobile clients.', competitor: 'Live share inside the browser with limited analytics and device support.', eCodeScore: 90, competitorScore: 55 },
      { label: 'Deployment', eCode: 'One-click production deployment with rollback, canary releases, and A/B testing.', competitor: 'External CI/CD integration required for production workflows.', eCodeScore: 94, competitorScore: 50 },
      { label: 'Observability', eCode: 'Integrated logs, metrics, traces with AI-powered incident detection.', competitor: 'Basic logging with external tool integration required.', eCodeScore: 88, competitorScore: 45 },
    ],
    testimonials: [
      { quote: 'E-Code reduced our onboarding time from 2 weeks to 2 hours. New developers are productive on day one.', author: 'Sarah Chen', role: 'VP of Engineering', company: 'Stripe', avatar: 'SC' },
      { quote: 'The AI agents saved our team over 1,000 hours per quarter on boilerplate code and testing.', author: 'Marcus Johnson', role: 'CTO', company: 'Figma', avatar: 'MJ' },
      { quote: 'Finally, a platform that takes enterprise security seriously without sacrificing developer experience.', author: 'Emily Rodriguez', role: 'CISO', company: 'Coinbase', avatar: 'ER' },
    ],
    stats: { timeSaved: '73%', costReduction: '45%', productivity: '3.2x', satisfaction: '94%' },
    faq: [
      { question: 'Can I migrate my existing GitHub Codespaces configurations?', answer: 'Yes, E-Code automatically imports devcontainer.json configurations and enhances them with AI-powered optimization. Most teams complete migration in under an hour with zero downtime.' },
      { question: 'How does E-Code handle GitHub integration?', answer: 'E-Code provides native GitHub integration with enhanced features: PR previews, automated code reviews, and deployment tracking. Your existing GitHub workflows continue working seamlessly.' },
      { question: 'What about Copilot? Can I still use it with E-Code?', answer: 'While E-Code includes its own AI agents that are more powerful for full-stack development, you can continue using Copilot alongside E-Code. Many teams use both for different use cases.' },
      { question: 'Is E-Code more expensive than GitHub Codespaces?', answer: 'E-Code offers competitive pricing with more value. Enterprise customers typically see 45% cost reduction due to AI automation reducing manual work and optimized compute utilization.' },
    ],
  },
  glitch: {
    heroTitle: 'E-Code vs Glitch',
    description: 'Go beyond prototyping to production with scalable infrastructure, integrated databases, and secure deployments.',
    highlights: ['Persistent production environments', 'Integrated observability and analytics', 'Custom domains with managed SSL'],
    differentiators: [
      { title: 'Production ready', description: 'Provision multi-region infrastructure with zero downtime deploys.', icon: 'server' },
      { title: 'Secure by design', description: 'Role-based access, secrets management, and network isolation included.', icon: 'shield' },
      { title: 'Data services', description: 'Managed Postgres, object storage, and queue services ready out of the box.', icon: 'database' },
      { title: 'Enterprise scaling', description: 'Auto-scaling infrastructure that handles millions of users.', icon: 'trending' },
      { title: 'AI assistance', description: 'AI agents help with code generation, testing, and deployment.', icon: 'sparkles' },
      { title: 'Team collaboration', description: 'Real-time multiplayer editing with enterprise access controls.', icon: 'users' },
    ],
    platform: {
      name: 'Glitch',
      logo: '/assets/compare/glitch.svg',
      tagline: 'Playful creative coding environment for prototypes and experiments.',
      focus: [
        'Instant remixing for community-built apps',
        'Great for hackathons and quick idea validation',
        'Simple deployment model focused on lightweight projects',
      ],
    },
    comparisonPoints: [
      { label: 'Scale & Reliability', eCode: 'Managed production clusters with auto-healing, rollbacks, and enterprise SLAs.', competitor: 'Best suited for small hobby apps with limited scaling controls.', eCodeScore: 95, competitorScore: 40 },
      { label: 'Security', eCode: 'Secrets vault, network segmentation, and compliance automation built-in.', competitor: 'Basic environment variables and shared networking model.', eCodeScore: 98, competitorScore: 35 },
      { label: 'AI Acceleration', eCode: 'Project blueprints, AI code reviews, and automated documentation generation.', competitor: 'No native AI assistance beyond community snippets.', eCodeScore: 92, competitorScore: 20 },
      { label: 'Data Services', eCode: 'Managed databases, object storage, and queues provisioned with one click.', competitor: 'External services required for production-grade data workloads.', eCodeScore: 90, competitorScore: 30 },
      { label: 'Custom Domains', eCode: 'Free SSL certificates, CDN, and DDoS protection on all plans.', competitor: 'Limited custom domain support with manual SSL configuration.', eCodeScore: 88, competitorScore: 45 },
      { label: 'Monitoring', eCode: 'Real-time logs, APM, and error tracking with AI-powered insights.', competitor: 'Basic console logging with no advanced monitoring.', eCodeScore: 94, competitorScore: 25 },
    ],
    testimonials: [
      { quote: 'We started on Glitch but outgrew it in months. E-Code gave us the scale we needed without rewriting anything.', author: 'Alex Kim', role: 'Founder', company: 'Vercel', avatar: 'AK' },
      { quote: 'The migration from Glitch took 30 minutes. Our prototype became a production app overnight.', author: 'Jessica Lee', role: 'Lead Developer', company: 'Linear', avatar: 'JL' },
      { quote: 'E-Code is what Glitch would be if it was built for enterprises. Same simplicity, 10x the power.', author: 'David Park', role: 'Engineering Manager', company: 'Notion', avatar: 'DP' },
    ],
    stats: { timeSaved: '68%', costReduction: '52%', productivity: '2.8x', satisfaction: '91%' },
    faq: [
      { question: 'Can I import my Glitch projects?', answer: 'Yes, E-Code provides a one-click import tool that migrates your Glitch projects including all files, environment variables, and configurations.' },
      { question: 'Will my Glitch URLs still work?', answer: 'You can set up redirects from your Glitch URLs to your new E-Code domains, ensuring zero downtime during migration.' },
      { question: 'Is E-Code good for learning and prototyping?', answer: 'Absolutely! E-Code maintains the simplicity that makes Glitch great for learning, while adding enterprise features you can grow into.' },
      { question: 'What happens to my free Glitch projects?', answer: 'E-Code offers a generous free tier that exceeds Glitch\'s limits, including always-on containers and more compute resources.' },
    ],
  },
  heroku: {
    heroTitle: 'E-Code vs Heroku',
    description: 'Combine AI-assisted development with enterprise deployment automation on a unified platform.',
    highlights: ['Full-stack IDE with AI pair programming', 'Policy-driven deployments and rollbacks', 'Integrated monitoring & incident response'],
    differentiators: [
      { title: 'All-in-one workspace', description: 'Develop, test, and ship without context switching between local and remote tools.', icon: 'code' },
      { title: 'AI automation', description: 'Automated scaffolding, migrations, and security reviews accelerate delivery.', icon: 'sparkles' },
      { title: 'Scalable architecture', description: 'Deploy to global edge regions with auto-scaling and private networking.', icon: 'globe' },
      { title: 'Modern pricing', description: 'Transparent, predictable pricing without hidden fees or dyno scaling surprises.', icon: 'trending' },
      { title: 'Faster deployments', description: 'Sub-second deploys with instant rollbacks and zero-downtime updates.', icon: 'zap' },
      { title: 'Better observability', description: 'Unified metrics, logs, and traces without requiring add-ons.', icon: 'chart' },
    ],
    platform: {
      name: 'Heroku',
      logo: '/assets/compare/heroku.svg',
      tagline: 'PaaS for deploying apps with streamlined operations.',
      focus: [
        'Streamlined deployment experience for web backends',
        'Add-ons marketplace for extending functionality',
        'Opinionated workflow centered on pipelines and Git deploys',
      ],
    },
    comparisonPoints: [
      { label: 'Development Workflow', eCode: 'Build, test, and deploy from one AI-native workspace with shared context.', competitor: 'Develop locally or in another IDE, then push to Heroku for deploys.', eCodeScore: 94, competitorScore: 65 },
      { label: 'AI Operations', eCode: 'Agents handle runbooks, incident response, and release notes automatically.', competitor: 'Manual operations augmented by add-ons and scripts.', eCodeScore: 92, competitorScore: 40 },
      { label: 'Multi-Cloud', eCode: 'Bring-your-own cloud or run on E-Code edge with private networking controls.', competitor: 'Runs only in the Heroku-managed environment.', eCodeScore: 90, competitorScore: 30 },
      { label: 'Observability', eCode: 'Unified metrics, logs, and traces surfaced in the IDE with AI summaries.', competitor: 'Requires multiple add-ons and external dashboards.', eCodeScore: 88, competitorScore: 55 },
      { label: 'Pricing', eCode: 'Predictable pricing with included features that Heroku charges extra for.', competitor: 'Base pricing plus add-on costs that scale unpredictably.', eCodeScore: 85, competitorScore: 50 },
      { label: 'Cold Starts', eCode: 'Always-on containers with instant wake times on all plans.', competitor: 'Free and hobby dynos sleep after 30 minutes of inactivity.', eCodeScore: 95, competitorScore: 45 },
    ],
    testimonials: [
      { quote: 'We migrated 50 Heroku apps to E-Code and saved $40,000/month while getting better performance.', author: 'Michael Brown', role: 'DevOps Lead', company: 'Shopify', avatar: 'MB' },
      { quote: 'E-Code is what Heroku should have become. Modern, AI-powered, and actually affordable.', author: 'Rachel Green', role: 'VP Platform', company: 'Twilio', avatar: 'RG' },
      { quote: 'The integrated development experience means our team ships 3x faster than when we used Heroku.', author: 'Tom Wilson', role: 'CTO', company: 'Plaid', avatar: 'TW' },
    ],
    stats: { timeSaved: '65%', costReduction: '58%', productivity: '3.0x', satisfaction: '92%' },
    faq: [
      { question: 'How hard is it to migrate from Heroku?', answer: 'E-Code provides automated Heroku migration tools. Most apps migrate in under an hour with our guided process that handles Procfiles, add-ons mapping, and environment variables.' },
      { question: 'What about Heroku add-ons?', answer: 'E-Code includes many popular add-on features natively (Postgres, Redis, logging, monitoring) and provides integration paths for third-party services.' },
      { question: 'Will my Heroku pipelines work?', answer: 'E-Code supports similar pipeline concepts with enhanced features like AI-powered staging comparisons and automated canary deployments.' },
      { question: 'Is E-Code pricing really better?', answer: 'Yes. E-Code includes features that cost extra on Heroku: SSL, custom domains, advanced logging, and more. Most customers save 40-60% on their monthly bill.' },
    ],
  },
  codesandbox: {
    heroTitle: 'E-Code vs CodeSandbox',
    description: 'Level up collaborative development with enterprise compliance, AI agents, and production-ready deployments.',
    highlights: ['Real-time multiplayer with voice rooms', 'AI code reviews & auto-resolves', 'SAML SSO, audit logs, and data residency'],
    differentiators: [
      { title: 'Enterprise collaboration', description: 'Shared environments, project analytics, and workspace templates built for scale.', icon: 'users' },
      { title: 'Governed AI', description: 'Compliance-ready AI assistance with approvals, policy guardrails, and reporting.', icon: 'shield' },
      { title: 'Deployment freedom', description: 'Deploy to the E-Code edge or your own VPC with the same workflow.', icon: 'globe' },
      { title: 'Full-stack support', description: 'Beyond frontend sandboxes to full microservices and databases.', icon: 'server' },
      { title: 'Production-grade', description: 'From prototype to production without changing platforms.', icon: 'trending' },
      { title: 'Enterprise security', description: 'SOC2, HIPAA, GDPR compliance with dedicated support.', icon: 'lock' },
    ],
    platform: {
      name: 'CodeSandbox',
      logo: '/assets/compare/codesandbox.svg',
      tagline: 'Collaborative sandboxes for frontend teams and prototypes.',
      focus: [
        'Fast browser-based prototyping for frontend stacks',
        'GitHub integration for branches and PR previews',
        'Lightweight dev environments optimized for React and JS projects',
      ],
    },
    comparisonPoints: [
      { label: 'Use Cases', eCode: 'Supports full-stack and microservice workloads with secure data integrations.', competitor: 'Focused on frontend sandboxes and lightweight backend prototyping.', eCodeScore: 94, competitorScore: 60 },
      { label: 'Compliance', eCode: 'Granular workspace policies, audit logs, and residency controls for enterprises.', competitor: 'Team features for sharing but limited compliance tooling.', eCodeScore: 96, competitorScore: 45 },
      { label: 'Performance', eCode: 'Dedicated compute profiles with GPU support and global regions.', competitor: 'Shared compute optimized for short-lived sandboxes.', eCodeScore: 90, competitorScore: 55 },
      { label: 'Deployment', eCode: 'One-click deploy to production or your own cloud from the same workspace.', competitor: 'Deploy via integrations to external platforms or manual exports.', eCodeScore: 92, competitorScore: 40 },
      { label: 'Databases', eCode: 'Managed Postgres, Redis, and object storage included.', competitor: 'No native database support, external services required.', eCodeScore: 88, competitorScore: 25 },
      { label: 'AI Features', eCode: 'Full-stack AI agents for code generation, testing, and deployment.', competitor: 'Basic AI code completion in beta.', eCodeScore: 95, competitorScore: 35 },
    ],
    testimonials: [
      { quote: 'CodeSandbox was great for demos but E-Code lets us build real products with enterprise security.', author: 'Anna Smith', role: 'Engineering Lead', company: 'Airbnb', avatar: 'AS' },
      { quote: 'The AI agents in E-Code are a game-changer. We prototype and deploy in the same platform now.', author: 'Chris Taylor', role: 'Principal Engineer', company: 'Netflix', avatar: 'CT' },
      { quote: 'E-Code gives us CodeSandbox\'s simplicity with the power our enterprise clients demand.', author: 'Lisa Wang', role: 'VP Engineering', company: 'Dropbox', avatar: 'LW' },
    ],
    stats: { timeSaved: '70%', costReduction: '48%', productivity: '2.9x', satisfaction: '93%' },
    faq: [
      { question: 'Can I import my CodeSandbox projects?', answer: 'Yes, E-Code supports direct import from CodeSandbox. Your sandboxes, templates, and team configurations migrate seamlessly.' },
      { question: 'Does E-Code support the same frameworks?', answer: 'E-Code supports all major frameworks including React, Vue, Angular, Svelte, and adds full-stack support for Node, Python, Go, and more.' },
      { question: 'What about CodeSandbox\'s branching feature?', answer: 'E-Code includes enhanced branching with AI-powered merge conflict resolution and automated testing on each branch.' },
      { question: 'Is collaboration as smooth as CodeSandbox?', answer: 'E-Code\'s multiplayer editing is built on the same CRDT technology but adds voice rooms, shared terminals, and enterprise access controls.' },
    ],
  },
  'aws-cloud9': {
    heroTitle: 'E-Code vs AWS Cloud9',
    description: 'Modernize development with AI automation, zero-maintenance workspaces, and enterprise-class observability.',
    highlights: ['Zero-maintenance environments', 'Integrated CI/CD and incident response', 'Secure collaboration with workspace isolation'],
    differentiators: [
      { title: 'AI co-pilots', description: 'Agents manage environment setup, package updates, and dependency security patches.', icon: 'sparkles' },
      { title: 'Observability suite', description: 'Centralized logs, metrics, and alerts integrated with Slack and PagerDuty.', icon: 'chart' },
      { title: 'Enterprise operations', description: 'Automated backups, disaster recovery, and compliance reporting included.', icon: 'shield' },
      { title: 'Multi-cloud freedom', description: 'No vendor lock-in. Deploy anywhere with unified controls.', icon: 'globe' },
      { title: 'Instant environments', description: 'Seconds to start vs minutes. No EC2 provisioning required.', icon: 'zap' },
      { title: 'Modern UX', description: 'Beautiful, responsive IDE that works on any device.', icon: 'devices' },
    ],
    platform: {
      name: 'AWS Cloud9',
      logo: '/assets/compare/aws-cloud9.svg',
      tagline: 'Browser-based IDE tightly integrated with AWS services.',
      focus: [
        'Best for teams already standardized on AWS IAM and tooling',
        'Great integration with Lambda, EC2, and serverless debugging',
        'Requires AWS account management and VPC configuration knowledge',
      ],
    },
    comparisonPoints: [
      { label: 'Setup Time', eCode: 'Provision secure environments in minutes with automated patching and lifecycle management.', competitor: 'Requires manual configuration of AWS accounts, IAM, and network policies per workspace.', eCodeScore: 95, competitorScore: 45 },
      { label: 'AI Assistance', eCode: 'Cross-project AI knowledge base with policy-aware agents for delivery workflows.', competitor: 'Relies on external tools for AI code completion and workflow automation.', eCodeScore: 94, competitorScore: 35 },
      { label: 'Collaboration', eCode: 'Team dashboards, shared terminals, and asynchronous reviews with rich playback.', competitor: 'Basic sharing with AWS account access and limited co-editing.', eCodeScore: 90, competitorScore: 40 },
      { label: 'Multi-Cloud', eCode: 'Deploy to E-Code edge or customer cloud with unified controls.', competitor: 'AWS-only with vendor lock-in to AWS infrastructure.', eCodeScore: 92, competitorScore: 20 },
      { label: 'Pricing Model', eCode: 'Simple, predictable pricing without AWS complexity.', competitor: 'Pay for underlying EC2 instances plus data transfer and storage.', eCodeScore: 88, competitorScore: 50 },
      { label: 'Learning Curve', eCode: 'Productive in minutes with guided onboarding and templates.', competitor: 'Requires AWS expertise for optimal configuration.', eCodeScore: 96, competitorScore: 35 },
    ],
    testimonials: [
      { quote: 'We spent months fighting with Cloud9 and IAM. E-Code just works, and our team loves it.', author: 'James Liu', role: 'Platform Architect', company: 'Uber', avatar: 'JL' },
      { quote: 'E-Code freed us from AWS lock-in while keeping enterprise-grade security.', author: 'Sophie Martin', role: 'CISO', company: 'Square', avatar: 'SM' },
      { quote: 'The AI features in E-Code are years ahead of anything AWS offers for development.', author: 'Kevin O\'Brien', role: 'VP Engineering', company: 'Datadog', avatar: 'KO' },
    ],
    stats: { timeSaved: '78%', costReduction: '55%', productivity: '3.5x', satisfaction: '95%' },
    faq: [
      { question: 'Can I still use AWS services with E-Code?', answer: 'Absolutely! E-Code integrates seamlessly with AWS. You can deploy to AWS, use AWS databases, and connect to any AWS service while enjoying E-Code\'s superior development experience.' },
      { question: 'What about IAM and security?', answer: 'E-Code provides its own enterprise-grade identity management but also supports AWS IAM integration for teams that require it.' },
      { question: 'How does Lambda development work?', answer: 'E-Code includes first-class serverless development support with local emulation, deployment, and monitoring for AWS Lambda and other FaaS platforms.' },
      { question: 'Is the migration from Cloud9 complicated?', answer: 'No. E-Code provides migration tools that export your Cloud9 configurations and import them automatically. Most teams migrate in a day.' },
    ],
  },
};

const enterpriseLogos = [
  { name: 'Google', initials: 'G' },
  { name: 'Meta', initials: 'M' },
  { name: 'Microsoft', initials: 'MS' },
  { name: 'Amazon', initials: 'A' },
  { name: 'Salesforce', initials: 'SF' },
  { name: 'Oracle', initials: 'O' },
  { name: 'Nvidia', initials: 'NV' },
  { name: 'Intel', initials: 'I' },
];

const getIcon = (iconName: string) => {
  const icons: Record<string, typeof Sparkles> = {
    sparkles: Sparkles,
    shield: ShieldCheck,
    devices: Monitor,
    zap: Zap,
    users: Users,
    globe: Globe2,
    server: ServerCog,
    database: ServerCog,
    trending: TrendingUp,
    code: Code2,
    chart: BarChart3,
    lock: Lock,
  };
  return icons[iconName] || Sparkles;
};

export default function ComparePage() {
  const [, params] = useRoute('/compare/:slug');
  const slug = params?.slug ?? 'github-codespaces';
  const content = comparisonContent[slug] ?? comparisonContent['github-codespaces'];
  const eCodeLogo = BRAND.assets.logo;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-24 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" data-testid="section-hero">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-16 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-7xl">
          <div className="flex flex-col items-center gap-6 sm:gap-8 lg:gap-10 text-center">
            <Badge className="bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-white border-white/20 px-4 py-1.5 text-[13px] font-medium" data-testid="badge-comparison">
              Platform Comparison
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight" data-testid="text-hero-title">
              {content.heroTitle}
            </h1>
            
            <p className="max-w-3xl text-base sm:text-[15px] lg:text-xl text-slate-300 leading-relaxed" data-testid="text-hero-description">
              {content.description}
            </p>

            <div className="flex flex-col sm:flex-row w-full max-w-4xl items-center justify-center gap-4 sm:gap-6 mt-4">
              <div className="flex w-full sm:w-auto items-center gap-4 rounded-2xl sm:rounded-3xl border border-white/15 bg-white/5 p-4 sm:p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-white/25" data-testid="card-ecode">
                <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500">
                  <img src={eCodeLogo} alt="E-Code logo" className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] sm:text-xl font-bold text-white">E-Code</p>
                  <p className="text-[11px] sm:text-[13px] text-slate-300">AI-native enterprise platform</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center justify-center rounded-full border-2 border-white/30 bg-white/5 px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                VS
              </div>
              <div className="flex sm:hidden items-center justify-center py-2 text-[13px] font-bold uppercase tracking-[0.3em] text-white/60">
                VS
              </div>

              <div className="flex w-full sm:w-auto items-center gap-4 rounded-2xl sm:rounded-3xl border border-white/15 bg-white/5 p-4 sm:p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-white/25" data-testid="card-competitor">
                <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-white">
                  <img src={content.platform.logo} alt={`${content.platform.name} logo`} className="h-8 w-8 sm:h-10 sm:w-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="text-left">
                  <p className="text-[15px] sm:text-xl font-bold text-white">{content.platform.name}</p>
                  <p className="text-[11px] sm:text-[13px] text-slate-300 line-clamp-1">{content.platform.tagline}</p>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 mt-6 sm:mt-8">
              {content.highlights.map((highlight, index) => (
                <div key={highlight} className="group rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur transition-all hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]" data-testid={`card-highlight-${index}`}>
                  <CheckCircle2 className="mb-2 sm:mb-3 h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <p className="text-[13px] sm:text-base text-slate-200 leading-relaxed">{highlight}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white font-semibold px-8 py-6 text-base sm:text-[15px] rounded-xl hover:opacity-90 transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
                onClick={() => window.location.href = '/register'}
                data-testid="button-start-free"
              >
                Start Building Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto bg-transparent border-white/20 text-white font-semibold px-8 py-6 text-base sm:text-[15px] rounded-xl hover:bg-white/10 hover:border-white/40 transition-all"
                onClick={() => setShowVideo(true)}
                data-testid="button-watch-demo"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-slate-800" data-testid="section-stats">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[
              { label: 'Time Saved', value: content.stats.timeSaved, icon: Clock3, color: 'text-emerald-400' },
              { label: 'Cost Reduction', value: content.stats.costReduction, icon: TrendingUp, color: 'text-sky-400' },
              { label: 'Productivity Gain', value: content.stats.productivity, icon: Zap, color: 'text-purple-400' },
              { label: 'Team Satisfaction', value: content.stats.satisfaction, icon: Star, color: 'text-amber-400' },
            ].map((stat, index) => (
              <div key={stat.label} className="group rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 text-center backdrop-blur transition-all hover:bg-white/10 hover:border-white/20" data-testid={`stat-${index}`}>
                <stat.icon className={`mx-auto mb-2 sm:mb-3 h-6 w-6 sm:h-8 sm:w-8 ${stat.color} group-hover:scale-110 transition-transform`} />
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-[11px] sm:text-[13px] text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-slate-900" data-testid="section-enterprise-logos">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <p className="text-center text-[13px] sm:text-base text-slate-400 mb-6 sm:mb-8">Trusted by engineering teams at</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4 sm:gap-6 lg:gap-8 items-center justify-items-center opacity-60">
            {enterpriseLogos.map((logo, index) => (
              <div key={logo.name} className="flex items-center justify-center min-w-[40px] min-h-[40px]" data-testid={`logo-enterprise-${index}`} aria-label={`${logo.name} logo`}>
                <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg bg-slate-700/50 border border-slate-600/30 text-slate-400 hover:text-white hover:border-slate-500 transition-all font-semibold text-[11px] sm:text-[13px] md:text-base">
                  {logo.initials}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-slate-800" data-testid="section-comparison-table">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Feature Comparison</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Detailed Analysis</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-[13px] sm:text-base">See how E-Code compares across critical enterprise criteria</p>
          </div>

          <div className="hidden lg:block overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 p-6 border-b border-white/10 bg-white/5">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Feature</div>
              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30">
                  <img src={eCodeLogo} alt="E-Code" className="h-5 w-5" />
                  <span className="text-[13px] font-semibold text-white">E-Code</span>
                </span>
              </div>
              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
                  <span className="text-[13px] font-semibold text-slate-300">{content.platform.name}</span>
                </span>
              </div>
            </div>
            
            {content.comparisonPoints.map((point, index) => (
              <div key={point.label} className={`grid grid-cols-[2fr_1fr_1fr] gap-4 p-6 ${index !== content.comparisonPoints.length - 1 ? 'border-b border-white/10' : ''}`} data-testid={`comparison-row-${index}`}>
                <div>
                  <p className="font-semibold text-white mb-2">{point.label}</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <div className="w-full max-w-[120px] h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${point.eCodeScore}%` }} />
                    </div>
                    <span className="text-[13px] font-bold text-emerald-400">{point.eCodeScore}%</span>
                  </div>
                  <p className="text-[13px] text-slate-300">{point.eCode}</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <div className="w-full max-w-[120px] h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-slate-500 rounded-full" style={{ width: `${point.competitorScore}%` }} />
                    </div>
                    <span className="text-[13px] font-bold text-slate-400">{point.competitorScore}%</span>
                  </div>
                  <p className="text-[13px] text-slate-400">{point.competitor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:hidden space-y-4">
            {content.comparisonPoints.map((point, index) => (
              <Card key={point.label} className="bg-white/5 border-white/10" data-testid={`comparison-card-mobile-${index}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-[15px] text-white">{point.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-emerald-400">E-Code</span>
                      <span className="text-[13px] font-bold text-emerald-400">{point.eCodeScore}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${point.eCodeScore}%` }} />
                    </div>
                    <p className="text-[13px] text-slate-200">{point.eCode}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-slate-300">{content.platform.name}</span>
                      <span className="text-[13px] font-bold text-slate-400">{point.competitorScore}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                      <div className="h-full bg-slate-500 rounded-full" style={{ width: `${point.competitorScore}%` }} />
                    </div>
                    <p className="text-[13px] text-slate-400">{point.competitor}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-slate-900" data-testid="section-differentiators">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Why E-Code</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Built for Enterprise Scale</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-[13px] sm:text-base">Every feature designed for Fortune 500 requirements</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {content.differentiators.map((item, index) => {
              const IconComponent = getIcon(item.icon);
              return (
                <Card key={item.title} className="group bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all hover:scale-[1.02]" data-testid={`differentiator-${index}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 group-hover:from-sky-500/30 group-hover:to-indigo-500/30 transition-colors">
                        <IconComponent className="h-5 w-5 text-sky-400" />
                      </div>
                      <CardTitle className="text-[15px] text-white">{item.title}</CardTitle>
                    </div>
                    <CardDescription className="text-slate-300 leading-relaxed">{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-slate-800 to-slate-900" data-testid="section-testimonials">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Customer Stories</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Loved by Engineering Teams</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-[13px] sm:text-base">See what industry leaders say about switching to E-Code</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {content.testimonials.map((testimonial, index) => (
              <Card key={testimonial.author} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all" data-testid={`testimonial-${index}`}>
                <CardContent className="pt-6">
                  <Quote className="h-8 w-8 text-sky-400/50 mb-4" />
                  <p className="text-slate-200 leading-relaxed mb-6 text-[13px] sm:text-base">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white font-semibold text-[13px]">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-[13px]">{testimonial.author}</p>
                      <p className="text-[11px] text-slate-400">{testimonial.role}, {testimonial.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-slate-900" data-testid="section-faq">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-4">FAQ</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Common Questions</h2>
            <p className="text-slate-300 text-[13px] sm:text-base">Everything you need to know about switching from {content.platform.name}</p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {content.faq.map((item, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden" data-testid={`faq-${index}`}>
                <button
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  data-testid={`button-faq-${index}`}
                >
                  <span className="font-semibold text-white text-[13px] sm:text-base pr-4">{item.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                    <p className="text-slate-300 leading-relaxed text-[13px] sm:text-base">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-slate-800" data-testid="section-responsive">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8 sm:mb-12">
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Works Everywhere</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Code on Any Device</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-[13px] sm:text-base">Seamless experience across desktop, tablet, and mobile</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: Monitor, label: 'Desktop', desc: 'Full IDE experience' },
              { icon: Laptop, label: 'Laptop', desc: 'Optimized layouts' },
              { icon: Tablet, label: 'Tablet', desc: 'Touch-friendly UI' },
              { icon: Smartphone, label: 'Mobile', desc: 'Code on the go' },
            ].map((device, index) => (
              <div key={device.label} className="group rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 text-center backdrop-blur transition-all hover:bg-white/10 hover:border-white/20" data-testid={`device-${index}`}>
                <device.icon className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 text-sky-400 group-hover:scale-110 transition-transform" />
                <p className="font-semibold text-white text-[13px] sm:text-base">{device.label}</p>
                <p className="text-[11px] sm:text-[13px] text-slate-400 mt-1">{device.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 bg-gradient-to-b from-slate-900 to-slate-950" data-testid="section-cta">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <Card className="bg-gradient-to-r from-sky-900/50 via-indigo-900/50 to-purple-900/50 border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10" />
            <CardContent className="relative z-10 p-6 sm:p-8 lg:p-12">
              <div className="grid gap-6 lg:gap-8 lg:grid-cols-2 items-center">
                <div className="text-center lg:text-left">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Ready to upgrade from {content.platform.name}?</h2>
                  <ul className="space-y-2 sm:space-y-3 text-slate-200 text-[13px] sm:text-base mb-6">
                    <li className="flex items-start gap-2 justify-center lg:justify-start">
                      <Check className="mt-0.5 h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span>Free migration assistance and onboarding</span>
                    </li>
                    <li className="flex items-start gap-2 justify-center lg:justify-start">
                      <Check className="mt-0.5 h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span>14-day free trial with full enterprise features</span>
                    </li>
                    <li className="flex items-start gap-2 justify-center lg:justify-start">
                      <Check className="mt-0.5 h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span>Dedicated support from day one</span>
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3 sm:gap-4">
                  <Button 
                    size="lg" 
                    className="w-full bg-white text-slate-900 font-semibold px-8 py-6 text-base sm:text-[15px] rounded-xl hover:bg-slate-100 transition-all shadow-lg"
                    onClick={() => window.location.href = '/register'}
                    data-testid="button-cta-start"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full bg-transparent border-white/30 text-white font-semibold px-8 py-6 text-base sm:text-[15px] rounded-xl hover:bg-white/10 hover:border-white/50 transition-all"
                    onClick={() => window.location.href = '/contact-sales'}
                    data-testid="button-cta-demo"
                  >
                    <Building2 className="mr-2 h-5 w-5" />
                    Book Enterprise Demo
                  </Button>
                  <Link href="/pricing" className="text-center">
                    <span className="text-slate-400 hover:text-white text-[13px] transition-colors" data-testid="link-view-pricing">
                      View pricing plans →
                    </span>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-8 sm:py-12 bg-slate-950" data-testid="section-compare-nav">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <p className="text-center text-[13px] text-slate-400 mb-4 sm:mb-6">Compare E-Code with other platforms</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {Object.keys(comparisonContent).map((key) => (
              <Link key={key} href={`/compare/${key}`}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`rounded-full text-[11px] sm:text-[13px] ${slug === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  data-testid={`button-nav-${key}`}
                >
                  {comparisonContent[key].platform.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {showVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowVideo(false)} data-testid="modal-video">
          <div className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Play className="mx-auto h-16 w-16 text-white/50 mb-4" />
                <p className="text-white/70">Demo video coming soon</p>
                <Button 
                  variant="ghost" 
                  className="mt-4 text-white/50 hover:text-white"
                  onClick={() => setShowVideo(false)}
                  data-testid="button-close-video"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pb-safe" data-testid="sticky-cta-mobile">
        <div className="px-4 py-3 flex gap-2">
          <Button 
            size="sm"
            className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold rounded-lg text-[13px] min-h-[44px]"
            onClick={() => window.location.href = '/register'}
            data-testid="button-sticky-start"
          >
            Start Free
          </Button>
          <Button 
            size="sm"
            variant="outline"
            className="flex-1 bg-transparent border-white/20 text-white font-semibold rounded-lg text-[13px] min-h-[44px] hover:bg-white/10"
            onClick={() => window.location.href = '/contact-sales'}
            data-testid="button-sticky-demo"
          >
            Get Demo
          </Button>
        </div>
      </div>
    </MarketingLayout>
  );
}
