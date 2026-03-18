import AppStoragePanelOrig from '@/components/AppStoragePanel';

export function AppStoragePanel({ projectId }: { projectId: string }) {
  return <AppStoragePanelOrig projectId={projectId} onClose={() => {}} />;
}
