import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Brain,
  Sparkles,
  MousePointer2,
  Coins,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatToolbarProps {
  extendedThinking: boolean;
  highPowerModels: boolean;
  onToggleExtendedThinking: () => void;
  onToggleHighPowerModels: () => void;
  onToggleElementSelector?: () => void;
  elementSelectorActive?: boolean;
  isUpdating?: boolean;
  credits?: number;
  onOpenUsage?: () => void;
  className?: string;
}

export function ChatToolbar({
  extendedThinking,
  highPowerModels,
  onToggleExtendedThinking,
  onToggleHighPowerModels,
  onToggleElementSelector,
  elementSelectorActive = false,
  isUpdating = false,
  credits,
  onOpenUsage,
  className,
}: ChatToolbarProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted/50 border",
        className
      )}
      data-testid="chat-toolbar"
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={extendedThinking ? "default" : "ghost"}
              size="sm"
              onClick={onToggleExtendedThinking}
              disabled={isUpdating}
              className={cn(
                "h-11 w-11 p-0 md:h-9 md:w-9 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] touch-manipulation",
                extendedThinking && "bg-purple-600 hover:bg-purple-700 text-white"
              )}
              data-testid="toolbar-extended-thinking"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="font-medium">Extended Thinking</p>
            <p className="text-[11px] text-muted-foreground">
              Deeper reasoning for harder problems
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={highPowerModels ? "default" : "ghost"}
              size="sm"
              onClick={onToggleHighPowerModels}
              disabled={isUpdating}
              className={cn(
                "h-11 w-11 p-0 md:h-9 md:w-9 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] touch-manipulation",
                highPowerModels && "bg-orange-500 hover:bg-orange-600 text-white"
              )}
              data-testid="toolbar-high-power"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="font-medium">High Power Mode</p>
            <p className="text-[11px] text-muted-foreground">
              Use sophisticated AI for complex tasks
            </p>
          </TooltipContent>
        </Tooltip>

        {onToggleElementSelector && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={elementSelectorActive ? "default" : "ghost"}
                size="sm"
                onClick={onToggleElementSelector}
                className={cn(
                  "h-11 w-11 p-0 md:h-9 md:w-9 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] touch-manipulation",
                  elementSelectorActive && "bg-violet-600 hover:bg-violet-700 text-white"
                )}
                data-testid="toolbar-element-selector"
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">Element Selector</p>
              <p className="text-[11px] text-muted-foreground">
                Click any element to edit it visually
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="h-4 w-px bg-border mx-1" />

        {credits !== undefined && onOpenUsage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenUsage}
                className="h-8 gap-1.5 px-2 text-[11px]"
                data-testid="toolbar-usage"
              >
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">{credits.toLocaleString()}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">Credits remaining</p>
              <p className="text-[11px] text-muted-foreground">Click to view usage</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}

export function ChatToolbarMobile({
  extendedThinking,
  highPowerModels,
  onToggleExtendedThinking,
  onToggleHighPowerModels,
  isUpdating = false,
  className,
}: Omit<ChatToolbarProps, 'onToggleElementSelector' | 'elementSelectorActive' | 'credits' | 'onOpenUsage'>) {
  return (
    <div 
      className={cn(
        "flex items-center justify-start gap-2",
        className
      )}
      data-testid="chat-toolbar-mobile"
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={extendedThinking ? "default" : "ghost"}
              size="sm"
              onClick={onToggleExtendedThinking}
              disabled={isUpdating}
              className={cn(
                "h-11 w-11 p-0 min-h-[44px] min-w-[44px] touch-manipulation",
                extendedThinking && "bg-purple-600 hover:bg-purple-700 text-white"
              )}
              data-testid="toolbar-mobile-thinking"
            >
              {isUpdating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Brain className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-medium">Extended Thinking</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={highPowerModels ? "default" : "ghost"}
              size="sm"
              onClick={onToggleHighPowerModels}
              disabled={isUpdating}
              className={cn(
                "h-11 w-11 p-0 min-h-[44px] min-w-[44px] touch-manipulation",
                highPowerModels && "bg-orange-500 hover:bg-orange-600 text-white"
              )}
              data-testid="toolbar-mobile-power"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-medium">High Power Mode</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default ChatToolbar;
