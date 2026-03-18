import ConsolePanel from '@/components/ConsolePanel';

interface ReplitConsolePanelProps {
  projectId: string;
  isRunning?: boolean;
  executionId?: string | null;
}

export function ReplitConsolePanel({ projectId, isRunning, executionId }: ReplitConsolePanelProps) {
  return <ConsolePanel projectId={parseInt(projectId, 10)} isRunning={isRunning || false} logs={[]} />;
}
