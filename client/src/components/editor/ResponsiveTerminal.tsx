import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import 'xterm/css/xterm.css';

interface ResponsiveTerminalProps {
  projectId: number;
  className?: string;
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function ResponsiveTerminal({ 
  projectId, 
  className,
  onClose,
  isFullscreen,
  onToggleFullscreen
}: ResponsiveTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal with responsive settings
    const term = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? 12 : 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: 'var(--ecode-background)',
        foreground: 'var(--ecode-text)',
        cursor: 'var(--ecode-accent)',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#339af0',
        magenta: '#f06595',
        cyan: '#22b8cf',
        white: '#e9ecef',
        brightBlack: '#495057',
        brightRed: '#ff8787',
        brightGreen: '#69db7c',
        brightYellow: '#ffe066',
        brightBlue: '#4dabf7',
        brightMagenta: '#f783ac',
        brightCyan: '#3bc9db',
        brightWhite: '#f8f9fa',
      },
      scrollback: isMobile ? 500 : 1000,
      cols: isMobile ? 80 : 120,
      rows: isMobile ? 20 : 30,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Open terminal
    term.open(terminalRef.current);
    fitAddon.fit();

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/terminal?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      term.writeln('\r\n\x1b[32mConnected to terminal\x1b[0m\r\n');
      
      // Send initial resize
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      term.writeln('\r\n\x1b[31mConnection error\x1b[0m\r\n');
    };

    ws.onclose = () => {
      setIsConnected(false);
      term.writeln('\r\n\x1b[31mDisconnected from terminal\x1b[0m\r\n');
    };

    // Send input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddon) {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Touch support for mobile
    if (isMobile) {
      let touchStartY = 0;
      
      terminalRef.current.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      });
      
      terminalRef.current.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        
        if (Math.abs(deltaY) > 10) {
          term.scrollLines(deltaY > 0 ? 3 : -3);
          touchStartY = touchY;
        }
        
        e.preventDefault();
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [projectId, isMobile]);

  const copySelection = () => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
  };

  const downloadLog = () => {
    if (xtermRef.current) {
      const buffer = [];
      const term = xtermRef.current;
      
      for (let i = 0; i < term.buffer.active.length; i++) {
        const line = term.buffer.active.getLine(i);
        if (line) {
          buffer.push(line.translateToString(true));
        }
      }
      
      const blob = new Blob([buffer.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terminal-log-${projectId}-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-[var(--ecode-background)]",
      isFullscreen && "fixed inset-0 z-50",
      className
    )}>
      {/* Terminal Header */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Terminal</span>
          {isConnected ? (
            <span className="text-[10px] text-green-500">● Connected</span>
          ) : (
            <span className="text-[10px] text-red-500">● Disconnected</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copySelection}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadLog}>
            <Download className="h-3 w-3" />
          </Button>
          {onToggleFullscreen && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-2"
        style={{
          touchAction: isMobile ? 'none' : 'auto'
        }}
      />
    </div>
  );
}