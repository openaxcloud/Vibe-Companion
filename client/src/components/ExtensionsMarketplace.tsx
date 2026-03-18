import { Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtensionsMarketplaceProps {
  projectId: number;
  className?: string;
}

export function ExtensionsMarketplace({ projectId, className }: ExtensionsMarketplaceProps) {
  return (
    <div className={cn('h-full overflow-auto p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Puzzle className="w-4 h-4 text-[#0CCE6B]" />
        <h2 className="text-[15px] font-semibold text-[var(--ide-text)]">Extensions</h2>
      </div>
      <p className="text-xs text-[var(--ide-text-muted)]">Browse and install extensions for your IDE.</p>
    </div>
  );
}
