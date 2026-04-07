import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ChevronLeft, 
  MoreVertical, 
  Search, 
  Trash2, 
  X, 
  ChevronDown,
  Plus,
  Square,
  Sparkles,
  ChevronUp,
  Shell as ShellIcon,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const ANSI_STRIP_REGEX = new RegExp(String.raw`\u001b\[[0-9;]*m`, "g");

interface ShellTab {
  id: string;
  name: string;
  cwd: string;
  output: string[];
  ws: WebSocket | null;
  isConnected: boolean;
}

interface ReplitMobileShellProps {
  projectId: number;
  onClose?: () => void;
  onBack?: () => void;
}

export function ReplitMobileShell({ projectId, onClose, onBack }: ReplitMobileShellProps) {
  const { toast } = useToast();
  
  const [tabs, setTabs] = useState<ShellTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const findInputRef = useRef<HTMLInputElement>(null);
  const generateInputRef = useRef<HTMLInputElement>(null);

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
      name: 'bash',
      cwd: '~',
      output: [],
      ws: null,
      isConnected: false
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(sessionId);

    const connectWithRetry = (retries = 3) => {
      const socket = createWebSocket(sessionId);
      
      socket.onopen = () => {
        setTabs(prev => prev.map(tab => 
          tab.id === sessionId ? { ...tab, ws: socket, isConnected: true, output: [...tab.output, '\x1b[32m● Connected to E-Code Shell\x1b[0m\r\n'] } : tab
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
        if (retries > 0) {
          setTimeout(() => connectWithRetry(retries - 1), 1000);
        } else {
          setTabs(prev => prev.map(tab => 
            tab.id === sessionId ? { ...tab, isConnected: false, output: [...tab.output, '\r\n\x1b[31m● Connection failed\x1b[0m\r\n'] } : tab
          ));
        }
      };
    };

    setTimeout(() => connectWithRetry(), 100);
    
    return newTab;
  }, [createWebSocket]);

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
        description: 'Shell is not connected',
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

  const clearShell = () => {
    if (!activeTab) return;
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, output: [] } : tab
    ));
    setIsMenuOpen(false);
    toast({ title: 'Shell cleared' });
  };

  const openFindInShell = () => {
    setIsFindMode(true);
    setIsMenuOpen(false);
    setTimeout(() => findInputRef.current?.focus(), 100);
  };

  const closeFindMode = () => {
    setIsFindMode(false);
    setFindQuery('');
    setFindMatches([]);
    setCurrentMatchIndex(0);
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
    toast({ title: `Match ${currentMatchIndex + 2} of ${findMatches.length}` });
  };

  const findPrevious = () => {
    if (findMatches.length === 0) return;
    setCurrentMatchIndex(prev => prev === 0 ? findMatches.length - 1 : prev - 1);
    toast({ title: `Match ${currentMatchIndex} of ${findMatches.length}` });
  };

  const openGenerateMode = () => {
    setIsGenerateMode(true);
    setTimeout(() => generateInputRef.current?.focus(), 100);
  };

  const closeGenerateMode = () => {
    setIsGenerateMode(false);
    setGeneratePrompt('');
  };

  const generateCommandMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return await apiRequest('POST', '/api/shell/generate-command', { prompt, projectId });
    },
    onSuccess: (data: any) => {
      if (data.command) {
        setCurrentCommand(data.command);
        closeGenerateMode();
        inputRef.current?.focus();
        toast({ title: 'Command generated', description: data.command });
      }
    },
    onError: () => {
      toast({ title: 'Generation failed', variant: 'destructive' });
    }
  });

  const handleGenerateSubmit = () => {
    if (generatePrompt.trim()) {
      generateCommandMutation.mutate(generatePrompt);
    }
  };

  const handleGenerateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGenerateSubmit();
    } else if (e.key === 'Escape') {
      closeGenerateMode();
    }
  };

  const stopExecution = () => {
    if (activeTab?.ws && activeTab.ws.readyState === WebSocket.OPEN) {
      activeTab.ws.send('\x03');
      setIsExecuting(false);
    }
  };

  const closeTab = () => {
    if (!activeTab) return;
    activeTab.ws?.close();
    
    if (tabs.length <= 1) {
      onClose?.();
      return;
    }
    
    const remainingTabs = tabs.filter(t => t.id !== activeTabId);
    setTabs(remainingTabs);
    setActiveTabId(remainingTabs[0].id);
    setIsMenuOpen(false);
  };

  const parseAnsiToHtml = (text: string, highlightQuery?: string): string => {
    let parsed = text
      .replaceAll(`\u001b[32m`, '<span style="color: hsl(var(--chart-2))">')
      .replaceAll(`\u001b[31m`, '<span style="color: hsl(var(--destructive))">')
      .replaceAll(`\u001b[33m`, '<span style="color: hsl(var(--chart-4))">')
      .replaceAll(`\u001b[34m`, '<span style="color: hsl(var(--primary))">')
      .replaceAll(`\u001b[35m`, '<span style="color: hsl(var(--chart-5))">')
      .replaceAll(`\u001b[36m`, '<span style="color: hsl(var(--chart-3))">')
      .replaceAll(`\u001b[90m`, '<span style="color: hsl(var(--muted-foreground))">')
      .replaceAll(`\u001b[0m`, '</span>')
      .replace(ANSI_STRIP_REGEX, '')
      .replace(/\r\n/g, '<br/>')
      .replace(/\n/g, '<br/>');
    
    if (highlightQuery) {
      const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      parsed = parsed.replace(regex, '<mark style="background: hsl(var(--chart-4)); color: hsl(var(--background)); padding: 0 2px; border-radius: 2px;">$1</mark>');
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
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={onBack}
          data-testid="shell-back-button"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2">
          <ShellIcon className="h-4 w-4 text-primary" />
          <span className="font-medium text-[13px]">Shell</span>
          <span className={`h-2 w-2 rounded-full ${activeTab.isConnected ? 'bg-[hsl(var(--chart-2))]' : 'bg-destructive'}`} />
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => setIsMenuOpen(true)}
          data-testid="shell-menu-button"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-[11px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-[11px] font-normal gap-1"
              data-testid="shell-tab-dropdown"
            >
              <ChevronDown className="h-3 w-3" />
              <span className="text-primary">{activeTab.cwd}:</span>
              <span className="text-muted-foreground">{activeTab.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {tabs.map(tab => (
              <DropdownMenuItem 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className="text-[11px]"
                data-testid={`shell-tab-${tab.id}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full mr-2 ${tab.isConnected ? 'bg-[hsl(var(--chart-2))]' : 'bg-destructive'}`} />
                {tab.cwd}: {tab.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={createNewTab} className="text-[11px] gap-2" data-testid="shell-new-tab">
              <Plus className="h-3 w-3" />
              New Shell
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={openFindInShell}
            data-testid="shell-search-button"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={clearShell}
            data-testid="shell-clear-button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={closeTab}
            data-testid="shell-close-tab-button"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-[11px] text-muted-foreground"
            onClick={openGenerateMode}
            data-testid="shell-generate-button"
          >
            Generate
          </Button>
        </div>
      </div>

      {isFindMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
          <Input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => handleFindChange(e.target.value)}
            placeholder="Find"
            className="h-7 text-[11px] flex-1"
            data-testid="shell-find-input"
          />
          {findMatches.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {currentMatchIndex + 1}/{findMatches.length}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[11px]"
            onClick={findNext}
            disabled={findMatches.length === 0}
            data-testid="shell-find-next"
          >
            Next
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[11px]"
            onClick={findPrevious}
            disabled={findMatches.length === 0}
            data-testid="shell-find-prev"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[11px]"
            onClick={closeFindMode}
            data-testid="shell-find-close"
          >
            Exit
          </Button>
        </div>
      )}

      <div 
        ref={terminalRef}
        className="flex-1 overflow-auto p-3 font-mono text-[11px] bg-background"
        onClick={() => inputRef.current?.focus()}
        data-testid="shell-terminal-output"
      >
        <div 
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(parseAnsiToHtml(activeTab.output.join(''), isFindMode ? findQuery : undefined))
          }} 
        />
        
        <div className="flex items-start gap-1 mt-1">
          <span className="text-primary font-semibold">{activeTab.cwd}$</span>
          <span className="text-foreground">{currentCommand}</span>
          <span className="animate-pulse">▊</span>
        </div>
      </div>

      {isGenerateMode && (
        <div className="border-t bg-card p-3">
          <div className="relative">
            <Input
              ref={generateInputRef}
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              onKeyDown={handleGenerateKeyDown}
              placeholder="Enter a prompt to generate a shell command"
              className="h-9 text-[13px] pr-10"
              data-testid="shell-generate-input"
            />
            <Button
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={handleGenerateSubmit}
              disabled={generateCommandMutation.isPending}
              data-testid="shell-generate-submit"
            >
              {generateCommandMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Generate with Assistant</span>
            </div>
            <span>Esc to close, Enter to submit</span>
          </div>
        </div>
      )}

      {!isGenerateMode && (
        <div className="border-t bg-card p-2">
          <div className="flex items-center gap-2">
            <span className="text-primary text-[11px] font-mono">{activeTab.cwd}$</span>
            <Input
              ref={inputRef}
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              className="h-8 text-[11px] font-mono flex-1 bg-transparent border-none focus-visible:ring-0"
              data-testid="shell-command-input"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 py-3 border-t bg-card safe-area-bottom">
        <Button
          variant={isExecuting ? "destructive" : "secondary"}
          size="icon"
          className="h-11 w-11 rounded-lg"
          onClick={stopExecution}
          disabled={!isExecuting}
          data-testid="shell-stop-button"
        >
          <Square className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center bg-muted rounded-full px-1 py-1 gap-1">
          <Button 
            variant="default" 
            size="icon" 
            className="h-9 w-9 rounded-full bg-primary"
            data-testid="shell-nav-active"
          >
            <ShellIcon className="h-4 w-4" />
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-lg"
          onClick={createNewTab}
          data-testid="shell-split-button"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-2">
              <ShellIcon className="h-4 w-4" />
              <SheetTitle className="text-base">Shell</SheetTitle>
            </div>
            <SheetDescription>
              Directly access your App through a command line interface (CLI).
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4 space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-between h-12"
              onClick={clearShell}
              data-testid="menu-clear-shell"
            >
              <span>Clear Shell</span>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-between h-12"
              onClick={openFindInShell}
              data-testid="menu-find-shell"
            >
              <span>Find in Shell</span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            <div className="border-t my-2" />
            
            <Button 
              variant="ghost" 
              className="w-full justify-between h-12"
              onClick={closeTab}
              data-testid="menu-close-tab"
            >
              <span>Close tab</span>
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ReplitMobileShell;
