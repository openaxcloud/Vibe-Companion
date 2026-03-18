import WorkflowsPanelOrig from '@/components/WorkflowsPanel';

export function WorkflowsPanel({ projectId }: { projectId: string }) {
  return <WorkflowsPanelOrig projectId={projectId} onClose={() => {}} />;
}
