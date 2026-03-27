import TestRunnerPanel from '@/components/TestRunnerPanel';

interface ReplitTestingPanelProps {
  projectId: string;
  onClose?: () => void;
}

export function ReplitTestingPanel({ projectId, onClose }: ReplitTestingPanelProps) {
  return <TestRunnerPanel projectId={projectId} onClose={onClose || (() => {})} />;
}
