import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyMotionDiv } from '@/lib/motion';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

// Lazy load Enhanced Mobile Code Editor (CodeMirror 6 based)
const EnhancedMobileCodeEditor = instrumentedLazy(() => 
  import('./EnhancedMobileCodeEditor').then(module => ({
    default: module.EnhancedMobileCodeEditor
  })), 'EnhancedMobileCodeEditor'
);

interface LazyMobileCodeEditorProps {
  fileId?: number;
  projectId: string | number;
  initialContent?: string;
  initialLanguage?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  className?: string;
}

const MobileEditorSkeleton = () => (
  <LazyMotionDiv 
    className="flex flex-col h-full w-full bg-background"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    data-testid="mobile-editor-skeleton"
  >
    <div className="h-12 bg-surface-solid border-b border-border px-3 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Skeleton className="h-7 w-7 rounded bg-surface-tertiary-solid" />
        <Skeleton className="h-7 w-7 rounded bg-surface-tertiary-solid" />
      </div>
      <Skeleton className="h-6 w-16 rounded bg-surface-tertiary-solid" />
    </div>

    <div className="flex-1 p-4 space-y-2 overflow-hidden">
      {[48, 64, 40, 56, 72, 44].map((width, i) => (
        <div key={i} className="flex space-x-3">
          <Skeleton className="h-4 w-8 bg-surface-tertiary-solid" />
          <Skeleton className={`h-4 bg-surface-tertiary-solid`} style={{ width: `${width * 4}px` }} />
        </div>
      ))}
    </div>

    <div className="h-12 bg-surface-solid border-t border-border px-3 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-12 rounded bg-surface-tertiary-solid" />
        <Skeleton className="h-8 w-12 rounded bg-surface-tertiary-solid" />
        <Skeleton className="h-8 w-12 rounded bg-surface-tertiary-solid" />
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8 rounded bg-surface-tertiary-solid" />
        <Skeleton className="h-8 w-8 rounded bg-surface-tertiary-solid" />
      </div>
    </div>
  </LazyMotionDiv>
);

export function LazyMobileCodeEditor(props: LazyMobileCodeEditorProps) {
  return (
    <Suspense fallback={<MobileEditorSkeleton />}>
      <EnhancedMobileCodeEditor {...props} />
    </Suspense>
  );
}
