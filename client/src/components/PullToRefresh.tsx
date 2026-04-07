import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const { containerRef, isPulling, isRefreshing, pullDistance, pullProgress } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  return (
    <div ref={containerRef as any} className="relative h-full overflow-auto">
      {/* Pull indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-50"
        style={{
          top: pullDistance - 40,
          opacity: pullProgress,
          transform: `translateX(-50%) rotate(${pullProgress * 360}deg)`,
        }}
      >
        <div className={`p-2 rounded-full bg-background shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
      </div>
      
      {/* Content with pull offset */}
      <div
        style={{
          transform: isPulling ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.3s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
