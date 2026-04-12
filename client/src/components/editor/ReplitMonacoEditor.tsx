import { useMemo, useCallback, lazy, Suspense } from 'react';
import CodeEditor, { detectLanguage } from '@/components/CodeEditor';

const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor'));

type EditorEngine = 'codemirror' | 'monaco';

function getEditorEngine(): EditorEngine {
  try {
    return (localStorage.getItem('editor-engine') as EditorEngine) || 'monaco';
  } catch {
    return 'monaco';
  }
}

interface ReplitMonacoEditorProps {
  projectId: string;
  fileId: string | null;
  fileContents: Record<string, string>;
  onCodeChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  ytext?: any;
  remoteAwareness?: any;
  blameData?: any[];
  filename?: string;
  editorEngine?: EditorEngine;
}

export function ReplitMonacoEditor({
  projectId,
  fileId,
  fileContents,
  onCodeChange,
  onCursorChange,
  fontSize,
  tabSize,
  wordWrap,
  minimap,
  ytext,
  remoteAwareness,
  blameData,
  filename,
  editorEngine,
}: ReplitMonacoEditorProps) {
  const engine = editorEngine || getEditorEngine();

  const value = useMemo(() => {
    if (!fileId) return '';
    return fileContents[fileId] ?? '';
  }, [fileId, fileContents]);

  const language = useMemo(() => {
    if (filename) return detectLanguage(filename);
    if (!fileId) return 'javascript';
    const parts = fileId.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      return detectLanguage(lastPart);
    }
    return 'javascript';
  }, [filename, fileId]);

  const handleChange = useCallback(
    (val: string) => {
      onCodeChange(val);
    },
    [onCodeChange],
  );

  const handleCursorChange = useCallback(
    (line: number, col: number) => {
      onCursorChange?.(line, col);
    },
    [onCursorChange],
  );

  if (!fileId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ide-text-muted)] text-xs">
        Select a file to edit
      </div>
    );
  }

  if (engine === 'monaco') {
    return (
      <div className="h-full" data-testid="editor-monaco-wrapper">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center bg-[#0d1117] text-[#c9d1d9] text-sm">
            Loading Monaco Editor...
          </div>
        }>
          <MonacoCodeEditor
            value={value}
            onChange={handleChange}
            language={language}
            onCursorChange={onCursorChange ? handleCursorChange : undefined}
            fontSize={fontSize}
            tabSize={tabSize}
            wordWrap={wordWrap}
            minimap={minimap}
            filename={filename}
            projectId={projectId}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="editor-codemirror-wrapper">
      <CodeEditor
        value={value}
        onChange={handleChange}
        language={language}
        onCursorChange={onCursorChange ? handleCursorChange : undefined}
        fontSize={fontSize}
        tabSize={tabSize}
        wordWrap={wordWrap}
        minimap={minimap}
        blameData={blameData}
        aiCompletions={true}
        filename={filename}
        projectId={projectId}
        ytext={ytext}
        remoteAwareness={remoteAwareness}
      />
    </div>
  );
}
