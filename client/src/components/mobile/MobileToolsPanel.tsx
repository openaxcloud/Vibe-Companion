import { useState, useMemo } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence, type PanInfo } from '@/lib/motion';
import { 
  X, Search,
  FileText, Bot, Sparkles, Rocket, HardDrive, UserCheck,
  Terminal, Database, Code, GitBranch, Puzzle, Users,
  Eye, Key, Shield, TerminalSquare, Settings, Zap, Store, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ToolItem {
  id: string;
  icon: typeof Search;
  title: string;
  description: string;
  section: 'search' | 'tools';
}

const defaultTools: ToolItem[] = [
  { id: 'search', icon: Search, title: 'Search', description: 'Search through your files', section: 'search' },
  { id: 'files', icon: FileText, title: 'Files', description: 'Find a file', section: 'search' },
  { id: 'agent', icon: Bot, title: 'Agent', description: 'Agent can make changes, review its work, and debug itself automatically.', section: 'tools' },
  { id: 'assistant', icon: Sparkles, title: 'Assistant', description: 'Assistant answers questions, refines code, and makes precise edits.', section: 'tools' },
  { id: 'publishing', icon: Rocket, title: 'Publishing', description: 'Publish a live, stable, public version of your App.', section: 'tools' },
  { id: 'app-storage', icon: HardDrive, title: 'App Storage', description: "Built-in object storage for uploads like images, videos, and documents.", section: 'tools' },
  { id: 'auth', icon: UserCheck, title: 'Auth', description: 'Let users log in to your App using a prebuilt login page', section: 'tools' },
  { id: 'console', icon: Terminal, title: 'Console', description: 'View the terminal output after running your code', section: 'tools' },
  { id: 'database', icon: Database, title: 'Database', description: 'Stores structured data such as user profiles, game scores, and product catalogs.', section: 'tools' },
  { id: 'developer', icon: Code, title: 'Developer', description: 'Advanced developer tools and settings', section: 'tools' },
  { id: 'git', icon: GitBranch, title: 'Git', description: 'Version control for your App', section: 'tools' },
  { id: 'integrations', icon: Puzzle, title: 'Integrations', description: 'Connect to native and external services', section: 'tools' },
  { id: 'multiplayer', icon: Users, title: 'Multiplayer', description: 'Invite real-time collaborators and manage access to your App', section: 'tools' },
  { id: 'preview', icon: Eye, title: 'Preview', description: 'Preview your App', section: 'tools' },
  { id: 'kv-store', icon: Store, title: 'Key-Value Store', description: 'Easy-to-use key value store for caching and session management', section: 'tools' },
  { id: 'secrets', icon: Key, title: 'Secrets', description: 'Store sensitive information (like API keys) securely in your App', section: 'tools' },
  { id: 'security', icon: Shield, title: 'Security Scanner', description: 'Scan your app for vulnerabilities', section: 'tools' },
  { id: 'shell', icon: TerminalSquare, title: 'Shell', description: 'Directly access your App through a command line interface (CLI)', section: 'tools' },
  { id: 'settings', icon: Settings, title: 'User Settings', description: 'Configure personal editor preferences and workspace settings', section: 'tools' },
  { id: 'workflows', icon: Zap, title: 'Workflows', description: 'Configure different ways to run your App', section: 'tools' },
  { id: 'checkpoints', icon: History, title: 'Checkpoints', description: 'View and restore project checkpoints created during AI builds', section: 'tools' },
];

interface MobileToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool?: (toolId: string) => void;
}

export function MobileToolsPanel({
  isOpen,
  onClose,
  onSelectTool
}: MobileToolsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onClose();
    }
  };

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return defaultTools;
    const query = searchQuery.toLowerCase();
    return defaultTools.filter(
      tool =>
        tool.title.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const searchItems = filteredTools.filter(t => t.section === 'search');
  const toolItems = filteredTools.filter(t => t.section === 'tools');

  const handleSelect = (toolId: string) => {
    onSelectTool?.(toolId);
    onClose();
    setSearchQuery('');
  };
  
  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
            data-testid="mobile-tools-backdrop"
          />
          
          {/* Tools Panel */}
          <LazyMotionDiv
            className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[var(--ecode-background)] z-50 shadow-2xl flex flex-col"
            initial={{ y: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            data-testid="mobile-tools-panel"
          >
            {/* Header with Search */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ecode-text-muted)]" />
                <Input
                  type="text"
                  placeholder="Search for tools and files"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 h-10 bg-[var(--ecode-surface)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  data-testid="mobile-tools-search"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 shrink-0"
                data-testid="mobile-tools-close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Tools List */}
            <ScrollArea className="flex-1">
              <div className="py-2">
                {/* Search Section */}
                {searchItems.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-medium text-[var(--ecode-text-muted)] uppercase tracking-wider">
                        Search
                      </span>
                    </div>
                    {searchItems.map((tool) => (
                      <ToolRow key={tool.id} tool={tool} onSelect={handleSelect} />
                    ))}
                  </div>
                )}
                
                {/* Tools Section */}
                {toolItems.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5">
                      <span className="text-[11px] font-medium text-[var(--ecode-text-muted)] uppercase tracking-wider">
                        Tools
                      </span>
                    </div>
                    {toolItems.map((tool) => (
                      <ToolRow key={tool.id} tool={tool} onSelect={handleSelect} />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {filteredTools.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Search className="h-8 w-8 mx-auto mb-3 text-[var(--ecode-text-muted)]" />
                    <p className="text-[13px] text-[var(--ecode-text-muted)]">
                      No tools found for "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </LazyMotionDiv>
        </>
      )}
    </LazyAnimatePresence>
  );
}

function ToolRow({ 
  tool, 
  onSelect 
}: { 
  tool: ToolItem; 
  onSelect: (id: string) => void;
}) {
  const Icon = tool.icon;
  
  return (
    <LazyMotionButton
      onClick={() => onSelect(tool.id)}
      className={cn(
        "w-full px-4 py-3 flex items-start gap-3 text-left",
        "hover:bg-[var(--ecode-sidebar-hover)] active:bg-[var(--ecode-sidebar-active)]",
        "transition-colors touch-manipulation"
      )}
      whileTap={{ scale: 0.98 }}
      data-testid={`tool-${tool.id}`}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--ecode-surface)] border border-[var(--ecode-border)] flex items-center justify-center">
        <Icon className="h-4 w-4 text-[var(--ecode-text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px] text-[var(--ecode-text)]">
          {tool.title}
        </div>
        <div className="text-[11px] text-[var(--ecode-text-muted)] line-clamp-2 mt-0.5">
          {tool.description}
        </div>
      </div>
    </LazyMotionButton>
  );
}
