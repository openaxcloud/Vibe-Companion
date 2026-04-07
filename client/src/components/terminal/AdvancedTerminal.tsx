import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Maximize2, Minimize2, X, RefreshCw, Plus,
  Sun, Moon, Copy, ChevronDown, Search,
  RotateCcw, RotateCw, ZoomIn, ZoomOut,
  Terminal as TerminalIcon, History,
  Download, Upload, Settings, Palette,
  Save, Trash2, Split
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';

interface TerminalSession {
  id: string;
  name: string;
  terminal: XTerm;
  fitAddon: FitAddon;
  history: string[];
  currentDirectory: string;
  websocket?: WebSocket;
}

interface AdvancedTerminalProps {
  projectId: number;
  onClose?: () => void;
  minimized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  className?: string;
}

// Terminal themes
const terminalThemes = {
  dark: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    selection: '#3a3d41',
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
    brightWhite: '#ffffff'
  },
  light: {
    background: '#ffffff',
    foreground: '#1e1e1e',
    cursor: '#1e1e1e',
    cursorAccent: '#ffffff',
    selection: '#add6ff',
    black: '#1e1e1e',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#272822',
    selection: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  }
};

export function AdvancedTerminal({
  projectId,
  onClose,
  minimized = false,
  onMinimize,
  onMaximize,
  className
}: AdvancedTerminalProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ sessionId: string; line: number; text: string }[]>([]);
  const [fontSize, setFontSize] = useState(14);
  const [splitView, setSplitView] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof terminalThemes>('dark');
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { toast } = useToast();

  // Create a new terminal session
  const createSession = useCallback((name?: string) => {
    const id = `term-${Date.now()}`;
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize,
      fontFamily: 'JetBrains Mono, Monaco, Consolas, "Courier New", monospace',
      theme: terminalThemes[selectedTheme],
      allowTransparency: true,
      scrollback: 10000,
      bellStyle: 'both',
      rightClickSelectsWord: true,
      convertEol: true,
      screenReaderMode: true,
      wordSeparator: ' ()[]{}\',"',
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    const session: TerminalSession = {
      id,
      name: name || `Terminal ${sessions.length + 1}`,
      terminal,
      fitAddon,
      history: [],
      currentDirectory: '~'
    };

    // Connect WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/terminal?projectId=${projectId}&sessionId=${id}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`Terminal session ${id} connected`);
      terminal.writeln('\x1b[1;32mConnected to terminal\x1b[0m');
      terminal.writeln('');
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      terminal.writeln('\x1b[1;31mConnection error\x1b[0m');
    };

    ws.onclose = () => {
      terminal.writeln('\x1b[1;31mDisconnected from terminal\x1b[0m');
    };

    // Handle terminal input
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Track command history
    let currentCommand = '';
    terminal.onKey(({ key, domEvent }) => {
      if (domEvent.key === 'Enter') {
        if (currentCommand.trim()) {
          session.history.push(currentCommand);
          currentCommand = '';
        }
      } else if (domEvent.key === 'Backspace') {
        currentCommand = currentCommand.slice(0, -1);
      } else if (key.length === 1) {
        currentCommand += key;
      }
    });

    session.websocket = ws;
    setSessions(prev => [...prev, session]);
    setActiveSessionId(id);

    return session;
  }, [sessions.length, fontSize, selectedTheme, projectId]);

  // Initialize first session
  useEffect(() => {
    if (sessions.length === 0) {
      const session = createSession('Main');
      
      // Mount terminal after a short delay to ensure DOM is ready
      setTimeout(() => {
        const terminalElement = document.getElementById(`terminal-${session.id}`);
        if (terminalElement) {
          session.terminal.open(terminalElement);
          session.fitAddon.fit();
        }
      }, 100);
    }
  }, []);

  // Mount terminals when sessions change
  useEffect(() => {
    sessions.forEach(session => {
      const terminalElement = document.getElementById(`terminal-${session.id}`);
      if (terminalElement && !terminalElement.hasChildNodes()) {
        session.terminal.open(terminalElement);
        session.fitAddon.fit();
      }
    });
  }, [sessions, activeSessionId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      sessions.forEach(session => {
        if (session.fitAddon) {
          session.fitAddon.fit();
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sessions]);

  // Update font size for all sessions
  useEffect(() => {
    sessions.forEach(session => {
      session.terminal.options.fontSize = fontSize;
      session.fitAddon.fit();
    });
  }, [fontSize, sessions]);

  // Update theme for all sessions
  useEffect(() => {
    sessions.forEach(session => {
      session.terminal.options.theme = terminalThemes[selectedTheme];
    });
  }, [selectedTheme, sessions]);

  // Close a session
  const closeSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.websocket?.close();
      session.terminal.dispose();
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (activeSessionId === sessionId && sessions.length > 1) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setActiveSessionId(remainingSessions[0].id);
      }
    }
  };

  // Search functionality
  const searchInTerminals = () => {
    const results: { sessionId: string; line: number; text: string }[] = [];
    
    sessions.forEach(session => {
      const buffer = session.terminal.buffer.active;
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString();
          if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push({
              sessionId: session.id,
              line: i,
              text: text.trim()
            });
          }
        }
      }
    });
    
    setSearchResults(results);
  };

  // Navigate to search result
  const goToSearchResult = (sessionId: string, line: number) => {
    setActiveSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.terminal.scrollToLine(line);
    }
  };

  // Export terminal content
  const exportTerminalContent = () => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      const buffer = session.terminal.buffer.active;
      let content = '';
      
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString() + '\n';
        }
      }
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terminal-${session.name}-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Terminal content has been exported",
      });
    }
  };

  // Clear terminal
  const clearTerminal = () => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      session.terminal.clear();
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <TooltipProvider>
      <div className={`flex flex-col h-full bg-background ${className || ''}`}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Terminal</span>
            
            {/* Session Tabs */}
            <Tabs value={activeSessionId} onValueChange={setActiveSessionId} className="ml-4">
              <TabsList className="h-7">
                {sessions.map(session => (
                  <TabsTrigger 
                    key={session.id} 
                    value={session.id}
                    className="text-xs px-2 py-1 h-6"
                  >
                    <span className="max-w-[100px] truncate">{session.name}</span>
                    {sessions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeSession(session.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </TabsTrigger>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => createSession()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TabsList>
            </Tabs>
          </div>

          {/* Terminal Actions */}
          <div className="flex items-center space-x-1">
            {/* Search */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSearchOpen(!searchOpen)}
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search in Terminal</TooltipContent>
            </Tooltip>

            {/* History */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setHistoryOpen(!historyOpen)}
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Command History</TooltipContent>
            </Tooltip>

            {/* Split View */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSplitView(!splitView)}
                >
                  <Split className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split Terminal</TooltipContent>
            </Tooltip>

            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Terminal Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Theme Selection */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="h-4 w-4 mr-2" />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.keys(terminalThemes).map(theme => (
                      <DropdownMenuItem
                        key={theme}
                        onClick={() => setSelectedTheme(theme as keyof typeof terminalThemes)}
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Font Size */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ZoomIn className="h-4 w-4 mr-2" />
                    Font Size
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setFontSize(Math.min(20, fontSize + 1))}>
                      <ZoomIn className="h-4 w-4 mr-2" />
                      Increase
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFontSize(Math.max(10, fontSize - 1))}>
                      <ZoomOut className="h-4 w-4 mr-2" />
                      Decrease
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFontSize(14)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={clearTerminal}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Terminal
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={exportTerminalContent}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Content
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Window Controls */}
            {onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onMinimize}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {onMaximize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onMaximize}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="px-3 py-2 border-b bg-muted/20">
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search in terminal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    searchInTerminals();
                  }
                }}
                className="h-8"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={searchInTerminals}
              >
                Search
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <ScrollArea className="h-24 mt-2">
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="px-2 py-1 text-xs hover:bg-muted rounded cursor-pointer"
                      onClick={() => goToSearchResult(result.sessionId, result.line)}
                    >
                      <span className="font-medium">
                        {sessions.find(s => s.id === result.sessionId)?.name}:
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {result.text}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Terminal Content */}
        <div className="flex-1 overflow-hidden" ref={containerRef}>
          {splitView ? (
            <div className="flex h-full">
              {sessions.slice(0, 2).map((session, index) => (
                <div
                  key={session.id}
                  className={`flex-1 ${index === 0 ? 'border-r' : ''}`}
                >
                  <div
                    id={`terminal-${session.id}`}
                    className="h-full w-full"
                    style={{ display: 'block' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                id={`terminal-${session.id}`}
                className="h-full w-full"
                style={{ display: activeSessionId === session.id ? 'block' : 'none' }}
              />
            ))
          )}
        </div>

        {/* Command History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Command History</DialogTitle>
              <DialogDescription>
                Recent commands from {activeSession?.name}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96">
              <div className="space-y-1 p-2">
                {activeSession?.history.map((command, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 rounded hover:bg-muted cursor-pointer font-mono text-sm"
                    onClick={() => {
                      if (activeSession.websocket?.readyState === WebSocket.OPEN) {
                        activeSession.websocket.send(command);
                        setHistoryOpen(false);
                      }
                    }}
                  >
                    {command}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}