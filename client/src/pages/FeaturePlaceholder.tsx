import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, ShieldCheck, Clock3, Bell, CheckCircle, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

type FeatureStatus = 'coming_soon' | 'beta' | 'available' | 'enterprise_only';

const featureCopy: Record<string, {
  title: string;
  subtitle: string;
  summary: string;
  highlights: string[];
  status: FeatureStatus;
  alternativeRoute?: string;
  estimatedDate?: string;
}> = {
  assistant: {
    title: 'AI Assistant',
    subtitle: 'Conversational development copilot',
    summary: 'Ask questions about your codebase, auto-generate documentation, and unblock your teams with contextual intelligence.',
    highlights: ['Understands your repository, tests, and deployments', 'Enterprise controls with audit trails and policy guardrails', 'Available across web, mobile, and desktop apps'],
    status: 'available',
    alternativeRoute: '/ide',
  },
  database: {
    title: 'Managed Database Studio',
    subtitle: 'Command the data layer with zero friction',
    summary: 'Provision, manage, and observe your databases with AI-assisted migrations, schema visualizations, and performance insights.',
    highlights: ['AI-assisted migration planning', 'Automated backups and failover', 'Integrated query insights and alerts'],
    status: 'beta',
    estimatedDate: 'Q1 2025',
  },
  console: {
    title: 'Command Console',
    subtitle: 'Secure shell, logs, and observability in one place',
    summary: 'Gain instant access to runtime logs, shell access, and metrics dashboards through a unified console experience.',
    highlights: ['Role-based access for operations teams', 'Full audit history of shell sessions', 'Deep links into traces and deployments'],
    status: 'available',
    alternativeRoute: '/ide',
  },
  authentication: {
    title: 'Authentication Hub',
    subtitle: 'Streamlined auth experiences for every app',
    summary: 'Integrate SSO, passwordless login, and social sign-on with built-in compliance controls.',
    highlights: ['Supports SAML, OIDC, and passwordless flows', 'Centralized policy management and analytics', 'Fully branded experiences and user lifecycle automations'],
    status: 'available',
    alternativeRoute: '/settings',
  },
  preview: {
    title: 'Preview Environments',
    subtitle: 'On-demand environments for every change',
    summary: 'Spin up secure preview environments with generated fixtures, QA checklists, and collaboration tools.',
    highlights: ['Automatic URL for every pull request', 'AI generated test plans and review summaries', 'Usage analytics and tear-down scheduling'],
    status: 'coming_soon',
    estimatedDate: 'Q2 2025',
  },
  agent: {
    title: 'Agent Control Center',
    subtitle: 'Manage, govern, and monitor your AI agents',
    summary: 'Operationalize AI in production with real-time observability, approval workflows, and safety checks.',
    highlights: ['Fine-grained permissions and scopes', 'Live session replay and analytics', 'Policy and compliance automation'],
    status: 'available',
    alternativeRoute: '/ide',
  },
  'code-search': {
    title: 'Code Search',
    subtitle: 'Semantic search across every repository',
    summary: 'Discover patterns, anti-patterns, and reusable components with AI-powered insights across your codebase.',
    highlights: ['Natural language queries with vector search', 'Compliance and license filters', 'Cross-language understanding'],
    status: 'beta',
    estimatedDate: 'Q1 2025',
  },
  packages: {
    title: 'Package Intelligence',
    subtitle: 'Safe dependencies at enterprise scale',
    summary: 'Audit vulnerabilities, licenses, and supply-chain risks with automated remediation workflows.',
    highlights: ['Continuous CVE monitoring and auto-patches', 'Policy-driven approvals', 'SBOM exports and compliance reports'],
    status: 'coming_soon',
    estimatedDate: 'Q2 2025',
  },
  extensions: {
    title: 'Extensions Marketplace',
    subtitle: 'Curate private integrations and workflows',
    summary: 'Bring your toolchain directly into the workspace with vetted, secure extensions tailored to your teams.',
    highlights: ['Private marketplace support', 'Role and permission aware extensions', 'Lifecycle management and analytics'],
    status: 'coming_soon',
    estimatedDate: 'Q3 2025',
  },
  integrations: {
    title: 'Integration Hub',
    subtitle: 'Connect your ecosystem in minutes',
    summary: 'Prebuilt connectors for CI/CD, observability, support, and data services with centralized governance.',
    highlights: ['200+ enterprise integrations', 'Granular secrets management', 'Event streaming and webhooks'],
    status: 'beta',
    estimatedDate: 'Q1 2025',
  },
  networking: {
    title: 'Networking Control Plane',
    subtitle: 'Secure connectivity for hybrid deployments',
    summary: 'Control ingress, egress, and private connectivity with fine-grained policies and observability.',
    highlights: ['Private networking and VPC peering', 'Zero-trust access policies', 'Global traffic management'],
    status: 'enterprise_only',
  },
  problems: {
    title: 'Issue Intelligence',
    subtitle: 'Proactively resolve incidents with AI triage',
    summary: 'Detect, prioritize, and resolve incidents using AI-driven root-cause analysis and recommended playbooks.',
    highlights: ['Noise reduction with ML-based correlation', 'Automated postmortem generation', 'Workflow integrations with PagerDuty and Jira'],
    status: 'coming_soon',
    estimatedDate: 'Q2 2025',
  },
  'kv-store': {
    title: 'Distributed KV Store',
    subtitle: 'Ultra-fast key-value storage for serverless apps',
    summary: 'Provision globally available KV storage with built-in replication, caching, and analytics.',
    highlights: ['Low-latency global reads and writes', 'Auto-scaling with zero maintenance', 'Audit logging and TTL policies'],
    status: 'coming_soon',
    estimatedDate: 'Q2 2025',
  },
  shell: {
    title: 'Secure Shell',
    subtitle: 'Production-grade terminal in the browser',
    summary: 'Give teams audited, role-aware shell access without exposing infrastructure keys.',
    highlights: ['Session recording and approvals', 'Just-in-time credentials', 'Command policy enforcement'],
    status: 'available',
    alternativeRoute: '/ide',
  },
  threads: {
    title: 'Collaboration Threads',
    subtitle: 'Async conversations anchored to your code',
    summary: 'Embed discussions, reviews, and decisions directly in the workspace for transparent knowledge sharing.',
    highlights: ['Attach to files, lines, or deployments', 'AI summaries and next steps', 'Integrations with Slack and Teams'],
    status: 'coming_soon',
    estimatedDate: 'Q3 2025',
  },
  vnc: {
    title: 'Visual Workspace',
    subtitle: 'Graphical access to managed environments',
    summary: 'Secure browser-based desktop for design tooling, data visualization, and legacy workflows.',
    highlights: ['Pixel-perfect streaming performance', 'Policy-controlled clipboard and downloads', 'Session analytics and compliance logging'],
    status: 'enterprise_only',
  },
  referrals: {
    title: 'Referral Hub',
    subtitle: 'Reward your network for building on E-Code',
    summary: 'Launch global referral campaigns with transparent tracking, insights, and flexible incentives.',
    highlights: ['Customizable incentive structures', 'Real-time performance dashboards', 'Automated payouts and compliance'],
    status: 'coming_soon',
    estimatedDate: 'Q2 2025',
  },
  'teams/new': {
    title: 'Team Launchpad',
    subtitle: 'Spin up new teams with enterprise guardrails',
    summary: 'Template onboarding, permissions, and workspace configuration for new teams in minutes.',
    highlights: ['Automated workspace provisioning', 'Policy-based permission templates', 'Analytics on activation and usage'],
    status: 'beta',
    alternativeRoute: '/teams',
    estimatedDate: 'Q1 2025',
  },
};

interface FeaturePlaceholderProps {
  featureKey: string;
}

const statusConfig: Record<FeatureStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Available Now', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
  beta: { label: 'Beta', color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
  coming_soon: { label: 'Coming Soon', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  enterprise_only: { label: 'Enterprise Only', color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
};

export default function FeaturePlaceholder({ featureKey }: FeaturePlaceholderProps) {
  const copy = featureCopy[featureKey] ?? featureCopy.assistant;
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const statusInfo = statusConfig[copy.status];

  const handleNotifyMe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/feature-interest', {
        email,
        featureKey,
        featureTitle: copy.title,
      });
      setIsSubscribed(true);
      toast({
        title: "You're on the list!",
        description: `We'll notify you when ${copy.title} becomes available.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to register interest. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-responsive py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="text-center space-y-4">
          <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border`} data-testid="badge-feature-status">
            {statusInfo.label}
            {copy.estimatedDate && copy.status !== 'available' && ` - ${copy.estimatedDate}`}
          </Badge>
          <h1 className="text-4xl font-semibold text-white" data-testid="text-feature-title">{copy.title}</h1>
          <p className="text-[15px] text-slate-300">{copy.subtitle}</p>
          <p className="mx-auto max-w-3xl text-slate-300 leading-relaxed">{copy.summary}</p>
          
          {copy.status === 'available' && copy.alternativeRoute && (
            <div className="pt-4">
              <Link href={copy.alternativeRoute}>
                <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600" data-testid="button-go-to-feature">
                  <ArrowRight className="h-4 w-4" />
                  Go to {copy.title}
                </Button>
              </Link>
            </div>
          )}
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {copy.highlights.map((highlight, index) => (
            <Card key={highlight} className="bg-white/5 border-white/10" data-testid={`card-highlight-${index}`}>
              <CardHeader className="flex items-start gap-3">
                <div className="rounded-full bg-white/10 p-3 text-sky-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <CardTitle className="text-base text-white leading-relaxed">{highlight}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {copy.status !== 'available' && (
          <Card className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-white/10">
            <CardContent className="grid gap-8 py-10 sm:grid-cols-2">
              <div className="space-y-3">
                <CardTitle className="text-2xl text-white">
                  {copy.status === 'enterprise_only' ? 'Enterprise access' : 'Get notified'}
                </CardTitle>
                <CardDescription className="text-slate-300">
                  {copy.status === 'enterprise_only'
                    ? 'This feature is available exclusively for enterprise customers. Contact our sales team to learn more.'
                    : copy.status === 'beta'
                    ? 'Join the beta program to get early access and help shape the product.'
                    : "Be the first to know when this feature launches. We'll send you an email notification."}
                </CardDescription>
              </div>
              <div className="space-y-3">
                {copy.status === 'enterprise_only' ? (
                  <>
                    <Link href="/contact-sales">
                      <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white" data-testid="button-contact-sales">
                        Contact Sales
                      </Button>
                    </Link>
                    <Link href="/enterprise">
                      <Button variant="outline" className="w-full border-white/20 text-slate-100 hover:text-white" data-testid="button-enterprise-info">
                        Learn about Enterprise
                      </Button>
                    </Link>
                  </>
                ) : isSubscribed ? (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-emerald-500/20 text-emerald-300" data-testid="text-subscribed-success">
                    <CheckCircle className="h-5 w-5" />
                    <span>You will be notified when {copy.title} launches!</span>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                        data-testid="input-notify-email"
                      />
                      <Button
                        onClick={handleNotifyMe}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white shrink-0"
                        data-testid="button-notify-me"
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                    </div>
                    {copy.status === 'beta' && (
                      <Link href="/contact-sales">
                        <Button variant="outline" className="w-full border-white/20 text-slate-100 hover:text-white" data-testid="button-request-beta">
                          Request beta access
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 sm:grid-cols-3">
          {[{
            title: 'Security by default',
            description: 'SOC2 Type II controls, audit logging, and fine-grained RBAC protect every action.',
          }, {
            title: 'Accelerated delivery',
            description: 'AI guided workflows remove busywork so teams can focus on strategic initiatives.',
          }, {
            title: 'Operational confidence',
            description: 'Real-time insights keep stakeholders aligned with progress and impact.',
          }].map((item, index) => (
            <Card key={item.title} className="bg-white/5 border-white/10" data-testid={`card-benefit-${index}`}>
              <CardHeader>
                <CardTitle className="text-[15px] text-white">{item.title}</CardTitle>
                <CardDescription className="text-slate-300 leading-relaxed">{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-[13px] text-slate-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-slate-200">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <span>Enterprise roadmap partner program</span>
            </div>
            <div className="flex items-center gap-3 text-slate-200">
              <Clock3 className="h-5 w-5 text-sky-300" />
              <span>Priority onboarding and support SLAs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
