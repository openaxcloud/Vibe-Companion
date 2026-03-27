import { useState } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  Play, 
  Square, 
  ChevronDown, 
  Sparkles, 
  Settings, 
  Share2, 
  Search,
  MoreVertical,
  Home,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReducedMotion, SPRING_CONFIG, getReducedMotionTransition } from '@/hooks/use-reduced-motion';
import { Link } from 'wouter';

interface MobileIDEHeaderProps {
  projectName: string;
  modelName?: string;
  isRunning?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  onSearch?: () => void;
  onSettings?: () => void;
  onShare?: () => void;
  className?: string;
}

export function MobileIDEHeader({
  projectName,
  modelName = 'Claude Sonnet 4.5',
  isRunning = false,
  onRun,
  onStop,
  onSearch,
  onSettings,
  onShare,
  className,
}: MobileIDEHeaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleRunStop = () => {
    if (isRunning) {
      onStop?.();
    } else {
      onRun?.();
    }
  };

  return (
    <header 
      className={cn(
        'flex items-center justify-between h-12 px-3',
        'bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)]',
        'safe-area-inset-top',
        className
      )}
      data-testid="mobile-ide-header"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Link href="/projects">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 rounded-lg hover:bg-[var(--ecode-surface-hover)]"
            data-testid="button-back-home"
          >
            <Home className="h-4 w-4 text-[var(--ecode-text-muted)]" />
          </Button>
        </Link>

        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors"
              data-testid="button-project-dropdown"
            >
              <span className="font-semibold text-[13px] text-[var(--ecode-text)] truncate max-w-[140px]">
                {projectName}
              </span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-[var(--ecode-text-muted)] transition-transform duration-200",
                isDropdownOpen && "rotate-180"
              )} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onSettings} data-testid="menu-project-settings">
              <Settings className="h-4 w-4 mr-2" />
              Project Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} data-testid="menu-project-share">
              <Share2 className="h-4 w-4 mr-2" />
              Share Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-all-projects">
              <Link href="/projects" className="flex items-center">
                <Home className="h-4 w-4 mr-2" />
                All Projects
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ecode-accent)]/10">
          <Sparkles className="h-3 w-3 text-[var(--ecode-accent)]" />
          <span className="text-[10px] font-medium text-[var(--ecode-accent)] truncate max-w-[80px]">
            {modelName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSearch}
            className="h-8 w-8 p-0 rounded-lg hover:bg-[var(--ecode-surface-hover)]"
            data-testid="button-search"
          >
            <Search className="h-4 w-4 text-[var(--ecode-text-muted)]" />
          </Button>
        )}

        <LazyMotionDiv
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.default)}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRunStop}
            className={cn(
              "h-8 px-3 rounded-lg font-medium transition-all duration-200",
              isRunning 
                ? "bg-red-500/15 text-red-500 hover:bg-red-500/25" 
                : "bg-green-500/15 text-green-500 hover:bg-green-500/25"
            )}
            data-testid="button-run-stop"
          >
            <LazyAnimatePresence mode="wait">
              {isRunning ? (
                <LazyMotionDiv
                  key="stop"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[11px]">Stop</span>
                </LazyMotionDiv>
              ) : (
                <LazyMotionDiv
                  key="run"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span className="text-[11px]">Run</span>
                </LazyMotionDiv>
              )}
            </LazyAnimatePresence>
          </Button>
        </LazyMotionDiv>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg hover:bg-[var(--ecode-surface-hover)]"
              data-testid="button-more-options"
            >
              <MoreVertical className="h-4 w-4 text-[var(--ecode-text-muted)]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onSettings} data-testid="menu-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} data-testid="menu-share">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
