import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight,
  Book,
  Bot,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Users
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface DocAction {
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  articleKey?: DocKey;
  href?: string;
  external?: boolean;
}

interface DocArticle {
  title: string;
  summary: string;
  lastUpdated: string;
  content: ReactNode;
  keywords?: string[];
  actions?: DocAction[];
}

type DocKey =
  | 'overview'
  | 'workspace'
  | 'ai'
  | 'collaboration'
  | 'projects'
  | 'deployments'
  | 'runtimes'
  | 'security'
  | 'support'
  | 'api';

interface DocSection {
  id: string;
  name: string;
  title: string;
  icon: ReactNode;
  items: Array<{ key: DocKey; label: string; description?: string }>;
}

const documentationArticles: Record<DocKey, DocArticle> = {
  overview: {
    title: 'Platform overview',
    summary:
      'How the full-stack E-Code platform stitches together the React client, Express API, workspace runtimes, and governance services.',
    lastUpdated: 'February 18, 2025',
    keywords: ['architecture', 'express', 'react', 'postgres', 'overview', 'single-port'],
    content: (
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What ships with the platform</h2>
          <p>
            E-Code combines a Vite-powered React client with an Express API that
            proxies long-lived WebSocket connections, orchestrates runtime containers, and exposes deployment tooling. Persistent
            data is stored in PostgreSQL via Drizzle ORM migrations.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Unified experience</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                A single-page client routes authenticated users through the dashboard, project editor, deployments, AI studio, and
                admin surfaces using <code>wouter</code> for navigation.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Single-port topology</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Requests fan out to Go and Python runtimes while keeping everything available behind
                the primary Express process.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Data-driven UI</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Navigation, marketplace listings, and template catalogs are hydrated from JSON fixtures and server responses seeded
                from structured data.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Enterprise controls</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Authentication, audit logs, and org-level settings are wired into every layer of the platform.
              </p>
            </li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Key areas</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">Client</CardTitle>
                <CardDescription>React + Tailwind UI</CardDescription>
              </CardHeader>
              <CardContent className="text-[13px] text-muted-foreground space-y-2">
                <p>
                  Feature views span from Docs to Deployments, powered by shared primitives and a design-token system via Tailwind.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">Server</CardTitle>
                <CardDescription>Express services</CardDescription>
              </CardHeader>
              <CardContent className="text-[13px] text-muted-foreground space-y-2">
                <p>
                  API routes cover projects, auth, billing, and deployments. Orchestration helpers and background jobs handle
                  heavy lifting.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">Infrastructure</CardTitle>
                <CardDescription>Runtime + tooling</CardDescription>
              </CardHeader>
              <CardContent className="text-[13px] text-muted-foreground space-y-2">
                <p>
                  Deployment scripts, Kubernetes manifests, Drizzle migrations, and database helpers automate provisioning and
                  schema management.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    ),
    actions: [
      { label: 'Explore deployments', href: '/deployments', variant: 'default' },
      { label: 'Deep dive into runtimes', articleKey: 'runtimes', variant: 'outline' }
    ]
  },
  workspace: {
    title: 'Cloud workspace tour',
    summary: 'Understand the editor, terminals, previews, and resource monitors that make up an E-Code workspace.',
    lastUpdated: 'February 18, 2025',
    keywords: ['workspace', 'editor', 'preview', 'terminal', 'monaco'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Editor, terminals, and preview</h2>
          <p>
            The project workspace binds together the Monaco editor, file tree,
            shell processes, and live preview frames. Terminals are backed by a WebSocket bridge, while the
            preview iframe proxies so every project port is accessible from the main origin.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Resource overlays:</strong> CPU, memory, and file system usage are streamed in real time from the runtime
              metrics service.
            </li>
            <li>
              <strong>Command palette:</strong> A floating palette offers quick access to environment
              variables, deployments, and AI actions.
            </li>
            <li>
              <strong>Themeable UI:</strong> Workspace themes persist to user profiles and can be customized from the settings page.
            </li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Real-time state</h2>
          <p>
            Collaboration overlays and comments rely on Yjs documents synchronized through WebRTC data channels. Presence updates propagate
            in real time, and comment threads surface in the review sidebar.
          </p>
          <p>
            Autosave checkpoints mirror project files to persistent volumes, ensuring work is never lost even during unexpected disconnections.
          </p>
        </section>
      </div>
    ),
    actions: [
      { label: 'Open a workspace', href: '/projects', variant: 'default' },
      { label: 'Customize workspace theme', href: '/themes', variant: 'outline' }
    ]
  },
  ai: {
    title: 'AI copilots & automations',
    summary:
      'Leverage the AI services wired into the platform, from in-editor completions to fully autonomous build agents.',
    lastUpdated: 'February 18, 2025',
    keywords: ['ai', 'agents', 'autonomous', 'anthropic', 'openai', 'mcp'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Provider federation</h2>
          <p>
            All AI requests flow through a centralized service that selects model providers dynamically. Support is baked in for Anthropic, OpenAI, Google Gemini, and locally hosted models.
          </p>
          <p>
            The autonomous agent loop executes tool invocations with guard rails and audit logging to maintain traceability across every action taken.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">In-product experiences</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">AI Sidebar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Context-aware prompts, code explanations, and test generation directly inside the editor.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Agent Studio</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Design workflow automations, schedule recurrent runs, and review execution logs from one interface.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">MCP integrations</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Managed Connectors expose filesystem, Git, and deployment capabilities to the agent layer.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Reviews & guardrails</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Before code is merged, AI-authored changes run through safety checks and surface in the review feed.
              </p>
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Launch Agent Studio', href: '/ai-agent/studio', variant: 'default' },
      { label: 'Browse automation logs', href: '/workflows', variant: 'outline' }
    ]
  },
  collaboration: {
    title: 'Collaboration & reviews',
    summary: 'How teams co-edit, comment, and review deployments with workspace presence and async workflows.',
    lastUpdated: 'February 17, 2025',
    keywords: ['collaboration', 'comments', 'presence', 'reviews', 'teams'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Live collaboration</h2>
          <p>
            The collaboration layer uses Yjs documents and WebRTC data channels for real-time co-editing. Presence pings and shared
            cursors appear instantly for all participants in a workspace session.
          </p>
          <p>
            Teams and org membership enforce role-based permissions, allowing fine-grained control over who can view, edit, and deploy projects.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Reviews and discussions</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Comments:</strong> Threaded conversations sit alongside code and surface in the workspace sidebar.
            </li>
            <li>
              <strong>Audit trails:</strong> Every change is captured and displayed in the audit logs for complete traceability.
            </li>
            <li>
              <strong>Notifications:</strong> Email and in-app alerts keep team members informed about reviews, comments, and deployment events.
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Create a team', href: '/teams', variant: 'default' },
      { label: 'Review audit logs', href: '/audit-logs', variant: 'outline' }
    ]
  },
  projects: {
    title: 'Projects, templates & marketplace',
    summary: 'Spin up production-ready apps using curated templates, dependency installers, and the E-Code marketplace.',
    lastUpdated: 'February 16, 2025',
    keywords: ['templates', 'marketplace', 'projects', 'packages'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Template catalog</h2>
          <p>
            The template catalog covers full-stack frameworks (Next.js, Remix), AI starter kits, and mobile cross-platform projects. Each
            template includes runtime requirements, default environment variables, and quickstart instructions.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Dependency automation</h2>
          <p>
            The dependency graph for every project is tracked automatically. Installations invoke language-specific workers for Node, Python, and
            other runtimes with upgrades managed from a dedicated UI.
          </p>
          <p>
            Marketplace extensions let you add integrations, themes, and tooling to your workspace with one click.
          </p>
        </section>
      </div>
    ),
    actions: [
      { label: 'Browse templates', href: '/templates', variant: 'default' },
      { label: 'Open the marketplace', href: '/marketplace', variant: 'outline' }
    ]
  },
  deployments: {
    title: 'Deployments & environments',
    summary: 'Promote projects from dev sandboxes to production with built-in previews, custom domains, and GKE automation.',
    lastUpdated: 'February 18, 2025',
    keywords: ['deployments', 'gke', 'kubernetes', 'domains', 'preview'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Promotion pipeline</h2>
          <p>
            Every deployment starts as a preview. Once validated, it moves into the
            production orchestrator targeting Kubernetes clusters. DNS automation and SSL provisioning run through Cloudflare adapters.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-[13px] font-medium mb-2">Deployment flow</p>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground flex-wrap">
              <span className="rounded bg-background px-2 py-1 border">Code push</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-background px-2 py-1 border">Preview deploy</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-background px-2 py-1 border">Validation</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="rounded bg-background px-2 py-1 border">Production</span>
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Operations tooling</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Health dashboard:</strong> Cluster metrics are visualized in real time from the monitoring service.
            </li>
            <li>
              <strong>Runtime diagnostics:</strong> Deep-dives on container logs help troubleshoot issues quickly.
            </li>
            <li>
              <strong>Production scripts:</strong> Shell helpers replicate the same promotion steps used by the UI for CLI-based workflows.
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Open deployments hub', href: '/deployments', variant: 'default' },
      { label: 'Review runtime services', articleKey: 'runtimes', variant: 'outline' }
    ]
  },
  runtimes: {
    title: 'Runtimes & system services',
    summary: 'Dive into the Go runtime, sandboxing, resource quotas, and storage that keep workspaces isolated.',
    lastUpdated: 'February 15, 2025',
    keywords: ['runtime', 'sandbox', 'go runtime', 'resource quotas', 'storage'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Container orchestration</h2>
          <p>
            Workspace containers are namespaced, cgroup-isolated, and mounted with project storage. Resource policies ensure CPU,
            memory, and file descriptors remain within plan limits.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Language runtimes</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Polyglot adapters</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Go, Python, and Node executors are exposed through a unified service. Runtime availability and versions are surfaced in the UI.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Sandboxing</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Commands run through an isolation layer that mounts ephemeral volumes, rewrites syscalls, and applies seccomp
                profiles per container.
              </p>
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Check runtime status', href: '/runtimes', variant: 'default' },
      { label: 'Inspect diagnostics', href: '/runtime-diagnostics', variant: 'outline' }
    ]
  },
  security: {
    title: 'Security, identity & compliance',
    summary: 'Enterprise-grade access controls, audit trails, and compliance tooling wired into every workspace.',
    lastUpdated: 'February 17, 2025',
    keywords: ['security', 'identity', 'sso', 'compliance', 'audit'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Identity & access</h2>
          <p>
            Authentication supports password, OAuth, and SSO flows. SCIM provisioning is available for SAML and OIDC configurations.
            Role-based access control is enforced across all platform surfaces.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Operational security</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Secrets management:</strong> Environment variables and API keys are encrypted at rest and scoped per project with
              rotation support.
            </li>
            <li>
              <strong>Compliance reporting:</strong> DPA, SOC 2, and subprocessor details are published and kept up to date for
              enterprise customers.
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Configure SSO', href: '/advanced/sso', variant: 'default' },
      { label: 'View compliance docs', href: '/dpa', variant: 'outline' }
    ]
  },
  support: {
    title: 'Support & success',
    summary: 'How customers engage with support, success engineering, and the self-serve knowledge base.',
    lastUpdated: 'February 14, 2025',
    keywords: ['support', 'success', 'status', 'contact'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Channels</h2>
          <p>
            The support hub surfaces live chat, ticket routing, and knowledge base search. Escalations notify on-call responders
            and status updates ensure transparency during maintenance windows.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Customer success</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Onboarding runbooks:</strong> Delivered through structured learning paths and templated tasks.
            </li>
            <li>
              <strong>Billing support:</strong> Plan management syncs with Stripe for transparent usage tracking.
            </li>
            <li>
              <strong>Community programs:</strong> The forum and community hub provide moderation tools and peer-to-peer support.
            </li>
          </ul>
        </section>
      </div>
    ),
    actions: [
      { label: 'Contact support', href: '/support', variant: 'default' },
      { label: 'Check system status', href: '/status', variant: 'outline' }
    ]
  },
  api: {
    title: 'APIs & integrations',
    summary: 'Programmatic access to workspaces, deployments, and billing via REST, webhooks, and SDKs.',
    lastUpdated: 'February 18, 2025',
    keywords: ['api', 'sdk', 'webhooks', 'integrations'],
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">REST & webhooks</h2>
          <p>
            REST endpoints are organized with OpenAPI descriptions. Webhooks for deployments,
            billing events, and audit alerts include signature verification for security.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Client SDKs</h2>
          <p>
            The TypeScript SDK mirrors the REST endpoints and ships on NPM. Sample usage and code snippets are
            available in the API reference page.
          </p>
          <p>
            Server-to-server integrations with GitHub, GitLab, Slack, and PagerDuty can be configured from
            the integrations settings page.
          </p>
        </section>
      </div>
    ),
    actions: [
      { label: 'View API reference', href: '/api-sdk', variant: 'default' },
      { label: 'Manage integrations', href: '/integrations', variant: 'outline' }
    ]
  }
};

const docSections: DocSection[] = [
  {
    id: 'start-here',
    name: 'Start here',
    title: 'Start here',
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { key: 'overview', label: 'Platform overview', description: 'Architecture, services, and tooling.' },
      { key: 'workspace', label: 'Cloud workspace tour', description: 'Editor, preview, and collaboration surface.' },
      { key: 'ai', label: 'AI copilots & automations', description: 'Model federation and agent tooling.' }
    ]
  },
  {
    id: 'build-together',
    name: 'Build together',
    title: 'Build together',
    icon: <Users className="h-4 w-4" />,
    items: [
      { key: 'collaboration', label: 'Collaboration & reviews', description: 'Co-editing, comments, and notifications.' },
      { key: 'projects', label: 'Projects & templates', description: 'Catalogs, dependencies, and marketplace.' }
    ]
  },
  {
    id: 'ship-to-production',
    name: 'Ship to production',
    title: 'Ship to production',
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { key: 'deployments', label: 'Deployments & environments', description: 'Previews, domains, and GKE automation.' },
      { key: 'runtimes', label: 'Runtimes & system services', description: 'Isolation, quotas, and language adapters.' }
    ]
  },
  {
    id: 'operate-securely',
    name: 'Operate securely',
    title: 'Operate securely',
    icon: <ShieldCheck className="h-4 w-4" />,
    items: [
      { key: 'security', label: 'Security & compliance', description: 'SSO, secrets, audit logging, and policies.' },
      { key: 'api', label: 'APIs & integrations', description: 'REST, SDKs, and partner connectors.' }
    ]
  },
  {
    id: 'get-help',
    name: 'Get help',
    title: 'Get help',
    icon: <LifeBuoy className="h-4 w-4" />,
    items: [
      { key: 'support', label: 'Support & success', description: 'Support channels, status, and onboarding.' }
    ]
  }
];

const quickStartCards: Array<{ key: DocKey; title: string; description: string; icon: ReactNode; gradient: string }> = [
  {
    key: 'overview',
    title: 'Getting Started',
    description: 'Explore the platform architecture, key services, and how everything fits together.',
    icon: <Rocket className="h-6 w-6 text-white" />,
    gradient: 'from-orange-500 to-red-500'
  },
  {
    key: 'ai',
    title: 'AI Features',
    description: 'Learn about AI copilots, autonomous agents, and model federation built into every workspace.',
    icon: <Bot className="h-6 w-6 text-white" />,
    gradient: 'from-blue-500 to-indigo-500'
  },
  {
    key: 'deployments',
    title: 'Deployments',
    description: 'Ship from dev to production with previews, custom domains, and automated promotion pipelines.',
    icon: <Server className="h-6 w-6 text-white" />,
    gradient: 'from-green-500 to-emerald-500'
  }
];

export default function DocsPage(): JSX.Element {
  const [, setLocation] = useLocation();
  const [activeArticle, setActiveArticle] = useState<DocKey | null>(null);
  const [query, setQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(
    docSections.map((s) => s.id)
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) {
      return docSections;
    }

    return docSections
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          const article = documentationArticles[item.key];
          const haystack = [
            item.label,
            item.description ?? '',
            article.title,
            article.summary,
            ...(article.keywords ?? [])
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        });

        if (!filteredItems.length) {
          return null;
        }

        return { ...section, items: filteredItems };
      })
      .filter((section): section is DocSection => Boolean(section));
  }, [normalizedQuery]);

  useEffect(() => {
    if (normalizedQuery) {
      const firstMatch = filteredSections[0]?.items[0];
      setActiveArticle(firstMatch ? firstMatch.key : null);
    } else if (query === '') {
      setActiveArticle(null);
    }
  }, [normalizedQuery, filteredSections, query]);

  const activeArticleData = activeArticle ? documentationArticles[activeArticle] : null;

  const handleAction = (action: DocAction) => {
    if (action.articleKey) {
      setActiveArticle(action.articleKey);
    }

    if (action.href) {
      if (action.external) {
        window.open(action.href, '_blank', 'noopener,noreferrer');
      } else {
        setLocation(action.href);
      }
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const firstResult = filteredSections[0]?.items[0];
      if (firstResult) {
        setActiveArticle(firstResult.key);
      }
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="flex flex-1 flex-col" data-testid="page-docs">
      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="heading-docs">Documentation</h1>
          </div>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search docs..."
              className="pl-9"
              data-testid="input-docs-search"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="hidden w-64 shrink-0 border-r md:block">
          <ScrollArea className="h-[calc(100vh-65px)] sticky top-0">
            <nav className="p-4 space-y-1">
              {filteredSections.length === 0 && normalizedQuery && (
                <div className="px-2 py-8 text-center">
                  <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-[13px] text-muted-foreground">No matching articles</p>
                </div>
              )}
              {filteredSections.map((section) => (
                <Collapsible
                  key={section.id}
                  open={expandedSections.includes(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    {section.icon}
                    <span className="flex-1 text-left">{section.name}</span>
                    {expandedSections.includes(section.id) ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-2 border-l pl-2 mt-0.5 space-y-0.5">
                      {section.items.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setActiveArticle(item.key)}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                            activeArticle === item.key
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-auto">
          <ScrollArea className="h-[calc(100vh-65px)]">
            <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
              {activeArticleData ? (
                <article>
                  <div className="mb-8">
                    <Badge variant="secondary" className="mb-3 text-[11px]">
                      Last updated {activeArticleData.lastUpdated}
                    </Badge>
                    <h1 className="text-3xl font-bold tracking-tight">{activeArticleData.title}</h1>
                    <p className="mt-2 text-muted-foreground">{activeArticleData.summary}</p>
                  </div>

                  <Separator className="mb-8" />

                  <div className="prose-sm">{activeArticleData.content}</div>

                  {activeArticleData.actions && activeArticleData.actions.length > 0 && (
                    <div className="mt-10 flex flex-wrap gap-3 border-t pt-6">
                      {activeArticleData.actions.map((action) => (
                        <Button
                          key={action.label}
                          variant={action.variant ?? 'default'}
                          onClick={() => handleAction(action)}
                          className="gap-1.5"
                        >
                          {action.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ))}
                    </div>
                  )}
                </article>
              ) : normalizedQuery && filteredSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Search className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No results found</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground max-w-sm">
                    No articles match "{query.trim()}". Try a different search term or browse the sidebar.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold tracking-tight">
                      Welcome to E-Code Documentation
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                      Everything you need to build, deploy, and scale your applications with the E-Code platform. Pick a topic from the sidebar or start with one of the guides below.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {quickStartCards.map((card) => (
                      <Card
                        key={card.key}
                        className="group cursor-pointer transition-all hover:shadow-lg"
                        onClick={() => setActiveArticle(card.key)}
                      >
                        <CardHeader className="pb-3">
                          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient}`}>
                            {card.icon}
                          </div>
                          <CardTitle className="text-base">{card.title}</CardTitle>
                          <CardDescription className="text-[13px]">
                            {card.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-primary group-hover:underline">
                            Read guide <ArrowRight className="h-3 w-3" />
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">All topics</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {docSections.flatMap((section) =>
                        section.items.map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setActiveArticle(item.key)}
                            className="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                          >
                            <div className="mt-0.5 shrink-0 text-muted-foreground">
                              {section.icon}
                            </div>
                            <div>
                              <p className="text-[14px] font-medium">{item.label}</p>
                              {item.description && (
                                <p className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                            <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
