import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyMotionDiv } from '@/lib/motion';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const TabletIDEView = instrumentedLazy(() => 
  import('./TabletIDEView').then(module => ({
    default: module.TabletIDEView
  })), 'TabletIDEView'
);

interface LazyTabletIDEViewProps {
  projectId: string;
  className?: string;
  bootstrapToken?: string | null;
  onWorkspaceComplete?: () => void;
  onWorkspaceError?: (error: string) => void;
}

const TabletIDESkeleton = () => (
  <LazyMotionDiv 
    className="flex h-full w-full bg-background"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    data-testid="tablet-ide-skeleton"
  >
    <div className="w-80 bg-card border-r border-border hidden md:block">
      <div className="h-14 bg-muted border-b border-border px-4 flex items-center justify-between">
        <Skeleton className="h-8 w-32 rounded bg-muted-foreground/20" />
        <Skeleton className="h-8 w-8 rounded bg-muted-foreground/20" />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-32 bg-muted-foreground/20" />
        </div>
        <div className="flex items-center space-x-2 pl-4">
          <Skeleton className="h-4 w-4 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-40 bg-muted-foreground/20" />
        </div>
        <div className="flex items-center space-x-2 pl-4">
          <Skeleton className="h-4 w-4 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-36 bg-muted-foreground/20" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-28 bg-muted-foreground/20" />
        </div>
      </div>
    </div>

    <div className="flex-1 flex flex-col">
      <div className="h-14 bg-muted border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-8 w-8 rounded bg-muted-foreground/20" />
          <Skeleton className="h-6 w-48 rounded bg-muted-foreground/20" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-20 rounded bg-muted-foreground/20" />
          <Skeleton className="h-8 w-24 rounded bg-muted-foreground/20" />
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 bg-background p-4 space-y-2">
          <div className="flex space-x-3">
            <Skeleton className="h-4 w-8 bg-muted-foreground/20" />
            <Skeleton className="h-4 w-64 bg-muted-foreground/20" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-4 w-8 bg-muted-foreground/20" />
            <Skeleton className="h-4 w-80 bg-muted-foreground/20" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-4 w-8 bg-muted-foreground/20" />
            <Skeleton className="h-4 w-56 bg-muted-foreground/20" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-4 w-8 bg-muted-foreground/20" />
            <Skeleton className="h-4 w-72 bg-muted-foreground/20" />
          </div>
        </div>

        <div className="w-2 bg-muted" />

        <div className="w-[40%] bg-background hidden lg:block">
          <div className="h-12 bg-muted border-b border-border px-4 flex items-center space-x-2">
            <Skeleton className="h-8 w-24 rounded bg-muted-foreground/20" />
            <Skeleton className="h-8 w-24 rounded bg-muted-foreground/20" />
          </div>
          <div className="p-4">
            <Skeleton className="h-64 w-full rounded bg-muted-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  </LazyMotionDiv>
);

export function LazyTabletIDEView(props: LazyTabletIDEViewProps) {
  return (
    <Suspense fallback={<TabletIDESkeleton />}>
      <TabletIDEView {...props} />
    </Suspense>
  );
}
