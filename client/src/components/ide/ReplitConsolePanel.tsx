import ConsolePanel from '@/components/ConsolePanel';

interface ReplitConsolePanelProps {
  projectId: string;
  isRunning: boolean;
  logs: { id: number; text: string; type: 'info' | 'error' | 'success' }[];
  onStop?: () => Promise<void> | void;
  onAskAI?: (text: string) => void;
  activeFileName?: string;
  currentConsoleRunId?: string | null;
  executionId?: string | null;
  onSendStdin?: (data: string) => void;
}

export function ReplitConsolePanel({
  projectId,
  isRunning,
  logs,
  onStop,
  onAskAI,
  activeFileName,
  currentConsoleRunId,
  onSendStdin,
}: ReplitConsolePanelProps) {
  return (
    <ConsolePanel
      projectId={projectId}
      isRunning={isRunning}
      logs={logs}
      onStop={onStop || (() => {})}
      onAskAI={onAskAI || (() => {})}
      activeFileName={activeFileName}
      currentConsoleRunId={currentConsoleRunId}
      onSendStdin={onSendStdin}
    />
  );
}
