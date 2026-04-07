import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Globe, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface WebSearchToggleProps {
  enabled: boolean;
  onToggle: () => void;
  isUpdating?: boolean;
  variant?: 'button' | 'switch' | 'prominent';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function WebSearchToggle({
  enabled,
  onToggle,
  isUpdating = false,
  variant = 'button',
  size = 'md',
  showLabel = true,
  className,
}: WebSearchToggleProps) {
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-9 w-9',
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  if (variant === 'switch') {
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="web-search-toggle-switch">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          enabled ? "bg-blue-100 dark:bg-blue-900/50" : "bg-muted"
        )}>
          <Globe className={cn(
            "h-4 w-4",
            enabled ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
          )} />
        </div>
        {showLabel && (
          <span className={cn(
            "text-[13px] font-medium",
            enabled ? "text-foreground" : "text-muted-foreground"
          )}>
            Web Search
          </span>
        )}
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={isUpdating}
          className="data-[state=checked]:bg-blue-500"
          data-testid="web-search-switch"
        />
        <LazyAnimatePresence>
          {enabled && (
            <LazyMotionDiv
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Badge 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
              >
                Web
              </Badge>
            </LazyMotionDiv>
          )}
        </LazyAnimatePresence>
      </div>
    );
  }

  if (variant === 'prominent') {
    return (
      <LazyMotionDiv
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
          enabled 
            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" 
            : "bg-muted/30 border-border hover:bg-muted/50",
          className
        )}
        data-testid="web-search-toggle-prominent"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className="flex items-center gap-2 flex-1"
          data-testid="web-search-prominent-button"
        >
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            enabled 
              ? "bg-blue-500 text-white" 
              : "bg-muted text-muted-foreground"
          )}>
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium">Web Search</span>
              <LazyAnimatePresence>
                {enabled && (
                  <LazyMotionDiv
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300"
                    >
                      Active
                    </Badge>
                  </LazyMotionDiv>
                )}
              </LazyAnimatePresence>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {enabled ? "Searching web for docs & APIs" : "Enable to search the internet"}
            </p>
          </div>
          <Search className={cn(
            "h-4 w-4 transition-colors",
            enabled ? "text-blue-500" : "text-muted-foreground"
          )} />
        </button>
      </LazyMotionDiv>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={enabled ? "default" : "ghost"}
            size="sm"
            onClick={onToggle}
            disabled={isUpdating}
            className={cn(
              sizeClasses[size],
              "p-0 min-h-[32px] min-w-[32px] relative",
              enabled && "bg-blue-500 hover:bg-blue-600 text-white",
              className
            )}
            data-testid="web-search-toggle-button"
          >
            {isUpdating ? (
              <Loader2 className={cn(iconSizes[size], "animate-spin")} />
            ) : (
              <Globe className={iconSizes[size]} />
            )}
            <LazyAnimatePresence>
              {enabled && (
                <LazyMotionDiv
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute -top-1 -right-1"
                >
                  <span className="flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-300" />
                  </span>
                </LazyMotionDiv>
              )}
            </LazyAnimatePresence>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium">Web Search</p>
          <p className="text-[11px] text-muted-foreground">
            {enabled 
              ? "Currently searching the web for docs and APIs" 
              : "Enable to search for up-to-date information"
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WebSearchBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      data-testid="web-search-badge"
    >
      <Badge 
        variant="outline" 
        className="text-[10px] px-1.5 py-0 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 gap-1"
      >
        <Globe className="h-3 w-3" />
        Web
      </Badge>
    </LazyMotionDiv>
  );
}

export default WebSearchToggle;
