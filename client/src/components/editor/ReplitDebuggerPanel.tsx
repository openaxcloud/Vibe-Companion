import { Bug } from 'lucide-react';

export function ReplitDebuggerPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 bg-[var(--ide-panel)]">
      <Bug className="w-10 h-10 text-[var(--ide-text-muted)]" />
      <h3 className="text-sm font-semibold text-[var(--ide-text)]">Debugger</h3>
      <p className="text-xs text-[var(--ide-text-muted)] text-center max-w-[200px]">Set breakpoints and inspect variables</p>
    </div>
  );
}
