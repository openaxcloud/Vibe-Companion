import PackagesPanel from '@/components/PackagesPanel';

interface ReplitPackagesPanelProps {
  projectId: string;
  onClose?: () => void;
  onOpenFile?: (filename: string) => void;
}

export function ReplitPackagesPanel({ projectId, onClose, onOpenFile }: ReplitPackagesPanelProps) {
  return (
    <PackagesPanel
      projectId={projectId}
      onClose={onClose || (() => {})}
      onOpenFile={onOpenFile}
    />
  );
}
