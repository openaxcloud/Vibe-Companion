import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, ChevronRight, ChevronDown, Search, ArrowLeft,
  Zap, Layers, Settings, Database,
  GitBranch, Globe, Users, Bug, Cpu, Bot, History,
  Plug, Shield, X, Menu
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceType } from "@/hooks/use-media-query";

function DocScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="my-6 rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] overflow-hidden shadow-lg">
      <img
        src={src}
        alt={alt}
        className="w-full h-auto block"
        loading="lazy"
        data-testid={`img-doc-${alt.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </div>
  );
}



interface DocSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  articles: { id: string; title: string; content: string; visual?: string }[];
}

const docSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    articles: [
      { id: "intro", title: "Introduction to E-Code", visual: "dashboard", content: "E-Code is a production-grade, cloud-based integrated development environment (IDE) that lets you write, run, and deploy code directly from your browser. It supports 11+ programming languages including JavaScript, TypeScript, Python, Go, Rust, Java, C++, Ruby, PHP, Bash, and more.\n\nEvery project runs in its own isolated sandbox with a full Linux environment, giving you access to a terminal, package manager, version control, AI assistance, and all the tools you need to build and ship software.\n\nE-Code is designed for real teams with real-time collaboration, usage-based AI billing, team workspaces, and deployment to production with custom domains." },
      { id: "create-project", title: "Creating a Project", visual: "dashboard", content: "To create a new project:\n\n1. Click 'Create Project' from the dashboard\n2. Choose from 30+ templates: React, Express API, Python Flask, Go Server, Rust, C++, Java, Ruby, Bash, 3D Games, Dashboards, Animations, Mobile Apps, and more\n3. Name your project and click Create\n\nYou can also:\n- Use AI to generate a project by describing what you want to build\n- Import from GitHub (public or private repos via OAuth)\n- Import a ZIP file\n- Fork any public project from the Community Hub\n- Create from an official framework template" },
      { id: "editor", title: "Using the Editor", visual: "ide", content: "The E-Code editor is powered by CodeMirror 6 with full language support:\n\n- Syntax highlighting for 20+ languages\n- IntelliSense and autocomplete via LSP\n- Multi-cursor editing (Ctrl/Cmd+D)\n- Find and replace (Ctrl/Cmd+F)\n- Global search across all files (Ctrl/Cmd+Shift+F)\n- Code folding and bracket matching\n- Minimap navigation\n- Custom themes (60+ built-in, plus Theme Editor for creating your own)\n- Split editor panes\n- Inline diagnostics and error highlighting\n- Go-to-definition and hover documentation via Language Server Protocol" },
      { id: "running-code", title: "Running Your Code", content: "Click the Run button (or press Ctrl/Cmd+Enter) to execute your project. The output appears in the Console panel below the editor.\n\nFor web projects, a live preview opens automatically showing your application. The preview updates in real-time as you save changes.\n\nYou can also:\n- Run individual files from the terminal\n- Configure custom run commands per project\n- Set up multiple workflows (dev server, tests, linters) running simultaneously\n- Use the built-in debugger with breakpoints and variable inspection" },
    ],
  },
  {
    id: "ide-features",
    title: "IDE Features",
    icon: Layers,
    articles: [
      { id: "terminal", title: "Terminal", content: "Every project includes a full Linux terminal with bash shell access. You can:\n\n- Install system packages\n- Run scripts and commands\n- Use git from the command line\n- Access project files\n- Run background processes\n- Use multiple terminal tabs simultaneously\n\nThe terminal supports full ANSI color output, interactive programs, and persistent sessions." },
      { id: "file-management", title: "File Management", content: "The file tree on the left side of the IDE shows all project files and folders. You can:\n\n- Create, rename, and delete files and folders\n- Drag and drop to reorganize\n- Upload files from your computer (including images and binary files)\n- Download files and folders\n- Search across all files with Ctrl/Cmd+Shift+F\n- View file history and blame annotations\n\nFiles are automatically saved as you type. The file tree supports keyboard navigation and context menus." },
      { id: "packages", title: "Package Management", content: "Install packages using the built-in package manager panel or terminal:\n\n- npm/yarn for JavaScript/TypeScript\n- pip for Python\n- cargo for Rust\n- go get for Go\n- And more for other languages\n\nThe Packages panel in the IDE sidebar lets you search, install, and remove packages with a single click. Dependencies are tracked in your project's manifest file (package.json, requirements.txt, etc.)." },
      { id: "workflows", title: "Workflows", content: "Workflows let you define and manage multiple processes for your project:\n\n- Configure start commands (e.g., npm run dev, python app.py)\n- Run multiple workflows simultaneously (dev server + tests + linter)\n- View real-time console output per workflow\n- Auto-restart on file changes\n- Configure environment variables per workflow\n\nWorkflows are managed from the IDE sidebar. Each workflow has its own terminal output and status indicator." },
      { id: "themes", title: "Themes & Customization", visual: "themes", content: "Customize the IDE appearance:\n\n- Choose from 60+ built-in themes (Dark, Light, Monokai, Solarized, Dracula, Nord, etc.)\n- Create custom themes with the visual Theme Editor\n- Share themes with the community\n- Adjust font size, font family, and line height\n- Configure editor behavior (tab size, word wrap, ligatures)\n\nAccess themes from Settings or the Theme Explorer at /themes." },
      { id: "keybindings", title: "Keyboard Shortcuts", content: "Essential keyboard shortcuts:\n\n- Ctrl/Cmd+S: Save file\n- Ctrl/Cmd+Enter: Run project\n- Ctrl/Cmd+`: Toggle terminal\n- Ctrl/Cmd+B: Toggle sidebar\n- Ctrl/Cmd+P: Quick file open\n- Ctrl/Cmd+Shift+F: Search in files\n- Ctrl/Cmd+D: Select next occurrence\n- Ctrl/Cmd+/: Toggle line comment\n- F5: Start debugger\n- F10: Step over\n- F11: Step into\n- Shift+F11: Step out\n- Alt+Up/Down: Move line up/down\n- Ctrl/Cmd+Shift+K: Delete line" },
    ],
  },
  {
    id: "version-control",
    title: "Version Control",
    icon: GitBranch,
    articles: [
      { id: "git-overview", title: "Git Integration Overview", visual: "git", content: "E-Code has a complete built-in Git version control system powered by isomorphic-git. The Git panel in the IDE sidebar provides a visual interface for all common Git operations without needing the terminal.\n\nThe Git panel has 4 tabs:\n- Changes: View modified files, stage changes, and commit\n- Branches: Create, switch, and delete branches\n- History: Browse commit timeline with details\n- GitHub: Push to and pull from GitHub\n\nAll operations create automatic checkpoints for safety, so you can always roll back." },
      { id: "git-changes", title: "Staging & Committing", content: "The Changes tab shows all modified files with status indicators:\n\n- A (Added): New files not yet tracked\n- M (Modified): Changed files\n- D (Deleted): Removed files\n- U (Untracked): New files never committed\n\nYou can:\n- Select/deselect individual files for staging\n- Use 'Select All' / 'Deselect All' for bulk operations\n- Write a commit message and press Ctrl/Cmd+Enter to commit\n- Commit all changes or only selected files\n\nThe diff view shows exactly what changed in each file." },
      { id: "git-branches", title: "Branch Management", content: "The Branches tab lets you manage Git branches:\n\n- View all branches with the current branch highlighted\n- Create new branches from the current HEAD\n- Switch between branches (with automatic file sync)\n- Delete branches (except the default 'main' branch)\n\nWhen switching branches, E-Code automatically creates a checkpoint before the switch, updates all project files to match the branch, and syncs the database state.\n\nMerge conflict detection and resolution is built-in — if a pull or merge creates conflicts, the Merge Conflicts panel guides you through resolving them file by file." },
      { id: "git-history", title: "Commit History", content: "The History tab shows a visual timeline of all commits:\n\n- Commit messages with timestamps\n- Short SHA hashes for reference\n- Author information\n- Expandable details showing full SHA, branch, and parent commit\n- 'Restore' button to checkout any previous commit\n\nYou can also view file-specific history — right-click any file in the file tree and select 'File History' to see all commits that modified that file, with blame annotations showing who changed each line." },
      { id: "git-github", title: "GitHub Integration", content: "Connect your GitHub account to push and pull code:\n\n1. Go to Settings and connect your GitHub account via OAuth\n2. In the GitHub tab of the Git panel, click Push to upload commits\n3. Click Pull to download the latest changes from GitHub\n\nYou can also:\n- Connect a project to an existing GitHub repository\n- Import projects directly from GitHub repos\n- Handle merge conflicts when pulling creates them\n\nGitHub integration uses your OAuth token — no need to manage SSH keys or personal access tokens." },
    ],
  },
  {
    id: "database",
    title: "Database",
    icon: Database,
    articles: [
      { id: "db-overview", title: "PostgreSQL Database", visual: "database", content: "Every project can use a fully managed PostgreSQL database:\n\n- Automatic provisioning — no setup required\n- Connection via DATABASE_URL environment variable\n- Full SQL support (DDL, DML, transactions)\n- Compatible with any ORM (Drizzle, Prisma, Sequelize, etc.)\n\nThe database is project-scoped with schema isolation — each project gets its own schema, preventing cross-project data leaks." },
      { id: "db-panel", title: "Database Panel & SQL Editor", content: "The Database panel in the IDE provides a full SQL editor:\n\n- Write and execute any SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, etc.)\n- Syntax highlighting and auto-completion\n- Results displayed in a formatted table\n- Support for complex queries (JOINs, subqueries, CTEs, window functions)\n- Query history for quick re-execution\n\nSecurity features:\n- Schema isolation via PostgreSQL search_path\n- Dangerous operations (GRANT, REVOKE, COPY, pg_read_file) are blocked\n- Destructive queries (DROP, TRUNCATE, DELETE without WHERE) require confirmation\n- Production database access is read-only" },
      { id: "db-migrations", title: "Schema Migrations", content: "E-Code supports database migrations via Drizzle ORM:\n\n1. Define your schema in shared/schema.ts using Drizzle table definitions\n2. Run 'npm run db:push' to sync your schema with the database\n3. Changes are applied automatically without data loss (when possible)\n\nFor manual migrations, you can run ALTER TABLE statements directly in the SQL editor.\n\nThe database panel shows your current schema and lets you browse tables, columns, and relationships." },
    ],
  },
  {
    id: "ai",
    title: "AI Features",
    icon: Bot,
    articles: [
      { id: "ai-agent", title: "AI Agent", visual: "ai", content: "The AI Agent is a full coding assistant that can help you write, debug, and understand code. It has access to your project files and can:\n\n- Generate new features from natural language descriptions\n- Fix bugs and errors automatically\n- Explain code and concepts\n- Refactor and optimize code\n- Write tests\n- Execute multi-step tasks in Build mode\n- Plan work and create task breakdowns in Plan mode\n\nThe agent reads your project context (files, errors, terminal output) to give relevant, accurate responses.\n\nTwo modes:\n- Chat mode: Conversational Q&A about your code\n- Agent mode: Autonomous coding — the AI writes, edits, and runs code for you" },
      { id: "ai-models", title: "AI Models", content: "E-Code supports multiple AI models from leading providers:\n\n- GPT-4o and GPT-4o-mini (OpenAI)\n- Claude 3.5 Sonnet and Claude 3 Haiku (Anthropic)\n- Gemini Pro and Gemini Flash (Google)\n\nYou can switch models from the AI panel header. Different models have different strengths:\n- GPT-4o: Complex reasoning and analysis\n- Claude 3.5 Sonnet: Excellent code generation and long-context understanding\n- Gemini Pro: Fast responses and multimodal capabilities\n\nUsage is billed per token with transparent pricing. Check your usage breakdown in Settings > Usage & Billing." },
      { id: "code-complete", title: "Code Completion", content: "AI-powered code completion suggests code as you type:\n\n- Tab to accept suggestions\n- Escape to dismiss\n- Contextual suggestions based on your project files\n- Multi-line completions for function bodies and blocks\n\nCode completion can be toggled on/off from Settings > Editor." },
      { id: "ai-billing", title: "Usage-Based AI Billing", content: "AI usage is tracked and billed per token:\n\n- Input tokens: Based on the prompt sent to the model (including context)\n- Output tokens: Based on the response generated\n- Each model has different per-token pricing\n\nView your usage breakdown in Settings > Usage & Billing:\n- Total tokens used per model\n- Cost breakdown by day/week/month\n- Remaining credits on your plan\n\nFree tier includes a monthly token allowance. Pro and Team plans include higher limits with overage billing." },
    ],
  },
  {
    id: "checkpoints",
    title: "Checkpoints & Recovery",
    icon: History,
    articles: [
      { id: "checkpoints-overview", title: "Automatic Checkpoints", content: "E-Code automatically creates snapshots of your project at critical moments:\n\n- Before deployments\n- Before Git checkout/pull/clone operations\n- Before file deletions\n- Before AI code generation\n- Before AI agent actions\n- Before risky operations\n\nCheckpoints capture the complete state of your project files, allowing you to restore to any previous point.\n\nThe Checkpoints panel in the IDE sidebar shows a visual timeline of all checkpoints with timestamps, trigger reasons, and restore buttons." },
      { id: "checkpoints-restore", title: "Restoring Checkpoints", content: "To restore a checkpoint:\n\n1. Open the Checkpoints panel in the IDE sidebar\n2. Browse the timeline of checkpoints\n3. Click 'Restore' on the checkpoint you want to revert to\n4. Confirm the restoration\n\nRestoring a checkpoint:\n- Replaces all project files with the checkpoint snapshot\n- Creates a new checkpoint of the current state before restoring (so you can undo)\n- Does NOT affect the database — only files are restored\n\nYou can also compare checkpoints to see what changed between two points in time using the diff view." },
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    icon: Globe,
    articles: [
      { id: "deploy-basics", title: "Deploying Your App", visual: "deploy", content: "Deploy your project to make it accessible on the internet:\n\n1. Click the Deploy tab in the IDE sidebar\n2. Configure your build command and start command\n3. Choose deployment type: Static (for frontend-only) or VM (for full-stack with WebSockets)\n4. Click Deploy\n\nYour app gets a .ecode.app subdomain automatically.\n\nDeployments include:\n- Automatic HTTPS/TLS certificates\n- Health checks with auto-restart on crash\n- Environment variable management (separate dev/prod)\n- Version history with rollback\n- Deployment logs for debugging" },
      { id: "custom-domains", title: "Custom Domains", content: "To use a custom domain:\n\n1. Go to the Deployment panel\n2. Click 'Add Custom Domain'\n3. Enter your domain name\n4. Add the CNAME record to your DNS provider pointing to your .ecode.app domain\n5. Wait for DNS propagation (usually 5-30 minutes)\n\nSSL certificates are provisioned automatically. Custom domains support:\n- Root domains (example.com)\n- Subdomains (app.example.com)\n- Wildcard subdomains (*.example.com)" },
      { id: "env-vars", title: "Environment Variables & Secrets", content: "Store sensitive values like API keys in environment variables:\n\n1. Open the Secrets panel in the IDE sidebar\n2. Add key-value pairs\n3. Access them in your code via process.env (Node.js) or os.environ (Python)\n\nSecurity features:\n- Secrets are encrypted at rest\n- Never exposed in logs or version control\n- Separate development and production environments\n- The security scanner warns if secrets are accidentally hardcoded in source files" },
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration",
    icon: Users,
    articles: [
      { id: "sharing", title: "Sharing Projects", content: "Share your project with others:\n\n- Share link: Anyone with the link can view your project in read-only mode\n- Invite collaborators: Add users by email with Read or Write access\n- Public projects: Make your project visible on the Community Hub\n- Fork: Others can fork your public projects to create their own copy\n\nCollaborators with write access can edit code, run the project, and use the terminal." },
      { id: "teams", title: "Teams", content: "Create a team to collaborate on multiple projects:\n\n- Shared project workspace visible to all team members\n- Team member management with invitations via email\n- Role-based access control:\n  - Owner: Full control including billing and team deletion\n  - Admin: Manage members and projects\n  - Member: Access team projects with write permissions\n- Team billing and usage tracking\n- Shared environment variables across team projects\n\nCreate a team from the Dashboard sidebar." },
      { id: "community", title: "Community Hub", visual: "community", content: "The Community Hub at /community lets you:\n\n- Browse public projects from other users\n- Discover templates and starter projects\n- Fork interesting projects to learn from them\n- Share your own projects with the community\n- Search by language, framework, or project type\n\nPopular projects are featured on the hub based on views and forks." },
    ],
  },
  {
    id: "debugging",
    title: "Debugging",
    icon: Bug,
    articles: [
      { id: "debugger", title: "Using the Debugger", content: "The built-in debugger supports Node.js applications:\n\n1. Open the Debugger panel from the IDE sidebar\n2. Set breakpoints by clicking the line gutter or using the Breakpoints panel\n3. Click 'Start Debug Session' to launch your app with the debugger attached\n4. When a breakpoint is hit, inspect variables, step through code, and evaluate expressions\n\nDebugger features:\n- Breakpoints (line, conditional, logpoint)\n- Variable inspection with object expansion\n- Call stack navigation\n- Watch expressions\n- Debug console for evaluating expressions\n\nControls: Resume (F8), Step Over (F10), Step Into (F11), Step Out (Shift+F11)" },
      { id: "console-debug", title: "Console & Logs", content: "Multiple ways to debug your application:\n\n- Console panel: Shows stdout/stderr output from your running application\n- Debug console: Evaluate expressions at breakpoints\n- Browser DevTools: For frontend debugging (right-click > Inspect in the preview)\n- Deployment logs: View production logs from the Deployment panel\n\nThe console supports ANSI color codes for formatted output and includes timestamps for each log entry." },
    ],
  },
  {
    id: "security",
    title: "Security",
    icon: Shield,
    articles: [
      { id: "security-scanner", title: "Security Scanner", content: "E-Code includes a built-in security scanner that checks your code for:\n\n- Hardcoded secrets and credentials (API keys, passwords, tokens)\n- SQL injection vulnerabilities\n- XSS (Cross-Site Scripting) risks\n- Command injection\n- Path traversal attacks\n- Insecure dependencies with known CVEs\n- PII exposure in logs\n- Malicious code patterns (eval, exec, crypto mining)\n\nRun a scan from the Security panel in the IDE. The scanner supports JavaScript, TypeScript, Python, Go, Rust, Java, C++, PHP, and Ruby.\n\nResults are categorized by severity (Critical, High, Medium, Low) with actionable fix suggestions." },
      { id: "secrets-mgmt", title: "Secrets Management", content: "Best practices for handling secrets:\n\n1. Never hardcode API keys, passwords, or tokens in source code\n2. Use the Secrets panel to store sensitive values\n3. Access secrets via environment variables\n4. Rotate secrets regularly\n5. Use different secrets for development and production\n\nE-Code encrypts all secrets at rest. The security scanner will flag any secrets found in source files." },
      { id: "auth", title: "Authentication & Access Control", content: "E-Code supports multiple authentication methods:\n\n- Email/password with secure hashing (scrypt)\n- Google OAuth 2.0\n- GitHub OAuth\n- Email verification for new accounts\n- Password reset via email\n- Session management with secure cookies\n- CSRF protection on all state-changing operations\n\nAdmin users have access to the Admin panel for managing users, projects, and system settings." },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Plug,
    articles: [
      { id: "github-integration", title: "GitHub", content: "Connect your GitHub account to E-Code:\n\n1. Go to Settings > Connected Accounts\n2. Click 'Connect GitHub'\n3. Authorize the E-Code OAuth application\n\nOnce connected, you can:\n- Import repositories as new projects\n- Push commits to GitHub\n- Pull changes from GitHub\n- Auto-sync branches\n- View GitHub user info in the Git panel" },
      { id: "mcp-integrations", title: "MCP Directory", visual: "mcp", content: "The MCP (Model Context Protocol) Directory at /mcp-directory lets you browse and install MCP servers that extend the AI agent's capabilities:\n\n- Figma: Access design files, extract styles, and generate code from designs\n- And more integrations added regularly\n\nMCP servers give the AI agent access to external tools and data sources, making it more capable at specific tasks like design-to-code, database management, or API integration." },
      { id: "stripe", title: "Payments (Stripe)", content: "E-Code uses Stripe for subscription billing:\n\n- Multiple plan tiers (Free, Pro, Team, Enterprise)\n- Usage-based AI token billing\n- Automatic invoice generation\n- Secure payment processing\n- Webhook integration for real-time subscription updates\n\nManage your subscription from Settings > Billing." },
    ],
  },
  {
    id: "advanced",
    title: "Advanced Features",
    icon: Cpu,
    articles: [
      { id: "task-system", title: "Task System (Build & Plan Modes)", content: "The AI agent operates in two modes:\n\nBuild Mode:\n- The AI writes, edits, and runs code autonomously\n- Executes multi-step tasks with real-time progress\n- Automatically creates checkpoints before changes\n- Shows file diffs and terminal output as it works\n\nPlan Mode:\n- The AI creates structured task breakdowns\n- Tasks can be assigned to different agents\n- Dependencies between tasks are tracked\n- Progress is visible in the task panel\n\nSwitch between modes from the AI panel header." },
      { id: "automation", title: "Automation & Scheduling", content: "Set up automated workflows for your projects:\n\n- Cron-based scheduling (run tasks on a schedule)\n- Webhook triggers (execute on external events)\n- Slack/Telegram bot integration\n- Custom automation scripts\n\nAutomation is configured per-project and runs in the background even when you're not in the IDE." },
      { id: "frameworks", title: "Official Frameworks", visual: "frameworks", content: "E-Code provides official framework templates that are pre-configured and optimized:\n\n- React + Vite (TypeScript)\n- Express API (JavaScript)\n- Python Flask\n- Go HTTP Server\n- Next.js\n- And more\n\nFrameworks include best-practice project structure, development server configuration, and deployment settings out of the box.\n\nBrowse frameworks at /frameworks." },
      { id: "file-history", title: "File History & Blame", content: "Track changes to individual files:\n\n- File History: View all commits that modified a specific file, with timestamps and authors\n- Blame Annotations: See who last modified each line, with commit SHA and date\n\nAccess file history from the right-click context menu on any file in the file tree, or from the Git panel.\n\nBlame view shows inline annotations next to each line, making it easy to understand when and why code was changed." },
      { id: "merge-conflicts", title: "Merge Conflict Resolution", content: "When Git operations create conflicts, E-Code provides a guided resolution flow:\n\n1. The Merge Conflicts panel shows all conflicting files\n2. Each file displays both versions (yours vs. theirs) side by side\n3. Choose to accept your changes, their changes, or manually edit\n4. Mark each file as resolved\n5. Complete the merge with a commit\n\nYou can also abort the merge to return to the previous state.\n\nConflict markers (<<<<<<, =======, >>>>>>>) are highlighted in the editor for manual resolution." },
    ],
  },
  {
    id: "account",
    title: "Account & Billing",
    icon: Settings,
    articles: [
      { id: "pricing-plans", title: "Pricing Plans", visual: "pricing", content: "E-Code offers multiple pricing tiers:\n\n- Free: Limited projects, basic AI usage, community support\n- Pro: Unlimited projects, higher AI limits, priority support, custom domains\n- Team: Everything in Pro plus team workspaces, shared billing, role management\n- Enterprise: Custom limits, SLA, dedicated support, SSO\n\nAll plans include:\n- PostgreSQL database per project\n- Git version control\n- HTTPS deployments\n- Terminal access\n\nView detailed pricing at /pricing." },
      { id: "usage-billing", title: "Usage & Billing", content: "Track your usage from Settings > Usage & Billing:\n\n- AI token usage per model with cost breakdown\n- Storage usage across all projects\n- Bandwidth usage for deployed applications\n- Compute time for project sandboxes\n\nBilling is monthly. You can upgrade, downgrade, or cancel your plan at any time. Overage charges apply when you exceed your plan's included limits." },
      { id: "account-settings", title: "Account Settings", visual: "settings", content: "Manage your account from Settings:\n\n- Profile: Display name, email, avatar\n- Security: Change password, enable 2FA\n- Connected Accounts: GitHub, Google\n- Editor Preferences: Theme, font, keybindings\n- Notifications: Email and in-app notification preferences\n- CLI Access: Generate API keys for the E-Code CLI\n- Data Export: Download all your project data" },
    ],
  },
];

const screenshotMap: Record<string, { src: string; alt: string }> = {
  ide: { src: "/docs-images/ide.png", alt: "E-Code IDE workspace" },
  git: { src: "/docs-images/ide.png", alt: "E-Code version control" },
  database: { src: "/docs-images/ide.png", alt: "E-Code database panel" },
  ai: { src: "/docs-images/ide.png", alt: "E-Code assistant" },
  dashboard: { src: "/docs-images/dashboard.png", alt: "E-Code dashboard" },
  deploy: { src: "/docs-images/dashboard.png", alt: "E-Code deployment" },
  settings: { src: "/docs-images/settings.png", alt: "E-Code account settings" },
  themes: { src: "/docs-images/themes.png", alt: "E-Code themes explorer" },
  frameworks: { src: "/docs-images/frameworks.png", alt: "E-Code developer frameworks" },
  pricing: { src: "/docs-images/pricing.png", alt: "E-Code pricing plans" },
  community: { src: "/docs-images/community.png", alt: "E-Code community" },
  mcp: { src: "/docs-images/mcp-directory.png", alt: "E-Code MCP integrations directory" },
  help: { src: "/docs-images/help-center.png", alt: "E-Code help center" },
  landing: { src: "/docs-images/landing.png", alt: "E-Code landing page" },
};

export default function Documentation() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("getting-started");
  const [selectedArticle, setSelectedArticle] = useState("intro");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["getting-started"]));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const deviceType = useDeviceType();
  const isTablet = deviceType === "tablet";

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectArticle = (sectionId: string, articleId: string) => {
    setSelectedSection(sectionId);
    setSelectedArticle(articleId);
    setExpandedSections(prev => new Set(prev).add(sectionId));
    if (isMobile) setSidebarOpen(false);
  };

  const currentSection = docSections.find(s => s.id === selectedSection);
  const currentArticle = currentSection?.articles.find(a => a.id === selectedArticle);

  const filteredSections = searchQuery.trim()
    ? docSections.map(s => ({
        ...s,
        articles: s.articles.filter(a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.content.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.articles.length > 0)
    : docSections;

  const totalArticles = docSections.reduce((sum, s) => sum + s.articles.length, 0);

  const sidebarContent = (
    <>
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#0079F2]/50"
            data-testid="input-docs-search"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filteredSections.map(section => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          return (
            <div key={section.id} className="mb-1">
              <button
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--ide-surface)] transition-colors"
                onClick={() => toggleSection(section.id)}
                data-testid={`docs-section-${section.id}`}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                <Icon className="w-3.5 h-3.5 text-[var(--ide-text-secondary)]" />
                <span className="text-[12px] font-medium">{section.title}</span>
                <span className="ml-auto text-[9px] text-[var(--ide-text-muted)]">{section.articles.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-5 pl-3 border-l border-[var(--ide-border)]/50">
                  {section.articles.map(article => (
                    <button
                      key={article.id}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded-md transition-colors ${
                        selectedSection === section.id && selectedArticle === article.id
                          ? "bg-[#0079F2]/10 text-[#0079F2] font-medium"
                          : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                      }`}
                      onClick={() => selectArticle(section.id, article.id)}
                      data-testid={`docs-article-${article.id}`}
                    >
                      {article.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="docs-page">
      <header className={`flex items-center gap-3 ${isMobile ? 'px-3' : 'px-6'} h-14 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0`}>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          {!isMobile && <span className="text-[12px]">Home</span>}
        </button>
        <div className="w-px h-5 bg-[var(--ide-border)]" />
        <BookOpen className="w-4 h-4 text-[#0079F2]" />
        <h1 className="text-[14px] font-semibold">Documentation</h1>
        {!isMobile && (
          <span className="text-[10px] text-[var(--ide-text-muted)] bg-[var(--ide-surface)] px-2 py-0.5 rounded-full" data-testid="text-docs-stats">{docSections.length} sections · {totalArticles} articles</span>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {isMobile ? (
          <>
            {sidebarOpen && (
              <div
                className="absolute inset-0 bg-black/50 z-10"
                onClick={() => setSidebarOpen(false)}
                data-testid="sidebar-overlay"
              />
            )}
            <nav
              className={`absolute top-0 left-0 h-full w-72 max-w-[85vw] border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col z-20 transition-transform duration-200 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              data-testid="docs-sidebar"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
                <span className="text-[12px] font-semibold">Navigation</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  data-testid="button-close-sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {sidebarContent}
            </nav>
          </>
        ) : (
          <nav
            className={`${isTablet ? 'w-52' : 'w-64'} border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col shrink-0 overflow-hidden`}
            data-testid="docs-sidebar"
          >
            {sidebarContent}
          </nav>
        )}

        <main className="flex-1 overflow-y-auto min-w-0">
          {currentArticle ? (
            <div className={`max-w-3xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-4 md:px-6 lg:px-8 py-8'}`}>
              <div className="flex items-center gap-2 text-[11px] text-[var(--ide-text-muted)] mb-4">
                <span>{currentSection?.title}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[var(--ide-text)]">{currentArticle.title}</span>
              </div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold mb-6`} data-testid="docs-article-title">{currentArticle.title}</h2>
              
              {currentArticle.visual && screenshotMap[currentArticle.visual] && (
                <div className="mb-6 overflow-hidden">
                  <DocScreenshot
                    src={screenshotMap[currentArticle.visual].src}
                    alt={screenshotMap[currentArticle.visual].alt}
                  />
                </div>
              )}

              <div className="prose prose-invert max-w-none">
                {currentArticle.content.split("\n\n").map((paragraph, idx) => {
                  if (paragraph.startsWith("```")) {
                    const lines = paragraph.split("\n");
                    const code = lines.slice(1, -1).join("\n");
                    return (
                      <pre key={idx} className={`bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg ${isMobile ? 'p-3' : 'p-4'} my-4 overflow-x-auto`}>
                        <code className="text-[12px] font-mono text-[var(--ide-text)]">{code}</code>
                      </pre>
                    );
                  }
                  if (paragraph.startsWith("- ") || paragraph.startsWith("  - ")) {
                    const lines = paragraph.split("\n");
                    const items: { text: string; indent: number }[] = [];
                    lines.forEach(l => {
                      const match = l.match(/^(\s*)- (.*)$/);
                      if (match) {
                        items.push({ text: match[2], indent: match[1].length });
                      }
                    });
                    return (
                      <ul key={idx} className="my-3 space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-[var(--ide-text-secondary)] leading-relaxed" style={{ marginLeft: item.indent * 8 }}>
                            <span className={`mt-1.5 shrink-0 ${item.indent > 0 ? 'text-[var(--ide-text-muted)]' : 'text-[#0079F2]'}`}>•</span>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\./.test(paragraph)) {
                    const lines = paragraph.split("\n");
                    const result: React.ReactNode[] = [];
                    let currentNum = 0;
                    lines.forEach((l, i) => {
                      const numMatch = l.match(/^(\d+)\.\s*(.*)/);
                      const subMatch = l.match(/^\s+- (.*)/);
                      if (numMatch) {
                        currentNum++;
                        result.push(
                          <li key={i} className="flex gap-2 text-[13px] text-[var(--ide-text-secondary)] leading-relaxed">
                            <span className="text-[#0079F2] font-medium shrink-0">{currentNum}.</span>
                            <span>{numMatch[2]}</span>
                          </li>
                        );
                      } else if (subMatch) {
                        result.push(
                          <li key={i} className="flex gap-2 text-[13px] text-[var(--ide-text-secondary)] leading-relaxed ml-6">
                            <span className="text-[var(--ide-text-muted)] mt-1.5 shrink-0">•</span>
                            <span>{subMatch[1]}</span>
                          </li>
                        );
                      }
                    });
                    return <ol key={idx} className="my-3 space-y-1">{result}</ol>;
                  }
                  return <p key={idx} className="text-[13px] text-[var(--ide-text-secondary)] leading-relaxed my-3">{paragraph}</p>;
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-sm">
              Select an article to read
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
