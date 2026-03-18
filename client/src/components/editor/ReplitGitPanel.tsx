import GitHubPanel from '@/components/GitHubPanel';

interface ReplitGitPanelProps {
  projectId: string;
  projectName?: string;
  onImported?: (newProjectId?: string) => void;
  onCloned?: () => void;
}

export function ReplitGitPanel({ projectId, projectName, onImported, onCloned }: ReplitGitPanelProps) {
  return (
    <GitHubPanel
      projectId={projectId}
      projectName={projectName || 'project'}
      onImported={onImported}
      onCloned={onCloned}
    />
  );
}
