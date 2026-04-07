/**
 * AppNotReadyPlaceholder - Displays when app/schema is not yet ready
 * 
 * Shown in tabs (Preview, Deploy, Files) when the AI Agent is still
 * building or the schema is being warmed in the background.
 * 
 * Features:
 * - Context-aware messages per tab
 * - Progress indicator for schema warming
 * - Smooth animations
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { memo, useCallback } from 'react';
import { 
  Monitor, 
  Rocket, 
  FolderOpen, 
  Loader2, 
  Sparkles,
  Database,
  Clock,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchemaWarmingStore, getAppNotReadyMessage } from '@/stores/schemaWarmingStore';
import { useAutonomousBuildStore } from '@/stores/autonomousBuildStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AppNotReadyPlaceholderProps {
  tabName: 'preview' | 'deploy' | 'files' | string;
  className?: string;
  compact?: boolean;
  projectId?: string;
}

const tabIcons: Record<string, React.ElementType> = {
  preview: Monitor,
  deploy: Rocket,
  files: FolderOpen,
};

export const AppNotReadyPlaceholder = memo(function AppNotReadyPlaceholder({
  tabName,
  className,
  compact = false,
  projectId,
}: AppNotReadyPlaceholderProps) {
  const { progress, isWarming, isReady } = useSchemaWarmingStore();
  const Icon = tabIcons[tabName.toLowerCase()] || Sparkles;

  const { toast } = useToast();
  const buildPhase = useAutonomousBuildStore((s) => s.phase);
  const isBuildComplete = buildPhase === 'complete';
  const isPreviewTab = tabName.toLowerCase() === 'preview';
  const showRunButton = isPreviewTab && isBuildComplete && !isWarming && projectId;

  const handleRunPreview = useCallback(async () => {
    if (!projectId) return;
    try {
      await apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {});
      useSchemaWarmingStore.getState().markReady();
    } catch (err) {
      console.error('[AppNotReady] Failed to start preview:', err);
      toast({
        title: 'Preview failed to start',
        description: 'There was an issue starting the preview. Unlocking the panel so you can retry.',
        variant: 'destructive',
      });
      useSchemaWarmingStore.getState().markReady();
    }
  }, [projectId, toast]);

  // If ready, don't show placeholder
  if (isReady) {
    return null;
  }

  const message = getAppNotReadyMessage(tabName, progress.status);
  const showProgress = isWarming && progress.progress > 0;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20",
        className
      )}>
        {isWarming ? (
          <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin flex-shrink-0" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        )}
        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium leading-tight">
          {progress.message}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-1 flex flex-col items-center justify-center p-6",
      "animate-fade-in",
      className
    )}>
      <div className={cn(
        "relative mb-4",
        isWarming && "animate-pulse"
      )}>
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center",
          "bg-[var(--ecode-surface-secondary)]",
          "shadow-sm border border-[var(--ecode-border)]"
        )}>
          <Icon className="h-8 w-8 text-[var(--ecode-text-muted)]" />
        </div>
        
        {isWarming && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--ecode-accent)] flex items-center justify-center shadow-lg">
            <Database className="h-3 w-3 text-white animate-pulse" />
          </div>
        )}
      </div>

      <h3 className="text-[13px] font-semibold text-[var(--ecode-text)] mb-1.5 text-center">
        {isWarming ? 'Preparing Your App' : showRunButton ? 'Ready to Preview' : 'App Not Ready Yet'}
      </h3>

      <p className="text-[11px] sm:text-[11px] text-[var(--ecode-text-muted)] text-center max-w-[240px] leading-relaxed">
        {showRunButton
          ? 'Your workspace is ready. Click Run to see a preview.'
          : message.split('\n\n')[0]}
      </p>

      {showRunButton && (
        <Button
          size="sm"
          onClick={handleRunPreview}
          className="mt-4 gap-2 bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
        >
          <Play className="h-3.5 w-3.5" />
          Run Preview
        </Button>
      )}

      {showProgress && (
        <div className="w-full max-w-[200px] mt-4 space-y-1.5">
          <div className="h-1.5 rounded-full bg-[var(--ecode-surface-secondary)] overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[var(--ecode-accent)] to-[var(--ecode-accent-hover)] transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--ecode-text-muted)]">
            <span className="flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--ecode-accent)]" />
              {progress.message}
            </span>
            <span className="text-[var(--ecode-accent)]">{progress.progress}%</span>
          </div>
        </div>
      )}

      {progress.schemaPreview && (
        <div className={cn(
          "mt-3 px-3 py-1.5 rounded-full",
          "bg-emerald-500/10 border border-emerald-500/20",
          "text-[10px] text-emerald-400 font-medium"
        )}>
          {progress.schemaPreview}
        </div>
      )}

      {!showRunButton && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => useSchemaWarmingStore.getState().markReady()}
          className="mt-4 text-[11px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]"
          data-testid="button-skip-warming"
        >
          Skip waiting
        </Button>
      )}
    </div>
  );
});

/**
 * Inline compact version for tab bars
 */
export const AppNotReadyBadge = memo(function AppNotReadyBadge({
  className,
}: { className?: string }) {
  const { isWarming, isReady, progress } = useSchemaWarmingStore();

  if (isReady || (!isWarming && progress.status === 'idle')) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded",
      "bg-amber-500/20 text-amber-600 dark:text-amber-400",
      "text-[9px] font-semibold uppercase tracking-wide",
      className
    )}>
      <Loader2 className="h-2 w-2 animate-spin" />
      <span>Warming</span>
    </div>
  );
});
