import { useState } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, ChevronRight, ChevronDown, Search, ArrowLeft,
  Code2, Terminal, Database, Shield, Zap, Layers, Settings,
  Box, GitBranch, Globe, Key, Palette, FileCode, Users,
  Play, Bug, Package, Cpu, Workflow, Bot
} from "lucide-react";

interface DocSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  articles: { id: string; title: string; content: string }[];
}

const docSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    articles: [
      { id: "intro", title: "Introduction to E-Code", content: "E-Code is a cloud-based integrated development environment (IDE) that lets you write, run, and deploy code directly from your browser. It supports multiple programming languages including JavaScript, TypeScript, Python, Go, Rust, Java, C++, Ruby, PHP, and more.\n\nEvery project runs in its own isolated sandbox with a full Linux environment, giving you access to a terminal, package manager, and all the tools you need." },
      { id: "create-project", title: "Creating a Project", content: "To create a new project:\n\n1. Click 'Create Project' from the dashboard\n2. Choose a language or framework template\n3. Name your project and click Create\n\nYou can also use AI to generate a project by describing what you want to build in the prompt box on the dashboard.\n\nProjects can be created from scratch, from a template, from a GitHub repository, or by importing a ZIP file." },
      { id: "editor", title: "Using the Editor", content: "The E-Code editor is powered by CodeMirror 6 with full language support:\n\n- Syntax highlighting for 20+ languages\n- IntelliSense and autocomplete\n- Multi-cursor editing (Ctrl/Cmd+D)\n- Find and replace (Ctrl/Cmd+F)\n- Code folding\n- Bracket matching\n- Minimap navigation\n- Custom themes\n\nThe editor integrates with LSP (Language Server Protocol) for real-time diagnostics, go-to-definition, and hover documentation." },
      { id: "running-code", title: "Running Your Code", content: "Click the Run button (or press Ctrl/Cmd+Enter) to execute your project. The output appears in the Console panel below the editor.\n\nFor web projects, a live preview opens automatically showing your application. The preview updates in real-time as you save changes.\n\nYou can also run individual files or custom commands from the terminal." },
    ],
  },
  {
    id: "features",
    title: "Core Features",
    icon: Layers,
    articles: [
      { id: "terminal", title: "Terminal", content: "Every project includes a full Linux terminal with bash shell access. You can:\n\n- Install system packages\n- Run scripts and commands\n- Use git from the command line\n- Access project files\n- Run background processes\n\nThe terminal supports multiple tabs, so you can run different processes simultaneously." },
      { id: "file-management", title: "File Management", content: "The file tree on the left side of the IDE shows all project files and folders. You can:\n\n- Create, rename, and delete files and folders\n- Drag and drop to reorganize\n- Upload files from your computer\n- Download files and folders\n- Search across all files with Ctrl/Cmd+Shift+F\n\nFiles are automatically saved as you type." },
      { id: "git", title: "Version Control (Git)", content: "E-Code has built-in Git integration:\n\n- View changed files and diffs\n- Stage and commit changes\n- Create and switch branches\n- Push to and pull from GitHub\n- View commit history\n- Resolve merge conflicts\n\nConnect your GitHub account from Settings to push/pull directly." },
      { id: "packages", title: "Package Management", content: "Install packages using the built-in package manager:\n\n- npm/yarn for JavaScript/TypeScript\n- pip for Python\n- cargo for Rust\n- go get for Go\n\nYou can also install packages from the terminal or use the Packages panel in the IDE sidebar." },
      { id: "database", title: "Database", content: "Every project can use a PostgreSQL database:\n\n- Automatic provisioning\n- SQL query editor with syntax highlighting\n- Table browser and schema viewer\n- Migration support via Drizzle ORM\n- Connection via DATABASE_URL environment variable\n\nUse the Database panel in the IDE to run queries and manage your schema." },
    ],
  },
  {
    id: "ai",
    title: "AI Features",
    icon: Bot,
    articles: [
      { id: "ai-agent", title: "AI Agent", content: "The AI Agent can help you write, debug, and understand code. It has access to your project files and can:\n\n- Generate new features from descriptions\n- Fix bugs and errors\n- Explain code and concepts\n- Refactor and optimize code\n- Write tests\n\nOpen the AI panel from the sidebar and describe what you need. The agent reads your project context to give relevant responses." },
      { id: "ai-models", title: "AI Models", content: "E-Code supports multiple AI models:\n\n- GPT-4o and GPT-4o-mini (OpenAI)\n- Claude 3.5 Sonnet (Anthropic)\n- Gemini Pro (Google)\n\nYou can switch models from the AI panel header. Different models have different strengths - GPT-4o is great for complex reasoning, Claude excels at code generation, and Gemini is fast for quick tasks.\n\nUsage is billed per token. Check your usage in Settings > Usage." },
      { id: "code-complete", title: "Code Completion", content: "AI-powered code completion suggests code as you type:\n\n- Tab to accept suggestions\n- Escape to dismiss\n- Contextual suggestions based on your project\n\nCode completion can be toggled on/off from Settings." },
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    icon: Globe,
    articles: [
      { id: "deploy-basics", title: "Deploying Your App", content: "Deploy your project to make it accessible on the internet:\n\n1. Click the Deploy tab in the IDE\n2. Configure your build and start commands\n3. Click Deploy\n\nYour app gets a .ecode.app subdomain automatically. You can also connect a custom domain.\n\nDeployments include:\n- Automatic HTTPS/TLS\n- Health checks\n- Auto-restart on crash\n- Environment variable management" },
      { id: "custom-domains", title: "Custom Domains", content: "To use a custom domain:\n\n1. Go to the Deployment panel\n2. Click 'Add Custom Domain'\n3. Enter your domain name\n4. Add the CNAME record to your DNS provider\n5. Wait for DNS propagation (usually 5-30 minutes)\n\nSSL certificates are provisioned automatically via Let's Encrypt." },
      { id: "env-vars", title: "Environment Variables", content: "Store sensitive values like API keys in environment variables:\n\n1. Open the Secrets panel in the IDE\n2. Add key-value pairs\n3. Access them in your code via process.env (Node.js) or os.environ (Python)\n\nSecrets are encrypted at rest and never exposed in logs or version control.\n\nYou can also set deployment-specific environment variables that only apply in production." },
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration",
    icon: Users,
    articles: [
      { id: "sharing", title: "Sharing Projects", content: "Share your project with others:\n\n- Share link: Anyone with the link can view your project\n- Invite collaborators: Add users by email with read or write access\n- Public projects: Make your project visible on your profile\n\nCollaborators can edit code in real-time with live cursors and presence indicators." },
      { id: "teams", title: "Teams", content: "Create a team to collaborate on multiple projects:\n\n- Shared project workspace\n- Team member management\n- Role-based access control (Owner, Admin, Member)\n- Team billing and usage tracking\n\nCreate a team from the Dashboard sidebar." },
    ],
  },
  {
    id: "settings",
    title: "Settings & Configuration",
    icon: Settings,
    articles: [
      { id: "ecode-config", title: "ecode.md Configuration", content: "The ecode.md file in your project root configures project behavior:\n\n```\nrun = \"node index.js\"\nlanguage = \"javascript\"\n\n[env]\nPORT = \"3000\"\n```\n\nSupported fields:\n- run: The command to execute your project\n- language: Primary language for syntax highlighting\n- build: Build command (runs before start)\n- [env]: Default environment variables\n- [deployment]: Deployment-specific settings" },
      { id: "themes", title: "Themes", content: "Customize the IDE appearance:\n\n- Choose from built-in themes (Dark, Light, Monokai, Solarized, etc.)\n- Create custom themes with the Theme Editor\n- Share themes with the community\n- Adjust font size, font family, and line height\n\nAccess themes from Settings or the Theme Explorer." },
      { id: "keybindings", title: "Keyboard Shortcuts", content: "Essential keyboard shortcuts:\n\n- Ctrl/Cmd+S: Save file\n- Ctrl/Cmd+Enter: Run project\n- Ctrl/Cmd+`: Toggle terminal\n- Ctrl/Cmd+B: Toggle sidebar\n- Ctrl/Cmd+P: Quick file open\n- Ctrl/Cmd+Shift+F: Search in files\n- Ctrl/Cmd+D: Select next occurrence\n- F5: Start debugger\n- F10: Step over\n- F11: Step into\n- Shift+F11: Step out" },
    ],
  },
  {
    id: "debugging",
    title: "Debugging",
    icon: Bug,
    articles: [
      { id: "debugger", title: "Using the Debugger", content: "The built-in debugger supports Node.js applications:\n\n1. Open the Debugger panel from the IDE sidebar\n2. Set breakpoints by clicking the line gutter or using the Breakpoints panel\n3. Click 'Start Debug Session' to launch your app with the debugger attached\n4. When a breakpoint is hit, inspect variables, step through code, and evaluate expressions\n\nDebugger controls:\n- Resume (F8): Continue execution\n- Step Over (F10): Execute current line\n- Step Into (F11): Enter function calls\n- Step Out (Shift+F11): Return from current function" },
      { id: "console-debug", title: "Debug Console", content: "The debug console lets you evaluate expressions while paused at a breakpoint:\n\n- Type any JavaScript expression and press Enter\n- Access local variables from the current scope\n- Modify variable values on the fly\n- Call functions in the current context\n\nThe console also shows console.log() output from your running application." },
    ],
  },
  {
    id: "security",
    title: "Security",
    icon: Shield,
    articles: [
      { id: "security-scanner", title: "Security Scanner", content: "E-Code includes a built-in security scanner that checks your code for:\n\n- Hardcoded secrets and credentials\n- SQL injection vulnerabilities\n- XSS (Cross-Site Scripting) risks\n- Command injection\n- Insecure dependencies\n- PII exposure in logs\n- Malicious code patterns\n\nRun a scan from the Security panel in the IDE. The scanner supports JavaScript, TypeScript, Python, Go, Rust, Java, C++, PHP, and Ruby." },
      { id: "secrets-mgmt", title: "Secrets Management", content: "Best practices for handling secrets:\n\n1. Never hardcode API keys, passwords, or tokens in source code\n2. Use the Secrets panel to store sensitive values\n3. Access secrets via environment variables\n4. Rotate secrets regularly\n5. Use different secrets for development and production\n\nE-Code encrypts all secrets at rest using AES-256 encryption." },
    ],
  },
];

export default function Documentation() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("getting-started");
  const [selectedArticle, setSelectedArticle] = useState("intro");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["getting-started"]));

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

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="docs-page">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[12px]">Dashboard</span>
        </button>
        <div className="w-px h-5 bg-[var(--ide-border)]" />
        <BookOpen className="w-4 h-4 text-[#0079F2]" />
        <h1 className="text-[14px] font-semibold">Documentation</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <nav className="w-64 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col shrink-0 overflow-hidden">
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
        </nav>

        <main className="flex-1 overflow-y-auto">
          {currentArticle ? (
            <div className="max-w-3xl mx-auto px-8 py-8">
              <div className="flex items-center gap-2 text-[11px] text-[var(--ide-text-muted)] mb-4">
                <span>{currentSection?.title}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[var(--ide-text)]">{currentArticle.title}</span>
              </div>
              <h2 className="text-2xl font-bold mb-6" data-testid="docs-article-title">{currentArticle.title}</h2>
              <div className="prose prose-invert max-w-none">
                {currentArticle.content.split("\n\n").map((paragraph, idx) => {
                  if (paragraph.startsWith("```")) {
                    const lines = paragraph.split("\n");
                    const code = lines.slice(1, -1).join("\n");
                    return (
                      <pre key={idx} className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-4 my-4 overflow-x-auto">
                        <code className="text-[12px] font-mono text-[var(--ide-text)]">{code}</code>
                      </pre>
                    );
                  }
                  if (paragraph.startsWith("- ")) {
                    return (
                      <ul key={idx} className="my-3 space-y-1.5">
                        {paragraph.split("\n").filter(l => l.startsWith("- ")).map((item, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-[var(--ide-text-secondary)] leading-relaxed">
                            <span className="text-[#0079F2] mt-1.5">•</span>
                            <span>{item.slice(2)}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\./.test(paragraph)) {
                    return (
                      <ol key={idx} className="my-3 space-y-1.5">
                        {paragraph.split("\n").filter(l => /^\d+\./.test(l)).map((item, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-[var(--ide-text-secondary)] leading-relaxed">
                            <span className="text-[#0079F2] font-medium shrink-0">{i + 1}.</span>
                            <span>{item.replace(/^\d+\.\s*/, "")}</span>
                          </li>
                        ))}
                      </ol>
                    );
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
