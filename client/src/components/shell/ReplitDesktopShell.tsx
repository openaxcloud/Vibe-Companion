import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Terminal as TerminalIcon, 
  Plus, 
  X, 
  Maximize2, 
  Minimize2,
  Copy,
  Trash2,
  Settings,
  Search,
  Download,
  ChevronUp,
  Sparkles,
  Square,
  Loader2,
  FolderOpen,
  Package,
  Code,
  HelpCircle,
  Command
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

const ANSI_STRIP_REGEX = new RegExp(String.raw`\u001b\[[0-9;]*m`, "g");

interface ShellTab {
  id: string;
  name: string;
  cwd: string;
  output: string[];
  ws: WebSocket | null;
  isConnected: boolean;
}

interface ReplitDesktopShellProps {
  projectId: number;
  isFullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

export function ReplitDesktopShell({ 
  projectId, 
  isFullscreen = false,
  onFullscreenChange 
}: ReplitDesktopShellProps) {
  const { toast } = useToast();
  
  const [tabs, setTabs] = useState<ShellTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [fontSize, setFontSize] = useState(14);
  const [isFindMode, setIsFindMode] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [currentCommand, setCurrentCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const createWebSocket = useCallback((sessionId: string, userId: number = 1): WebSocket => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/shell?sessionId=${sessionId}&userId=${userId}`;
    return new WebSocket(wsUrl);
  }, []);

  const createNewTab = useCallback(() => {
    const sessionId = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newTab: ShellTab = {
      id: sessionId,
      name: `Shell ${tabs.length + 1}`,
      cwd: '~',
      output: [],
      ws: null,
      isConnected: false
    };

    const socket = createWebSocket(sessionId);
    
    socket.onopen = () => {
      setTabs(prev => prev.map(tab => 
        tab.id === sessionId ? { ...tab, isConnected: true, output: [...tab.output, '\x1b[32m● Connected to E-Code Shell\x1b[0m\r\n'] } : tab
      ));
    };
    
    socket.onmessage = (event) => {
      setTabs(prev => prev.map(tab => 
        tab.id === sessionId ? { ...tab, output: [...tab.output, event.data] } : tab
      ));
    };
    
    socket.onclose = () => {
      setTabs(prev => prev.map(tab => 
        tab.id === sessionId ? { ...tab, isConnected: false, output: [...tab.output, '\r\n\x1b[31m● Disconnected\x1b[0m\r\n'] } : tab
      ));
    };
    
    socket.onerror = () => {
      setTabs(prev => prev.map(tab => 
        tab.id === sessionId ? { ...tab, isConnected: false } : tab
      ));
    };

    newTab.ws = socket;
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(sessionId);
    
    return newTab;
  }, [tabs.length, createWebSocket]);

  useEffect(() => {
    if (tabs.length === 0) {
      createNewTab();
    }
  }, [tabs.length, createNewTab]);

  useEffect(() => {
    return () => {
      tabs.forEach(tab => {
        tab.ws?.close();
      });
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current && activeTab) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeTab?.output]);

  const sendCommand = useCallback((command: string) => {
    if (!activeTab?.ws || activeTab.ws.readyState !== WebSocket.OPEN) {
      toast({
        title: 'Not connected',
        description: 'Reconnecting to shell...',
        variant: 'destructive'
      });
      return;
    }
    
    activeTab.ws.send(command + '\r');
    setCurrentCommand('');
    setIsExecuting(true);
    setTimeout(() => setIsExecuting(false), 500);
  }, [activeTab, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentCommand.trim()) {
      sendCommand(currentCommand);
    }
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    tab?.ws?.close();
    
    if (tabs.length <= 1) return;
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const clearTerminal = () => {
    if (!activeTab) return;
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, output: [] } : tab
    ));
  };

  const copyTerminalContent = () => {
    if (!activeTab) return;
    const content = activeTab.output.join('').replace(ANSI_STRIP_REGEX, '');
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied to clipboard' });
  };

  const downloadLog = () => {
    if (!activeTab) return;
    const content = activeTab.output.join('').replace(ANSI_STRIP_REGEX, '');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shell-${activeTab.name}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFindChange = (query: string) => {
    setFindQuery(query);
    if (!query || !activeTab) {
      setFindMatches([]);
      return;
    }
    
    const output = activeTab.output.join('').replace(ANSI_STRIP_REGEX, '');
    const matches: number[] = [];
    let index = 0;
    while ((index = output.toLowerCase().indexOf(query.toLowerCase(), index)) !== -1) {
      matches.push(index);
      index += query.length;
    }
    setFindMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  };

  const findNext = () => {
    if (findMatches.length === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % findMatches.length);
  };

  const findPrevious = () => {
    if (findMatches.length === 0) return;
    setCurrentMatchIndex(prev => prev === 0 ? findMatches.length - 1 : prev - 1);
  };

  const generateCommandMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return await apiRequest('POST', '/api/shell/generate-command', { prompt, projectId });
    },
    onSuccess: (data: any) => {
      if (data.command) {
        setCurrentCommand(data.command);
        setIsGenerateMode(false);
        setGeneratePrompt('');
        inputRef.current?.focus();
        toast({ title: 'Command generated', description: data.command });
      }
    },
    onError: () => {
      toast({ title: 'Generation failed', variant: 'destructive' });
    }
  });

  const stopExecution = () => {
    if (activeTab?.ws && activeTab.ws.readyState === WebSocket.OPEN) {
      activeTab.ws.send('\x03');
      setIsExecuting(false);
    }
  };

  const parseAnsiToHtml = (text: string, highlightQuery?: string): string => {
    let parsed = text
      .replaceAll(`\u001b[32m`, '<span class="text-green-500">')
      .replaceAll(`\u001b[31m`, '<span class="text-red-500">')
      .replaceAll(`\u001b[33m`, '<span class="text-yellow-500">')
      .replaceAll(`\u001b[34m`, '<span class="text-blue-500">')
      .replaceAll(`\u001b[35m`, '<span class="text-purple-500">')
      .replaceAll(`\u001b[36m`, '<span class="text-cyan-500">')
      .replaceAll(`\u001b[90m`, '<span class="text-muted-foreground">')
      .replaceAll(`\u001b[0m`, '</span>')
      .replace(ANSI_STRIP_REGEX, '')
      .replace(/\r\n/g, '<br/>')
      .replace(/\n/g, '<br/>');
    
    if (highlightQuery) {
      const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      parsed = parsed.replace(regex, '<mark class="bg-yellow-400 text-black px-0.5 rounded">$1</mark>');
    }
    
    return parsed;
  };

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background", isFullscreen ? 'fixed inset-0 z-50' : 'h-full')}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-5 w-5 text-primary" />
            <h1 className="text-[15px] font-semibold">Shell</h1>
          </div>

          <Tabs value={activeTabId} onValueChange={setActiveTabId}>
            <TabsList className="h-8 bg-muted">
              {tabs.map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="text-[11px] px-3 py-1 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  data-testid={`desktop-shell-tab-${tab.id}`}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", tab.isConnected ? 'bg-green-500' : 'bg-red-500')} />
                  <span className="max-w-[100px] truncate">{tab.name}</span>
                  {tabs.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      data-testid={`desktop-shell-close-tab-${tab.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </TabsTrigger>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1"
                onClick={createNewTab}
                data-testid="desktop-shell-new-tab"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFindMode(!isFindMode)}
            className="h-8 w-8"
            data-testid="desktop-shell-search"
          >
            <Search className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={copyTerminalContent}
            className="h-8 w-8"
            data-testid="desktop-shell-copy"
          >
            <Copy className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={clearTerminal}
            className="h-8 w-8"
            data-testid="desktop-shell-clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="desktop-shell-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={downloadLog} data-testid="desktop-shell-download">
                <Download className="h-4 w-4 mr-2" />
                Download Log
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <div className="px-2 py-1.5">
                <label className="text-[13px] font-medium">Font Size</label>
                <Select value={fontSize.toString()} onValueChange={(v) => setFontSize(parseInt(v))}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12px</SelectItem>
                    <SelectItem value="14">14px</SelectItem>
                    <SelectItem value="16">16px</SelectItem>
                    <SelectItem value="18">18px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onFullscreenChange?.(!isFullscreen)}
            className="h-8 w-8"
            data-testid="desktop-shell-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/30 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-3 w-3" />
            <span>{activeTab.cwd}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-3 w-3" />
            <span>Node.js 20</span>
          </div>
          <div className="flex items-center gap-2">
            <Code className="h-3 w-3" />
            <span>Bash</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", activeTab.isConnected ? 'bg-green-500' : 'bg-red-500')} />
            <span>{activeTab.isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[11px] gap-1"
            onClick={() => setIsGenerateMode(!isGenerateMode)}
            data-testid="desktop-shell-generate"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" data-testid="desktop-shell-help">
            <HelpCircle className="h-3 w-3" />
            Help
          </Button>
        </div>
      </div>

      {isFindMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
          <Input
            value={findQuery}
            onChange={(e) => handleFindChange(e.target.value)}
            placeholder="Find in shell..."
            className="h-8 text-[13px] flex-1 max-w-xs"
            autoFocus
            data-testid="desktop-shell-find-input"
          />
          {findMatches.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {currentMatchIndex + 1}/{findMatches.length}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8"
            onClick={findNext}
            disabled={findMatches.length === 0}
            data-testid="desktop-shell-find-next"
          >
            Next
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8"
            onClick={findPrevious}
            disabled={findMatches.length === 0}
            data-testid="desktop-shell-find-prev"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8"
            onClick={() => {
              setIsFindMode(false);
              setFindQuery('');
              setFindMatches([]);
            }}
            data-testid="desktop-shell-find-close"
          >
            Close
          </Button>
        </div>
      )}

      {isGenerateMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <Input
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="Describe the command you want..."
            className="h-8 text-[13px] flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && generatePrompt.trim()) {
                generateCommandMutation.mutate(generatePrompt);
              } else if (e.key === 'Escape') {
                setIsGenerateMode(false);
                setGeneratePrompt('');
              }
            }}
            autoFocus
            data-testid="desktop-shell-generate-input"
          />
          <Button 
            size="sm" 
            className="h-8 gap-1"
            onClick={() => generateCommandMutation.mutate(generatePrompt)}
            disabled={!generatePrompt.trim() || generateCommandMutation.isPending}
            data-testid="desktop-shell-generate-submit"
          >
            {generateCommandMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Generate
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8"
            onClick={() => {
              setIsGenerateMode(false);
              setGeneratePrompt('');
            }}
            data-testid="desktop-shell-generate-cancel"
          >
            Cancel
          </Button>
        </div>
      )}

      <div 
        ref={terminalRef}
        className="flex-1 overflow-auto p-4 font-mono bg-gray-900 dark:bg-[#1e1e1e]"
        style={{ fontSize: `${fontSize}px`, minHeight: '300px' }}
        onClick={() => inputRef.current?.focus()}
        data-testid="desktop-shell-output"
      >
        <div 
          className="text-gray-200 dark:text-[#d4d4d4]"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(parseAnsiToHtml(activeTab.output.join(''), isFindMode ? findQuery : undefined))
          }} 
        />
        
        <div className="flex items-start gap-1 mt-1 text-gray-200 dark:text-[#d4d4d4]">
          <span className="text-green-400">{activeTab.cwd}$</span>
          <span>{currentCommand}</span>
          <span className="animate-pulse">▊</span>
        </div>
      </div>

      <div className="border-t bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant={isExecuting ? "destructive" : "secondary"}
            size="icon"
            className="h-8 w-8"
            onClick={stopExecution}
            disabled={!isExecuting}
            data-testid="desktop-shell-stop"
          >
            <Square className="h-3 w-3" />
          </Button>
          
          <span className="text-primary text-[13px] font-mono">{activeTab.cwd}$</span>
          <Input
            ref={inputRef}
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            className="h-8 text-[13px] font-mono flex-1 bg-transparent border-none focus-visible:ring-0"
            data-testid="desktop-shell-input"
          />
        </div>
      </div>

      <div className="border-t bg-muted/30 px-4 py-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{activeTab.isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>•</span>
            <span>UTF-8</span>
            <span>•</span>
            <span>LF</span>
          </div>
          <div className="flex items-center gap-2">
            <Command className="h-3 w-3" />
            <span>Ctrl+C to interrupt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReplitDesktopShell;
