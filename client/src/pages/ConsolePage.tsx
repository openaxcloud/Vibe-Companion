import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Terminal,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Settings,
  Search,
  History,
  Download,
  Copy,
  Trash2,
  Play,
  Square,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Palette,
  Command,
  Clock,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TerminalSession {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  createdAt: Date;
}

interface CommandHistoryItem {
  command: string;
  timestamp: Date;
  exitCode?: number;
}

interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: string;
}

const QUICK_COMMANDS = [
  { name: 'List files', command: 'ls -la', category: 'Files' },
  { name: 'Show current directory', command: 'pwd', category: 'Navigation' },
  { name: 'Check disk usage', command: 'df -h', category: 'System' },
  { name: 'Show memory usage', command: 'free -m', category: 'System' },
  { name: 'List processes', command: 'ps aux', category: 'Processes' },
  { name: 'Show network info', command: 'ifconfig', category: 'Network' },
  { name: 'Git status', command: 'git status', category: 'Git' },
  { name: 'Git log', command: 'git log --oneline -10', category: 'Git' },
  { name: 'NPM install', command: 'npm install', category: 'Node.js' },
  { name: 'NPM run dev', command: 'npm run dev', category: 'Node.js' },
  { name: 'Python version', command: 'python --version', category: 'Python' },
  { name: 'Pip list', command: 'pip list', category: 'Python' },
];

const TERMINAL_THEMES = {
  dark: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    black: '#414868',
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
    brightWhite: '#c0caf5',
  },
  light: {
    background: '#f5f5f5',
    foreground: '#2e3440',
    cursor: '#3b4252',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#5e81ac',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#5e81ac',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
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
    brightWhite: '#f9f8f5',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
};

export default function ConsolePage() {
  const { toast } = useToast();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: 'main', name: 'Main Terminal', status: 'connected', createdAt: new Date() },
  ]);
  const [activeSession, setActiveSession] = useState('main');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof TERMINAL_THEMES>('dark');
  const [showHistory, setShowHistory] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState('terminal');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Monaco, Consolas, "Courier New", monospace',
      fontSize,
      theme: TERMINAL_THEMES[selectedTheme],
      scrollback: 10000,
      allowTransparency: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    const webLinks = new WebLinksAddon();
    term.loadAddon(webLinks);

    term.open(terminalRef.current);
    fit.fit();

    term.writeln('\x1b[1;32mE-Code Console v2.0\x1b[0m');
    term.writeln('\x1b[90mType "help" for available commands\x1b[0m');
    term.writeln('');
    term.write('\x1b[1;34m$\x1b[0m ');

    setTerminal(term);
    setFitAddon(fit);

    const handleResize = () => {
      if (fit) {
        try {
          fit.fit();
        } catch (e) {
          console.error('Failed to fit terminal:', e);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (terminal) {
      terminal.options.fontSize = fontSize;
      if (fitAddon) fitAddon.fit();
    }
  }, [fontSize, terminal, fitAddon]);

  useEffect(() => {
    if (terminal) {
      terminal.options.theme = TERMINAL_THEMES[selectedTheme];
    }
  }, [selectedTheme, terminal]);

  const createNewSession = () => {
    const id = `session-${Date.now()}`;
    const newSession: TerminalSession = {
      id,
      name: `Terminal ${sessions.length + 1}`,
      status: 'connected',
      createdAt: new Date(),
    };
    setSessions([...sessions, newSession]);
    setActiveSession(id);
    toast({
      title: 'New Terminal Created',
      description: `Terminal session "${newSession.name}" is ready`,
    });
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      toast({
        title: 'Cannot Close',
        description: 'At least one terminal session must remain open',
        variant: 'destructive',
      });
      return;
    }
    setSessions(sessions.filter((s) => s.id !== sessionId));
    if (activeSession === sessionId) {
      setActiveSession(sessions.find((s) => s.id !== sessionId)?.id || 'main');
    }
  };

  const executeQuickCommand = (command: string) => {
    if (terminal) {
      terminal.writeln(command);
      terminal.write('\x1b[1;34m$\x1b[0m ');
      setCommandHistory([
        { command, timestamp: new Date(), exitCode: 0 },
        ...commandHistory,
      ]);
    }
    setShowQuickCommands(false);
  };

  const clearTerminal = () => {
    if (terminal) {
      terminal.clear();
      terminal.write('\x1b[1;34m$\x1b[0m ');
    }
  };

  const exportLogs = () => {
    const content = logs
      .map((log) => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Logs Exported',
      description: 'Log file downloaded successfully',
    });
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredQuickCommands = QUICK_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedCommands = filteredQuickCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, typeof QUICK_COMMANDS>);

  return (
    <PageShell fullHeight>
      <PageHeader
        title="Console"
        description="Full-featured terminal console with multi-tab support, command history, and log viewer."
        icon={Terminal}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuickCommands(true)}
              data-testid="button-quick-commands"
            >
              <Command className="h-4 w-4 mr-2" />
              Quick Commands
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              data-testid="button-history"
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-terminal-settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Terminal Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="h-4 w-4 mr-2" />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.keys(TERMINAL_THEMES).map((theme) => (
                      <DropdownMenuItem
                        key={theme}
                        onClick={() => setSelectedTheme(theme as keyof typeof TERMINAL_THEMES)}
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                        {selectedTheme === theme && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
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
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset (14px)
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearTerminal}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Terminal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        }
      />

      <div className={`grid gap-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'grid-cols-1 lg:grid-cols-4'}`}>
        {!isFullscreen && (
          <div className="lg:col-span-1 space-y-4">
            <Card data-testid="card-system-metrics">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  System Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-4 w-4" />
                      CPU Usage
                    </span>
                    <span className="font-medium">23%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '23%' }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MemoryStick className="h-4 w-4" />
                      Memory
                    </span>
                    <span className="font-medium">1.2 / 4 GB</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <HardDrive className="h-4 w-4" />
                      Storage
                    </span>
                    <span className="font-medium">8.5 / 20 GB</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '42.5%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Wifi className="h-4 w-4" />
                    Network
                  </span>
                  <Badge variant="secondary" className="text-[11px]">Connected</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-recent-commands">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Commands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {commandHistory.slice(0, 10).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => executeQuickCommand(item.command)}
                        data-testid={`recent-command-${index}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <code className="text-[11px] truncate">{item.command}</code>
                        </div>
                        <Badge
                          variant={item.exitCode === 0 ? 'secondary' : 'destructive'}
                          className="text-[10px] shrink-0"
                        >
                          {item.exitCode === 0 ? 'OK' : 'ERR'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <div className={isFullscreen ? 'h-full' : 'lg:col-span-3'}>
          <Card className="h-full flex flex-col" data-testid="card-terminal">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      activeSession === session.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                    onClick={() => setActiveSession(session.id)}
                    data-testid={`session-tab-${session.id}`}
                  >
                    <Terminal className="h-3 w-3" />
                    <span className="text-[11px] font-medium">{session.name}</span>
                    {session.status === 'connected' && (
                      <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                    )}
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeSession(session.id);
                        }}
                        className="hover:bg-muted rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={createNewSession}
                  data-testid="button-new-session"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearTerminal}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (terminal) {
                      const buffer = terminal.buffer.active;
                      let content = '';
                      for (let i = 0; i < buffer.length; i++) {
                        const line = buffer.getLine(i);
                        if (line) content += line.translateToString() + '\n';
                      }
                      navigator.clipboard.writeText(content);
                      toast({ title: 'Copied', description: 'Terminal content copied to clipboard' });
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div
              ref={terminalRef}
              className="flex-1 p-2"
              style={{ minHeight: isFullscreen ? 'calc(100vh - 200px)' : '500px' }}
              data-testid="terminal-container"
            />
          </Card>
        </div>
      </div>

      {!isFullscreen && (
        <Card data-testid="card-logs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Application Logs
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {logs.length} entries
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportLogs}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                    data-testid={`log-entry-${log.id}`}
                  >
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium">{log.source}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={showQuickCommands} onOpenChange={setShowQuickCommands}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-quick-commands">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Command className="h-5 w-5" />
              Quick Commands
            </DialogTitle>
            <DialogDescription>
              Select a command to execute in the terminal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-commands"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {Object.entries(groupedCommands).map(([category, commands]) => (
                  <div key={category}>
                    <h4 className="text-[11px] font-semibold text-muted-foreground mb-2">{category}</h4>
                    <div className="space-y-1">
                      {commands.map((cmd) => (
                        <div
                          key={cmd.command}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => executeQuickCommand(cmd.command)}
                          data-testid={`quick-command-${cmd.name.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <div>
                            <p className="text-[13px] font-medium">{cmd.name}</p>
                            <code className="text-[11px] text-muted-foreground">{cmd.command}</code>
                          </div>
                          <Play className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-history">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Command History
            </DialogTitle>
            <DialogDescription>
              View and rerun previous commands
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {commandHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => {
                    executeQuickCommand(item.command);
                    setShowHistory(false);
                  }}
                  data-testid={`history-item-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-[13px] block truncate">{item.command}</code>
                    <span className="text-[11px] text-muted-foreground">
                      {item.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <Badge
                    variant={item.exitCode === 0 ? 'secondary' : 'destructive'}
                    className="ml-2"
                  >
                    Exit: {item.exitCode}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
