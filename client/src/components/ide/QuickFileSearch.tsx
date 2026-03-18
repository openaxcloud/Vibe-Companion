import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Search, FileCode, FileText, FileJson, Image, File,
  Folder, Hash, ChevronRight
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: string;
  path: string;
  content: string;
}

interface QuickFileSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileItem[];
  onFileSelect: (file: { id: string; name: string }) => void;
}

function getFileIcon(name: string, type: string) {
  if (type === 'folder') return Folder;
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return FileCode;
    case 'json':
      return FileJson;
    case 'md':
    case 'txt':
    case 'html':
    case 'css':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'webp':
      return Image;
    default:
      return File;
  }
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '#0079F2';
    case 'js':
    case 'jsx':
      return '#F26522';
    case 'json':
      return '#0CCE6B';
    case 'css':
    case 'scss':
      return '#7C65CB';
    case 'html':
      return '#F26522';
    case 'md':
      return '#0079F2';
    default:
      return 'var(--ide-text-muted)';
  }
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="text-[#0079F2] font-semibold">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

export function QuickFileSearch({
  open,
  onOpenChange,
  files,
  onFileSelect,
}: QuickFileSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'files' | 'symbols'>('files');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine mode from query prefix
  const effectiveQuery = query.startsWith('#')
    ? query.slice(1)
    : query.startsWith('>')
      ? query.slice(1)
      : query;

  const effectiveMode = query.startsWith('#') ? 'symbols' : 'files';

  const filteredFiles = useMemo(() => {
    if (!effectiveQuery.trim()) return files.slice(0, 50);

    const lowerQuery = effectiveQuery.toLowerCase();

    // Score-based fuzzy matching
    const scored = files
      .map((file) => {
        const name = file.name.toLowerCase();
        const path = file.path.toLowerCase();
        let score = 0;

        // Exact name match
        if (name === lowerQuery) score += 100;
        // Name starts with query
        else if (name.startsWith(lowerQuery)) score += 80;
        // Name contains query
        else if (name.includes(lowerQuery)) score += 60;
        // Path contains query
        else if (path.includes(lowerQuery)) score += 40;
        // Fuzzy character match on name
        else {
          let qi = 0;
          for (let i = 0; i < name.length && qi < lowerQuery.length; i++) {
            if (name[i] === lowerQuery[qi]) qi++;
          }
          if (qi === lowerQuery.length) score += 20;
        }

        return { file, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    return scored.map((s) => s.file);
  }, [files, effectiveQuery]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            const f = filteredFiles[selectedIndex];
            onFileSelect({ id: f.id, name: f.name });
            onOpenChange(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [filteredFiles, selectedIndex, onFileSelect, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 bg-[var(--ide-panel)] border-[var(--ide-border)] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 h-12 border-b border-[var(--ide-border)]">
          <Search className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name... (# for symbols)"
            className="flex-1 h-full bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none"
            autoFocus
          />
          {query && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[10px] text-[var(--ide-text-muted)] font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-[var(--ide-text-muted)]">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No files found</p>
              {query && (
                <p className="text-xs mt-1 opacity-70">
                  Try a different search term
                </p>
              )}
            </div>
          ) : (
            filteredFiles.map((file, index) => {
              const Icon = getFileIcon(file.name, file.type);
              const color = getFileColor(file.name);
              const isActive = index === selectedIndex;
              const pathParts = file.path.split('/').filter(Boolean);
              const dirPath = pathParts.slice(0, -1);

              return (
                <button
                  key={file.id}
                  data-active={isActive}
                  onClick={() => {
                    onFileSelect({ id: file.id, name: file.name });
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-[var(--ide-surface)]'
                      : 'hover:bg-[var(--ide-hover)]'
                  )}
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--ide-text)] truncate">
                      {highlightMatch(file.name, effectiveQuery)}
                    </div>
                    {dirPath.length > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px] text-[var(--ide-text-muted)] mt-0.5 truncate">
                        {dirPath.map((part, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5">
                            {i > 0 && <ChevronRight className="w-2.5 h-2.5" />}
                            {part}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[10px] text-[var(--ide-text-muted)] font-mono shrink-0">
                      Enter
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-[var(--ide-border)] text-[10px] text-[var(--ide-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono">Enter</kbd>
            Open
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono">#</kbd>
            Symbols
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
