import AppStoragePanelOrig from '@/components/AppStoragePanel';

interface AppStoragePanelWrapperProps {
  projectId: string;
  onClose?: () => void;
}

export function AppStoragePanel({ projectId, onClose }: AppStoragePanelWrapperProps) {
  return <AppStoragePanelOrig projectId={projectId} onClose={onClose || (() => {})} />;
}
