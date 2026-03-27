// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { 
  Copy, Clipboard, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  CornerDownLeft, Delete, X as Escape, Command, Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTerminalHistoryPersistence } from '@/hooks/use-mobile-persistence';
import { TerminalMetricsIndicator } from '@/components/terminal/TerminalMetricsIndicator';
import '@xterm/xterm/css/xterm.css';

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
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const commandBufferRef = useRef<string>('');
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [canPaste, setCanPaste] = useState(false);
  const [currentLine, setCurrentLine] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();
  
  const { history, addToHistory } = useTerminalHistoryPersistence(String(projectId));

  useEffect(() => {
    if (!terminalRef.current) return;

    const getTerminalTheme = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const terminalBg = computedStyle.getPropertyValue('--ecode-terminal-bg').trim() || '#1e1e1e';
      const terminalText = computedStyle.getPropertyValue('--ecode-terminal-text').trim() || '#d4d4d4';
      const terminalCursor = computedStyle.getPropertyValue('--ecode-terminal-cursor').trim() || '#F26207';
      
      return {
        background: terminalBg,
        foreground: terminalText,
        cursor: terminalCursor,
        selectionBackground: '#3D4455',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      };
    };

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.4,
      theme: getTerminalTheme(),
      scrollback: 1000,
      convertEol: true,
      disableStdin: false,
      allowProposedApi: true,
    });

    const handleThemeChange = () => {
      terminal.options.theme = getTerminalTheme();
    };
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          handleThemeChange();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    terminal.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws?projectId=${projectId}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {};
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'output') {
            terminal.write(message.data);
          } else if (message.type === 'error') {
            terminal.writeln(`\r\n\x1b[31mError: ${message.error}\x1b[0m\r\n$ `);
          }
        } catch (error) {
          console.error('[MobileTerminal] Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[MobileTerminal] WebSocket error:', error);
        terminal.writeln('\r\n\x1b[31mTerminal connection error. Please refresh.\x1b[0m\r\n');
      };
      
      ws.onclose = () => {
        terminal.writeln('\r\n\x1b[33mTerminal disconnected. Please refresh.\x1b[0m\r\n');
        wsRef.current = null;
      };
      
    } catch (error) {
      console.error('[MobileTerminal] Failed to create WebSocket:', error);
      terminal.writeln('\x1b[31mFailed to connect to terminal.\x1b[0m\r\n');
      terminal.writeln('Type commands below (local mode - commands will not execute).\r\n$ ');
    }

    terminal.onData((data) => {
      terminal.scrollToBottom();
      
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data
        }));
      }
      
      if (data === '\r') {
        if (commandBufferRef.current.trim()) {
          addToHistory(commandBufferRef.current.trim());
        }
        
        commandBufferRef.current = '';
        setHistoryIndex(-1);
        return;
      }
      
      if (data === '\x7F') {
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        }
        return;
      }
      
      if (data >= ' ' && data <= '~') {
        commandBufferRef.current += data;
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = terminal;
        ws.send(JSON.stringify({
          type: 'resize',
          cols,
          rows
        }));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      terminal.dispose();
    };
  }, [projectId, sessionId, addToHistory]);

  const sendToTerminal = (text: string) => {
    termInstanceRef.current?.paste(text);
    termInstanceRef.current?.scrollToBottom();
  };

  const handleTab = () => sendToTerminal('\t');
  const handleEnter = () => sendToTerminal('\r');
  const handleEscape = () => sendToTerminal('\x1B');
  const handleBackspace = () => sendToTerminal('\x7F');
  
  const replaceCurrentLine = (newCommand: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ 
          type: 'replace_line',
          command: newCommand
        }));
        
        commandBufferRef.current = newCommand;
        setCurrentLine(newCommand);
      } catch (error) {
        console.error('[MobileTerminal] Failed to send replace_line:', error);
        toast({
          title: 'Terminal sync error',
          description: 'Failed to replace command line',
          variant: 'destructive',
        });
      }
    } else {
      console.warn('[MobileTerminal] WebSocket not connected, cannot replace line');
    }
  };

  const handleArrowUp = () => {
    if (history.length > 0) {
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      if (newIndex >= 0 && newIndex < history.length) {
        setHistoryIndex(newIndex);
        const command = history[history.length - 1 - newIndex];
        replaceCurrentLine(command);
      }
    }
  };
  
  const handleArrowDown = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const command = history[history.length - 1 - newIndex];
      replaceCurrentLine(command);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      replaceCurrentLine('');
    }
  };
  
  const handleArrowLeft = () => sendToTerminal('\x1B[D');
  const handleArrowRight = () => sendToTerminal('\x1B[C');
  
  const handleCtrlC = () => sendToTerminal('\x03');
  const handleCtrlD = () => sendToTerminal('\x04');

  const handleCopy = async () => {
    const selection = termInstanceRef.current?.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
        toast({
          title: 'Copied',
          description: 'Terminal output copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Copy failed',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      sendToTerminal(text);
      toast({
        title: 'Pasted',
        description: 'Text pasted into terminal',
      });
    } catch (error) {
      toast({
        title: 'Paste failed',
        description: 'Failed to read from clipboard',
        variant: 'destructive',
      });
    }
  };

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

  const handleClear = () => {
    termInstanceRef.current?.clear();
    termInstanceRef.current?.write('$ ');
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

      <div 
        ref={terminalRef} 
        className="flex-1 min-h-0 p-2 overflow-auto"
        data-testid="mobile-terminal-container"
      />
    </div>
  );
}
