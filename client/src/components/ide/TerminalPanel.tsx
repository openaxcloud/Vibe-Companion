import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const ReplitTerminalPanel = instrumentedLazy(() => 
  import('@/components/editor/ReplitTerminalPanel').then(module => ({ default: module.ReplitTerminalPanel })), 'ReplitTerminalPanel'
);

const TerminalFallback = () => (
  <div className="h-full flex items-center justify-center bg-[var(--ecode-surface)]">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-[11px] text-[var(--ecode-text-muted)]">Loading terminal...</p>
    </div>
  </div>
);

interface TerminalPanelProps {
  projectId: string;
}

export function TerminalPanel({ projectId }: TerminalPanelProps) {
  return (
    <div className="h-full">
      <Suspense fallback={<TerminalFallback />}>
        <ReplitTerminalPanel projectId={projectId} />
      </Suspense>
    </div>
  );
}
