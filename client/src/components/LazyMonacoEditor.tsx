/**
 * LazyMonacoEditor - Lazy loaded CodeMirror 6 Editor wrapper.
 * Migrated from Monaco to CodeMirror 6 for better bundle size.
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const CM6Editor = instrumentedLazy(() => 
  import('@/components/editor/CM6Editor').then(mod => ({ default: mod.CM6Editor })), 'CM6Editor'
);

interface LazyMonacoEditorProps {
  file: any;
  onChange: (content: string) => void;
  onSelectionChange?: (selectedText: string | undefined) => void;
  collaboration?: any;
}

const EditorSkeleton = () => (
  <div className="flex flex-col h-full w-full bg-[var(--ecode-editor-bg)]">
    <div className="h-12 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] px-4 flex items-center space-x-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-20" />
      <div className="flex-1" />
      <Skeleton className="h-6 w-6 rounded" />
      <Skeleton className="h-6 w-6 rounded" />
    </div>
    <div className="flex-1 p-4 space-y-2">
      <div className="flex space-x-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  </div>
);

export function LazyMonacoEditor({ file, onChange, onSelectionChange }: LazyMonacoEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <CM6Editor
        value={file?.content || ''}
        language={file?.language || 'javascript'}
        onChange={onChange}
        onMount={(view) => {
          if (onSelectionChange) {
            view.dom.addEventListener('mouseup', () => {
              const { from, to } = view.state.selection.main;
              if (from !== to) {
                const selected = view.state.sliceDoc(from, to);
                onSelectionChange(selected);
              } else {
                onSelectionChange(undefined);
              }
            });
          }
        }}
        height="100%"
      />
    </Suspense>
  );
}
