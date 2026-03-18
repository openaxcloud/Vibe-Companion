import TestRunnerPanel from '@/components/TestRunnerPanel';

export function ReplitTestingPanel({ projectId }: { projectId: string }) {
  return <TestRunnerPanel projectId={projectId} onClose={() => {}} />;
}
