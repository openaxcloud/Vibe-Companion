import PublishingPanel from '@/components/PublishingPanel';

interface ReplitDeploymentPanelProps {
  projectId: string;
  defaultTab?: string;
}

export function ReplitDeploymentPanel({ projectId }: ReplitDeploymentPanelProps) {
  return (
    <div className="h-full overflow-auto">
      <PublishingPanel projectId={projectId} onClose={() => {}} />
    </div>
  );
}
