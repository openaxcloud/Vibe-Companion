/**
 * File Diff Viewer - Inline before/after comparison
 * Replit-style diff display with syntax highlighting
 */

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FileDiff {
  path: string;
  before?: string;
  after: string;
  language?: string;
  linesAdded: number;
  linesRemoved: number;
}

interface FileDiffViewerProps {
  diff: FileDiff;
  defaultExpanded?: boolean;
}

export function FileDiffViewer({ diff, defaultExpanded = false }: FileDiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const beforeLines = diff.before?.split('\n') || [];
  const afterLines = diff.after.split('\n');

  return (
    <div className="border border-[var(--ecode-border)] rounded-lg overflow-hidden my-2">
      {/* Header */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between px-3 py-3 md:py-2 h-auto min-h-[44px] hover:bg-[var(--ecode-surface)] touch-manipulation"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          )}
          <FileText className="h-5 w-5 md:h-4 md:w-4 text-blue-500 flex-shrink-0" />
          <span className="text-[13px] font-mono text-[var(--ecode-text)] truncate">
            {diff.path}
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {diff.linesAdded > 0 && (
            <Badge variant="outline" className="text-[11px] bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              <Plus className="h-3 w-3 mr-1" />
              {diff.linesAdded}
            </Badge>
          )}
          {diff.linesRemoved > 0 && (
            <Badge variant="outline" className="text-[11px] bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
              <Minus className="h-3 w-3 mr-1" />
              {diff.linesRemoved}
            </Badge>
          )}
          {diff.language && (
            <Badge variant="outline" className="text-[11px]">
              {diff.language}
            </Badge>
          )}
        </div>
      </Button>

      {/* Diff Content */}
      {isExpanded && (
        <div className="border-t border-[var(--ecode-border)]">
          {diff.before ? (
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-[var(--ecode-border)]">
              {/* Before */}
              <div className="bg-red-50 dark:bg-red-950/10 md:border-b-0 border-b border-[var(--ecode-border)]">
                <div className="px-3 py-2 bg-red-100 dark:bg-red-900/20 border-b border-[var(--ecode-border)]">
                  <span className="text-[11px] font-semibold text-red-700 dark:text-red-400">Before</span>
                </div>
                <pre className="p-3 overflow-x-auto text-[11px] font-mono max-w-full">
                  {beforeLines.map((line, i) => (
                    <div key={i} className="flex">
                      <span className="text-red-400 dark:text-red-600 mr-3 select-none w-8 text-right">{i + 1}</span>
                      <span className="text-red-700 dark:text-red-300">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>

              {/* After */}
              <div className="bg-green-50 dark:bg-green-950/10">
                <div className="px-3 py-2 bg-green-100 dark:bg-green-900/20 border-b border-[var(--ecode-border)]">
                  <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">After</span>
                </div>
                <pre className="p-3 overflow-x-auto text-[11px] font-mono max-w-full">
                  {afterLines.map((line, i) => (
                    <div key={i} className="flex">
                      <span className="text-green-400 dark:text-green-600 mr-3 select-none w-8 text-right">{i + 1}</span>
                      <span className="text-green-700 dark:text-green-300">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          ) : (
            // New file (no before)
            <div className="bg-green-50 dark:bg-green-950/10">
              <div className="px-3 py-2 bg-green-100 dark:bg-green-900/20 border-b border-[var(--ecode-border)]">
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">New File</span>
              </div>
              <pre className="p-3 overflow-x-auto text-[11px] font-mono max-w-full">
                {afterLines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-green-400 dark:text-green-600 mr-3 select-none w-8 text-right">{i + 1}</span>
                    <span className="text-green-700 dark:text-green-300">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MultiFileDiffProps {
  diffs: FileDiff[];
}

export function MultiFileDiff({ diffs }: MultiFileDiffProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeDiffs = diffs || [];
  
  if (safeDiffs.length === 0) return null;

  const totalAdded = safeDiffs.reduce((sum, d) => sum + d.linesAdded, 0);
  const totalRemoved = safeDiffs.reduce((sum, d) => sum + d.linesRemoved, 0);

  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-[var(--ecode-text)]">
          {safeDiffs.length} {safeDiffs.length === 1 ? 'file' : 'files'} changed
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-green-600 dark:text-green-400">
            +{totalAdded}
          </span>
          <span className="text-[11px] text-red-600 dark:text-red-400">
            -{totalRemoved}
          </span>
        </div>
      </div>
      
      {safeDiffs.map((diff, i) => (
        <FileDiffViewer key={i} diff={diff} />
      ))}
    </div>
  );
}
