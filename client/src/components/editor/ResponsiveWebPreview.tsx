import { Globe, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResponsiveWebPreviewProps {
  projectId: string;
}

export function ResponsiveWebPreview({ projectId }: ResponsiveWebPreviewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded">
          <RefreshCw className="w-3 h-3" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
            <span className="text-[10px] text-[var(--ide-text-muted)] font-mono">localhost:3000</span>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <Globe className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-xs text-gray-400">Run your app to see the preview</p>
        </div>
      </div>
    </div>
  );
}
