/**
 * LazyCM6Editor - Lazy loaded CodeMirror 6 Editor wrapper.
 * 
 * This component provides a lazy-loaded CM6Editor with a nice
 * loading skeleton fallback for better UX.
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const CM6Editor = instrumentedLazy(() => 
  import('@/components/editor/CM6Editor').then(mod => ({ default: mod.CM6Editor })), 'CM6Editor'
);

interface LazyCM6EditorProps {
  file: any;
  onChange: (content: string) => void;
  onSelectionChange?: (selectedText: string | undefined) => void;
  collaboration?: any;
  readOnly?: boolean;
  height?: string | number;
  theme?: 'dark' | 'light';
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

function getLanguageFromFile(file: any): string {
  if (!file) return 'javascript';
  if (file.language) return file.language;
  
  const ext = file.name?.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'css',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'xml': 'xml',
  };
  
  return languageMap[ext] || 'javascript';
}

export function LazyCM6Editor({ 
  file, 
  onChange, 
  onSelectionChange, 
  collaboration,
  readOnly = false,
  height = '100%',
  theme = 'dark',
}: LazyCM6EditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <CM6Editor
        value={file?.content || ''}
        language={getLanguageFromFile(file)}
        onChange={onChange}
        readOnly={readOnly}
        height={height}
        theme={theme}
        onMount={(view) => {
          if (onSelectionChange) {
            view.dom.addEventListener('mouseup', () => {
              const selection = view.state.sliceDoc(
                view.state.selection.main.from,
                view.state.selection.main.to
              );
              onSelectionChange(selection || undefined);
            });
          }
        }}
      />
    </Suspense>
  );
}

export { EditorSkeleton };
