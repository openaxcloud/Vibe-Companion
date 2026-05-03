/**
 * ReplitTerminal — thin wrapper around WorkspaceTerminal.
 * Converts projectId + session to a canonical /api/terminal/ws URL
 * and delegates all terminal management to WorkspaceTerminal.
 */
import { useRef, useImperativeHandle, forwardRef } from 'react';
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
import { TerminalMetricsIndicator } from './TerminalMetricsIndicator';
import { cn } from '@/lib/utils';

interface ReplitTerminalProps {
  projectId: number | string;
  className?: string;
  defaultCommand?: string;
  onCommandExecute?: (command: string) => void;
  maxHeight?: number;
  theme?: 'dark' | 'light';
  allowMultipleSessions?: boolean;
  sessionId?: string;
}

export const ReplitTerminal = forwardRef<WorkspaceTerminalHandle, ReplitTerminalProps>(
  function ReplitTerminal(
    { projectId, className, onCommandExecute, theme, sessionId = 'default' },
    ref
  ) {
    const wthRef = useRef<WorkspaceTerminalHandle>(null);

    useImperativeHandle(ref, () => ({
      searchNext: (q) => wthRef.current?.searchNext(q) ?? false,
      searchPrevious: (q) => wthRef.current?.searchPrevious(q) ?? false,
      clearSearch: () => wthRef.current?.clearSearch(),
      clear: () => wthRef.current?.clear(),
      sendRaw: (msg) => wthRef.current?.sendRaw(msg),
      paste: async () => wthRef.current?.paste(),
      reconnect: () => wthRef.current?.reconnect(),
    }));

    const protocol = typeof window !== 'undefined'
      ? (window.location.protocol === 'https:' ? 'wss' : 'ws')
      : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5000';
    const wsUrl = `${protocol}://${host}/api/terminal/ws?projectId=${encodeURIComponent(String(projectId))}&sessionId=${encodeURIComponent(sessionId)}`;

    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-shrink-0 flex items-center justify-end px-2 py-1 border-b bg-muted/30">
          <TerminalMetricsIndicator compact />
        </div>
        <div className="flex-1 min-h-0">
          <WorkspaceTerminal
            ref={wthRef}
            wsUrl={wsUrl}
            runnerOffline={false}
            visible={true}
            theme={theme}
            onLastCommand={onCommandExecute}
          />
        </div>
      </div>
    );
  }
);
