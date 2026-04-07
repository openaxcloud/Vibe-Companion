/**
 * Visual Diff Editor - Side-by-side file comparison using CodeMirror 6
 * Uses @codemirror/merge for diff visualization
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  GitCompare,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Copy,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getTheme } from '@/lib/cm6/theme';
import { getReadOnlyExtensions } from '@/lib/cm6/extensions';
import { loadLanguage } from '@/lib/cm6/language-loader';

interface DiffChange {
  lineNumber: number;
  type: 'added' | 'removed' | 'modified';
  oldContent?: string;
  newContent?: string;
}

interface VisualDiffEditorProps {
  originalContent: string;
  modifiedContent: string;
  originalFileName?: string;
  modifiedFileName?: string;
  language?: string;
  onAcceptChange?: (lineNumber: number) => void;
  onRejectChange?: (lineNumber: number) => void;
  className?: string;
  readOnly?: boolean;
}

export function VisualDiffEditor({
  originalContent,
  modifiedContent,
  originalFileName = 'Original',
  modifiedFileName = 'Modified',
  language = 'typescript',
  onAcceptChange,
  onRejectChange,
  className,
  readOnly = false
}: VisualDiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const [currentDiff, setCurrentDiff] = useState(0);
  const [totalDiffs, setTotalDiffs] = useState(0);
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [inlineView, setInlineView] = useState(false);
  const [changes, setChanges] = useState<DiffChange[]>([]);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const { toast } = useToast();

  const themeCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());

  const calculateChanges = useCallback((original: string, modified: string): DiffChange[] => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const changes: DiffChange[] = [];

    const lcs = getLCS(originalLines, modifiedLines);
    let origIdx = 0;
    let modIdx = 0;
    let lcsIdx = 0;

    while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
      if (lcsIdx < lcs.length && origIdx < originalLines.length && modIdx < modifiedLines.length) {
        if (originalLines[origIdx] === lcs[lcsIdx] && modifiedLines[modIdx] === lcs[lcsIdx]) {
          origIdx++;
          modIdx++;
          lcsIdx++;
        } else if (originalLines[origIdx] !== lcs[lcsIdx] && modifiedLines[modIdx] !== lcs[lcsIdx]) {
          changes.push({
            lineNumber: modIdx + 1,
            type: 'modified',
            oldContent: originalLines[origIdx],
            newContent: modifiedLines[modIdx]
          });
          origIdx++;
          modIdx++;
        } else if (originalLines[origIdx] !== lcs[lcsIdx]) {
          changes.push({
            lineNumber: origIdx + 1,
            type: 'removed',
            oldContent: originalLines[origIdx]
          });
          origIdx++;
        } else {
          changes.push({
            lineNumber: modIdx + 1,
            type: 'added',
            newContent: modifiedLines[modIdx]
          });
          modIdx++;
        }
      } else if (origIdx < originalLines.length) {
        changes.push({
          lineNumber: origIdx + 1,
          type: 'removed',
          oldContent: originalLines[origIdx]
        });
        origIdx++;
      } else if (modIdx < modifiedLines.length) {
        changes.push({
          lineNumber: modIdx + 1,
          type: 'added',
          newContent: modifiedLines[modIdx]
        });
        modIdx++;
      }
    }

    return changes;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const initMergeView = async () => {
      if (!containerRef.current || !mounted) return;

      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }

      const languageSupport = await loadLanguage(language);
      if (!mounted) return;

      const baseTheme = EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: 'IBM Plex Mono, SF Mono, Monaco, Consolas, monospace',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-content': {
          padding: '8px 0',
        },
        '.cm-line': {
          padding: '0 8px',
        },
        '.cm-changedLine': {
          backgroundColor: 'rgba(255, 193, 7, 0.1) !important',
        },
        '.cm-deletedChunk': {
          backgroundColor: 'rgba(239, 68, 68, 0.15) !important',
        },
        '.cm-insertedChunk': {
          backgroundColor: 'rgba(34, 197, 94, 0.15) !important',
        },
        '.cm-mergeView': {
          height: '100%',
        },
        '.cm-merge-a': {
          borderRight: '1px solid var(--border)',
        },
        '.cm-merge-b': {
          borderLeft: '1px solid var(--border)',
        },
        '.cm-merge-spacer': {
          backgroundColor: 'var(--background)',
          minWidth: '16px',
        },
        '.cm-deletedText': {
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          textDecoration: 'line-through',
        },
        '.cm-insertedText': {
          backgroundColor: 'rgba(34, 197, 94, 0.3)',
        },
      });

      const whitespaceExtension = showWhitespace ? EditorView.theme({
        '.cm-whitespace': {
          color: 'rgba(150, 150, 150, 0.5)',
        },
      }) : [];

      const extensions = [
        ...getReadOnlyExtensions(),
        themeCompartment.current.of(getTheme(isDarkTheme)),
        languageCompartment.current.of(languageSupport ? [languageSupport] : []),
        baseTheme,
        whitespaceExtension,
        EditorView.lineWrapping,
      ];

      const mergeView = new MergeView({
        a: {
          doc: originalContent,
          extensions: [
            ...extensions,
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
          ],
        },
        b: {
          doc: modifiedContent,
          extensions: [
            ...extensions,
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ],
        },
        parent: containerRef.current,
        revertControls: !readOnly ? 'a-to-b' : undefined,
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 4 },
      });

      mergeViewRef.current = mergeView;

      const calculatedChanges = calculateChanges(originalContent, modifiedContent);
      setChanges(calculatedChanges);
      setTotalDiffs(calculatedChanges.length);
    };

    initMergeView();

    return () => {
      mounted = false;
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
    };
  }, [originalContent, modifiedContent, language, inlineView, showWhitespace, readOnly, isDarkTheme, calculateChanges]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkTheme(isDark);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkTheme(isDark);
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const navigateToDiff = (direction: 'next' | 'previous') => {
    if (!mergeViewRef.current || totalDiffs === 0) return;

    const targetIndex = direction === 'next'
      ? Math.min(currentDiff + 1, totalDiffs - 1)
      : Math.max(currentDiff - 1, 0);

    setCurrentDiff(targetIndex);

    const change = changes[targetIndex];
    if (change) {
      const bEditor = mergeViewRef.current.b;
      const line = bEditor.state.doc.line(Math.min(change.lineNumber, bEditor.state.doc.lines));
      bEditor.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      });
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  const handleCopyModified = () => {
    navigator.clipboard.writeText(modifiedContent);
    toast({
      title: "Copied to clipboard",
      description: "Modified content copied successfully",
    });
  };

  const handleAcceptAll = () => {
    if (onAcceptChange) {
      changes.forEach(change => onAcceptChange(change.lineNumber));
    }
    toast({
      title: "All changes accepted",
      description: `${changes.length} changes have been accepted`,
    });
  };

  const handleRejectAll = () => {
    if (onRejectChange) {
      changes.forEach(change => onRejectChange(change.lineNumber));
    }
    toast({
      title: "All changes rejected",
      description: `${changes.length} changes have been rejected`,
    });
  };

  const getDiffStats = () => {
    const added = changes.filter(c => c.type === 'added').length;
    const removed = changes.filter(c => c.type === 'removed').length;
    const modified = changes.filter(c => c.type === 'modified').length;
    return { added, removed, modified };
  };

  const stats = getDiffStats();

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Visual Diff
          </CardTitle>

          <div className="flex items-center gap-2">
            {stats.added > 0 && (
              <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-600 border-green-500/20">
                +{stats.added}
              </Badge>
            )}
            {stats.removed > 0 && (
              <Badge variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20">
                -{stats.removed}
              </Badge>
            )}
            {stats.modified > 0 && (
              <Badge variant="outline" className="text-[11px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                ~{stats.modified}
              </Badge>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono">{originalFileName}</span>
            <ArrowLeftRight className="h-3 w-3" />
            <span className="font-mono font-medium">{modifiedFileName}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => navigateToDiff('previous')}
              disabled={currentDiff === 0 || totalDiffs === 0}
              data-testid="diff-nav-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-[11px]">
              {totalDiffs > 0 ? `${currentDiff + 1}/${totalDiffs}` : '0/0'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => navigateToDiff('next')}
              disabled={currentDiff >= totalDiffs - 1 || totalDiffs === 0}
              data-testid="diff-nav-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setInlineView(!inlineView)}
              data-testid="diff-toggle-view"
            >
              {inlineView ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Side-by-Side
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Inline
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setShowWhitespace(!showWhitespace)}
              data-testid="diff-toggle-whitespace"
            >
              <Settings className="h-3 w-3 mr-1" />
              {showWhitespace ? 'Hide' : 'Show'} Whitespace
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={handleCopyModified}
              data-testid="diff-copy"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>

          {!readOnly && onAcceptChange && onRejectChange && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] text-green-600 border-green-600/20 hover:bg-green-500/10"
                onClick={handleAcceptAll}
                disabled={changes.length === 0}
                data-testid="diff-accept-all"
              >
                <Check className="h-3 w-3 mr-1" />
                Accept All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] text-red-600 border-red-600/20 hover:bg-red-500/10"
                onClick={handleRejectAll}
                disabled={changes.length === 0}
                data-testid="diff-reject-all"
              >
                <X className="h-3 w-3 mr-1" />
                Reject All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full w-full cm6-diff-container"
          style={{ minHeight: '400px' }}
          data-testid="diff-editor-container"
        />
      </CardContent>
    </Card>
  );
}

function getLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
