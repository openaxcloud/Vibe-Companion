import CheckpointsPanel from '@/components/CheckpointsPanel';

interface UnifiedCheckpointsPanelProps {
  projectId: string;
  maxHeight?: string;
}

export function UnifiedCheckpointsPanel({ projectId, maxHeight }: UnifiedCheckpointsPanelProps) {
  return (
    <div className="h-full overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <CheckpointsPanel projectId={projectId} onClose={() => {}} />
    </div>
  );
}
