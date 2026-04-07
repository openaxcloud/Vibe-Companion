import { cn } from '@/lib/utils';
import { ECodeLoading } from './ECodeLoading';

interface LoadingSectionProps {
  className?: string;
  minHeight?: string | number;
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullHeight?: boolean;
}

/**
 * LoadingSection - Prevents layout shift during loading
 * 
 * Uses CSS containment and min-height to reserve space,
 * ensuring loading → content transitions don't cause UI jumps.
 * 
 * @example
 * {isLoading ? (
 *   <LoadingSection minHeight={400} text="Loading dashboard..." />
 * ) : (
 *   <Dashboard data={data} />
 * )}
 */
export function LoadingSection({ 
  className,
  minHeight = 400,
  text = 'Loading...',
  size = 'lg',
  fullHeight = false
}: LoadingSectionProps) {
  const heightValue = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;
  
  return (
    <div 
      className={cn(
        'relative w-full flex items-center justify-center',
        fullHeight && 'h-full',
        className
      )}
      style={{ 
        minHeight: fullHeight ? '100%' : heightValue,
        contain: 'layout style paint' // CSS containment prevents layout shifts
      }}
      data-testid="loading-section"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ECodeLoading 
          size={size}
          text={text}
        />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for specific content types
 */
export function LoadingSkeleton({ type = 'card', count = 1 }: { 
  type?: 'card' | 'list' | 'table';
  count?: number;
}) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i}
            className="h-48 bg-muted animate-pulse rounded-lg"
            style={{ contain: 'layout' }}
          />
        ))}
      </div>
    );
  }
  
  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i}
            className="h-16 bg-muted animate-pulse rounded"
            style={{ contain: 'layout' }}
          />
        ))}
      </div>
    );
  }
  
  return (
    <div className="h-96 bg-muted animate-pulse rounded">
      <div className="p-4 space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-8 bg-background/50 rounded" />
        ))}
      </div>
    </div>
  );
}
