import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  FileCode, 
  Bot, 
  Rocket, 
  Database, 
  Terminal, 
  GitBranch, 
  Users, 
  Package, 
  Shield, 
  Code, 
  FolderTree,
  HardDrive,
  Settings
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'search' | 'tools';
}

const tools: Tool[] = [
  {
    id: 'search',
    name: 'Search',
    description: 'Search through your files',
    icon: Search,
    category: 'search',
  },
  {
    id: 'files',
    name: 'Files',
    description: 'Find a file',
    icon: FolderTree,
    category: 'search',
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'Agent can make changes, review its work, and debug itself automatically.',
    icon: Bot,
    category: 'tools',
  },
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'Assistant answers questions, refines code, and makes precise edits.',
    icon: Code,
    category: 'tools',
  },
  {
    id: 'publishing',
    name: 'Publishing',
    description: 'Publish a live, stable, public version of your App, unaffected by the changes you make in the workspace',
    icon: Rocket,
    category: 'tools',
  },
  {
    id: 'app-storage',
    name: 'App Storage',
    description: "App Storage is Replit's built-in object storage that lets your app easily host and save uploads like images, videos, and documents.",
    icon: HardDrive,
    category: 'tools',
  },
  {
    id: 'auth',
    name: 'Auth',
    description: 'Let users log in to your App using a prebuilt login page',
    icon: Shield,
    category: 'tools',
  },
  {
    id: 'console',
    name: 'Console',
    description: 'View the terminal output after running your code',
    icon: Terminal,
    category: 'tools',
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Stores structured data such as user profiles, game scores, and product catalogs.',
    icon: Database,
    category: 'tools',
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Advanced development tools',
    icon: Code,
    category: 'tools',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Version control for your App',
    icon: GitBranch,
    category: 'tools',
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Connect to Replit-native and external services',
    icon: Package,
    category: 'tools',
  },
  {
    id: 'multiplayer',
    name: 'Multiplayer',
    description: 'Invite real-time collaborators and manage access to your App',
    icon: Users,
    category: 'tools',
  },
  {
    id: 'preview',
    name: 'Preview',
    description: 'View your app in a browser',
    icon: FileCode,
    category: 'tools',
  },
];

interface ReplitToolsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToolSelect: (toolId: string) => void;
}

export function ReplitToolsSheet({ open, onOpenChange, onToolSelect }: ReplitToolsSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const searchTools = tools.filter(t => t.category === 'search');
  const regularTools = tools.filter(t => t.category === 'tools');

  const filteredSearchTools = searchQuery
    ? searchTools.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchTools;

  const filteredRegularTools = searchQuery
    ? regularTools.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : regularTools;

  const handleToolClick = (toolId: string) => {
    onToolSelect(toolId);
    onOpenChange(false);
    setSearchQuery('');
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-2xl p-0 bg-background border-t border-border"
        data-testid="tools-sheet"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-border space-y-3 bg-background">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-[15px]">Search for tools and files</SheetTitle>
              <button
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground text-[13px] font-medium"
                data-testid="button-close-tools"
              >
                Close
              </button>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for tools and files"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-surface-solid"
                data-testid="input-search-tools"
              />
            </div>
          </SheetHeader>

          {/* Tools List */}
          <div className="flex-1 overflow-y-auto">
            {/* Search Section */}
            {filteredSearchTools.length > 0 && (
              <div className="py-3">
                <div className="px-4 mb-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Search
                  </h3>
                </div>
                <div className="space-y-0.5">
                  {filteredSearchTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-tertiary-solid transition-colors text-left"
                        data-testid={`tool-${tool.id}`}
                      >
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[13px]">{tool.name}</div>
                          <div className="text-[11px] text-muted-foreground">{tool.description}</div>
                        </div>
                        <span className="text-muted-foreground">›</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tools Section */}
            {filteredRegularTools.length > 0 && (
              <div className="py-3">
                <div className="px-4 mb-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Tools
                  </h3>
                </div>
                <div className="space-y-0.5">
                  {filteredRegularTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-tertiary-solid transition-colors text-left"
                        data-testid={`tool-${tool.id}`}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0",
                          tool.id === 'agent' && "bg-surface-tertiary-solid",
                          tool.id === 'publishing' && "bg-surface-solid",
                          tool.id === 'database' && "bg-surface-solid",
                          tool.id === 'git' && "bg-surface-solid",
                          !['agent', 'publishing', 'database', 'git'].includes(tool.id) && "bg-surface-solid"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            tool.id === 'agent' && "text-primary",
                            tool.id === 'publishing' && "text-green-600 dark:text-green-500",
                            tool.id === 'database' && "text-blue-600 dark:text-blue-500",
                            tool.id === 'git' && "text-orange-600 dark:text-orange-500",
                            !['agent', 'publishing', 'database', 'git'].includes(tool.id) && "text-muted-foreground"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[13px] mb-0.5">{tool.name}</div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed">
                            {tool.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Results */}
            {searchQuery && filteredSearchTools.length === 0 && filteredRegularTools.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-[13px] text-muted-foreground">
                  No tools found for "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
