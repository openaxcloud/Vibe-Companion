import FileHistoryPanel from '@/components/FileHistoryPanel';

export function ReplitHistoryPanel({ projectId }: { projectId: string }) {
  return <FileHistoryPanel projectId={projectId} files={[]} onClose={() => {}} onFileRestored={() => {}} />;
}
