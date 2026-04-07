import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Project } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Minimize2, Maximize2, X, Terminal as TerminalIcon, Play, Square } from 'lucide-react';

interface TerminalProps {
  project: Project | undefined;
  minimized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function Terminal({ project, minimized, onMinimize, onMaximize, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // Initialize xterm.js terminal
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Clean up previous terminal if it exists
    if (terminal) {
      terminal.dispose();
    }
    
    // Create a new terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5'
      },
      scrollback: 1000,
      allowTransparency: true
    });
    
    // Create addons
    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    // Load addons
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    
    // Open terminal in the container
    term.open(terminalRef.current);
    
    // Fit terminal to container size
    fit.fit();
    
    // Show welcome message
    term.writeln('\x1b[1;34m★ PLOT Terminal ★\x1b[0m');
    term.writeln('Type commands or click Run to execute your project.');
    term.writeln('');
    
    // Set up resize handler
    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);
    
    // Save terminal and addon references
    setTerminal(term);
    setFitAddon(fit);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);
  
  // Set up WebSocket connection for terminal
  useEffect(() => {
    if (!project || !terminal) return;
    
    // Close previous connection if exists
    if (socket) {
      socket.close();
    }
    
    // Create protocol for WebSocket (ws or wss)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const terminalSocket = new WebSocket(`${protocol}//${window.location.host}/terminal/${project.id}`);
    
    // Handle incoming data from WebSocket
    terminalSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'output') {
          terminal.write(data.content);
        } else if (data.type === 'status') {
          setIsRunning(data.running);
        }
      } catch (error) {
        // If not JSON, treat as raw output
        terminal.write(event.data);
      }
    };
    
    // Handle socket connection open
    terminalSocket.onopen = () => {
      terminal.writeln('\r\n\x1b[1;32mTerminal connection established\x1b[0m\r\n');
    };
    
    // Handle socket connection close
    terminalSocket.onclose = () => {
      terminal.writeln('\r\n\x1b[1;31mTerminal connection closed\x1b[0m\r\n');
    };
    
    // Handle socket connection error
    terminalSocket.onerror = (error) => {
      terminal.writeln(`\r\n\x1b[1;31mWebSocket error: ${error}\x1b[0m\r\n`);
    };
    
    // Handle user input
    terminal.onData((data) => {
      if (terminalSocket.readyState === WebSocket.OPEN) {
        terminalSocket.send(JSON.stringify({ type: 'input', content: data }));
      }
    });
    
    // Save socket reference
    setSocket(terminalSocket);
    
    // Clean up
    return () => {
      terminalSocket.close();
    };
  }, [project, terminal]);
  
  // Handle terminal resize
  useEffect(() => {
    if (fitAddon && !minimized) {
      setTimeout(() => {
        fitAddon.fit();
      }, 100);
    }
  }, [minimized, fitAddon]);
  
  // Run the project
  const runProject = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    // Send run command to server
    socket.send(JSON.stringify({ type: 'command', action: 'run' }));
    setIsRunning(true);
  };
  
  // Stop the project
  const stopProject = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    // Send stop command to server
    socket.send(JSON.stringify({ type: 'command', action: 'stop' }));
    setIsRunning(false);
  };
  
  // Clear the terminal
  const clearTerminal = () => {
    if (terminal) {
      terminal.clear();
    }
  };
  
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-background border border-border rounded-md shadow-lg z-50">
        <div className="p-2 flex items-center justify-between">
          <div className="flex items-center">
            <TerminalIcon className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Terminal</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onMaximize} className="h-6 w-6 p-0">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-background border-t border-border">
      <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
        <div className="flex items-center">
          <TerminalIcon className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
        <div className="flex items-center space-x-1">
          {isRunning ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={stopProject} 
              className="h-6 w-6 p-0"
              title="Stop"
            >
              <Square className="h-3 w-3 text-destructive" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={runProject} 
              className="h-6 w-6 p-0"
              title="Run"
            >
              <Play className="h-3 w-3 text-green-500" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearTerminal} 
            className="h-6 w-6 p-0"
            title="Clear"
          >
            <span className="text-xs font-bold">CLR</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onMinimize} 
            className="h-6 w-6 p-0"
            title="Minimize"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-6 w-6 p-0"
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden" ref={terminalRef} />
    </div>
  );
}