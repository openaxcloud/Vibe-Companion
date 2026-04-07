// @ts-nocheck
/**
 * LazyMonacoEditor - Lazy loading wrappers for CodeMirror 6 editor components.
 * Migrated from Monaco to CodeMirror 6 for better bundle size.
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
      data-testid="editor-loading"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
      <span className="text-[13px] text-muted-foreground">Loading editor...</span>
    </div>
  );
}

export const LazyExternalMonacoEditor = instrumentedLazy(() => 
  import('@/components/editor/ExternalMonacoEditor').then(mod => ({ default: mod.ExternalMonacoEditor })), 'ExternalMonacoEditor'
);

export const LazyCodeEditor = instrumentedLazy(() => import('@/components/CodeEditor'), 'CodeEditor');

export const LazyReplitMonacoEditor = instrumentedLazy(() => 
  import('@/components/editor/ReplitMonacoEditor').then(mod => ({ default: mod.ReplitMonacoEditor })), 'ReplitMonacoEditor'
);

export const LazyReplitCodeEditor = instrumentedLazy(() => 
  import('@/components/editor/ReplitCodeEditor').then(mod => ({ default: mod.ReplitCodeEditor })), 'ReplitCodeEditor'
);

export const LazyMultiTabEditor = instrumentedLazy(() => 
  import('@/components/editor/MultiTabEditor').then(mod => ({ default: mod.MultiTabEditor })), 'MultiTabEditor'
);

export const LazyVisualDiffEditor = instrumentedLazy(() => 
  import('@/components/git/VisualDiffEditor').then(mod => ({ default: mod.VisualDiffEditor })), 'VisualDiffEditor'
);

export const LazyCM6Editor = instrumentedLazy(() => 
  import('@/components/editor/CM6Editor').then(mod => ({ default: mod.CM6Editor })), 'CM6Editor'
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
