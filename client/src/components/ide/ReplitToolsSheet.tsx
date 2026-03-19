import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Terminal, Database, Globe, Key, GitBranch, Package,
  Brain, Rocket, Bug, Workflow, Clock, Puzzle,
  FileCode, MessageSquare, BarChart3, Shield,
  Zap, Layers, Search, HardDrive, Presentation, Video,
  Play, Paintbrush, Palette, FlaskConical, Users, Eye,
  ScrollText, Activity, Wand2,
  Bot, Inbox, Github, Plug, Cpu, Network, Upload,
  Sparkles, Server, MessageCircle, ShieldCheck, Wrench,
} from 'lucide-react';

interface ToolDefinition {
  id: string;
  label: string;
  description: string;
  icon: typeof Terminal;
  category: string;
  color: string;
}

const tools: ToolDefinition[] = [
  { id: 'shell', label: 'Shell', description: 'Run commands in a terminal', icon: Terminal, category: 'Core', color: '#0CCE6B' },
  { id: 'database', label: 'Database', description: 'PostgreSQL, SQLite, or Key-Value store', icon: Database, category: 'Core', color: '#0079F2' },
  { id: 'webview', label: 'Webview', description: 'Preview your running application', icon: Globe, category: 'Core', color: '#7C65CB' },
  { id: 'secrets', label: 'Secrets', description: 'Manage environment variables', icon: Key, category: 'Core', color: '#F26522' },
  { id: 'git', label: 'Git', description: 'Version control with Git', icon: GitBranch, category: 'Core', color: '#F26522' },
  { id: 'packages', label: 'Packages', description: 'Install and manage dependencies', icon: Package, category: 'Core', color: '#0079F2' },
  { id: 'ai-assistant', label: 'AI Assistant', description: 'Get help from an AI coding agent', icon: Brain, category: 'AI', color: '#7C65CB' },
  { id: 'ai-chat', label: 'AI Chat', description: 'Chat with AI about your code', icon: MessageSquare, category: 'AI', color: '#7C65CB' },
  { id: 'deployment', label: 'Deployments', description: 'Deploy and manage your app', icon: Rocket, category: 'Deploy', color: '#0079F2' },
  { id: 'debugger', label: 'Debugger', description: 'Debug your application', icon: Bug, category: 'Development', color: '#F26522' },
  { id: 'workflows', label: 'Workflows', description: 'Automate tasks and CI/CD', icon: Workflow, category: 'Development', color: '#0CCE6B' },
  { id: 'history', label: 'History', description: 'Browse file change history', icon: Clock, category: 'Development', color: '#0079F2' },
  { id: 'extensions', label: 'Extensions', description: 'Add third-party extensions', icon: Puzzle, category: 'Development', color: '#7C65CB' },
  { id: 'lsp', label: 'Language Server', description: 'Code intelligence and autocomplete', icon: FileCode, category: 'Development', color: '#0CCE6B' },
  { id: 'analytics', label: 'Analytics', description: 'View usage and performance metrics', icon: BarChart3, category: 'Monitoring', color: '#0079F2' },
  { id: 'auth', label: 'Authentication', description: 'Add user authentication', icon: Shield, category: 'Services', color: '#F26522' },
  { id: 'api-tester', label: 'API Tester', description: 'Test HTTP endpoints', icon: Zap, category: 'Development', color: '#0CCE6B' },
  { id: 'docker', label: 'Docker', description: 'Containerized environments', icon: Layers, category: 'Infrastructure', color: '#0079F2' },
  { id: 'search', label: 'Search & Replace', description: 'Find and replace across files', icon: Search, category: 'Core', color: '#0079F2' },
  { id: 'storage', label: 'Object Storage', description: 'Store files and assets', icon: HardDrive, category: 'Services', color: '#7C65CB' },
  { id: 'slides', label: 'Slide Editor', description: 'Create presentations with slides', icon: Presentation, category: 'Creative', color: '#F5A623' },
  { id: 'video', label: 'Video Editor', description: 'Edit videos with scenes and effects', icon: Video, category: 'Creative', color: '#E54D4D' },
  { id: 'animation', label: 'Animation Preview', description: 'Preview and export animations', icon: Play, category: 'Creative', color: '#0CCE6B' },
  { id: 'design', label: 'Design Canvas', description: 'Visual design with frames and annotations', icon: Paintbrush, category: 'Creative', color: '#7C65CB' },
  { id: 'themes', label: 'Themes', description: 'Customize IDE appearance and themes', icon: Palette, category: 'Settings', color: '#F26522' },
  { id: 'testing', label: 'Tests', description: 'Run and manage test suites', icon: FlaskConical, category: 'Development', color: '#0CCE6B' },
  { id: 'collaboration', label: 'Collaboration', description: 'Real-time multiplayer editing', icon: Users, category: 'Core', color: '#0079F2' },
  { id: 'checkpoints', label: 'Checkpoints', description: 'Save and restore project states', icon: Clock, category: 'Development', color: '#7C65CB' },
  { id: 'console', label: 'Console', description: 'View application output and logs', icon: Terminal, category: 'Core', color: '#0CCE6B' },
  { id: 'resources', label: 'Resources', description: 'Monitor CPU, memory and disk usage', icon: Activity, category: 'Monitoring', color: '#10B981' },
  { id: 'logs', label: 'Logs Viewer', description: 'Browse application and deployment logs', icon: ScrollText, category: 'Monitoring', color: '#0079F2' },
  { id: 'visual-editor', label: 'Visual Editor', description: 'Point-and-click UI editing', icon: Wand2, category: 'Creative', color: '#7C65CB' },
  { id: 'preview', label: 'Web Preview', description: 'Preview your running web application', icon: Eye, category: 'Core', color: '#0079F2' },
  { id: 'security', label: 'Security', description: 'Scan for vulnerabilities and issues', icon: Shield, category: 'Development', color: '#E54D4D' },
  { id: 'settings', label: 'Settings', description: 'Editor and workspace settings', icon: Zap, category: 'Settings', color: '#0079F2' },
  { id: 'terminal', label: 'Terminal', description: 'Embedded terminal emulator', icon: Terminal, category: 'Core', color: '#0CCE6B' },
  // Re-integrated panels
  { id: 'github', label: 'GitHub', description: 'Push, pull, and sync with GitHub', icon: Github, category: 'Core', color: '#F0F6FC' },
  { id: 'automations', label: 'Automations', description: 'Automate tasks with agents', icon: Bot, category: 'AI', color: '#0CCE6B' },
  { id: 'config', label: 'Config', description: 'Edit .replit and Nix configuration', icon: FileCode, category: 'Settings', color: '#0079F2' },
  { id: 'feedback', label: 'Feedback Inbox', description: 'View and manage user feedback', icon: Inbox, category: 'Services', color: '#F5A623' },
  { id: 'integrations', label: 'Integrations', description: 'Connect third-party services', icon: Plug, category: 'Services', color: '#7C65CB' },
  { id: 'mcp', label: 'MCP', description: 'Model Context Protocol tools', icon: Cpu, category: 'AI', color: '#0079F2' },
  { id: 'merge-conflicts', label: 'Merge Conflicts', description: 'Resolve git merge conflicts', icon: GitBranch, category: 'Development', color: '#E54D4D' },
  { id: 'monitoring', label: 'Monitoring', description: 'Application metrics and alerts', icon: BarChart3, category: 'Monitoring', color: '#10B981' },
  { id: 'networking', label: 'Networking', description: 'Manage ports and network config', icon: Network, category: 'Infrastructure', color: '#0079F2' },
  { id: 'publishing', label: 'Publishing', description: 'Publish and distribute your project', icon: Upload, category: 'Deploy', color: '#0CCE6B' },
  { id: 'skills', label: 'Skills', description: 'AI agent skills and capabilities', icon: Sparkles, category: 'AI', color: '#F5A623' },
  { id: 'ssh', label: 'SSH', description: 'Secure shell access to workspace', icon: Server, category: 'Infrastructure', color: '#6B7280' },
  { id: 'threads', label: 'Threads', description: 'Discussion threads on code', icon: MessageCircle, category: 'Core', color: '#7C65CB' },
  { id: 'test-runner', label: 'Test Runner', description: 'Execute and monitor test suites', icon: FlaskConical, category: 'Development', color: '#0CCE6B' },
  { id: 'security-scanner', label: 'Security Scanner', description: 'Deep security vulnerability scanning', icon: ShieldCheck, category: 'Development', color: '#E54D4D' },
  { id: 'backup', label: 'Backup & Recovery', description: 'Backup and restore project data', icon: HardDrive, category: 'Infrastructure', color: '#0079F2' },
];

interface ReplitToolsSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
}

export function ReplitToolsSheet({ open, onClose, onSelectTool }: ReplitToolsSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(tools.map((t) => t.category)));

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      !searchQuery ||
      tool.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelect = (toolId: string) => {
    onSelectTool(toolId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl bg-[var(--ide-panel)] border-[var(--ide-border)] text-[var(--ide-text)]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[var(--ide-text)]">
            Add Tool
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--ide-text-muted)]">
            Browse and add tools to your workspace
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0079F2] transition-colors"
            autoFocus
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              !selectedCategory
                ? 'bg-[#0079F2]/15 text-[#0079F2]'
                : 'bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                cat === selectedCategory
                  ? 'bg-[#0079F2]/15 text-[#0079F2]'
                  : 'bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 max-h-[400px] overflow-y-auto pr-1">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => handleSelect(tool.id)}
                className="flex items-start gap-3 p-3 rounded-lg bg-[var(--ide-surface)] border border-transparent hover:border-[var(--ide-border)] hover:bg-[var(--ide-hover)] transition-all text-left group"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${tool.color}15` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: tool.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--ide-text)] group-hover:text-[var(--ide-text)]">
                    {tool.label}
                  </div>
                  <div className="text-xs text-[var(--ide-text-muted)] mt-0.5 line-clamp-2">
                    {tool.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--ide-text-muted)]">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No tools found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
