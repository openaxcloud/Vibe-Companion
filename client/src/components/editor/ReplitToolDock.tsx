import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Folder,
  Search,
  Sparkles,
  GitBranch,
  Bug,
  Database,
  Package,
  Lock,
  Settings,
  HelpCircle,
  Grid,
  Terminal,
  HardDrive
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Tool {
  id: string;
  name: string;
  icon: React.ElementType;
  section?: 'top' | 'bottom';
}

interface ReplitToolDockProps {
  activeTool: string;
  onToolChange: (toolId: string) => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

const tools: Tool[] = [
  // Top section - main tools
  { id: 'files', name: 'Files', icon: Folder, section: 'top' },
  { id: 'search', name: 'Search', icon: Search, section: 'top' },
  { id: 'git', name: 'Git', icon: GitBranch, section: 'top' },
  { id: 'debug', name: 'Debugger', icon: Bug, section: 'top' },
  { id: 'agent', name: 'AI Agent', icon: Sparkles, section: 'top' },
  { id: 'database', name: 'Database', icon: Database, section: 'top' },
  { id: 'secrets', name: 'Secrets', icon: Lock, section: 'top' },
  { id: 'shell', name: 'Shell', icon: Terminal, section: 'top' },
  { id: 'packages', name: 'Packages', icon: Package, section: 'top' },
  { id: 'storage', name: 'App Storage', icon: HardDrive, section: 'top' },
  // Bottom section
  { id: 'settings', name: 'Settings', icon: Settings, section: 'bottom' },
];

export function ReplitToolDock({ 
  activeTool, 
  onToolChange,
  isCollapsed = false,
  onCollapseToggle 
}: ReplitToolDockProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  
  const topTools = tools.filter(t => t.section === 'top');
  const bottomTools = tools.filter(t => t.section === 'bottom');

  const renderTool = (tool: Tool) => {
    const Icon = tool.icon;
    const isActive = activeTool === tool.id;
    
    return (
      <Tooltip key={tool.id} delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange(tool.id)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            className={cn(
              "w-full h-8 flex items-center justify-center relative transition-all duration-150",
              isActive && "bg-[var(--ecode-surface-elevated)]",
              !isActive && hoveredTool === tool.id && "bg-[var(--ecode-surface-hover)]"
            )}
          >
            {/* Active indicator - 2px left border */}
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--ecode-accent)]" />
            )}
            
            {/* Icon - 18px size */}
            <Icon className={cn(
              "h-[18px] w-[18px] transition-colors",
              isActive ? "text-[var(--ecode-accent)]" : "text-[var(--ecode-text-secondary)]"
            )} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-[11px]">
          {tool.name}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="w-[40px] h-full border-r border-[var(--ecode-border)] bg-[var(--ecode-sidebar-bg)] flex flex-col">
      {/* Top section tools */}
      <div className="flex-1 py-1">
        <TooltipProvider>
          {topTools.map(renderTool)}
        </TooltipProvider>
      </div>

      {/* Bottom section tools */}
      <div className="py-1 border-t border-[var(--ecode-border)]">
        <TooltipProvider>
          {bottomTools.map(renderTool)}
        </TooltipProvider>
      </div>
    </div>
  );
}