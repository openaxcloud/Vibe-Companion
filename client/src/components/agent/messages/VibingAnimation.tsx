/**
 * Vibing Animation - Replit-style 3-dot animation
 * Enhanced with agent-animations.css for production-grade visual polish
 */

import { cn } from '@/lib/utils';

interface VibingAnimationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dots' | 'pulse';
}

export function VibingAnimation({ className, size = 'md', variant = 'dots' }: VibingAnimationProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  if (variant === 'pulse') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(sizeClasses[size], "bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full agent-vibing")} />
        <span className="text-[11px] text-violet-600 dark:text-violet-400 animate-pulse">Thinking...</span>
      </div>
    );
  }

  // Default: dots variant with enhanced animation
  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="vibing-animation">
      <div
        className={cn(
          sizeClasses[size],
          "bg-violet-500 rounded-full agent-vibing-dot"
        )}
        style={{ animationDelay: '-0.32s' }}
      />
      <div
        className={cn(
          sizeClasses[size],
          "bg-violet-500 rounded-full agent-vibing-dot"
        )}
        style={{ animationDelay: '-0.16s' }}
      />
      <div
        className={cn(
          sizeClasses[size],
          "bg-fuchsia-500 rounded-full agent-vibing-dot"
        )}
      />
    </div>
  );
}
