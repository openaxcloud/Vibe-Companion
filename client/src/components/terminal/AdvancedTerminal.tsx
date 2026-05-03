/**
 * AdvancedTerminal — thin wrapper around WorkspaceTerminal.
 * All terminal management is delegated to WorkspaceTerminal;
 * this component exists for backward-compatibility with lazy imports.
 */
import { useRef } from 'react';
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
import { cn } from '@/lib/utils';

interface AdvancedTerminalProps {
  projectId?: number | string;
  sessionId?: string;
  className?: string;
  theme?: 'dark' | 'light';
  onLastCommand?: (command: string) => void;
}

export function AdvancedTerminal({
  projectId,
  sessionId = 'default',
  className,
  theme,
  onLastCommand,
}: AdvancedTerminalProps) {
  const protocol = typeof window !== 'undefined'
    ? (window.location.protocol === 'https:' ? 'wss' : 'ws')
    : 'ws';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5000';
  const wsUrl = projectId
    ? `${protocol}://${host}/api/terminal/ws?projectId=${encodeURIComponent(String(projectId))}&sessionId=${encodeURIComponent(sessionId)}`
    : null;

  return (
    <div className={cn('h-full', className)}>
      <WorkspaceTerminal
        wsUrl={wsUrl}
        runnerOffline={!projectId}
        visible={true}
        theme={theme}
        onLastCommand={onLastCommand}
      />
    </div>
  );
}
