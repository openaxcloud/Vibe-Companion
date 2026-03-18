import PackagesPanel from '@/components/PackagesPanel';

export function ReplitPackagesPanel({ projectId }: { projectId: string }) {
  return <PackagesPanel projectId={projectId} onClose={() => {}} />;
}
