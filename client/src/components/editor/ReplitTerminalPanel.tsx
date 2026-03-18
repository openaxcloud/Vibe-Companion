import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
import { forwardRef } from 'react';

interface ReplitTerminalPanelProps {
  projectId: string;
  wsUrl?: string | null;
  runnerOffline?: boolean;
  visible?: boolean;
  onLastCommand?: (command: string) => void;
  shellBell?: boolean;
  accessibleTerminal?: boolean;
}

export const ReplitTerminalPanel = forwardRef<WorkspaceTerminalHandle, ReplitTerminalPanelProps>(
  function ReplitTerminalPanel(
    { wsUrl, runnerOffline = false, visible = true, onLastCommand, shellBell, accessibleTerminal },
    ref
  ) {
    return (
      <div className="h-full bg-black">
        <WorkspaceTerminal
          ref={ref}
          wsUrl={wsUrl || null}
          runnerOffline={runnerOffline}
          visible={visible}
          onLastCommand={onLastCommand}
          shellBell={shellBell}
          accessibleTerminal={accessibleTerminal}
        />
      </div>
    );
  }
);
