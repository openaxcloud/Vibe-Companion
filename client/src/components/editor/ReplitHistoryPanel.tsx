import FileHistoryPanel from '@/components/FileHistoryPanel';

interface ReplitHistoryPanelProps {
  projectId: string;
  files?: { id: string; filename: string; content: string }[];
  onClose?: () => void;
  onFileRestored?: (fileId: string, filename: string, content: string) => void;
  initialFile?: string | null;
  openCounter?: number;
}

export function ReplitHistoryPanel({
  projectId,
  files,
  onClose,
  onFileRestored,
  initialFile,
  openCounter,
}: ReplitHistoryPanelProps) {
  return (
    <FileHistoryPanel
      projectId={projectId}
      files={files || []}
      onClose={onClose || (() => {})}
      onFileRestored={onFileRestored}
      initialFile={initialFile}
      openCounter={openCounter}
    />
  );
}
