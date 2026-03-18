import { Loader2 } from 'lucide-react';

interface AppNotReadyPlaceholderProps {
  tabName: string;
  projectId: string;
}

export function AppNotReadyPlaceholder({ tabName }: AppNotReadyPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-[var(--ide-panel)]">
      <Loader2 className="w-8 h-8 text-[#0079F2] animate-spin" />
      <div className="text-center">
        <h3 className="text-sm font-semibold text-[var(--ide-text)]">{tabName} is loading...</h3>
        <p className="text-xs text-[var(--ide-text-muted)] mt-1">Your app is being set up. This won't take long.</p>
      </div>
    </div>
  );
}
