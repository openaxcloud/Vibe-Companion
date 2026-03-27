import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
import { forwardRef, useState, useEffect } from 'react';

interface ShellPanelProps {
  projectId: string;
  wsUrl?: string | null;
  runnerOffline?: boolean;
  visible?: boolean;
  onLastCommand?: (command: string) => void;
  shellBell?: boolean;
  accessibleTerminal?: boolean;
}

function buildTerminalWsUrl(projectId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(projectId)}&sessionId=default`;
}

export const ShellPanel = forwardRef<WorkspaceTerminalHandle, ShellPanelProps>(
  function ShellPanel(
    { projectId, wsUrl: externalWsUrl, runnerOffline = false, visible = true, onLastCommand, shellBell, accessibleTerminal },
    ref
  ) {
    const [autoWsUrl, setAutoWsUrl] = useState<string | null>(null);

    useEffect(() => {
      if (externalWsUrl) {
        setAutoWsUrl(null);
        return;
      }
      fetch(`/api/workspaces/${projectId}/terminal-url`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((d) => {
          if (d?.wsUrl) setAutoWsUrl(d.wsUrl);
          else setAutoWsUrl(buildTerminalWsUrl(projectId));
        })
        .catch(() => {
          setAutoWsUrl(buildTerminalWsUrl(projectId));
        });
    }, [projectId, externalWsUrl]);

    const effectiveWsUrl = externalWsUrl || autoWsUrl;

    return (
      <div className="h-full bg-black">
        <WorkspaceTerminal
          ref={ref}
          wsUrl={effectiveWsUrl}
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
