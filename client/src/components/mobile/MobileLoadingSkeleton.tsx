import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface MobileLoadingSkeletonProps {
  className?: string;
}

function SkeletonLine({ 
  width = '100%', 
  height = 'h-4', 
  className,
  animate = true
}: { 
  width?: string; 
  height?: string;
  className?: string;
  animate?: boolean;
}) {
  return (
    <div 
      className={cn(
        'rounded bg-muted',
        animate && 'animate-pulse',
        height,
        className
      )}
      style={{ width }}
    />
  );
}

export function FileExplorerSkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  return (
    <div 
      className={cn('flex flex-col gap-1 p-2', className)}
      data-testid="skeleton-file-explorer"
    >
      {Array.from({ length: 8 }).map((_, index) => {
        const isFolder = index % 3 === 0;
        const indent = index > 0 && index < 4 ? 16 : index >= 4 && index < 7 ? 32 : 0;
        
        return (
          <div 
            key={index} 
            className="flex items-center gap-2 py-2 px-3"
            style={{ paddingLeft: `${indent + 12}px` }}
          >
            <SkeletonLine 
              width="16px" 
              height="h-4" 
              className={isFolder ? 'rounded-sm' : 'rounded'}
              animate={animate}
            />
            <SkeletonLine 
              width={`${60 + Math.random() * 30}%`} 
              height="h-4" 
              animate={animate}
            />
          </div>
        );
      })}
    </div>
  );
}

export function EditorSkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  const lineWidths = [
    '45%', '72%', '58%', '90%', '35%', '68%', '80%', '42%', 
    '75%', '55%', '88%', '48%', '65%', '95%', '52%', '78%'
  ];
  
  return (
    <div 
      className={cn('flex flex-col bg-card', className)}
      data-testid="skeleton-editor"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-surface-solid">
        <SkeletonLine width="80px" height="h-5" animate={animate} />
        <SkeletonLine width="60px" height="h-5" animate={animate} />
      </div>
      
      <div className="flex-1 p-3 font-mono">
        <div className="flex flex-col gap-1.5">
          {lineWidths.map((width, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonLine 
                width="24px" 
                height="h-3.5" 
                className="flex-shrink-0"
                animate={animate}
              />
              {index % 5 === 4 ? (
                <div className="h-3.5" />
              ) : (
                <SkeletonLine 
                  width={width} 
                  height="h-3.5" 
                  animate={animate}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TerminalSkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  const lines = [
    { prompt: true, width: '35%' },
    { prompt: false, width: '85%' },
    { prompt: false, width: '60%' },
    { prompt: false, width: '45%' },
    { prompt: true, width: '50%' },
    { prompt: false, width: '75%' },
    { prompt: false, width: '40%' },
    { prompt: true, width: '25%' },
  ];
  
  return (
    <div 
      className={cn(
        'flex flex-col bg-[hsl(var(--background))] dark:bg-zinc-950 rounded-lg',
        className
      )}
      data-testid="skeleton-terminal"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <div className="flex gap-1.5">
          <div className={cn(
            'w-2.5 h-2.5 rounded-full bg-muted',
            animate && 'animate-pulse'
          )} />
          <div className={cn(
            'w-2.5 h-2.5 rounded-full bg-muted',
            animate && 'animate-pulse'
          )} />
          <div className={cn(
            'w-2.5 h-2.5 rounded-full bg-muted',
            animate && 'animate-pulse'
          )} />
        </div>
        <SkeletonLine width="60px" height="h-3" className="ml-2" animate={animate} />
      </div>
      
      <div className="flex-1 p-3 font-mono text-[13px]">
        <div className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              {line.prompt && (
                <>
                  <SkeletonLine 
                    width="12px" 
                    height="h-3" 
                    className="flex-shrink-0 bg-surface-tertiary-solid"
                    animate={animate}
                  />
                  <SkeletonLine 
                    width="45px" 
                    height="h-3" 
                    className="flex-shrink-0 bg-surface-tertiary-solid"
                    animate={animate}
                  />
                </>
              )}
              <SkeletonLine 
                width={line.width} 
                height="h-3" 
                className={line.prompt ? '' : 'ml-14'}
                animate={animate}
              />
            </div>
          ))}
          
          <div className="flex items-center gap-2 mt-1">
            <SkeletonLine 
              width="12px" 
              height="h-3" 
              className="flex-shrink-0 bg-surface-tertiary-solid"
              animate={animate}
            />
            <SkeletonLine 
              width="45px" 
              height="h-3" 
              className="flex-shrink-0 bg-surface-tertiary-solid"
              animate={animate}
            />
            <div className={cn(
              'w-2 h-4 bg-muted',
              animate && 'animate-pulse'
            )} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewSkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  return (
    <div 
      className={cn(
        'flex flex-col bg-card rounded-lg overflow-hidden',
        className
      )}
      data-testid="skeleton-preview"
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-solid border-b">
        <div className="flex gap-1">
          <SkeletonLine width="24px" height="h-6" className="rounded" animate={animate} />
          <SkeletonLine width="24px" height="h-6" className="rounded" animate={animate} />
        </div>
        <div className="flex-1 mx-2">
          <SkeletonLine width="100%" height="h-6" className="rounded-full" animate={animate} />
        </div>
        <SkeletonLine width="24px" height="h-6" className="rounded" animate={animate} />
      </div>
      
      <div className="flex-1 p-4 min-h-[200px]">
        <div className="flex flex-col gap-4">
          <SkeletonLine width="60%" height="h-8" animate={animate} />
          
          <div className="flex flex-col gap-2">
            <SkeletonLine width="100%" height="h-4" animate={animate} />
            <SkeletonLine width="90%" height="h-4" animate={animate} />
            <SkeletonLine width="75%" height="h-4" animate={animate} />
          </div>
          
          <div className="flex gap-2 mt-2">
            <SkeletonLine width="80px" height="h-8" className="rounded-md" animate={animate} />
            <SkeletonLine width="80px" height="h-8" className="rounded-md" animate={animate} />
          </div>
          
          <div className="mt-4">
            <SkeletonLine width="100%" height="h-32" className="rounded-lg" animate={animate} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentSkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  return (
    <div 
      className={cn('flex flex-col bg-card', className)}
      data-testid="skeleton-agent"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className={cn(
          'w-8 h-8 rounded-full bg-muted',
          animate && 'animate-pulse'
        )} />
        <div className="flex-1 flex flex-col gap-1.5">
          <SkeletonLine width="120px" height="h-4" animate={animate} />
          <SkeletonLine width="80px" height="h-3" animate={animate} />
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((index) => (
            <div 
              key={index}
              className={cn(
                'p-3 rounded-lg',
                index % 2 === 0 ? 'bg-surface-solid mr-8' : 'bg-surface-tertiary-solid ml-8'
              )}
            >
              <div className="flex flex-col gap-2">
                <SkeletonLine 
                  width="100%" 
                  height="h-3.5" 
                  animate={animate}
                />
                <SkeletonLine 
                  width={index % 2 === 0 ? '85%' : '70%'} 
                  height="h-3.5" 
                  animate={animate}
                />
                {index === 0 && (
                  <SkeletonLine 
                    width="45%" 
                    height="h-3.5" 
                    animate={animate}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="px-4 py-3 border-t">
        <div className="flex items-center gap-2">
          <SkeletonLine width="100%" height="h-10" className="rounded-lg" animate={animate} />
          <SkeletonLine width="40px" height="h-10" className="rounded-lg flex-shrink-0" animate={animate} />
        </div>
      </div>
    </div>
  );
}

export function DeploySkeleton({ className }: MobileLoadingSkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  
  return (
    <div 
      className={cn('flex flex-col gap-4 p-4 bg-card', className)}
      data-testid="skeleton-deploy"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-12 h-12 rounded-lg bg-muted',
          animate && 'animate-pulse'
        )} />
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonLine width="60%" height="h-5" animate={animate} />
          <SkeletonLine width="40%" height="h-3" animate={animate} />
        </div>
      </div>
      
      <div className="space-y-3">
        <SkeletonLine width="100%" height="h-10" className="rounded-lg" animate={animate} />
        
        <div className="grid grid-cols-2 gap-3">
          <SkeletonLine width="100%" height="h-20" className="rounded-lg" animate={animate} />
          <SkeletonLine width="100%" height="h-20" className="rounded-lg" animate={animate} />
        </div>
        
        <SkeletonLine width="100%" height="h-12" className="rounded-lg" animate={animate} />
      </div>
    </div>
  );
}

export type MobileSkeletonVariant = 
  | 'file-explorer' 
  | 'editor' 
  | 'terminal' 
  | 'preview' 
  | 'agent'
  | 'deploy';

interface MobileLoadingSkeletonSwitchProps extends MobileLoadingSkeletonProps {
  variant: MobileSkeletonVariant;
}

export function MobileLoadingSkeleton({ variant, className }: MobileLoadingSkeletonSwitchProps) {
  switch (variant) {
    case 'file-explorer':
      return <FileExplorerSkeleton className={className} />;
    case 'editor':
      return <EditorSkeleton className={className} />;
    case 'terminal':
      return <TerminalSkeleton className={className} />;
    case 'preview':
      return <PreviewSkeleton className={className} />;
    case 'agent':
      return <AgentSkeleton className={className} />;
    case 'deploy':
      return <DeploySkeleton className={className} />;
    default:
      return <FileExplorerSkeleton className={className} />;
  }
}
