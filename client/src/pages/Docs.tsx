import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import {
  ArrowRight,
  Book,
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Layers,
  LifeBuoy,
  MessageSquare,
  Rocket,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
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
  media?: ReactNode;
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

const docsMedia = {
  overviewScreenshot: 'https://cdn.ecode.dev/docs/dashboard-2025.webp',
  deploymentsPoster: 'https://cdn.ecode.dev/docs/deployments/handover-poster.webp'
};

const documentationArticles: Record<DocKey, DocArticle> = {
  overview: {
    title: 'Platform overview',
    summary:
      'How the full-stack E-Code platform stitches together the React client, Express API, workspace runtimes, and governance services.',
    lastUpdated: 'February 18, 2025',
    keywords: ['architecture', 'express', 'react', 'postgres', 'overview', 'single-port'],
    media: (
      <figure className="my-6 rounded-xl border bg-muted/40 p-4">
        <img
          src={docsMedia.overviewScreenshot}
          alt="E-Code dashboard showing the editor, terminal, and live preview"
          className="rounded-lg border shadow-sm"
          loading="lazy"
        />
        <figcaption className="mt-3 text-sm text-muted-foreground">
          The unified workspace pairs the Monaco editor with a live preview and terminals surfaced from <code>client/src/pages/IDEPage.tsx</code>.
        </figcaption>
      </figure>
    ),
    content: (
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What ships with the platform</h2>
          <p>
            E-Code combines a Vite-powered React client (<code>client/src/App.tsx</code>) with an Express API (<code>server/index.ts</code>) that
            proxies long-lived WebSocket connections, orchestrates runtime containers, and exposes deployment tooling. Persistent
            data is stored in PostgreSQL via Drizzle ORM migrations located in <code>migrations/</code>.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Unified experience</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A single-page client routes authenticated users through the dashboard, project editor, deployments, AI studio, and
                admin surfaces using <code>wouter</code> for navigation.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Single-port topology</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <code>server/polyglot-routes.ts</code> fans requests to the Go and Python runtimes while keeping everything available behind
                the primary Express process—matching the architecture described in <code>REPLIT_SINGLE_PORT_ARCHITECTURE.md</code>.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Data-driven UI</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Navigation, marketplace listings, and template catalogs are hydrated from JSON fixtures and server responses seeded by
                <code>server/seed-templates.ts</code> and <code>server/seed-blog.ts</code>.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Enterprise controls</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Authentication hooks into <code>server/auth.ts</code>, audit logs stream through <code>server/security/audit-logger.ts</code>, and org-level
                settings live under <code>client/src/pages/admin</code>.
              </p>
            </li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Key directories</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Client</CardTitle>
                <CardDescription>React + Tailwind UI</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <code>client/src/pages</code> hosts the feature views—from <code>Docs.tsx</code> to <code>Deployments.tsx</code>—powered by shared primitives in
                  <code>client/src/components</code>.
                </p>
                <p>
                  UI tokens come from <code>tailwind.config.ts</code> and <code>client/src/styles</code>.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Server</CardTitle>
                <CardDescription>Express services</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  API routes in <code>server/routes</code> cover projects, auth, billing, and deployments while orchestration helpers live under
                  <code>server/orchestration</code>.
                </p>
                <p>
                  Background jobs leverage <code>server/workflows</code> and <code>server/analytics</code>.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Infrastructure</CardTitle>
                <CardDescription>Runtime + tooling</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Scripts such as <code>deploy-production.sh</code>, <code>fix-existing-deployment.sh</code>, and the Kubernetes manifests under <code>kubernetes/</code>
                  automate provisioning.
                </p>
                <p>
                  Drizzle migrations and database helpers live inside <code>server/database</code> and <code>migrations/</code>.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    ),
    actions: [
      { label: 'Explore deployment scripts', href: '/deployments', variant: 'default' },
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
            The project workspace is rendered by <code>client/src/pages/IDEPage.tsx</code>. It binds together the Monaco editor, file tree,
            shell processes, and live preview frames. Terminals are backed by the WebSocket bridge in <code>server/terminal</code>, while the
            preview iframe proxies through <code>server/preview</code> so every project port is accessible from the main origin.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Resource overlays:</strong> <code>client/src/components/inspector</code> shows CPU, memory, and file system usage streamed from
              <code>server/status/runtime-metrics.ts</code>.
            </li>
            <li>
              <strong>Command palette:</strong> The floating palette in <code>client/src/components/command-palette</code> offers quick access to environment
              variables, deployments, and AI actions.
            </li>
            <li>
              <strong>Themeable UI:</strong> Workspace themes from <code>client/src/pages/Themes.tsx</code> persist to user profiles via
              <code>server/routes/user-settings.ts</code>.
            </li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Real-time state</h2>
          <p>
            Collaboration overlays and comments rely on Yjs documents synchronized through <code>server/collaboration</code>. Presence updates propagate
            via <code>server/realtime/presence-server.ts</code>, and comment threads surface in <code>client/src/components/review</code>.
          </p>
          <p>
            Autosave checkpoints are handled by <code>server/storage/file-system-adapter.ts</code>, mirroring project files to persistent volumes managed by
            the Go runtime under <code>server/runtimes/go</code>.
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
            All AI requests flow through <code>server/ai/ai-service.ts</code>, which selects model providers defined in
            <code>server/ai/ai-providers.ts</code>. Support is baked in for Anthropic, OpenAI, Google Gemini, and locally hosted models via
            <code>server/ai/opensource-models-provider.ts</code>.
          </p>
          <p>
            The autonomous agent loop lives in <code>server/ai/autonomous-builder.ts</code> and executes tool invocations declared inside
            <code>server/tools</code>. Each tool has guard rails and audit logging to maintain traceability.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">In-product experiences</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">AI Sidebar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <code>client/src/pages/AI.tsx</code> injects context-aware prompts, code explanations, and test generation directly inside the editor.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Agent Studio</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <code>client/src/pages/AIAgentStudio.tsx</code> lets power users design workflow automations, schedule recurrent runs, and review execution logs.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">MCP integrations</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Managed Connectors expose filesystem, Git, and deployment capabilities to the agent layer via <code>server/mcp</code>.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Reviews & guardrails</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Before code is merged, AI-authored changes run through <code>server/security/code-safety-checks.ts</code> and surface in the Review feed inside
                <code>client/src/pages/Workflows.tsx</code>.
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
            The collaboration layer is powered by <code>server/collaboration</code>. Each workspace session establishes a Yjs doc and WebRTC data channels
            managed by <code>server/webrtc</code>. Presence pings and shared cursors are rendered via <code>client/src/components/collaboration</code>.
          </p>
          <p>
            Teams and org membership live in <code>server/teams</code>, which enforces role-based permissions mirrored in the UI at
            <code>client/src/pages/Teams.tsx</code> and <code>client/src/pages/TeamSettings.tsx</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Reviews and discussions</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Comments:</strong> Threaded conversations sit in <code>server/community/comments-service.ts</code> and surface in the workspace sidebar.
            </li>
            <li>
              <strong>Audit trails:</strong> Every change is captured by <code>server/security/audit-logger.ts</code> and displayed in <code>client/src/pages/AuditLogs.tsx</code>.
            </li>
            <li>
              <strong>Notifications:</strong> Email and in-app alerts run through <code>server/notifications</code> and show up in <code>client/src/pages/Notifications.tsx</code>.
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
            Seed data in <code>server/seed-templates.ts</code> populates the catalog displayed on <code>client/src/pages/TemplatesPage.tsx</code>. Templates cover full-stack
            frameworks (Next.js, Remix), AI starter kits, and mobile cross-platform projects.
          </p>
          <p>
            Each template includes runtime requirements, default environment variables, and quickstart instructions rendered from
            structured metadata stored in <code>server/data/templates</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Dependency automation</h2>
          <p>
            The dependency graph for every project is tracked by <code>server/package-management</code>. Installations invoke the Node- and Python-specific
            workers in <code>server/package-installer.ts</code> and <code>server/python</code>, while the UI for upgrades lives in <code>client/src/pages/Dependencies.tsx</code>.
          </p>
          <p>
            Marketplace extensions, surfaced through <code>client/src/pages/Marketplace.tsx</code>, are backed by the server-side registry maintained in
            <code>server/extensions</code>.
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
    media: (
      <figure className="my-6 rounded-xl border bg-muted/40 p-4">
        <video
          className="w-full rounded-lg border shadow-sm"
          controls
          poster={docsMedia.deploymentsPoster}
          preload="metadata"
        >
          <source src="/assets/platform-demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <figcaption className="mt-3 text-sm text-muted-foreground">
          End-to-end promotion from draft previews to production runs inside <code>client/src/pages/Deployments.tsx</code>.
        </figcaption>
      </figure>
    ),
    content: (
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Promotion pipeline</h2>
          <p>
            Every deployment starts as a preview generated by <code>server/deployment/preview-service.ts</code>. Once validated, it moves into the
            production orchestrator defined in <code>server/deployment/deployment-service.ts</code>, which targets Kubernetes clusters configured via the
            manifests inside <code>kubernetes/</code>.
          </p>
          <p>
            DNS automation and SSL provisioning run through <code>server/deployment/domain-service.ts</code> and the Cloudflare adapters in
            <code>server/integrations/cloudflare</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Operations tooling</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Health dashboard:</strong> <code>client/src/pages/HealthDashboard.tsx</code> visualizes cluster metrics streamed from
              <code>server/monitoring/health-service.ts</code>.
            </li>
            <li>
              <strong>Runtime diagnostics:</strong> Deep-dives on container logs live in <code>client/src/pages/RuntimeDiagnosticsPage.tsx</code> and pull data from
              <code>server/runtimes/runtime-inspector.ts</code>.
            </li>
            <li>
              <strong>Production scripts:</strong> Shell helpers like <code>deploy-production.sh</code>, <code>deploy-to-gke.sh</code>, and <code>COMPLETE_DEPLOYMENT.sh</code>
              replicate the same steps used by the UI.
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
            Workspace containers are created by <code>server/orchestration/container-orchestrator.ts</code> and run inside the custom runtime described in
            <code>server/orchestration/container-runtime.ts</code>. Each container is namespaced, cgroup-isolated, and mounted with project storage from
            <code>server/storage</code>.
          </p>
          <p>
            Resource policies live in <code>server/orchestration/quota-manager.ts</code>, ensuring CPU, memory, and file descriptors remain within plan
            limits defined in <code>server/billing/plan-limits.ts</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Language runtimes</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Polyglot adapters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <code>server/polyglot-services.ts</code> exposes Go, Python, and Node executors. Client pages like <code>client/src/pages/RuntimesPage.tsx</code>
                surface runtime availability and versions.
              </p>
            </li>
            <li className="rounded-lg border bg-background p-4 shadow-sm">
              <p className="font-medium">Sandboxing</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Commands run through the isolation layer in <code>server/sandbox</code>, which mounts ephemeral volumes, rewrites syscalls, and applies seccomp
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
            Authentication routes in <code>server/auth.ts</code> support password, OAuth, and SSO flows. SCIM provisioning hooks are available in
            <code>server/sso/scim-service.ts</code>, while the UI for configuring SAML and OIDC lives at <code>client/src/pages/SSOConfiguration.tsx</code>.
          </p>
          <p>
            Role-based access control is enforced by <code>server/security/access-control.ts</code> and mirrored in the UI via <code>client/src/pages/CustomRoles.tsx</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Compliance & data protection</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Audit logs:</strong> <code>server/security/audit-logger.ts</code> persists every sensitive action for export in <code>client/src/pages/AuditLogs.tsx</code>.
            </li>
            <li>
              <strong>Secrets management:</strong> Encrypted storage is handled by <code>server/security/secrets-vault.ts</code> with UI surfaces in
              <code>client/src/pages/SecretManagement.tsx</code> and <code>client/src/pages/Secrets.tsx</code>.
            </li>
            <li>
              <strong>Compliance reporting:</strong> DPA, SOC 2, and subprocessor details are published through <code>client/src/pages/DPA.tsx</code>,
              <code>client/src/pages/StudentDPA.tsx</code>, and <code>client/src/pages/Subprocessors.tsx</code>.
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
            The support hub at <code>client/src/pages/Support.tsx</code> surfaces live chat, ticket routing, and knowledge base search. Tickets are persisted via
            <code>server/support/support-service.ts</code> and escalations notify on-call responders through <code>server/notifications/providers/pagerduty.ts</code>.
          </p>
          <p>
            Status updates and incident history originate from <code>server/status</code> and render in <code>client/src/pages/Status.tsx</code>, ensuring transparency during
            maintenance windows.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Customer success</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Onboarding runbooks:</strong> Delivered through <code>client/src/pages/Learn.tsx</code> and templated tasks tracked by
              <code>server/education</code>.
            </li>
            <li>
              <strong>Billing support:</strong> <code>client/src/pages/AdminBilling.tsx</code> provides plan management while <code>server/billing</code> syncs with Stripe.
            </li>
            <li>
              <strong>Community programs:</strong> The forum at <code>client/src/pages/Community.tsx</code> is powered by <code>server/community</code> with moderation tools in
              <code>client/src/pages/ReportAbuse.tsx</code>.
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
            REST endpoints are organized under <code>server/api</code> with OpenAPI descriptions generated from <code>server/api/openapi</code>. Webhooks for deployments,
            billing events, and audit alerts are handled by <code>server/api/webhooks</code> with signature verification in
            <code>server/security/webhook-verifier.ts</code>.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Client SDKs</h2>
          <p>
            The TypeScript SDK exposed through <code>sdk/</code> mirrors the REST endpoints and ships on NPM as <code>@ecode/sdk</code>. Sample usage and code snippets are
            available at <code>client/src/pages/APISDKPage.tsx</code>.
          </p>
          <p>
            Server-to-server integrations with GitHub, GitLab, Slack, and PagerDuty are implemented in <code>server/integrations</code> and can be configured from
            <code>client/src/pages/Integrations.tsx</code>.
          </p>
        </section>
      </div>
    ),
    actions: [
      { label: 'View API reference', href: '/api-sdk', variant: 'default' },
      { label: 'Download TypeScript SDK', href: 'https://www.npmjs.com/package/@ecode/sdk', external: true, variant: 'outline' }
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

const docsRepositoryBase = 'https://github.com/E-Code-AI/e-code/blob/main';

type DocReadiness = 'stable' | 'draft' | 'in-progress';

type DocHighlight = {
  title: string;
  description: string;
};

type DocResource = {
  label: string;
  href: string;
  description?: string;
};

type DocItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  highlights: DocHighlight[];
  tags?: string[];
  readiness?: DocReadiness;
  lastReviewed?: string;
  resources?: DocResource[];
};

type DocCategory = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: DocItem[];
};

const readinessLabels: Record<DocReadiness, string> = {
  stable: 'Production ready',
  draft: 'Draft',
  'in-progress': 'In review'
};

const docCategories: DocCategory[] = [
  {
    id: 'onboarding',
    title: 'Onboarding & Enablement',
    description: 'Bootstrap local environments and deliver accurate product walkthroughs.',
    icon: <Rocket className="h-4 w-4" />,
    items: [
      {
        id: 'getting-started',
        title: 'Environment bootstrap checklist',
        href: `${docsRepositoryBase}/docs/getting-started.md`,
        summary:
          'Install required tooling, configure secrets, seed the database, and validate the browser IDE end to end.',
        highlights: [
          {
            title: 'Install prerequisites',
            description:
              'Use Node.js 18+, npm 10+, and PostgreSQL 15. Optional Docker Desktop and Redis unlock container and rate-limit testing.'
          },
          {
            title: 'Configure environment variables',
            description:
              'Copy `.env.production.example` to `.env` and set DATABASE_URL, SESSION_SECRET, and optional AI provider API keys.'
          },
          {
            title: 'Provision the schema',
            description: 'Run `npm run db:push` to apply Drizzle migrations and load the seeded `testuser` dataset.'
          },
          {
            title: 'Launch and verify the workspace',
            description:
              'Start `npm run dev`, sign in at `http://localhost:5000` with `testuser` / `testpass123`, and exercise the editor, terminal, AI assistant, and live preview flows.'
          },
          {
            title: 'Troubleshoot quickly',
            description:
              'Validate PostgreSQL connectivity with `psql`, restart the dev server if Vite errors appear, and confirm WebSocket reachability for file sync.'
          }
        ],
        tags: ['local environment', 'onboarding'],
        readiness: 'stable',
        resources: [
          {
            label: 'Product tour playbook',
            href: `${docsRepositoryBase}/docs/product-tour.md`
          },
          {
            label: 'Architecture overview',
            href: `${docsRepositoryBase}/docs/architecture/overview.md`
          }
        ]
      },
      {
        id: 'product-tour',
        title: 'Persona-based product tour',
        href: `${docsRepositoryBase}/docs/product-tour.md`,
        summary:
          'Deliver a Fortune-500-ready walkthrough covering dashboards, collaboration, deployment, administration, and analytics.',
        highlights: [
          {
            title: 'Dashboard storyline',
            description:
              'Open with the admin dashboard persona, highlight usage cards, announcements, and the call to connect SSO.'
          },
          {
            title: 'Workspace collaboration',
            description:
              'Launch a flagship template, demonstrate multi-user editing, run `npm test`, and showcase AI refactoring within the IDE.'
          },
          {
            title: 'Deployment pipeline tour',
            description:
              'Walk through environment variable policies, audit trails, and stage a rollout using `deploy-production.sh`.'
          },
          {
            title: 'Governance and billing checkpoints',
            description:
              'Create roles, outline SAML/SCIM configuration screens, and review billing exports and webhook subscriptions.'
          },
          {
            title: 'Demo asset library',
            description:
              'Maintain screenshots, GIFs, and Loom trailers under `attached_assets/` so every button showcased reflects the current release.'
          }
        ],
        tags: ['enablement', 'demos'],
        readiness: 'stable',
        resources: [
          {
            label: 'Attached assets directory',
            href: 'https://github.com/E-Code-AI/e-code/tree/main/attached_assets',
            description: 'Source-of-truth visuals and video placeholders for live demos.'
          }
        ]
      }
    ]
  },
  {
    id: 'platform',
    title: 'Platform & Runtime Architecture',
    description: 'Understand the system boundaries powering the browser IDE and execution runtimes.',
    icon: <Layers className="h-4 w-4" />,
    items: [
      {
        id: 'architecture-overview',
        title: 'Platform architecture overview',
        href: `${docsRepositoryBase}/docs/architecture/overview.md`,
        summary:
          'Maps the React client, Express control plane, runtime services, persistence layer, and security posture in one reference.',
        highlights: [
          {
            title: 'Client layer',
            description:
              'React 18 with Vite, Tailwind UI, Monaco Editor, and collaborative editing backed by yjs and socket.io.'
          },
          {
            title: 'Control plane',
            description:
              'Express entry point in `server/index.ts` handles authentication, routing, middleware, and asset serving.'
          },
          {
            title: 'Runtime and container services',
            description:
              'Docker/Kubernetes helpers allocate sandboxes while AI tools live under `sdk/` and `services/runtime`.'
          },
          {
            title: 'Persistence & security',
            description:
              'PostgreSQL via Drizzle migrations, optional Redis-backed sessions, and hardened middleware for rate limiting and headers.'
          },
          {
            title: 'Deployment & observability',
            description:
              'Single-port deployment scripts integrate with Cloud Run or GKE and expose health endpoints plus CDN optimisation.'
          }
        ],
        tags: ['architecture', 'solution design'],
        readiness: 'stable',
        resources: [
          {
            label: 'Deployment playbook',
            href: `${docsRepositoryBase}/docs/operations/deployment-playbook.md`
          }
        ]
      },
      {
        id: 'live-preview',
        title: 'Live preview system',
        href: `${docsRepositoryBase}/docs/preview.md`,
        summary:
          'Explains multi-port previews, device emulation, domain routing, and API endpoints for orchestrating preview sessions.',
        highlights: [
          {
            title: 'Multi-port orchestration',
            description:
              'Automatically detect multiple services, label them, and monitor their health for real-time switching.'
          },
          {
            title: 'Device emulation presets',
            description:
              'Test desktop, tablet, and mobile breakpoints with persistent user preferences.'
          },
          {
            title: 'Framework coverage',
            description:
              'Ships with detection for React, Vue, Angular, static HTML, Express, Flask, Django, FastAPI, and more.'
          },
          {
            title: 'Path-based routing model',
            description:
              'Production previews use `https://e-code.ai/preview/:projectId/:port/` and WebSocket endpoints under `/ws/preview/`.'
          },
          {
            title: 'Preview APIs',
            description:
              'Integrate with `POST /api/projects/{id}/preview/start`, status polling, and port switching endpoints.'
          }
        ],
        tags: ['runtime', 'preview'],
        readiness: 'stable'
      }
    ]
  },
  {
    id: 'operations',
    title: 'Operations & Reliability',
    description: 'Promote releases confidently with documented gates, observability, and rollback patterns.',
    icon: <Server className="h-4 w-4" />,
    items: [
      {
        id: 'deployment-playbook',
        title: 'Deployment playbook',
        href: `${docsRepositoryBase}/docs/operations/deployment-playbook.md`,
        summary:
          'Standardizes promotions from development through production with environment matrices, validation gates, and rollback paths.',
        highlights: [
          {
            title: 'Environment matrix',
            description:
              'Defines development, staging, and production environments with clear differences in security and data hygiene.'
          },
          {
            title: 'Promotion workflow',
            description:
              'Cut release candidates, deploy to staging with `deploy-to-gke.sh`, and validate core smoke tests before production launch.'
          },
          {
            title: 'Operational review',
            description:
              'Check monitoring dashboards, confirm audit logs, and package release notes for stakeholder enablement.'
          },
          {
            title: 'Observability checklist',
            description:
              'Track CDN optimisation metrics, configure 5xx, database saturation, and AI error alerts, and retain JSON logs for 30 days.'
          },
          {
            title: 'Rollback strategy',
            description:
              'Document container image reversions, migration considerations, infrastructure restores, and communication steps.'
          }
        ],
        tags: ['operations', 'release management'],
        readiness: 'stable',
        resources: [
          {
            label: 'deploy-production.sh',
            href: `${docsRepositoryBase}/deploy-production.sh`
          },
          {
            label: 'deploy-to-gke.sh',
            href: `${docsRepositoryBase}/deploy-to-gke.sh`
          },
          {
            label: 'GOOGLE_CLOUD_DEPLOYMENT.md',
            href: `${docsRepositoryBase}/GOOGLE_CLOUD_DEPLOYMENT.md`
          }
        ]
      }
    ]
  },
  {
    id: 'ai',
    title: 'AI & Automation',
    description: 'Roll out AI-first features with documented flags, APIs, and telemetry expectations.',
    icon: <Bot className="h-4 w-4" />,
    items: [
      {
        id: 'ai-ux',
        title: 'AI UX feature catalogue',
        href: `${docsRepositoryBase}/docs/AI_UX_FEATURES.md`,
        summary:
          'Enumerates AI assistant UX improvements, governing feature flags, API endpoints, telemetry, and test coverage.',
        highlights: [
          {
            title: 'Improve Prompt refinement',
            description:
              'Enable the `aiUx.improvePrompt` flag to analyse and rewrite prompts through `POST /api/ai/improve-prompt`.'
          },
          {
            title: 'Extended thinking & high power mode',
            description:
              'Toolbar toggles increase reasoning depth, token budgets, and persist user preferences for complex tasks.'
          },
          {
            title: 'Progress tab visibility',
            description:
              'Surface per-step timelines, file navigation, and status colours under the Progress tab when `aiUx.progressTab` is active.'
          },
          {
            title: 'Pause and resume controls',
            description:
              'Allow operators to pause or resume agent executions via dedicated endpoints while preserving context.'
          },
          {
            title: 'Telemetry & testing',
            description:
              'Track feature usage, toggles, successes, and errors, and run `npm test test/ai-ux-features.test.ts` before rollout.'
          }
        ],
        tags: ['ai', 'feature flags'],
        readiness: 'stable'
      }
    ]
  },
  {
    id: 'governance',
    title: 'Governance & Support',
    description: 'Coordinate doc ownership, escalation paths, and source control hygiene.',
    icon: <Shield className="h-4 w-4" />,
    items: [
      {
        id: 'docs-hub',
        title: 'Documentation hub overview',
        href: `${docsRepositoryBase}/docs/README.md`,
        summary:
          'Explains how the docs directory is curated, the target audiences, and the governance model for updates.',
        highlights: [
          {
            title: 'Audience navigation table',
            description:
              'Direct developers, product champions, architects, and SREs to the right guides using the quick-start matrix.'
          },
          {
            title: 'Live inventory',
            description:
              'Track maintained documents including getting started, product tour, architecture overview, and deployment playbook.'
          },
          {
            title: 'Feedback & governance',
            description:
              'Reference the style guide, change control expectations, and the docs@e-code.ai contact for revisions.'
          }
        ],
        tags: ['governance', 'meta'],
        readiness: 'stable',
        lastReviewed: '2025-10-19',
        resources: [
          {
            label: 'ACCURATE_STATUS_REPORT.md',
            href: `${docsRepositoryBase}/ACCURATE_STATUS_REPORT.md`
          }
        ]
      },
      {
        id: 'git-troubleshooting',
        title: 'Git troubleshooting guide',
        href: `${docsRepositoryBase}/docs/git-troubleshooting.md`,
        summary:
          'Resolves common Git merge conflicts and aborted rebases blocking engineers from pulling the latest changes.',
        highlights: [
          {
            title: 'Diagnose conflicts',
            description:
              'Run `git status` to identify files marked “both modified” and clean conflict markers between `<<<<<<<` blocks.'
          },
          {
            title: 'Complete the merge or rebase',
            description: 'Stage resolved files, then finish with `git commit` or `git rebase --continue` as appropriate.'
          },
          {
            title: 'Abort safely when needed',
            description:
              'Use `git merge --abort` or `git rebase --abort` to discard partial operations and return to a clean working tree.'
          },
          {
            title: 'Prevent future issues',
            description:
              'Pull frequently and keep changesets small to minimise the time conflicts remain unresolved.'
          }
        ],
        tags: ['support', 'version control'],
        readiness: 'stable'
      }
    ]
  }
];

const allDocItems: DocItem[] = docCategories.flatMap(category => category.items);

const matchesQuery = (item: DocItem, query: string) => {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  const haystack = [
    item.title,
    item.summary,
    item.tags?.join(' ') ?? '',
    ...item.highlights.map(highlight => `${highlight.title} ${highlight.description}`)
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
};

export default function DocsPage(): JSX.Element {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeArticle, setActiveArticle] = useState<DocKey>('overview');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    docCategories.map(category => category.id)
  );
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories = (docCategories
    .map(category => ({
      ...category,
      items: category.items.filter((item): item is DocItem => matchesQuery(item, normalizedQuery))
    }))
    .filter(category => category.items.length > 0 || !normalizedQuery)) as DocCategory[];

  const hasResults = visibleCategories.some(category => category.items.length > 0);

  const selectedDoc = selectedDocId
    ? allDocItems.find(item => item.id === selectedDocId) ?? null
    : null;

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

  const activeArticleData = documentationArticles[activeArticle];

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

  const handleDocSelect = (item: DocItem) => {
    setSelectedDocId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDocument = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const navigate = (href: string) => {
    setLocation(href);
  };

  const heroActions: DocAction[] = user
    ? [
        { label: 'View latest updates', href: '/blog', variant: 'secondary' },
        { label: 'Open a workspace', href: '/projects', variant: 'default' }
      ]
    : [
        { label: 'Create an account', href: '/register', variant: 'default' },
        { label: 'Take a product tour', href: '/', variant: 'secondary' }
      ];

  return (
    <div className="flex flex-1 flex-col" data-testid="page-docs">
      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary" className="inline-flex items-center gap-2">
                <Book className="h-3.5 w-3.5" />
                Updated documentation hub
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="heading-docs">E-Code product documentation</h1>
              <p className="max-w-2xl text-muted-foreground">
                Explore how our Replit-grade cloud development platform works under the hood. These guides stay in lockstep with the
                private E-Code codebase so your team can build, ship, and operate reliably.
              </p>
              <div className="flex flex-wrap gap-2">
                {heroActions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant ?? 'default'}
                    onClick={() => handleAction(action)}
                  >
                    {action.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md">
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Search documentation</CardTitle>
                  <CardDescription>Find topics across architecture, AI, security, and operations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Search articles, features, or services"
                      className="pl-9"
                      data-testid="input-docs-search"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Main content section starts here */}
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-8">
        <div className="flex-1">
          {query.trim() ? (
            filteredSections.length > 0 ? (
              <div className="space-y-6">
                {filteredSections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <h2 className="text-xl font-semibold">{section.name}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.items.map((item) => (
                        <Card
                          key={item.key}
                          className="cursor-pointer transition-all hover:shadow-md"
                          onClick={() => setActiveArticle(item.key)}
                        >
                          <CardHeader>
                            <CardTitle className="text-base">{item.label}</CardTitle>
                            {item.description && (
                              <CardDescription>{item.description}</CardDescription>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No results found</h3>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or browse the categories below
                </p>
              </div>
            )
          ) : (
            <div className="space-y-8">
              {docSections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <h2 className="text-xl font-semibold">{section.name}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <Card
                        key={item.key}
                        className="cursor-pointer transition-all hover:shadow-md"
                        onClick={() => setActiveArticle(item.key)}
                      >
                        <CardHeader>
                          <CardTitle className="text-base">{item.label}</CardTitle>
                          {item.description && (
                            <CardDescription>{item.description}</CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
