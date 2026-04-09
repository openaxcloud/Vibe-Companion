import { memo, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentWorkingStatusBarProps {
  isWorking: boolean;
  isPaused: boolean;
  onPauseResume: () => void;
  className?: string;
}

export const AgentWorkingStatusBar = memo(function AgentWorkingStatusBar({
  isWorking,
  isPaused,
  onPauseResume,
  className,
}: AgentWorkingStatusBarProps) {
  if (!isWorking) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2.5 rounded-lg",
        "bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600",
        "text-white shadow-sm",
        className
      )}
      data-testid="agent-working-status-bar"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[3px]" data-testid="working-dots-animation">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/80"
              style={{
                animation: `workingPulse 1.5s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>
        <span className="text-[13px] font-medium tracking-wide">
          {isPaused ? 'Paused' : 'Working...'}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-3 text-[13px] font-medium text-white/90 hover:text-white hover:bg-white/15 rounded-md gap-1.5"
        onClick={onPauseResume}
        data-testid="button-pause-resume"
      >
        {isPaused ? (
          <>
            <Play className="w-3.5 h-3.5" />
            Resume
          </>
        ) : (
          <>
            <Pause className="w-3.5 h-3.5" />
            Pause
          </>
        )}
      </Button>

      <style>{`
        @keyframes workingPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
});
