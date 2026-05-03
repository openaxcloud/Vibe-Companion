import { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Copy, Clipboard, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  CornerDownLeft, Delete, X as Escape, Command, Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TerminalMetricsIndicator } from '@/components/terminal/TerminalMetricsIndicator';
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';

interface MobileTerminalProps {
  projectId: string | number;
  sessionId?: string;
  className?: string;
}

export function MobileTerminal({ 
  projectId, 
  sessionId,
  className 
}: MobileTerminalProps) {
  const wthRef = useRef<WorkspaceTerminalHandle>(null);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [canPaste, setCanPaste] = useState(false);
  const { toast } = useToast();

  const protocol = typeof window !== 'undefined'
    ? (window.location.protocol === 'https:' ? 'wss' : 'ws')
    : 'ws';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5000';
  const wsUrl = `${protocol}://${host}/api/terminal/ws?projectId=${encodeURIComponent(String(projectId))}&sessionId=${encodeURIComponent(sessionId || 'default')}`;

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const permission = await navigator.permissions.query({ 
          name: 'clipboard-read' as PermissionName 
        });
        setCanPaste(permission.state === 'granted' || permission.state === 'prompt');
      } catch {
        setCanPaste(true);
      }
    };
    checkClipboard();
  }, []);

  const send = useCallback((data: string) => {
    wthRef.current?.sendRaw({ type: 'input', data });
  }, []);

  const handleTab = () => send('\t');
  const handleEnter = () => {
    send('\r');
  };
  const handleEscape = () => send('\x1B');
  const handleBackspace = () => send('\x7F');
  const handleArrowLeft = () => send('\x1B[D');
  const handleArrowRight = () => send('\x1B[C');
  const handleCtrlC = () => send('\x03');
  const handleCtrlD = () => send('\x04');

  // Arrow up/down send the standard ANSI sequences that bash/readline
  // handles natively through the PTY — no custom server-side message needed.
  const handleArrowUp = () => send('\x1B[A');
  const handleArrowDown = () => send('\x1B[B');

  const handleCopy = async () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
        toast({ title: 'Copied', description: 'Terminal output copied to clipboard' });
      } catch {
        toast({ title: 'Copy failed', description: 'Failed to copy to clipboard', variant: 'destructive' });
      }
    }
  };

  const handlePaste = async () => {
    try {
      await wthRef.current?.paste();
      toast({ title: 'Pasted', description: 'Text pasted into terminal' });
    } catch {
      toast({ title: 'Paste failed', description: 'Failed to read from clipboard', variant: 'destructive' });
    }
  };

  const handleClear = () => {
    wthRef.current?.clear();
  };

  return (
    <div className={cn('flex flex-col h-full bg-[var(--ecode-terminal-bg)]', className)}>
      {showKeyboard && (
        <div 
          className="flex-shrink-0 border-b border-border dark:border-[var(--ecode-border)] bg-card dark:bg-[var(--ecode-surface)] overflow-x-auto mobile-hide-scrollbar"
          data-testid="mobile-terminal-keyboard-toolbar"
        >
          <div className="flex items-center gap-1 p-2 min-w-max">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-[11px] font-mono hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleTab}
              data-testid="mobile-terminal-tab"
            >
              Tab
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-[11px] font-mono hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleEscape}
              data-testid="mobile-terminal-esc"
            >
              Esc
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-[11px] font-mono hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform flex items-center gap-1"
              onClick={handleCtrlC}
              data-testid="mobile-terminal-ctrl-c"
            >
              <Command className="h-3 w-3" />
              <span>C</span>
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-[11px] font-mono hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform flex items-center gap-1"
              onClick={handleCtrlD}
              data-testid="mobile-terminal-ctrl-d"
            >
              <Command className="h-3 w-3" />
              <span>D</span>
            </Button>

            <div className="w-px h-6 bg-border dark:bg-[var(--ecode-border)]" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleArrowUp}
              data-testid="mobile-terminal-arrow-up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleArrowDown}
              data-testid="mobile-terminal-arrow-down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleArrowLeft}
              data-testid="mobile-terminal-arrow-left"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleArrowRight}
              data-testid="mobile-terminal-arrow-right"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border dark:bg-[var(--ecode-border)]" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleEnter}
              data-testid="mobile-terminal-enter"
            >
              <CornerDownLeft className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleBackspace}
              data-testid="mobile-terminal-backspace"
            >
              <Delete className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border dark:bg-[var(--ecode-border)]" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleCopy}
              data-testid="mobile-terminal-copy"
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            {canPaste && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
                onClick={handlePaste}
                data-testid="mobile-terminal-paste"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            )}

            <div className="w-px h-6 bg-border dark:bg-[var(--ecode-border)]" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-[11px] hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={handleClear}
              data-testid="mobile-terminal-clear"
            >
              Clear
            </Button>

            <div className="w-px h-6 bg-border dark:bg-[var(--ecode-border)]" />

            <div className="ml-auto mr-2">
              <TerminalMetricsIndicator compact data-testid="mobile-terminal-metrics-compact" />
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-surface-tertiary-solid dark:hover:bg-[var(--ecode-surface-hover)] active:scale-95 touch-manipulation transition-transform"
              onClick={() => setShowKeyboard(false)}
              data-testid="mobile-terminal-hide-toolbar"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!showKeyboard && (
        <div className="absolute top-2 right-2 z-10 animate-scale-in">
          <Button
            size="sm"
            variant="default"
            className="h-9 w-9 rounded-full shadow-lg bg-primary hover:bg-primary/90 active:scale-95 touch-manipulation transition-transform"
            onClick={() => setShowKeyboard(true)}
            data-testid="mobile-terminal-show-toolbar"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0" data-testid="mobile-terminal-container">
        <WorkspaceTerminal
          ref={wthRef}
          wsUrl={wsUrl}
          runnerOffline={false}
          visible={true}
        />
      </div>
    </div>
  );
}
