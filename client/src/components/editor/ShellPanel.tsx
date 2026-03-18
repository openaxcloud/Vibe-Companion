import WorkspaceTerminal from '@/components/WorkspaceTerminal';

export function ShellPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full bg-black">
      <WorkspaceTerminal projectId={parseInt(projectId, 10)} />
    </div>
  );
}
