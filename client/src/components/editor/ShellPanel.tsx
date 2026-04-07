import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Terminal,
  X,
  RotateCcw,
  Copy,
  Trash2,
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  Settings,
  FolderOpen,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { io, Socket } from 'socket.io-client';

interface ShellPanelProps {
  projectId: string | number;
  className?: string;
}

interface ShellTab {
  id: string;
  sessionId: string;
  name: string;
  cwd: string;
  isConnected: boolean;
  isConnecting: boolean;
}

interface TerminalInstance {
  term: XTerm;
  fitAddon: FitAddon;
  socket: Socket | null;
  commandHistory: string[];
  historyIndex: number;
  currentInput: string;
}

function getTerminalTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();
  return {
    background:         get('--ecode-terminal-bg')            || '#0e1525',
    foreground:         get('--ecode-terminal-text')           || '#d4d8dd',
    cursor:             get('--ecode-terminal-cursor')         || '#F26207',
    cursorAccent:       get('--ecode-terminal-bg')             || '#0e1525',
    selectionBackground:get('--ecode-terminal-selection')      || 'rgba(0,121,242,0.3)',
    black:              get('--ecode-terminal-black')          || '#0e1525',
    red:                get('--ecode-terminal-red')            || '#ff6b6b',
    green:              get('--ecode-terminal-green')          || '#4ecdc4',
    yellow:             get('--ecode-terminal-yellow')         || '#ffe66d',
    blue:               get('--ecode-terminal-blue')           || '#0079f2',
    magenta:            get('--ecode-terminal-magenta')        || '#c792ea',
    cyan:               get('--ecode-terminal-cyan')           || '#89ddff',
    white:              get('--ecode-terminal-white')          || '#d4d8dd',
    brightBlack:        get('--ecode-terminal-bright-black')   || '#3d4452',
    brightRed:          get('--ecode-terminal-bright-red')     || '#ff8a80',
    brightGreen:        get('--ecode-terminal-bright-green')   || '#69f0ae',
    brightYellow:       get('--ecode-terminal-bright-yellow')  || '#ffff8d',
    brightBlue:         get('--ecode-terminal-bright-blue')    || '#40c4ff',
    brightMagenta:      get('--ecode-terminal-bright-magenta') || '#ff80ab',
    brightCyan:         get('--ecode-terminal-bright-cyan')    || '#a7fdeb',
    brightWhite:        get('--ecode-terminal-bright-white')   || '#ffffff',
  };
}

export function ShellPanel({ projectId, className }: ShellPanelProps) {
  const [tabs, setTabs] = useState<ShellTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const wsInitiatedRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    const newTheme = getTerminalTheme();
    for (const instance of terminalsRef.current.values()) {
      instance.term.options.theme = newTheme;
    }
  }, [theme]);

  const createSession = useCallback(async (): Promise<string | null> => {
    // For now, use local session IDs - they work with the terminal WebSocket directly
    // The API endpoint is optional and may fail if user doesn't own the project
    const sessionId = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return sessionId;
  }, [projectId]);

  const connectSocket = useCallback((tabId: string, sessionId: string) => {
    const instance = terminalsRef.current.get(tabId);
    if (!instance) {
      return;
    }

    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, isConnecting: true, isConnected: false } : tab
    ));

    const projectParam = projectId && projectId !== 'undefined' ? projectId : 'default';

    try {
      // Use polling first for better proxy compatibility (Replit, etc.)
      const socket = io({
        path: '/socket.io/terminal',
        query: { projectId: projectParam, sessionId },
        transports: ['polling', 'websocket'], // Polling first for proxy compatibility
        timeout: 30000, // Increased timeout for slower connections
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        withCredentials: true, // Send session cookies for authentication
        forceNew: true, // Force new connection to avoid stale sockets
      });
      
      instance.socket = socket;

      socket.on('connect', () => {
        setTabs(prev => prev.map(tab => 
          tab.id === tabId ? { ...tab, isConnected: true, isConnecting: false } : tab
        ));

        instance.term.writeln('\x1b[1;32m✓ Connected to shell\x1b[0m');

        const existingTimeout = reconnectTimeoutsRef.current.get(tabId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          reconnectTimeoutsRef.current.delete(tabId);
        }
      });

      socket.on('connected', (data: { message: string }) => {
      });

      socket.on('ready', (data: { message: string }) => {
        instance.term.writeln(`\x1b[1;32m✓ ${data.message}\x1b[0m`);
      });

      socket.on('history', (data: { data: string }) => {
        if (data?.data) {
          instance.term.write(data.data);
        }
      });

      socket.on('output', (data: { data: string }) => {
        if (data?.data) {
          instance.term.write(data.data);
        }
      });

      socket.on('error', (data: { message: string }) => {
        instance.term.writeln(`\r\n\x1b[1;31m✗ ${data.message}\x1b[0m`);
      });

      socket.on('exit', (data: { code: number; signal: number }) => {
        instance.term.writeln(`\r\n\x1b[90mProcess exited with code ${data.code}\x1b[0m`);
      });

      socket.on('disconnect', (reason) => {
        setTabs(prev => prev.map(tab => 
          tab.id === tabId ? { ...tab, isConnected: false, isConnecting: false } : tab
        ));

        instance.term.writeln('\r\n\x1b[1;33m⚠ Connection closed\x1b[0m');

        if (reason === 'io server disconnect') {
          const timeout = setTimeout(() => {
            instance.term.writeln('\x1b[90mReconnecting...\x1b[0m');
            socket.connect();
          }, 3000);
          reconnectTimeoutsRef.current.set(tabId, timeout);
        }
      });

      socket.on('connect_error', (error) => {
        setTabs(prev => prev.map(tab => 
          tab.id === tabId ? { ...tab, isConnecting: false } : tab
        ));
        instance.term.writeln(`\r\n\x1b[1;31m✗ Connection error: ${error.message}\x1b[0m`);
      });

    } catch (error) {
      setTabs(prev => prev.map(tab => 
        tab.id === tabId ? { ...tab, isConnecting: false } : tab
      ));
    }
  }, [projectId]);

  const initializeTerminal = useCallback((tabId: string, container: HTMLDivElement) => {
    if (terminalsRef.current.has(tabId)) return;

    const term = new XTerm({
      theme: getTerminalTheme(),
      fontSize: 13,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      convertEol: true,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    
    setTimeout(() => fitAddon.fit(), 0);

    const instance: TerminalInstance = {
      term,
      fitAddon,
      socket: null,
      commandHistory: [],
      historyIndex: -1,
      currentInput: '',
    };

    term.writeln('\x1b[1;32m╭─────────────────────────────────────────╮\x1b[0m');
    term.writeln('\x1b[1;32m│\x1b[0m \x1b[1;36mShell\x1b[0m                                   \x1b[1;32m│\x1b[0m');
    term.writeln('\x1b[1;32m│\x1b[0m \x1b[90mConnecting to workspace...\x1b[0m            \x1b[1;32m│\x1b[0m');
    term.writeln('\x1b[1;32m╰─────────────────────────────────────────╯\x1b[0m');
    term.writeln('');

    term.onData((data) => {
      if (!instance.socket || !instance.socket.connected) {
        return;
      }

      instance.socket.emit('input', { data });
    });

    terminalsRef.current.set(tabId, instance);
  }, []);

  const addNewTab = useCallback(async () => {
    const sessionId = await createSession();
    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'Failed to create shell session',
        variant: 'destructive',
      });
      return;
    }

    const tabId = `tab-${Date.now()}`;
    const newTab: ShellTab = {
      id: tabId,
      sessionId,
      name: `Shell ${tabs.length + 1}`,
      cwd: '~',
      isConnected: false,
      isConnecting: false,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
  }, [createSession, tabs.length, toast]);

  const closeTab = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      await apiRequest('DELETE', `/api/projects/${projectId}/shell/${tab.sessionId}`);
    } catch (error) {
    }

    const instance = terminalsRef.current.get(tabId);
    if (instance) {
      instance.socket?.disconnect();
      instance.term.dispose();
      terminalsRef.current.delete(tabId);
    }

    const timeout = reconnectTimeoutsRef.current.get(tabId);
    if (timeout) {
      clearTimeout(timeout);
      reconnectTimeoutsRef.current.delete(tabId);
    }

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  }, [activeTabId, projectId, tabs]);

  const handleClear = useCallback(() => {
    const instance = terminalsRef.current.get(activeTabId);
    if (instance) {
      instance.term.clear();
    }
  }, [activeTabId]);

  const handleCopy = useCallback(() => {
    const instance = terminalsRef.current.get(activeTabId);
    if (instance) {
      const selection = instance.term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        toast({
          title: 'Copied',
          description: 'Selection copied to clipboard',
        });
      }
    }
  }, [activeTabId, toast]);

  const handleReset = useCallback(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    const instance = terminalsRef.current.get(activeTabId);
    
    if (!tab || !instance) return;

    instance.socket?.disconnect();
    instance.term.reset();
    instance.term.writeln('\x1b[1;32m╭─────────────────────────────────────────╮\x1b[0m');
    instance.term.writeln('\x1b[1;32m│\x1b[0m \x1b[1;36mShell\x1b[0m                                   \x1b[1;32m│\x1b[0m');
    instance.term.writeln('\x1b[1;32m│\x1b[0m \x1b[90mReconnecting...\x1b[0m                       \x1b[1;32m│\x1b[0m');
    instance.term.writeln('\x1b[1;32m╰─────────────────────────────────────────╯\x1b[0m');
    instance.term.writeln('');

    setTimeout(() => connectSocket(activeTabId, tab.sessionId), 500);
  }, [activeTabId, connectSocket, tabs]);

  useEffect(() => {
    if (tabs.length === 0) {
      addNewTab();
    }
  }, []);

  useEffect(() => {
    if (!activeTabId || !terminalContainerRef.current) return;

    const container = terminalContainerRef.current;
    const existingInstance = terminalsRef.current.get(activeTabId);
    
    if (!existingInstance) {
      container.innerHTML = '';
      initializeTerminal(activeTabId, container);
    } else {
      // Re-attach existing terminal to container
      container.innerHTML = '';
      existingInstance.term.open(container);
      setTimeout(() => existingInstance.fitAddon.fit(), 0);
    }
  }, [activeTabId, initializeTerminal]);
  
  // Separate effect for WebSocket connection - only runs once per tab
  useEffect(() => {
    if (!activeTabId) return;
    
    // Only initiate WebSocket connection once per tab
    if (wsInitiatedRef.current.has(activeTabId)) {
      return;
    }
    
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.sessionId) {
      return;
    }
    
    // Small delay to ensure terminal is fully initialized
    const timer = setTimeout(() => {
      const instance = terminalsRef.current.get(activeTabId);
      if (instance && !instance.socket) {
        wsInitiatedRef.current.add(activeTabId);
        connectSocket(activeTabId, tab.sessionId);
      } else {
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [activeTabId, tabs, connectSocket]);

  useEffect(() => {
    const handleResize = () => {
      const instance = terminalsRef.current.get(activeTabId);
      if (instance) {
        instance.fitAddon.fit();
        
        if (instance.socket?.connected) {
          instance.socket.emit('resize', {
            cols: instance.term.cols,
            rows: instance.term.rows,
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    const container = terminalContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    
    if (container) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [activeTabId]);

  useEffect(() => {
    return () => {
      terminalsRef.current.forEach((instance) => {
        instance.socket?.disconnect();
        instance.term.dispose();
      });
      terminalsRef.current.clear();
      
      reconnectTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      reconnectTimeoutsRef.current.clear();
    };
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div 
      className={cn(
        "h-full flex flex-col bg-[var(--ecode-surface)]",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
      data-testid="shell-panel"
    >
      <div className="h-9 flex items-center justify-between px-2.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <div className="flex items-center gap-1 shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            <span className="text-xs font-medium text-[var(--ecode-text)] hidden sm:inline">Shell</span>
          </div>

          {activeTab && (
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {activeTab.isConnecting ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground hidden md:inline">Connecting</span>
                </div>
              ) : activeTab.isConnected ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10">
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-[11px] text-green-500 hidden md:inline">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground hidden md:inline">Disconnected</span>
                </div>
              )}
            </div>
          )}

          {tabs.length > 1 && (
            <ScrollArea className="flex-1 max-w-[200px] sm:max-w-[300px] lg:max-w-[400px]">
              <Tabs value={activeTabId} onValueChange={setActiveTabId} className="w-full">
                <TabsList className="h-7 bg-[var(--ecode-surface)] border border-[var(--ecode-border)] rounded p-0 gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="h-6 px-2 text-[10px] gap-1 whitespace-nowrap data-[state=active]:bg-[var(--ecode-sidebar-hover)] rounded"
                      data-testid={`tab-shell-${tab.id}`}
                    >
                      <span className="truncate max-w-[60px] sm:max-w-[80px]">{tab.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        data-testid={`button-close-tab-${tab.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </ScrollArea>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={addNewTab}
            title="New shell"
            data-testid="button-new-shell"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleCopy}
            title="Copy selection"
            data-testid="button-copy-output"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleClear}
            title="Clear terminal"
            data-testid="button-clear-terminal"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleReset}
            title="Reset terminal"
            data-testid="button-reset-terminal"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                data-testid="button-shell-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-testid="menu-shell-settings">
              <DropdownMenuItem onClick={addNewTab}>
                <Plus className="w-4 h-4 mr-2" />
                New Shell
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClear}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Output
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Shell
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeTab && (
        <div className="h-6 flex items-center px-3 border-b border-border bg-muted/30 text-[11px] text-muted-foreground gap-2">
          <FolderOpen className="w-3 h-3" />
          <span className="truncate" data-testid="text-working-directory">{activeTab.cwd}</span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={terminalContainerRef}
          className="absolute inset-0 p-2"
          style={{ backgroundColor: 'var(--ecode-terminal-bg)' }}
          data-testid="terminal-container"
        />
      </div>
    </div>
  );
}
