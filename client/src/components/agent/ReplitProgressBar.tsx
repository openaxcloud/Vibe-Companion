/**
 * Replit Progress Bar
 * Production-grade progress indicator matching Replit's visual style
 */

import { cn } from '@/lib/utils';
import { Check, Loader2, XCircle } from 'lucide-react';

interface ReplitProgressBarProps {
  value: number; // 0-100
  status?: 'active' | 'completed' | 'error';
  label?: string;
  showPercentage?: boolean;
  variant?: 'gradient' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ReplitProgressBar({
  value,
  status = 'active',
  label,
  showPercentage = true,
  variant = 'gradient',
  size = 'md',
  className
}: ReplitProgressBarProps) {
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label and Percentage */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2">
            {status === 'active' && (
              <Loader2 className={cn(iconSizeClasses[size], "animate-spin text-violet-500")} />
            )}
            {status === 'completed' && (
              <Check className={cn(iconSizeClasses[size], "text-green-500")} />
            )}
            {status === 'error' && (
              <XCircle className={cn(iconSizeClasses[size], "text-red-500")} />
            )}
            {label && (
              <span className="font-medium text-foreground">{label}</span>
            )}
          </div>
          {showPercentage && (
            <span className="text-muted-foreground tabular-nums">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div
        className={cn(
          heightClasses[size],
          "w-full bg-muted rounded-full overflow-hidden relative"
        )}
        data-testid="replit-progress-bar"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            variant === 'gradient' && "progress-bar-replit",
            variant === 'solid' && "bg-violet-500",
            status === 'active' && variant === 'gradient' && "progress-bar-glow",
            status === 'completed' && "bg-green-500",
            status === 'error' && "bg-red-500"
          )}
          style={{ width: `${clampedValue}%` }}
          data-testid="progress-fill"
        />
      </div>
    </div>
  );
}

/**
 * Multi-Step Progress Bar (for multiple tasks)
 */
interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface MultiStepProgressBarProps {
  steps: Step[];
  className?: string;
}

export function MultiStepProgressBar({ steps, className }: MultiStepProgressBarProps) {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Overall Progress */}
      <ReplitProgressBar
        value={progress}
        status={completedSteps === totalSteps ? 'completed' : 'active'}
        label={`${completedSteps} of ${totalSteps} tasks completed`}
        variant="gradient"
      />

      {/* Step Indicators */}
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex-1 h-2 rounded-full transition-all duration-300",
              step.status === 'completed' && "bg-gradient-to-r from-violet-500 to-fuchsia-500",
              step.status === 'active' && "bg-yellow-400 animate-pulse",
              step.status === 'error' && "bg-red-500",
              step.status === 'pending' && "bg-muted"
            )}
            title={step.label}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Indeterminate Progress Bar (for unknown duration tasks)
 */
export function IndeterminateProgressBar({ className }: { className?: string }) {
  return (
    <div className={cn("w-full h-2 bg-muted rounded-full overflow-hidden", className)}>
      <div className="h-full progress-bar-animated" />
    </div>
  );
}
