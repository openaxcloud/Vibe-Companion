import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Zap,
  TestTube2,
  Globe,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentTools, type AgentToolsSettings } from '@/hooks/useAgentTools';

interface AgentToolsPanelProps {
  projectId?: number;
  onViewVideoReplays?: () => void;
  className?: string;
  settings?: AgentToolsSettings;
  onSettingsChange?: (settings: AgentToolsSettings) => void;
  videoReplayCount?: number;
  compact?: boolean;
  actualModelName?: string;
}

export function AgentToolsPanel({
  projectId,
  onViewVideoReplays,
  className,
  settings: externalSettings,
  onSettingsChange,
  videoReplayCount: externalVideoReplayCount,
  compact = false,
  actualModelName,
}: AgentToolsPanelProps) {
  const effectiveSettings: AgentToolsSettings = {
    maxAutonomy: externalSettings?.maxAutonomy ?? false,
    appTesting: externalSettings?.appTesting ?? true,
    extendedThinking: externalSettings?.extendedThinking ?? false,
    highPowerModels: externalSettings?.highPowerModels ?? false,
    webSearch: externalSettings?.webSearch ?? true,
    imageGeneration: externalSettings?.imageGeneration ?? true,
  };

  const hookData = useAgentTools(projectId);

  const {
    updateSettings: hookUpdateSettings,
    isUpdating,
    isLoadingPreferences,
    videoReplayCount: hookVideoReplayCount,
  } = hookData;

  const updateSettingsRef = useRef(onSettingsChange || hookUpdateSettings);
  useEffect(() => {
    updateSettingsRef.current = onSettingsChange || hookUpdateSettings;
  }, [onSettingsChange, hookUpdateSettings]);

  const videoReplayCount = externalVideoReplayCount ?? hookVideoReplayCount;

  const handleToggle = useCallback((key: keyof AgentToolsSettings, newValue: boolean) => {
    const newSettings: AgentToolsSettings = {
      ...effectiveSettings,
      [key]: newValue,
    };
    updateSettingsRef.current(newSettings);
  }, [effectiveSettings]);

  const tools = [
    {
      key: 'maxAutonomy' as const,
      icon: Zap,
      label: 'Max autonomy',
      shortLabel: 'Autonomy',
      tooltip: 'Agent supervises itself — runs up to 200 min',
      active: effectiveSettings.maxAutonomy,
      activeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      dotColor: 'bg-amber-500',
    },
    {
      key: 'appTesting' as const,
      icon: TestTube2,
      label: 'App testing',
      shortLabel: 'Testing',
      tooltip: 'Agent tests using a real browser',
      active: effectiveSettings.appTesting,
      activeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dotColor: 'bg-emerald-500',
    },
    {
      key: 'webSearch' as const,
      icon: Globe,
      label: 'Web search',
      shortLabel: 'Search',
      tooltip: 'Search the internet for information',
      active: effectiveSettings.webSearch,
      activeColor: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
      dotColor: 'bg-green-500',
    },
    {
      key: 'imageGeneration' as const,
      icon: ImageIcon,
      label: 'Images',
      shortLabel: 'Images',
      tooltip: 'Generate images, icons, and graphics with AI',
      active: effectiveSettings.imageGeneration,
      activeColor: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
      dotColor: 'bg-pink-500',
    },
  ];

  if (isLoadingPreferences) {
    return (
      <div className={cn("flex items-center gap-1.5 px-1 py-1", className)}>
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        "flex items-center gap-1 px-1 py-1 flex-wrap",
        className
      )}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Tooltip key={tool.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleToggle(tool.key, !tool.active)}
                  disabled={isUpdating}
                  data-testid={`toggle-${tool.key.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150 cursor-pointer",
                    "hover:opacity-80 active:scale-95 disabled:opacity-50",
                    tool.active
                      ? tool.activeColor
                      : "bg-transparent text-muted-foreground border-transparent hover:border-border/50"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tool.shortLabel}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px]">
                <p className="font-medium">{tool.label}</p>
                <p className="text-muted-foreground">{tool.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {isUpdating && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />
        )}
      </div>
    </TooltipProvider>
  );
}

export type { AgentToolsSettings };
