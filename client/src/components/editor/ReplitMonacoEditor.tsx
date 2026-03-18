import { useMemo, useCallback } from 'react';
import CodeEditor, { detectLanguage } from '@/components/CodeEditor';

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
}: ReplitMonacoEditorProps) {
  const value = useMemo(() => {
    if (!fileId) return '';
    return fileContents[fileId] ?? '';
  }, [fileId, fileContents]);

  const language = useMemo(() => {
    if (filename) return detectLanguage(filename);
    if (!fileId) return 'javascript';
    // Try to detect from the fileId if it looks like a path
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

  return (
    <div className="h-full">
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
