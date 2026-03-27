// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { MobileCodeKeyboard } from './MobileCodeKeyboard';
import { MobileCodeJoystick } from './MobileCodeJoystick';
import { useIsMobile } from '@/hooks/use-mobile';

interface LazyMobileCodeEditorProps {
  projectId: string;
  fileId: number | null;
  className?: string;
}

export function LazyMobileCodeEditor({ projectId, fileId, className }: LazyMobileCodeEditorProps) {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchFile = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const files = Array.isArray(data) ? data : (data.files || []);
        const file = files.find((f: any) => f.id === fileId);
        if (file) {
          setContent(file.content || '');
          setOriginalContent(file.content || '');
          setFilename(file.filename || '');
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId, fileId]);

  useEffect(() => { fetchFile(); }, [fetchFile]);

  const saveFile = async () => {
    if (!fileId || saving) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      setOriginalContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const isMobile = useIsMobile();
  const [keyboardExpanded, setKeyboardExpanded] = useState(false);

  // Determine language from file extension
  const getLanguage = (ext: string) => {
    const map: Record<string, string> = {
      js: 'javascript', jsx: 'javascript', mjs: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python', html: 'html', htm: 'html',
      css: 'css', scss: 'css', json: 'json',
    };
    return map[ext] || 'generic';
  };

  // Insert text at cursor position in textarea
  const handleKeyboardInsert = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + text + content.substring(end);
    setContent(newContent);
    // Set cursor after inserted text
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
    });
  }, [content]);

  // Handle keyboard actions (undo, redo, indent, etc.)
  const handleKeyboardAction = useCallback((action: 'undo' | 'redo' | 'indent' | 'outdent' | 'comment' | 'copy' | 'paste') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    switch (action) {
      case 'undo':
        document.execCommand('undo');
        break;
      case 'redo':
        document.execCommand('redo');
        break;
      case 'indent': {
        const before = content.substring(0, start);
        const selected = content.substring(start, end);
        const indented = selected.split('\n').map(line => '  ' + line).join('\n');
        setContent(before + indented + content.substring(end));
        break;
      }
      case 'outdent': {
        const before = content.substring(0, start);
        const selected = content.substring(start, end);
        const outdented = selected.split('\n').map(line => line.replace(/^  /, '')).join('\n');
        setContent(before + outdented + content.substring(end));
        break;
      }
      case 'comment': {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = content.indexOf('\n', end);
        const actualEnd = lineEnd === -1 ? content.length : lineEnd;
        const line = content.substring(lineStart, actualEnd);
        const commented = line.startsWith('// ') ? line.replace(/^\/\/ /, '') : '// ' + line;
        setContent(content.substring(0, lineStart) + commented + content.substring(actualEnd));
        break;
      }
      case 'copy':
        if (start !== end) {
          navigator.clipboard?.writeText(content.substring(start, end));
        }
        break;
      case 'paste':
        navigator.clipboard?.readText().then(text => {
          if (text) handleKeyboardInsert(text);
        });
        break;
    }
  }, [content, handleKeyboardInsert]);

  const hasChanges = content !== originalContent;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const lineCount = content.split('\n').length;

  if (!fileId) {
    return (
      <div className={`${className || 'h-full'} bg-[var(--ide-panel)] flex items-center justify-center`}>
        <p className="text-[12px] text-[var(--ide-text-muted)]">Select a file to edit</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className || 'h-full'} bg-[var(--ide-panel)] flex items-center justify-center`}>
        <p className="text-[12px] text-[var(--ide-text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`${className || 'h-full'} bg-[var(--ide-bg)] flex flex-col overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ide-panel)] border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-[var(--ide-text)] font-mono truncate">{filename}</span>
          {hasChanges && <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] shrink-0" />}
          {saved && <span className="text-[9px] text-[#0CCE6B]">Saved</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={fetchFile} className="w-7 h-7 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={saveFile} disabled={!hasChanges || saving}
            className="w-7 h-7 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] disabled:opacity-30">
            <Save className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-[var(--ide-panel)]/50 border-r border-[var(--ide-border)] overflow-hidden pointer-events-none z-10">
          <div className="pt-2 px-1">
            {Array.from({ length: Math.min(lineCount, 500) }, (_, i) => (
              <div key={i} className="text-[10px] text-[var(--ide-text-muted)] text-right pr-1 leading-[18px] font-mono">{i + 1}</div>
            ))}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="w-full h-full bg-transparent text-[12px] text-[var(--ide-text)] font-mono leading-[18px] p-2 pl-12 outline-none resize-none mobile-scroll"
          style={{ tabSize: 2, scrollbarWidth: 'none' }}
        />
        {/* Replit-style Joystick for code navigation */}
        {isMobile && (
          <MobileCodeJoystick
            className="absolute bottom-3 right-3 z-20"
            onScroll={(direction, velocity) => {
              const ta = textareaRef.current;
              if (!ta) return;
              const scrollAmount = velocity * 60;
              ta.scrollTop += direction === 'down' ? scrollAmount : -scrollAmount;
            }}
            onCursorMove={(direction) => {
              const ta = textareaRef.current;
              if (!ta) return;
              const pos = ta.selectionStart;
              const lines = content.split('\n');
              let currentLine = 0;
              let charCount = 0;
              for (let i = 0; i < lines.length; i++) {
                if (charCount + lines[i].length + 1 > pos) { currentLine = i; break; }
                charCount += lines[i].length + 1;
              }
              const colInLine = pos - charCount;
              let newPos = pos;
              if (direction === 'left') newPos = Math.max(0, pos - 1);
              else if (direction === 'right') newPos = Math.min(content.length, pos + 1);
              else if (direction === 'up' && currentLine > 0) {
                const prevLineStart = charCount - lines[currentLine - 1].length - 1;
                newPos = prevLineStart + Math.min(colInLine, lines[currentLine - 1].length);
              } else if (direction === 'down' && currentLine < lines.length - 1) {
                const nextLineStart = charCount + lines[currentLine].length + 1;
                newPos = nextLineStart + Math.min(colInLine, lines[currentLine + 1].length);
              }
              ta.selectionStart = ta.selectionEnd = newPos;
              ta.focus();
            }}
          />
        )}
      </div>
      {/* Mobile Code Keyboard - coding assistance toolbar */}
      {isMobile && (
        <MobileCodeKeyboard
          language={getLanguage(ext)}
          onInsert={handleKeyboardInsert}
          onAction={handleKeyboardAction}
          onSnippetSelect={(snippet) => handleKeyboardInsert(snippet.insert)}
          isExpanded={keyboardExpanded}
          onToggleExpand={() => setKeyboardExpanded(!keyboardExpanded)}
        />
      )}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--ide-panel)] border-t border-[var(--ide-border)]">
        <span className="text-[9px] text-[var(--ide-text-muted)]">{ext.toUpperCase()} • {lineCount} lines</span>
        <span className="text-[9px] text-[var(--ide-text-muted)]">{(content.length / 1024).toFixed(1)} KB</span>
      </div>
    </div>
  );
}
