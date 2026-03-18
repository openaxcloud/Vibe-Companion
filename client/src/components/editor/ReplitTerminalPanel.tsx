import WorkspaceTerminal from '@/components/WorkspaceTerminal';

interface ReplitTerminalPanelProps {
  projectId: string;
}

export function ReplitTerminalPanel({ projectId }: ReplitTerminalPanelProps) {
  return (
    <div className="h-full bg-black">
      <WorkspaceTerminal projectId={parseInt(projectId, 10)} />
    </div>
  );
}
