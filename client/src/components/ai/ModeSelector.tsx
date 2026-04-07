import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Hammer, MessageSquare, Pencil, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AgentMode = 'plan' | 'build' | 'edit' | 'fast';

interface ModeSelectorProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
  className?: string;
}

export function ModeSelector({ mode, onChange, className }: ModeSelectorProps) {
  const modes = [
    {
      id: 'build' as const,
      label: 'Build',
      icon: Hammer,
      description: 'Make, test, iterate autonomously',
      badge: 'Auto',
      color: 'emerald'
    },
    {
      id: 'plan' as const,
      label: 'Plan',
      icon: MessageSquare,
      description: 'Ask questions, plan your work',
      color: 'blue'
    },
    {
      id: 'edit' as const,
      label: 'Edit',
      icon: Pencil,
      description: 'Targeted changes to specific files',
      color: 'purple'
    },
    {
      id: 'fast' as const,
      label: 'Fast',
      icon: Zap,
      description: 'Quick, precise changes in seconds',
      badge: 'Speed',
      color: 'amber'
    }
  ];

  const currentMode = modes.find(m => m.id === mode) || modes[0];
  const CurrentIcon = currentMode.icon;

  const getColorClasses = (color: string, type: 'trigger' | 'bg' | 'icon' | 'text' | 'dot' | 'badge') => {
    const colors: Record<string, Record<string, string>> = {
      emerald: {
        trigger: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "bg-emerald-100 dark:bg-emerald-900/50",
        text: "text-emerald-600 dark:text-emerald-400",
        dot: "bg-emerald-500",
        badge: "bg-emerald-500"
      },
      blue: {
        trigger: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        icon: "bg-blue-100 dark:bg-blue-900/50",
        text: "text-blue-600 dark:text-blue-400",
        dot: "bg-blue-500",
        badge: "bg-blue-500"
      },
      purple: {
        trigger: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50",
        bg: "bg-purple-50 dark:bg-purple-950/30",
        icon: "bg-purple-100 dark:bg-purple-900/50",
        text: "text-purple-600 dark:text-purple-400",
        dot: "bg-purple-500",
        badge: "bg-purple-500"
      },
      amber: {
        trigger: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        icon: "bg-amber-100 dark:bg-amber-900/50",
        text: "text-amber-600 dark:text-amber-400",
        dot: "bg-amber-500",
        badge: "bg-amber-500"
      }
    };
    return colors[color]?.[type] || colors.blue[type];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 gap-1 text-[11px] font-medium",
            getColorClasses(currentMode.color, 'trigger'),
            "border-0 rounded-full",
            className
          )}
          data-testid="mode-selector-trigger"
        >
          <CurrentIcon className="w-3 h-3" />
          {currentMode.label}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 z-[60]">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = m.id === mode;
          
          return (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onChange(m.id)}
              className={cn(
                "flex items-center gap-2.5 p-2.5 cursor-pointer min-h-[44px]",
                isActive && getColorClasses(m.color, 'bg')
              )}
              data-testid={`mode-option-${m.id}`}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                getColorClasses(m.color, 'icon')
              )}>
                <Icon className={cn("w-4 h-4", getColorClasses(m.color, 'text'))} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "font-medium text-[13px]",
                    isActive ? getColorClasses(m.color, 'text') : "text-gray-900 dark:text-gray-100"
                  )}>
                    {m.label}
                  </span>
                  {m.badge && (
                    <span className={cn(
                      "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full text-white",
                      getColorClasses(m.color, 'badge')
                    )}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {m.description}
                </div>
              </div>
              {isActive && (
                <div className={cn("w-2 h-2 rounded-full shrink-0", getColorClasses(m.color, 'dot'))} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
