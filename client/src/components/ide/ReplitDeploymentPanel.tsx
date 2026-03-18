import PublishingPanel from '@/components/PublishingPanel';

interface ReplitDeploymentPanelProps {
  projectId: string;
  onClose?: () => void;
  defaultTab?: string;
}

export function ReplitDeploymentPanel({ projectId, onClose }: ReplitDeploymentPanelProps) {
  return (
    <div className="h-full overflow-auto">
      <PublishingPanel projectId={projectId} onClose={onClose || (() => {})} />
    </div>
  );
}
