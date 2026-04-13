import { useState, useMemo, useCallback, memo, ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Search,
  FileText,
  Sparkles,
  Rocket,
  HardDrive,
  UserCheck,
  Terminal,
  Database,
  Code,
  GitBranch,
  Puzzle,
  Users,
  Eye,
  Key,
  Shield,
  TerminalSquare,
  Settings,
  Zap,
  Store,
  ChevronRight,
  X,
  ListChecks,
  Upload,
} from 'lucide-react';

const ReplitAgentIcon = memo(({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <circle cx="7" cy="7" r="2.5" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="7" cy="17" r="2.5" />
    <circle cx="17" cy="17" r="2.5" />
  </svg>
));
ReplitAgentIcon.displayName = 'ReplitAgentIcon';

export interface ToolItem {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  section: 'search' | 'tools';
  iconColor?: string;
}

const defaultTools: ToolItem[] = [
  { id: 'search', icon: Search, title: 'Search', description: 'Search through your files', section: 'search' },
  { id: 'files', icon: FileText, title: 'Files', description: 'Find a file', section: 'search' },
  { id: 'agent', icon: ReplitAgentIcon, title: 'Agent', description: 'Agent can make changes, review its work, and debug itself automatically.', section: 'tools', iconColor: 'text-[#7C65C1]' },
  { id: 'assistant', icon: Sparkles, title: 'Assistant', description: 'Assistant answers questions, refines code, and makes precise edits.', section: 'tools', iconColor: 'text-amber-500' },
  { id: 'publishing', icon: Rocket, title: 'Publishing', description: 'Publish a live, stable, public version of your App, unaffected by the changes you make in the workspace', section: 'tools', iconColor: 'text-green-500' },
  { id: 'app-storage', icon: HardDrive, title: 'App Storage', description: "App Storage is Replit's built-in object storage that lets your app easily host and save uploads like images, videos, and documents.", section: 'tools' },
  { id: 'auth', icon: UserCheck, title: 'Auth', description: 'Let users log in to your App using a prebuilt login page', section: 'tools', iconColor: 'text-blue-500' },
  { id: 'console', icon: Terminal, title: 'Console', description: 'View the terminal output after running your code', section: 'tools' },
  { id: 'database', icon: Database, title: 'Database', description: 'Stores structured data such as user profiles, game scores, and product catalogs.', section: 'tools', iconColor: 'text-cyan-500' },
  { id: 'developer', icon: Code, title: 'Developer', description: 'Advanced developer tools and settings', section: 'tools' },
  { id: 'git', icon: GitBranch, title: 'Git', description: 'Version control for your App', section: 'tools', iconColor: 'text-orange-500' },
  { id: 'integrations', icon: Puzzle, title: 'Integrations', description: 'Connect to Replit-native and external services', section: 'tools' },
  { id: 'collaboration', icon: Users, title: 'Collaboration', description: 'Share and collaborate with others on your App', section: 'tools', iconColor: 'text-pink-500' },
  { id: 'preview', icon: Eye, title: 'Preview', description: 'Preview your App', section: 'tools' },
  { id: 'kv-store', icon: Store, title: 'Replit Key-Value Store', description: 'Free, easy-to-use key value store suitable for unstructured data, caching, session management, fast lookups, and flexible data models', section: 'tools' },
  { id: 'secrets', icon: Key, title: 'Secrets', description: 'Store sensitive information (like API keys) securely in your App', section: 'tools' },
  { id: 'security', icon: Shield, title: 'Security Scanner', description: 'Scan your app for vulnerabilities', section: 'tools' },
  { id: 'shell', icon: TerminalSquare, title: 'Shell', description: 'Directly access your App through a command line interface (CLI)', section: 'tools' },
  { id: 'settings', icon: Settings, title: 'User Settings', description: 'Configure personal editor preferences and workspace settings which apply to all Apps', section: 'tools' },
  { id: 'workflows', icon: Zap, title: 'Workflows', description: 'Configure different ways to run your App', section: 'tools' },
  { id: 'tasks', icon: ListChecks, title: 'Tasks', description: 'Manage and track project tasks with Kanban board', section: 'tools', iconColor: 'text-violet-500' },
  { id: 'deployment', icon: Upload, title: 'Deploy', description: 'Deploy your app to production with custom domains and SSL', section: 'tools', iconColor: 'text-emerald-500' },
];

interface ReplitToolsSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
  className?: string;
}

export const ReplitToolsSheet = memo(function ReplitToolsSheet({
  open,
  onClose,
  onSelectTool,
  className,
}: ReplitToolsSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return defaultTools;
    const query = searchQuery.toLowerCase();
    return defaultTools.filter(
      tool =>
        tool.title.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const { searchItems, toolItems } = useMemo(() => ({
    searchItems: filteredTools.filter(t => t.section === 'search'),
    toolItems: filteredTools.filter(t => t.section === 'tools'),
  }), [filteredTools]);

  const handleSelect = useCallback((toolId: string) => {
    onSelectTool(toolId);
    onClose();
    setSearchQuery('');
  }, [onSelectTool, onClose]);

  const handleClose = useCallback(() => {
    onClose();
    setSearchQuery('');
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        data-testid="tools-sheet-backdrop"
        style={{ WebkitBackdropFilter: 'blur(4px)' }}
      />
      
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white dark:bg-gray-900 dark:bg-[#1C1C1C]',
          'rounded-t-2xl shadow-2xl',
          'flex flex-col',
          'max-h-[85vh]',
          'animate-in slide-in-from-bottom duration-300',
          className
        )}
        data-testid="tools-sheet"
      >
        <div className="flex-shrink-0 flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        <div className="flex-shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-gray-200 dark:border-gray-700 dark:border-gray-800">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Search for tools and files"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full h-10 px-4',
                'bg-gray-100 dark:bg-[#2A2A2A] border-0',
                'text-gray-900 dark:text-white dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400',
                'rounded-lg text-[15px]',
                'focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600'
              )}
              data-testid="tools-search-input"
              autoFocus
            />
          </div>
          <button
            onClick={handleClose}
            className="text-gray-900 dark:text-white dark:text-white font-medium text-[15px] active:opacity-50 transition-opacity px-2 touch-manipulation"
            data-testid="tools-sheet-close"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="py-2">
            {searchItems.length > 0 && (
              <div className="mb-2">
                <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-4">
                  Search
                </h3>
                <div>
                  {searchItems.map((item) => (
                    <ToolItemRow
                      key={item.id}
                      item={item}
                      onSelect={handleSelect}
                      showArrow
                    />
                  ))}
                </div>
              </div>
            )}

            {toolItems.length > 0 && (
              <div>
                <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-4">
                  Tools
                </h3>
                <div>
                  {toolItems.map((item) => (
                    <ToolItemRow
                      key={item.id}
                      item={item}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredTools.length === 0 && (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-[15px]">No tools found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

interface ToolItemRowProps {
  item: ToolItem;
  onSelect: (id: string) => void;
  showArrow?: boolean;
}

const ToolItemRow = memo(function ToolItemRow({ item, onSelect, showArrow }: ToolItemRowProps) {
  const Icon = item.icon;
  
  const handleClick = useCallback(() => {
    onSelect(item.id);
  }, [onSelect, item.id]);
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3',
        'text-left transition-colors duration-100',
        'active:bg-gray-100 dark:active:bg-[#2A2A2A]',
        'touch-manipulation'
      )}
      data-testid={`tool-item-${item.id}`}
    >
      <div className={cn(
        'flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5',
        item.iconColor || 'text-gray-600 dark:text-gray-400'
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-white dark:text-white text-[15px] leading-tight">
          {item.title}
        </div>
        <div className="text-[13px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5 line-clamp-2">
          {item.description}
        </div>
      </div>
      {showArrow && (
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 mt-1">
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </button>
  );
});
