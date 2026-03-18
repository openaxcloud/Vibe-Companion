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
  Zap, Layers, Search, HardDrive
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
