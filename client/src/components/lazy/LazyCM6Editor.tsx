/**
 * LazyCM6Editor - Lazy loading wrappers for CodeMirror 6 editor components.
 * 
 * This module provides React.lazy() wrappers for the CM6Editor component
 * to enable code splitting and improve initial load performance.
 */

import { Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

interface EditorFallbackProps {
  height?: string | number;
}

function EditorFallback({ height = '100%' }: EditorFallbackProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center bg-muted/30 rounded-md border"
      style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight: '200px' }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
      <span className="text-[13px] text-muted-foreground">Loading editor...</span>
    </div>
  );
}

export const LazyCM6Editor = instrumentedLazy(() => 
  import('@/components/editor/CM6Editor').then(mod => ({ default: mod.CM6Editor })), 'CM6Editor'
);

export const LazyCodeEditor = instrumentedLazy(() => import('@/components/CodeEditor'), 'CodeEditor');

export const LazyReplitCodeEditor = instrumentedLazy(() => 
  import('@/components/editor/ReplitCodeEditor').then(mod => ({ default: mod.ReplitCodeEditor })), 'ReplitCodeEditor'
);

export const LazyMultiTabEditor = instrumentedLazy(() => 
  import('@/components/editor/MultiTabEditor').then(mod => ({ default: mod.MultiTabEditor })), 'MultiTabEditor'
);

export const LazyVisualDiffEditor = instrumentedLazy(() => 
  import('@/components/git/VisualDiffEditor').then(mod => ({ default: mod.VisualDiffEditor })), 'VisualDiffEditor'
);

interface LazyEditorWrapperProps {
  Component: ComponentType<any>;
  fallbackHeight?: string | number;
  [key: string]: any;
}

export function LazyEditorWrapper({ 
  Component, 
  fallbackHeight = '100%',
  ...props 
}: LazyEditorWrapperProps) {
  return (
    <Suspense fallback={<EditorFallback height={fallbackHeight} />}>
      <Component {...props} />
    </Suspense>
  );
}

export function withLazyEditor<P extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallbackHeight?: string | number,
  moduleName?: string
) {
  const LazyComponent = instrumentedLazy(importFn, moduleName || 'EditorComponent');
  
  return function LazyEditorHOC(props: P) {
    return (
      <Suspense fallback={<EditorFallback height={fallbackHeight} />}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };
}

export { EditorFallback };
