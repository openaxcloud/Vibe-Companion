import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import {
  Terminal,
  X,
  RotateCcw,
  Copy,
  Maximize2,
  Minimize2,
  Plus,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalMetricsIndicator } from '@/components/terminal/TerminalMetricsIndicator';
import { useToast } from '@/hooks/use-toast';
import { LazyMotionDiv } from '@/lib/motion';

interface ReplitTerminalPanelProps {
  projectId?: string | number;
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("rounded-lg bg-muted", className)}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ConnectionBadge({ isConnecting, isConnected }: { isConnecting: boolean; isConnected: boolean }) {
  if (isConnecting) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--ecode-surface)] border border-[var(--ecode-border)]">
        <Loader2 className="w-3 h-3 animate-spin text-[hsl(142,72%,42%)]" />
        <span className="text-[10px] text-[var(--ecode-text-muted)]">Connecting</span>
      </div>
    );
  }
  
  if (isConnected) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--ecode-surface)] border border-[var(--ecode-border)]">
        <Wifi className="w-3 h-3 text-[hsl(142,72%,42%)]" />
        <span className="text-[10px] text-[hsl(142,72%,42%)]">Connected</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--ecode-surface)] border border-[var(--ecode-border)]">
      <WifiOff className="w-3 h-3 text-[var(--ecode-text-muted)]" />
      <span className="text-[10px] text-[var(--ecode-text-muted)]">Disconnected</span>
    </div>
  );
}

function getTerminalTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();
  return {
    background:          get('--ecode-terminal-bg')            || '#0e1525',
    foreground:          get('--ecode-terminal-text')           || '#d4d8dd',
    cursor:              get('--ecode-terminal-cursor')         || '#F26207',
    cursorAccent:        get('--ecode-terminal-bg')             || '#0e1525',
    selectionBackground: get('--ecode-terminal-selection')      || 'rgba(0,121,242,0.3)',
    black:               get('--ecode-terminal-black')          || '#0e1525',
    red:                 get('--ecode-terminal-red')            || '#ff6b6b',
    green:               get('--ecode-terminal-green')          || '#4ecdc4',
    yellow:              get('--ecode-terminal-yellow')         || '#ffe66d',
    blue:                get('--ecode-terminal-blue')           || '#0079f2',
    magenta:             get('--ecode-terminal-magenta')        || '#c792ea',
    cyan:                get('--ecode-terminal-cyan')           || '#89ddff',
    white:               get('--ecode-terminal-white')          || '#d4d8dd',
    brightBlack:         get('--ecode-terminal-bright-black')   || '#3d4452',
    brightRed:           get('--ecode-terminal-bright-red')     || '#ff8a80',
    brightGreen:         get('--ecode-terminal-bright-green')   || '#69f0ae',
    brightYellow:        get('--ecode-terminal-bright-yellow')  || '#ffff8d',
    brightBlue:          get('--ecode-terminal-bright-blue')    || '#40c4ff',
    brightMagenta:       get('--ecode-terminal-bright-magenta') || '#ff80ab',
    brightCyan:          get('--ecode-terminal-bright-cyan')    || '#a7fdeb',
    brightWhite:         get('--ecode-terminal-bright-white')   || '#ffffff',
  };
}

export function ReplitTerminalPanel({ projectId, className }: ReplitTerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme();
    }
  }, [theme]);

  const connectWebSocket = useCallback(() => {
    if (!projectId) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use project ID explicitly in the URL
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws?projectId=${projectId}`;
    
    setIsConnecting(true);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setIsLoading(false);
        
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[1;32m✓ Connected to terminal server\x1b[0m');
        }
        
        if (fitAddonRef.current && xtermRef.current) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          }));
        }
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      ws.onmessage = (event) => {
        if (!xtermRef.current) return;
        
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'output':
              xtermRef.current.write(message.data);
              break;
            case 'error':
              xtermRef.current.write(`\x1b[1;31m${message.data}\x1b[0m`);
              break;
            case 'exit':
              xtermRef.current.writeln(`\r\n\x1b[90mProcess exited with code ${message.code}\x1b[0m`);
              break;
            default:
              xtermRef.current.write(message.data || event.data);
          }
        } catch { /* Raw terminal data - expected when message is not JSON */
          xtermRef.current.write(event.data);
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        
        if (xtermRef.current) {
          xtermRef.current.writeln('\r\n\x1b[1;33m⚠ Connection closed. Reconnecting...\x1b[0m');
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };
      
      ws.onerror = () => {
        setIsConnecting(false);
        if (xtermRef.current) {
          xtermRef.current.writeln('\r\n\x1b[1;31m✗ Connection error\x1b[0m');
        }
      };
    } catch (error) {
      setIsConnecting(false);
      console.error('[Terminal] WebSocket connection error:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: getTerminalTheme(),
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      convertEol: true,
      allowTransparency: false
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;32m╭─────────────────────────────────────────╮\x1b[0m');
    term.writeln('\x1b[1;32m│\x1b[0m \x1b[1;36mE-Code Terminal\x1b[0m                       \x1b[1;32m│\x1b[0m');
    term.writeln('\x1b[1;32m│\x1b[0m \x1b[90mConnecting to workspace...\x1b[0m            \x1b[1;32m│\x1b[0m');
    term.writeln('\x1b[1;32m╰─────────────────────────────────────────╯\x1b[0m');
    term.writeln('');

    term.onData((data) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    });

    connectWebSocket();
    
    setTimeout(() => setIsLoading(false), 1500);

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      term.dispose();
    };
  }, [connectWebSocket]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const handleReset = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.writeln('\x1b[1;32m╭─────────────────────────────────────────╮\x1b[0m');
      xtermRef.current.writeln('\x1b[1;32m│\x1b[0m \x1b[1;36mE-Code Terminal\x1b[0m                       \x1b[1;32m│\x1b[0m');
      xtermRef.current.writeln('\x1b[1;32m│\x1b[0m \x1b[90mReconnecting...\x1b[0m                       \x1b[1;32m│\x1b[0m');
      xtermRef.current.writeln('\x1b[1;32m╰─────────────────────────────────────────╯\x1b[0m');
      xtermRef.current.writeln('');
    }
    
    setTimeout(connectWebSocket, 500);
  };

  const handleCopy = () => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        toast({
          title: 'Copied',
          description: 'Selection copied to clipboard'
        });
      }
    }
  };

  return (
    <div 
      className={cn(
        "h-full flex flex-col bg-background",
        isFullscreen && "fixed inset-0 z-50",
        className
      )} 
      data-testid="replit-terminal-panel"
    >
      <div className="h-9 px-2.5 flex items-center justify-between bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            <span className="text-xs font-medium text-[var(--ecode-text)]">Shell</span>
          </div>
          
          <ConnectionBadge isConnecting={isConnecting} isConnected={isConnected} />
          
          <TerminalMetricsIndicator compact data-testid="replit-terminal-panel-metrics" />
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={handleCopy}
            data-testid="button-terminal-copy"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={handleClear}
            data-testid="button-terminal-clear"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={handleReset}
            data-testid="button-terminal-reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setIsFullscreen(!isFullscreen)}
            data-testid="button-terminal-fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-terminal-new"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 p-3 bg-background flex flex-col gap-2">
            <ShimmerSkeleton className="h-4 w-3/4 rounded" />
            <ShimmerSkeleton className="h-4 w-1/2 rounded" />
            <ShimmerSkeleton className="h-4 w-2/3 rounded" />
            <ShimmerSkeleton className="h-4 w-1/3 rounded" />
          </div>
        )}
        <div
          ref={terminalRef}
          className={cn(
            "h-full p-3 bg-[var(--ecode-terminal-bg)]",
            isLoading && "opacity-0"
          )}
          data-testid="terminal-container"
        />
      </div>
    </div>
  );
}
