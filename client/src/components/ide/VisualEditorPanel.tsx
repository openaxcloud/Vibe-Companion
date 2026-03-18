import { MousePointer2 } from 'lucide-react';

export function VisualEditorPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <MousePointer2 className="w-4 h-4 text-[#7C65CB]" />
        <h2 className="text-[15px] font-semibold text-[var(--ide-text)]">Visual Editor</h2>
      </div>
      <p className="text-xs text-[var(--ide-text-muted)]">Edit UI elements visually.</p>
    </div>
  );
}
