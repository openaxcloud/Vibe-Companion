export * from './LazyCM6Editor';
export * from './LazyTerminal';
export * from './LazyAgGrid';
export * from './LazyCharts';

import { Suspense, ReactNode } from 'react';
import { ECodeLoading } from '@/components/ECodeLoading';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

export const LazyDatabaseManagement = instrumentedLazy(() => 
  import('@/components/DatabaseManagement').then(mod => ({ default: mod.DatabaseManagement })), 'DatabaseManagement'
);

export const LazyReplitJSONEditor = instrumentedLazy(() => 
  import('@/components/ReplitJSONEditor').then(mod => ({ default: mod.ReplitJSONEditor })), 'ReplitJSONEditor'
);

export const LazyCodeGenerationPanel = instrumentedLazy(() => 
  import('@/components/CodeGenerationPanel').then(mod => ({ default: mod.CodeGenerationPanel })), 'CodeGenerationPanel'
);

export const LazyRealTimeCollaboration = instrumentedLazy(() => 
  import('@/components/collaboration/RealTimeCollaboration').then(mod => ({ default: mod.RealTimeCollaboration })), 'RealTimeCollaboration'
);

export const LazyGitBlameDecorator = instrumentedLazy(() => 
  import('@/components/git/GitBlameDecorator').then(mod => ({ default: mod.GitBlameDecorator })), 'GitBlameDecorator'
);

export function createSuspenseWrapper<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  fallback?: ReactNode
): React.FC<P> {
  return function SuspenseWrapper(props: P) {
    const Component = LazyComponent as unknown as React.ComponentType<P>;
    return (
      <Suspense fallback={fallback || <ECodeLoading size="md" text="Loading..." />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
