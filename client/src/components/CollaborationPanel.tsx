import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface CollaborationPanelProps {
  projectId: number;
  projectName?: string;
  currentUser?: any;
  currentFile?: string;
  className?: string;
}

export function CollaborationPanel({ projectId, className }: CollaborationPanelProps) {
  return (
    <div className={cn('h-full overflow-auto p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-[#7C65CB]" />
        <h2 className="text-[15px] font-semibold text-[var(--ide-text)]">Collaboration</h2>
      </div>
      <p className="text-xs text-[var(--ide-text-muted)]">Invite team members to collaborate in real-time.</p>
    </div>
  );
}
