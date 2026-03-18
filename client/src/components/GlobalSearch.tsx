import { useState, useMemo } from 'react';
import { Search, X, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  isOpen: boolean;
  inline?: boolean;
  onClose: () => void;
  projectId: string;
  onFileSelect?: (file: { id: number; name: string }) => void;
}

export function GlobalSearch({ isOpen, inline, onClose, projectId, onFileSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');

  if (!isOpen && !inline) return null;

  return (
    <div className={cn('flex flex-col', inline ? 'h-full' : '')}>
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--ide-border)]">
        <Search className="w-4 h-4 text-[var(--ide-text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in files..."
          className="flex-1 bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
          autoFocus
        />
        {!inline && (
          <button onClick={onClose} className="text-[var(--ide-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!query.trim() ? (
          <p className="text-xs text-[var(--ide-text-muted)] text-center">Type to search across all files</p>
        ) : (
          <p className="text-xs text-[var(--ide-text-muted)] text-center">Searching for "{query}"...</p>
        )}
      </div>
    </div>
  );
}
