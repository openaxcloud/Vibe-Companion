// @ts-nocheck
import { ReplitGitPanel } from '@/components/editor/ReplitGitPanel';

interface GitPanelProps {
  projectId: string;
  onBranchChange?: (branch: string) => void;
  mode?: 'desktop' | 'tablet' | 'mobile';
}

export function GitPanel({ projectId, onBranchChange, mode = 'desktop' }: GitPanelProps) {
  return (
    <div className="h-full">
      <ReplitGitPanel projectId={projectId} mode={mode} />
    </div>
  );
}
