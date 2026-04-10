/**
 * Tool Execution Badge - Visual indicators for AI tool usage
 * Displays tool type, status, and execution details
 */

import { 
  FileText, Edit, Trash2, Terminal, Package, FolderPlus, 
  Search, Globe, Brain, Code, CheckCircle2, Loader2, XCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ToolExecutionBadgeProps {
  tool: string;
  status: 'running' | 'success' | 'error';
  duration?: number;
  details?: string;
}

const TOOL_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  create_file: { icon: FileText, label: 'Create File', color: 'text-green-600 dark:text-green-400' },
  edit_file: { icon: Edit, label: 'Edit File', color: 'text-blue-600 dark:text-blue-400' },
  delete_file: { icon: Trash2, label: 'Delete File', color: 'text-red-600 dark:text-red-400' },
  run_command: { icon: Terminal, label: 'Run Command', color: 'text-purple-600 dark:text-purple-400' },
  install_package: { icon: Package, label: 'Install Package', color: 'text-orange-600 dark:text-orange-400' },
  create_folder: { icon: FolderPlus, label: 'Create Folder', color: 'text-teal-600 dark:text-teal-400' },
  search: { icon: Search, label: 'Search', color: 'text-indigo-600 dark:text-indigo-400' },
  web_search: { icon: Globe, label: 'Web Search', color: 'text-cyan-600 dark:text-cyan-400' },
  thinking: { icon: Brain, label: 'Thinking', color: 'text-violet-600 dark:text-violet-400' },
  code_analysis: { icon: Code, label: 'Code Analysis', color: 'text-pink-600 dark:text-pink-400' },
};

export function ToolExecutionBadge({ tool, status, duration, details }: ToolExecutionBadgeProps) {
  const config = TOOL_CONFIG[tool] || TOOL_CONFIG['thinking'];
  const Icon = config.icon;

  const statusConfig = {
    running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20', label: 'Running' },
    success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/20', label: 'Done' },
    error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20', label: 'Failed' },
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
        statusConfig[status].bg,
        "border-[var(--ecode-border)]"
      )}
      data-testid="tool-execution-badge"
    >
      <div className={cn("flex items-center gap-1.5")}>
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
        <span className="text-[11px] font-medium text-[var(--ecode-text)]">
          {config.label}
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 pl-1.5 border-l border-[var(--ecode-border)]">
        <StatusIcon 
          className={cn(
            "h-3 w-3", 
            statusConfig[status].color,
            status === 'running' && 'animate-spin'
          )} 
        />
        {duration !== undefined && (
          <span className="text-[11px] text-[var(--ecode-text-secondary)]">
            {duration}ms
          </span>
        )}
      </div>
      
      {details && (
        <span className="text-[11px] text-[var(--ecode-text-secondary)] max-w-[200px] truncate">
          {details}
        </span>
      )}
    </div>
  );
}

interface ToolExecutionListProps {
  tools: Array<{
    id: string;
    tool: string;
    status: 'running' | 'success' | 'error';
    duration?: number;
    details?: string;
  }>;
}

export function ToolExecutionList({ tools }: ToolExecutionListProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeTools = tools || [];
  
  if (safeTools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 my-3 max-w-full">
      {safeTools.map((tool) => (
        <ToolExecutionBadge
          key={tool.id}
          tool={tool.tool}
          status={tool.status}
          duration={tool.duration}
          details={tool.details}
        />
      ))}
    </div>
  );
}
