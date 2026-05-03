import { useState, useRef, useCallback, useMemo } from 'react';
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from '@/components/WorkspaceTerminal';
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
  Settings,
  Search,
  Code,
  ChevronUp,
  Sparkles,
  Loader2,
  HelpCircle,
  Command,
  RotateCcw,
  Trash2,
  Download,
  Clipboard,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ShellTab {
  id: string;
  sessionId: string;
  name: string;
  isAgent?: boolean;
}

interface ReplitDesktopShellProps {
  projectId: number;
  isFullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

function buildWsUrl(projectId: number, sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/terminal/ws?projectId=${projectId}&sessionId=${encodeURIComponent(sessionId)}`;
}

export function ReplitDesktopShell({ 
  projectId, 
  isFullscreen = false,
  onFullscreenChange 
}: ReplitDesktopShellProps) {
  const { toast } = useToast();

  // The first tab uses sessionId "default" so that server-side executeInSession(projectId, cmd)
  // — which resolves to ${projectId}:default — always finds an active session for agent commands.
  const [tabs, setTabs] = useState<ShellTab[]>([
    { id: 'default', sessionId: 'default', name: 'Agent', isAgent: true },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default');
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem('shell:fontSize');
    return stored ? parseInt(stored, 10) : 14;
  });
  const [isFindMode, setIsFindMode] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [generatePrompt, setGeneratePrompt] = useState('');
  // Track per-tab connection state
  const [connectedTabs, setConnectedTabs] = useState<Set<string>>(new Set());

  // One ref per tab — stored in a Map so we always call the active tab's handle.
  // Using a stable ref to the map avoids re-renders.
  const terminalRefs = useRef<Map<string, WorkspaceTerminalHandle>>(new Map());

  const activeRef = (): WorkspaceTerminalHandle | undefined =>
    terminalRefs.current.get(activeTabId);

  const isConnected = connectedTabs.has(activeTabId);

  const createNewTab = useCallback(() => {
    const sessionId = `shell-${projectId}-${Date.now()}`;
    const newTab: ShellTab = {
      id: sessionId,
      sessionId,
      name: `Shell ${tabs.length + 1}`,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(sessionId);
  }, [tabs.length, projectId]);

  const downloadLog = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    try {
      const res = await fetch(`/api/shell/log/${projectId}/${encodeURIComponent(activeTab.sessionId)}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shell-log-${projectId}-${activeTab.sessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Download failed', description: String(err), variant: 'destructive' });
    }
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isAgent) return; // Agent tab cannot be closed
    if (tabs.length <= 1) return;

    // Explicitly notify the backend to close the PTY session immediately
    // rather than waiting for the 30-second idle reaper.
    const ref = terminalRefs.current.get(tabId);
    ref?.sendRaw({ type: 'close_session' });

    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    terminalRefs.current.delete(tabId);
    setConnectedTabs(prev => {
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const renameTab = (tabId: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name } : t));
  };

  const handleConnectionChange = (tabId: string, connected: boolean) => {
    setConnectedTabs(prev => {
      const next = new Set(prev);
      if (connected) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  };

  const setFontSizePersisted = (size: number) => {
    setFontSize(size);
    localStorage.setItem('shell:fontSize', String(size));
  };

  const pasteFromClipboard = () => activeRef()?.paste();

  const manualReconnect = () => {
    activeRef()?.reconnect();
    toast({ title: 'Reconnecting…' });
  };

  const clearTerminal = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    activeRef()?.clear();
    if (activeTab) {
      fetch('/api/shell/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sessionId: activeTab.sessionId }),
      }).catch(() => {});
    }
  };

  const restartSession = () => {
    activeRef()?.sendRaw({ type: 'restart' });
    toast({ title: 'Restarting shell session…' });
  };

  const copyContent = () => {
    const selection = window.getSelection()?.toString() || '';
    if (selection) {
      navigator.clipboard.writeText(selection);
      toast({ title: 'Copied to clipboard' });
    } else {
      toast({ title: 'No text selected', description: 'Click and drag in the terminal to select text.' });
    }
  };

  const generateCommandMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return await apiRequest('POST', '/api/shell/generate-command', { prompt, projectId });
    },
    onSuccess: (data: any) => {
      if (data.command) {
        activeRef()?.sendRaw({ type: 'input', data: data.command });
        setIsGenerateMode(false);
        setGeneratePrompt('');
        toast({ title: 'Command inserted' });
      }
    },
    onError: () => {
      toast({ title: 'Generation failed', variant: 'destructive' });
    }
  });

  const searchNext = () => findQuery && activeRef()?.searchNext(findQuery);
  const searchPrevious = () => findQuery && activeRef()?.searchPrevious(findQuery);
  const closeFindMode = () => {
    setIsFindMode(false);
    setFindQuery('');
    activeRef()?.clearSearch();
  };

  return (
    <div className={cn("flex flex-col bg-background", isFullscreen ? 'fixed inset-0 z-50' : 'h-full')} data-testid="desktop-shell">

      {/* ── Tab bar / toolbar ── */}
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
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    connectedTabs.has(tab.id) ? 'bg-green-500' : 'bg-muted-foreground'
                  )} />
                  <span className="max-w-[100px] truncate">{tab.name}</span>
                  {tab.isAgent && <Sparkles className="h-3 w-3 text-primary/70" />}
                  {!tab.isAgent && tabs.length > 1 && (
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
          <Button variant="ghost" size="icon" onClick={() => setIsFindMode(!isFindMode)} className="h-8 w-8" title="Search" data-testid="desktop-shell-search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={clearTerminal} className="h-8 w-8" title="Clear terminal" data-testid="desktop-shell-clear">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={restartSession} className="h-8 w-8" title="Restart session" data-testid="desktop-shell-restart">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={manualReconnect} className="h-8 w-8" title="Reconnect" data-testid="desktop-shell-reconnect">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={pasteFromClipboard} className="h-8 w-8" title="Paste from clipboard" data-testid="desktop-shell-paste">
            <Clipboard className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={copyContent} className="h-8 w-8" title="Copy selection" data-testid="desktop-shell-copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={downloadLog} className="h-8 w-8" title="Download session log" data-testid="desktop-shell-download-log">
            <Download className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="desktop-shell-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => {
                  const name = window.prompt('Rename tab', tabs.find(t => t.id === activeTabId)?.name || 'Shell');
                  if (name) renameTab(activeTabId, name);
                }}
                data-testid="desktop-shell-rename"
              >
                <Code className="h-4 w-4 mr-2" />
                Rename Tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <label className="text-[13px] font-medium">Font Size</label>
                <Select value={fontSize.toString()} onValueChange={(v) => setFontSizePersisted(parseInt(v))}>
                  <SelectTrigger className="w-full mt-1" data-testid="desktop-shell-font-size">
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

          <Button variant="ghost" size="icon" onClick={() => onFullscreenChange?.(!isFullscreen)} className="h-8 w-8" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} data-testid="desktop-shell-fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/30 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", isConnected ? 'bg-green-500' : 'bg-yellow-500')} data-testid="desktop-shell-status-dot" />
            <span data-testid="desktop-shell-status-text">{isConnected ? 'Connected' : 'Connecting…'}</span>
          </div>
          <span>bash</span>
          <span>UTF-8</span>
          <span>xterm-256color</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setIsGenerateMode(!isGenerateMode)} data-testid="desktop-shell-generate">
            <Sparkles className="h-3 w-3" />
            Generate
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" asChild data-testid="desktop-shell-help">
            <a href="https://docs.replit.com/core-concepts/project-editor/editor-and-tools/shell" target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-3 w-3" />
              Help
            </a>
          </Button>
        </div>
      </div>

      {/* ── Find bar ── */}
      {isFindMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
          <Input
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              if (e.target.value) activeRef()?.searchNext(e.target.value);
              else activeRef()?.clearSearch();
            }}
            placeholder="Find in terminal…"
            className="h-8 text-[13px] flex-1 max-w-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchNext();
              else if (e.key === 'Escape') closeFindMode();
            }}
            data-testid="desktop-shell-find-input"
          />
          <Button variant="outline" size="sm" className="h-8" onClick={searchNext} disabled={!findQuery} data-testid="desktop-shell-find-next">Next</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={searchPrevious} disabled={!findQuery} data-testid="desktop-shell-find-prev">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={closeFindMode} data-testid="desktop-shell-find-close">Close</Button>
        </div>
      )}

      {/* ── Generate bar ── */}
      {isGenerateMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <Input
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            placeholder="Describe the command you want…"
            className="h-8 text-[13px] flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && generatePrompt.trim()) generateCommandMutation.mutate(generatePrompt);
              else if (e.key === 'Escape') { setIsGenerateMode(false); setGeneratePrompt(''); }
            }}
            autoFocus
            data-testid="desktop-shell-generate-input"
          />
          <Button
            size="sm" className="h-8 gap-1"
            onClick={() => generateCommandMutation.mutate(generatePrompt)}
            disabled={!generatePrompt.trim() || generateCommandMutation.isPending}
            data-testid="desktop-shell-generate-submit"
          >
            {generateCommandMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setIsGenerateMode(false); setGeneratePrompt(''); }} data-testid="desktop-shell-generate-cancel">Cancel</Button>
        </div>
      )}

      {/* ── Terminal area: one WorkspaceTerminal per tab, ALL mounted simultaneously.
              Inactive tabs are hidden via CSS (display:none via 'hidden' class).
              This prevents cross-tab xterm buffer contamination on tab switch
              and keeps each tab's PTY connection alive (preventing 30s idle reap). ── */}
      <div className="flex-1 min-h-0 relative" style={{ fontSize: `${fontSize}px` }} data-testid="desktop-shell-terminal">
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
              onConnectionChange={(connected) => handleConnectionChange(tab.id, connected)}
              onLastCommand={() => {}}
              fontSize={fontSize}
            />
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="border-t bg-muted/30 px-4 py-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span data-testid="desktop-shell-status-footer">{isConnected ? 'Connected' : 'Disconnected'}</span>
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
