import { FileText } from 'lucide-react';

export function LogsViewerPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-[var(--ide-text-muted)]" />
        <h2 className="text-[15px] font-semibold text-[var(--ide-text)]">Logs</h2>
      </div>
      <p className="text-xs text-[var(--ide-text-muted)]">View application logs and output.</p>
    </div>
  );
}
