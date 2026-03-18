import { BarChart3 } from 'lucide-react';

export function ResourcesPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-[var(--ide-text-muted)]" />
        <h2 className="text-[15px] font-semibold text-[var(--ide-text)]">Resources</h2>
      </div>
      <p className="text-xs text-[var(--ide-text-muted)]">Monitor CPU, memory, and disk usage.</p>
    </div>
  );
}
