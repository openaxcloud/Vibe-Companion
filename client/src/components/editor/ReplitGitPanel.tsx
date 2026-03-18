import GitHubPanel from '@/components/GitHubPanel';

export function ReplitGitPanel({ projectId }: { projectId: string }) {
  return <GitHubPanel projectId={projectId} projectName="project" />;
}
