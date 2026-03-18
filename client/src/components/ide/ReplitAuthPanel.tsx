import AuthPanel from '@/components/AuthPanel';

export function ReplitAuthPanel({ projectId }: { projectId: string }) {
  return <AuthPanel projectId={projectId} onClose={() => {}} />;
}
