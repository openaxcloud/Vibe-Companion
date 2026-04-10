import { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronRight, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface FileDiffData {
  path: string;
  language?: string;
  hunks: DiffHunk[];
  linesAdded: number;
  linesRemoved: number;
  isNewFile?: boolean;
  isDeleted?: boolean;
  isBinary?: boolean;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface FileDiffInlineProps {
  diff: FileDiffData;
  defaultExpanded?: boolean;
  className?: string;
}

function parsePatchToHunks(patch: string): { hunks: DiffHunk[]; added: number; removed: number } {
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let added = 0;
  let removed = 0;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      oldLine = match ? parseInt(match[1], 10) : 0;
      newLine = match ? parseInt(match[2], 10) : 0;
      currentHunk = { header: line, lines: [{ type: 'header', content: line }] };
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'added', content: line.slice(1), newLineNum: newLine });
      newLine++;
      added++;
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'removed', content: line.slice(1), oldLineNum: oldLine });
      oldLine++;
      removed++;
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({ type: 'context', content: line.slice(1) || '', oldLineNum: oldLine, newLineNum: newLine });
      oldLine++;
      newLine++;
    }
  }

  return { hunks, added, removed };
}

export function parseDiffString(diffText: string): FileDiffData[] {
  const files: FileDiffData[] = [];
  const fileSections = diffText.split(/^diff --git/m).filter(Boolean);

  for (const section of fileSections) {
    const pathMatch = section.match(/a\/(.+?) b\/(.+)/);
    const path = pathMatch ? pathMatch[2] : 'unknown';
    const isNewFile = section.includes('new file mode');
    const isDeleted = section.includes('deleted file mode');
    const isBinary = section.includes('Binary files');

    const ext = path.split('.').pop() || '';
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', html: 'HTML',
      css: 'CSS', scss: 'SCSS', json: 'JSON', md: 'Markdown', sql: 'SQL',
      sh: 'Shell', yml: 'YAML', yaml: 'YAML', toml: 'TOML',
    };

    const { hunks, added, removed } = parsePatchToHunks(section);

    files.push({
      path,
      language: langMap[ext],
      hunks,
      linesAdded: added,
      linesRemoved: removed,
      isNewFile,
      isDeleted,
      isBinary,
    });
  }

  return files;
}

const LINE_STYLES = {
  added: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-800 dark:text-green-200',
    gutter: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    marker: '+',
    markerColor: 'text-green-600 dark:text-green-400',
  },
  removed: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-800 dark:text-red-200',
    gutter: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    marker: '-',
    markerColor: 'text-red-600 dark:text-red-400',
  },
  context: {
    bg: '',
    text: 'text-[var(--ecode-text-secondary)]',
    gutter: 'text-[var(--ecode-text-tertiary)]',
    marker: ' ',
    markerColor: 'text-transparent',
  },
  header: {
    bg: 'bg-blue-50 dark:bg-blue-950/15',
    text: 'text-blue-700 dark:text-blue-300 font-medium',
    gutter: 'bg-blue-100 dark:bg-blue-900/25 text-blue-500 dark:text-blue-400',
    marker: '',
    markerColor: '',
  },
} as const;

function DiffLineRow({ line }: { line: DiffLine }) {
  const style = LINE_STYLES[line.type];

  if (line.type === 'header') {
    return (
      <div className={cn('flex text-[11px] font-mono py-0.5', style.bg)}>
        <span className={cn('w-8 text-right px-1 select-none shrink-0 border-r border-[var(--ecode-border)]', style.gutter)}>
          ...
        </span>
        <span className={cn('w-8 text-right px-1 select-none shrink-0 border-r border-[var(--ecode-border)]', style.gutter)}>
          ...
        </span>
        <span className={cn('px-2 flex-1', style.text)}>{line.content}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex text-[11px] font-mono leading-[18px] group/line', style.bg)}>
      <span className={cn('w-8 text-right px-1 select-none shrink-0 border-r border-[var(--ecode-border)]', style.gutter)}>
        {line.oldLineNum ?? ''}
      </span>
      <span className={cn('w-8 text-right px-1 select-none shrink-0 border-r border-[var(--ecode-border)]', style.gutter)}>
        {line.newLineNum ?? ''}
      </span>
      <span className={cn('w-4 text-center select-none shrink-0', style.markerColor)}>
        {style.marker}
      </span>
      <span className={cn('flex-1 whitespace-pre-wrap break-all pr-2', style.text)}>
        {line.content || '\u00A0'}
      </span>
    </div>
  );
}

export function FileDiffInline({ diff, defaultExpanded = false, className }: FileDiffInlineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  const filteredHunks = useMemo(() => {
    if (!showOnlyChanges) return diff.hunks;
    return diff.hunks.map(hunk => ({
      ...hunk,
      lines: hunk.lines.filter(l => l.type !== 'context'),
    }));
  }, [diff.hunks, showOnlyChanges]);

  const totalLines = useMemo(
    () => diff.hunks.reduce((sum, h) => sum + h.lines.length, 0),
    [diff.hunks]
  );

  const handleCopyPath = () => {
    navigator.clipboard.writeText(diff.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = diff.isNewFile
    ? <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">NEW</Badge>
    : diff.isDeleted
    ? <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">DEL</Badge>
    : diff.isBinary
    ? <Badge className="text-[9px] px-1.5 py-0 h-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">BIN</Badge>
    : null;

  return (
    <div className={cn('border border-[var(--ecode-border)] rounded-lg overflow-hidden', className)} data-testid={`diff-file-${diff.path}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ecode-surface)] transition-colors text-left"
        data-testid={`diff-toggle-${diff.path}`}
      >
        {isExpanded
          ? <ChevronDown className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)] shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)] shrink-0" />
        }
        <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="text-[12px] font-mono text-[var(--ecode-text)] truncate flex-1">{diff.path}</span>

        <div className="flex items-center gap-1.5 shrink-0">
          {statusBadge}
          {diff.linesAdded > 0 && (
            <span className="text-[10px] font-mono text-green-600 dark:text-green-400">+{diff.linesAdded}</span>
          )}
          {diff.linesRemoved > 0 && (
            <span className="text-[10px] font-mono text-red-600 dark:text-red-400">-{diff.linesRemoved}</span>
          )}
          {diff.language && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{diff.language}</Badge>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--ecode-border)]">
          <div className="flex items-center justify-between px-3 py-1 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)]">
            <span className="text-[10px] text-[var(--ecode-text-secondary)]">
              {totalLines} lines
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={(e) => { e.stopPropagation(); setShowOnlyChanges(!showOnlyChanges); }}
                data-testid="diff-toggle-context"
              >
                {showOnlyChanges ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {showOnlyChanges ? 'Show all' : 'Changes only'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={(e) => { e.stopPropagation(); handleCopyPath(); }}
                data-testid="diff-copy-path"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            {diff.isBinary ? (
              <div className="px-3 py-4 text-[11px] text-[var(--ecode-text-secondary)] italic text-center">
                Binary file not shown
              </div>
            ) : (
              filteredHunks.map((hunk, hi) => (
                <div key={hi}>
                  {hunk.lines.map((line, li) => (
                    <DiffLineRow key={`${hi}-${li}`} line={line} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface MultiFileDiffInlineProps {
  diffs: FileDiffData[];
  defaultExpanded?: boolean;
  className?: string;
}

export function MultiFileDiffInline({ diffs, defaultExpanded, className }: MultiFileDiffInlineProps) {
  const safeDiffs = diffs || [];
  if (safeDiffs.length === 0) return null;

  const totalAdded = safeDiffs.reduce((sum, d) => sum + d.linesAdded, 0);
  const totalRemoved = safeDiffs.reduce((sum, d) => sum + d.linesRemoved, 0);

  return (
    <div className={cn('space-y-2 my-2', className)} data-testid="multi-file-diff">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--ecode-text)]">
          {safeDiffs.length} {safeDiffs.length === 1 ? 'file' : 'files'} changed
        </span>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-green-600 dark:text-green-400">+{totalAdded}</span>
          <span className="text-red-600 dark:text-red-400">-{totalRemoved}</span>
        </div>
      </div>
      {safeDiffs.map((diff, i) => (
        <FileDiffInline key={`${diff.path}-${i}`} diff={diff} defaultExpanded={defaultExpanded} />
      ))}
    </div>
  );
}
