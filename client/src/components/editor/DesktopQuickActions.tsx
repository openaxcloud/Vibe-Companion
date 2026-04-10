import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bug,
  TestTube,
  FileCode,
  Zap,
  Search,
  GitCompare,
  Loader2
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type QuickAction = 
  | 'explain'
  | 'debug'
  | 'test'
  | 'document'
  | 'optimize'
  | 'review'
  | 'search';

interface DesktopQuickActionsProps {
  onAction: (action: QuickAction) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

interface ActionDefinition {
  id: QuickAction;
  label: string;
  icon: typeof Sparkles;
  description: string;
  shortcut?: string;
}

const ACTIONS: ActionDefinition[] = [
  {
    id: 'explain',
    label: 'Explain Code',
    icon: Sparkles,
    description: 'Get an AI explanation of selected code',
    shortcut: '⌘+E'
  },
  {
    id: 'debug',
    label: 'Find Bugs',
    icon: Bug,
    description: 'Detect potential bugs and issues',
    shortcut: '⌘+B'
  },
  {
    id: 'test',
    label: 'Generate Tests',
    icon: TestTube,
    description: 'Auto-generate unit tests',
    shortcut: '⌘+T'
  },
  {
    id: 'document',
    label: 'Add Docs',
    icon: FileCode,
    description: 'Generate JSDoc/TSDoc comments',
    shortcut: '⌘+D'
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: Zap,
    description: 'Performance optimization suggestions',
    shortcut: '⌘+O'
  },
  {
    id: 'review',
    label: 'Review',
    icon: GitCompare,
    description: 'Comprehensive code review',
    shortcut: '⌘+R'
  },
  {
    id: 'search',
    label: 'Smart Search',
    icon: Search,
    description: 'AI-powered code search',
    shortcut: '⌘+F'
  }
];

export function DesktopQuickActions({
  onAction,
  disabled = false,
  className = ''
}: DesktopQuickActionsProps) {
  const [loadingAction, setLoadingAction] = useState<QuickAction | null>(null);

  const handleAction = async (action: QuickAction) => {
    if (disabled || loadingAction) return;

    setLoadingAction(action);
    try {
      await onAction(action);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className={`flex items-center gap-1 p-2 border-b bg-background/95 ${className}`}>
      <div className="flex gap-1">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isLoading = loadingAction === action.id;

          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction(action.id)}
                  disabled={disabled || isLoading}
                  className="h-8 px-3 gap-2"
                  data-testid={`quick-action-${action.id}`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="hidden lg:inline text-[13px]">
                    {action.label}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-1">
                <p className="font-medium">{action.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {action.description}
                </p>
                {action.shortcut && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {action.shortcut}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
