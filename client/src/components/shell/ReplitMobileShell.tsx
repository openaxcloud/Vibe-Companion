import { useState, useRef, useCallback } from 'react';
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
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
  Sparkles,
  ChevronUp,
  Terminal as ShellIcon,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ShellTab {
  id: string;
  sessionId: string;
  name: string;
}

interface ReplitMobileShellProps {
  projectId: number;
  onClose?: () => void;
  onBack?: () => void;
}

function buildWsUrl(projectId: number, sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/terminal/ws?projectId=${projectId}&sessionId=${encodeURIComponent(sessionId)}`;
}

export function ReplitMobileShell({ projectId, onClose, onBack }: ReplitMobileShellProps) {
  const { toast } = useToast();

  // First tab uses sessionId "default" so agent executeInSession(projectId, cmd) can find it.
  const [tabs, setTabs] = useState<ShellTab[]>([
    { id: 'default', sessionId: 'default', name: 'bash' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFindMode, setIsFindMode] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [generatePrompt, setGeneratePrompt] = useState('');

  const findInputRef = useRef<HTMLInputElement>(null);
  const generateInputRef = useRef<HTMLInputElement>(null);

  // One ref per tab — stored in a Map so tab switching never mixes terminal state.
  const terminalRefs = useRef<Map<string, WorkspaceTerminalHandle>>(new Map());
  const activeRef = (): WorkspaceTerminalHandle | undefined =>
    terminalRefs.current.get(activeTabId);

  const createNewTab = useCallback(() => {
    const sessionId = `shell-mobile-${projectId}-${Date.now()}`;
    const newTab: ShellTab = {
      id: sessionId,
      sessionId,
      name: `bash ${tabs.length + 1}`,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(sessionId);
  }, [tabs.length, projectId]);

  const closeTab = () => {
    // Explicitly notify the server so it can clean up the PTY immediately
    // rather than waiting for the 30-second idle reaper.
    activeRef()?.sendRaw?.({ type: 'close_session' });
    if (tabs.length <= 1) {
      onClose?.();
      return;
    }
    const remainingTabs = tabs.filter(t => t.id !== activeTabId);
    terminalRefs.current.delete(activeTabId);
    setTabs(remainingTabs);
    setActiveTabId(remainingTabs[0].id);
    setIsMenuOpen(false);
  };

  const clearShell = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    activeRef()?.clear();
    if (activeTab) {
      fetch('/api/shell/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sessionId: activeTab.sessionId }),
      }).catch(() => {});
    }
    setIsMenuOpen(false);
  };

  const restartShell = () => {
    activeRef()?.sendRaw({ type: 'restart' });
    setIsMenuOpen(false);
    toast({ title: 'Restarting shell session…' });
  };

  const openFindInShell = () => {
    setIsFindMode(true);
    setIsMenuOpen(false);
    setTimeout(() => findInputRef.current?.focus(), 100);
  };

  const closeFindMode = () => {
    setIsFindMode(false);
    setFindQuery('');
    activeRef()?.clearSearch();
  };

  const searchNext = () => findQuery && activeRef()?.searchNext(findQuery);
  const searchPrevious = () => findQuery && activeRef()?.searchPrevious(findQuery);

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
        activeRef()?.sendRaw({ type: 'input', data: data.command });
        closeGenerateMode();
        toast({ title: 'Command inserted' });
      }
    },
    onError: () => {
      toast({ title: 'Generation failed', variant: 'destructive' });
    }
  });

  return (
    <div className="flex flex-col h-full bg-background" data-testid="mobile-shell">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} data-testid="shell-back-button">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShellIcon className="h-4 w-4 text-primary" />
          <span className="font-medium text-[13px]">Shell</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMenuOpen(true)} data-testid="shell-menu-button">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-[11px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-normal gap-1" data-testid="shell-tab-dropdown">
              <ChevronDown className="h-3 w-3" />
              <span className="text-muted-foreground">{tabs.find(t => t.id === activeTabId)?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {tabs.map(tab => (
              <DropdownMenuItem key={tab.id} onClick={() => setActiveTabId(tab.id)} className="text-[11px]" data-testid={`shell-tab-${tab.id}`}>
                {tab.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={createNewTab} className="text-[11px] gap-2" data-testid="shell-new-tab">
              <Plus className="h-3 w-3" />
              New Shell
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openFindInShell} data-testid="shell-search-button">
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeTab} data-testid="shell-close-tab-button">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={openGenerateMode} data-testid="shell-generate-button">
            Generate
          </Button>
        </div>
      </div>

      {/* ── Find bar ── */}
      {isFindMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
          <Input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              if (e.target.value) activeRef()?.searchNext(e.target.value);
              else activeRef()?.clearSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchNext();
              else if (e.key === 'Escape') closeFindMode();
            }}
            placeholder="Find"
            className="h-7 text-[11px] flex-1"
            data-testid="shell-find-input"
          />
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={searchNext} disabled={!findQuery} data-testid="shell-find-next">Next</Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={searchPrevious} disabled={!findQuery} data-testid="shell-find-prev">
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={closeFindMode} data-testid="shell-find-close">Exit</Button>
        </div>
      )}

      {/* ── Terminal area: one WorkspaceTerminal per tab, ALL mounted simultaneously.
              Inactive tabs are CSS-hidden. Each tab keeps its own xterm buffer and
              its own live WS connection — no cross-tab output contamination and no
              30s idle reap of background tabs while the shell panel is open. ── */}
      <div className="flex-1 min-h-0 relative" data-testid="shell-terminal-output">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn("absolute inset-0", tab.id !== activeTabId && "hidden")}
          >
            <WorkspaceTerminal
              ref={(handle) => {
                if (handle) terminalRefs.current.set(tab.id, handle);
                else terminalRefs.current.delete(tab.id);
              }}
              wsUrl={buildWsUrl(projectId, tab.sessionId)}
              runnerOffline={false}
              visible={tab.id === activeTabId}
              onLastCommand={() => {}}
            />
          </div>
        ))}
      </div>

      {/* ── Generate input ── */}
      {isGenerateMode && (
        <div className="border-t bg-card p-3">
          <div className="relative">
            <Input
              ref={generateInputRef}
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') generateCommandMutation.mutate(generatePrompt);
                else if (e.key === 'Escape') closeGenerateMode();
              }}
              placeholder="Enter a prompt to generate a shell command"
              className="h-9 text-[13px] pr-10"
              data-testid="shell-generate-input"
            />
            <Button
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => generateCommandMutation.mutate(generatePrompt)}
              disabled={generateCommandMutation.isPending}
              data-testid="shell-generate-submit"
            >
              {generateCommandMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Generate with Assistant</span>
            </div>
            <span>Esc to close · Enter to submit</span>
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div className="flex items-center justify-center gap-4 py-3 border-t bg-card safe-area-bottom">
        <div className="flex items-center bg-muted rounded-full px-1 py-1">
          <Button variant="default" size="icon" className="h-9 w-9 rounded-full bg-primary" data-testid="shell-nav-active">
            <ShellIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-lg" onClick={createNewTab} data-testid="shell-split-button">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Bottom-sheet menu ── */}
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
            <Button variant="ghost" className="w-full justify-between h-12" onClick={clearShell} data-testid="menu-clear-shell">
              <span>Clear Shell</span>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="w-full justify-between h-12" onClick={restartShell} data-testid="menu-restart-shell">
              <span>Restart Shell</span>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="w-full justify-between h-12" onClick={openFindInShell} data-testid="menu-find-shell">
              <span>Find in Shell</span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="border-t my-2" />
            <Button variant="ghost" className="w-full justify-between h-12" onClick={closeTab} data-testid="menu-close-tab">
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
