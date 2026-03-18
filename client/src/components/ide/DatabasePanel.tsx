import DatabasePanelOrig from '@/components/DatabasePanel';

interface DatabasePanelProps {
  projectId: string;
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  return <DatabasePanelOrig projectId={projectId} onClose={() => {}} />;
}
