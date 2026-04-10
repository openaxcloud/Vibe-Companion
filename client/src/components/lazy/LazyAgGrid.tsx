import { Suspense, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Table } from 'lucide-react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

interface GridFallbackProps {
  height?: string | number;
  rows?: number;
}

export function GridFallback({ height = '400px', rows = 5 }: GridFallbackProps) {
  return (
    <div 
      className="flex flex-col bg-background rounded-md border overflow-hidden"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <Table className="h-4 w-4 text-muted-foreground" />
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">Loading data grid...</span>
      </div>
      <div className="flex-1 p-2 space-y-2">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export const LazyAgentSessionsGrid = instrumentedLazy(() => 
  import('@/components/grids/AgentSessionsGrid').then(mod => ({ default: mod.AgentSessionsGrid })), 'AgentSessionsGrid'
);

export const LazyAgentActionsGrid = instrumentedLazy(() => 
  import('@/components/grids/AgentActionsGrid').then(mod => ({ default: mod.AgentActionsGrid })), 'AgentActionsGrid'
);

export const LazyConversationHistoryGrid = instrumentedLazy(() => 
  import('@/components/grids/ConversationHistoryGrid').then(mod => ({ default: mod.ConversationHistoryGrid })), 'ConversationHistoryGrid'
);

export const LazyFileOperationsGrid = instrumentedLazy(() => 
  import('@/components/grids/FileOperationsGrid').then(mod => ({ default: mod.FileOperationsGrid })), 'FileOperationsGrid'
);

interface LazyGridWrapperProps {
  Component: ComponentType<any>;
  fallbackHeight?: string | number;
  fallbackRows?: number;
  [key: string]: any;
}

export function LazyGridWrapper({ 
  Component, 
  fallbackHeight = '400px',
  fallbackRows = 5,
  ...props 
}: LazyGridWrapperProps) {
  return (
    <Suspense fallback={<GridFallback height={fallbackHeight} rows={fallbackRows} />}>
      <Component {...props} />
    </Suspense>
  );
}

export function withLazyGrid<P extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallbackHeight?: string | number,
  fallbackRows?: number,
  moduleName?: string
) {
  const LazyComponent = instrumentedLazy(importFn, moduleName || 'GridComponent');
  
  return function LazyGridHOC(props: P) {
    return (
      <Suspense fallback={<GridFallback height={fallbackHeight} rows={fallbackRows} />}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };
}
