// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bot, Send, StopCircle, Loader2, Trash2, Plus, Search,
  FolderOpen, FileText, Code2, Users, Activity, RefreshCw,
  ChevronRight, ChevronDown, Edit, Save, X, Copy, Check, Sparkles,
  Terminal, Brain, Zap, MessageSquare, Settings, Eye,
  Server, HardDrive, Package, Folder, Globe, Cpu, Database, MemoryStick
} from 'lucide-react';
import { format } from 'date-fns';
import { CM6Editor } from '@/components/editor/CM6Editor';

// ===== Types =====
interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  description: string;
  maxTokens: number;
  badge?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  language?: string;
  ownerId: number;
  ownerEmail?: string;
  ownerUsername?: string;
  createdAt?: string;
}

interface ProjectFile {
  id: number;
  projectId: number;
  name: string;
  path: string;
  content?: string;
  isDirectory?: boolean;
}

interface AgentSession {
  id: string;
  userId: number;
  userEmail?: string;
  username?: string;
  projectId?: number;
  projectName?: string;
  model: string;
  tokensUsed?: number;
  status?: string;
  startedAt: string;
  lastActivityAt?: string;
}

interface PlatformFileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: PlatformFileNode[];
}

interface PlatformFileContent {
  path: string;
  name: string;
  content: string;
  size: number;
  extension: string;
  modifiedAt: string;
}

interface PlatformStats {
  name: string;
  version: string;
  description: string;
  dependencies: number;
  devDependencies: number;
  fileCounts: { server: number; client: number; shared: number; total: number };
  nodeVersion: string;
  platform: string;
  uptime: number;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number; external: number };
}

// ===== Platform file tree node =====
function PlatformTreeNode({
  node,
  depth,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onSelectFile,
}: {
  node: PlatformFileNode;
  depth: number;
  selectedPath: string | null;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);

  if (node.isDirectory) {
    return (
      <div>
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1 rounded hover:bg-muted/50 text-left text-sm transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => onToggleDir(node.path)}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
          {isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-blue-400" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-blue-400" />}
          <span className="truncate text-[13px]">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => (
              <PlatformTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const ext = node.name.split('.').pop() || '';
  const fileColor = {
    ts: 'text-blue-400', tsx: 'text-cyan-400', js: 'text-yellow-400', jsx: 'text-yellow-400',
    json: 'text-orange-400', css: 'text-purple-400', sql: 'text-green-400', md: 'text-gray-400',
  }[ext] || 'text-muted-foreground';

  return (
    <button
      className={`flex items-center gap-1.5 w-full px-2 py-0.5 rounded hover:bg-muted/50 text-left text-sm transition-colors ${
        selectedPath === node.path ? 'bg-primary/10 text-primary' : ''
      }`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileText className={`w-3.5 h-3.5 shrink-0 ${fileColor}`} />
      <span className={`truncate text-[13px] ${selectedPath === node.path ? 'text-primary font-medium' : ''}`}>{node.name}</span>
    </button>
  );
}

// ===== Constants =====
const PROVIDER_COLORS = {
  openai: 'bg-green-500/10 text-green-400 border-green-500/20',
  anthropic: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const PROVIDER_LABELS = { openai: 'OpenAI', anthropic: 'Anthropic' };

// ===== Markdown renderer (simple) =====
function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-muted/60 rounded p-3 my-2 overflow-x-auto text-sm font-mono"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted/60 rounded px-1 py-0.5 text-sm font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// ===== Message bubble =====
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  if (msg.role === 'system') return null;

  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`group max-w-[80%] ${isUser ? 'order-1' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/50 border rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          {msg.timestamp && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(msg.timestamp), 'HH:mm')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Main component =====
export default function ChatGPTAdmin() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1');
  const [projectContext, setProjectContext] = useState<Project | null>(null);

  // Projects state
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isSavingFile, setIsSavingFile] = useState(false);

  // Sessions terminate
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  // Platform filesystem state
  const [platformSelectedPath, setPlatformSelectedPath] = useState<string | null>(null);
  const [platformEditedContent, setPlatformEditedContent] = useState<string>('');
  const [platformFileExt, setPlatformFileExt] = useState<string>('ts');
  const [isSavingPlatformFile, setIsSavingPlatformFile] = useState(false);
  const [expandedPlatformDirs, setExpandedPlatformDirs] = useState<Set<string>>(
    new Set(['server', 'client', 'shared'])
  );
  const [isLoadingPlatformFile, setIsLoadingPlatformFile] = useState(false);

  // ===== Queries =====
  const { data: models = [] } = useQuery<AIModel[]>({
    queryKey: ['/api/admin/chatgpt/models'],
  });

  const { data: allProjects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['/api/admin/chatgpt/all-projects'],
  });

  const { data: projectFiles = [], isLoading: loadingFiles } = useQuery<ProjectFile[]>({
    queryKey: ['/api/admin/chatgpt/projects', selectedProject?.id, 'files'],
    enabled: !!selectedProject,
    queryFn: async () => {
      if (!selectedProject) return [];
      const res = await fetch(`/api/admin/chatgpt/projects/${selectedProject.id}/files`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch files');
      return res.json();
    },
  });

  const { data: agentSessions = [], refetch: refetchSessions } = useQuery<AgentSession[]>({
    queryKey: ['/api/admin/chatgpt/agent-sessions'],
    refetchInterval: 10000,
  });

  const { data: platformTree = [], isLoading: loadingPlatformTree, refetch: refetchPlatformTree } = useQuery<PlatformFileNode[]>({
    queryKey: ['/api/admin/chatgpt/platform/tree'],
  });

  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ['/api/admin/chatgpt/platform/stats'],
  });

  // Filtered projects
  const filteredProjects = allProjects.filter(p =>
    !projectSearch ||
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.ownerEmail?.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.ownerUsername?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== Stream chat =====
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Build messages to send (exclude system if no project context)
    const apiMessages = [
      {
        role: 'system' as const,
        content: projectContext
          ? `You are an expert AI assistant for the E-Code platform admin. Current project context: "${projectContext.name}" (${projectContext.language || 'unknown language'}, owner: ${projectContext.ownerEmail || 'unknown'}). Help with code, debugging, and architecture decisions.`
          : 'You are an expert AI assistant for the E-Code platform admin. Help with code, project management, debugging, and architecture decisions.',
      },
      ...newMessages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
    ];

    let assistantContent = '';
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const response = await fetch('/api/admin/chatgpt/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages }),
        signal: ctrl.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content') {
              assistantContent += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMsg, content: assistantContent };
                return updated;
              });
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          if (updated[updated.length - 1].role === 'assistant' && !updated[updated.length - 1].content) {
            updated.pop();
          }
          return updated;
        });
      } else {
        toast({ title: 'Error', description: err.message || 'Failed to get response', variant: 'destructive' });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg, content: `Error: ${err.message}` };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputText, isStreaming, messages, selectedModel, projectContext, toast]);

  const stopStream = () => {
    abortRef.current?.abort();
  };

  const clearChat = () => {
    setMessages([]);
    setProjectContext(null);
  };

  // ===== File operations =====
  const loadFile = async (file: ProjectFile) => {
    if (file.isDirectory) return;
    setSelectedFile(file);
    setFileContent(file.content || '');
    if (!file.content) {
      try {
        const data = await apiRequest<ProjectFile>(`/api/admin/chatgpt/projects/${file.projectId}/files/${file.id}`);
        setFileContent(data.content || '');
        setSelectedFile(data);
      } catch (err) {
        toast({ title: 'Failed to load file', variant: 'destructive' });
      }
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !selectedProject) return;
    setIsSavingFile(true);
    try {
      await apiRequest('PUT', `/api/admin/chatgpt/projects/${selectedProject.id}/files/${selectedFile.id}`, { content: fileContent });
      toast({ title: 'File saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/chatgpt/projects', selectedProject.id, 'files'] });
    } catch (err) {
      toast({ title: 'Failed to save file', variant: 'destructive' });
    } finally {
      setIsSavingFile(false);
    }
  };

  const askAboutFile = () => {
    if (!selectedFile) return;
    const preview = (fileContent || '').slice(0, 3000);
    const question = `Review this file \`${selectedFile.path}\` and give me a brief analysis:\n\`\`\`\n${preview}\n\`\`\``;
    setInputText(question);
    setProjectContext(selectedProject);
    inputRef.current?.focus();
  };

  // ===== Platform file operations =====
  const loadPlatformFile = async (filePath: string) => {
    if (isLoadingPlatformFile) return;
    setPlatformSelectedPath(filePath);
    setIsLoadingPlatformFile(true);
    try {
      const res = await fetch(`/api/admin/chatgpt/platform/file?path=${encodeURIComponent(filePath)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load file');
      const data: PlatformFileContent = await res.json();
      setPlatformEditedContent(data.content);
      setPlatformFileExt(data.extension || 'ts');
    } catch {
      toast({ title: 'Failed to load platform file', variant: 'destructive' });
    } finally {
      setIsLoadingPlatformFile(false);
    }
  };

  const savePlatformFile = async () => {
    if (!platformSelectedPath) return;
    setIsSavingPlatformFile(true);
    try {
      const res = await fetch('/api/admin/chatgpt/platform/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: platformSelectedPath, content: platformEditedContent }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Platform file saved successfully' });
    } catch {
      toast({ title: 'Failed to save platform file', variant: 'destructive' });
    } finally {
      setIsSavingPlatformFile(false);
    }
  };

  const askAIAboutPlatformFile = () => {
    if (!platformSelectedPath || !platformEditedContent) return;
    const preview = platformEditedContent.slice(0, 4000);
    const question = `Analyze this E-Code platform source file \`${platformSelectedPath}\`:\n\`\`\`${platformFileExt}\n${preview}${platformEditedContent.length > 4000 ? '\n... [truncated]' : ''}\n\`\`\`\n\nProvide: purpose, key functions/components, potential improvements.`;
    setInputText(question);
    toast({ title: 'File context added to chat', description: 'Switch to AI Chat tab to send' });
  };

  const togglePlatformDir = (dirPath: string) => {
    setExpandedPlatformDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  // ===== Terminate session =====
  const terminateSession = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await apiRequest('POST', `/api/admin/chatgpt/agent-sessions/${sessionId}/terminate`, { reason: 'Admin terminated' });
      toast({ title: 'Session terminated' });
      refetchSessions();
    } catch {
      toast({ title: 'Failed to terminate session', variant: 'destructive' });
    } finally {
      setTerminatingId(null);
    }
  };

  // ===== Keyboard =====
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentModel = models.find(m => m.id === selectedModel);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-none">Admin AI Studio</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage projects & chat with the latest AI models</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {allProjects.length} projects · {agentSessions.length} active sessions
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit shrink-0">
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="w-3.5 h-3.5" />AI Chat</TabsTrigger>
          <TabsTrigger value="projects" className="gap-2"><FolderOpen className="w-3.5 h-3.5" />Client Projects</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2"><Activity className="w-3.5 h-3.5" />Live Sessions</TabsTrigger>
          <TabsTrigger value="platform" className="gap-2"><Server className="w-3.5 h-3.5" />E-Code Platform</TabsTrigger>
        </TabsList>

        {/* ===== TAB: AI CHAT ===== */}
        <TabsContent value="chat" className="flex-1 flex overflow-hidden m-0 mt-3 px-6 pb-6 gap-4">
          {/* Left: Model & Context config */}
          <div className="w-64 shrink-0 flex flex-col gap-3">
            {/* Model selector */}
            <Card className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">AI Model</p>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* OpenAI group */}
                  <div className="px-2 py-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">OpenAI</p>
                    {models.filter(m => m.provider === 'openai').map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.name}</span>
                          {m.badge && <Badge variant="secondary" className="text-[10px] h-4 px-1">{m.badge}</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    <Separator className="my-2" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Anthropic</p>
                    {models.filter(m => m.provider === 'anthropic').map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.name}</span>
                          {m.badge && <Badge variant="secondary" className="text-[10px] h-4 px-1">{m.badge}</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              {currentModel && (
                <div className="mt-2 p-2 rounded-md bg-muted/40">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant="outline" className={`text-[10px] h-4 px-1 ${PROVIDER_COLORS[currentModel.provider]}`}>
                      {PROVIDER_LABELS[currentModel.provider]}
                    </Badge>
                    {currentModel.badge && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{currentModel.badge}</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{currentModel.description}</p>
                </div>
              )}
            </Card>

            {/* Project context */}
            <Card className="p-3 flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Project Context</p>
              {projectContext ? (
                <div className="space-y-2">
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium truncate">{projectContext.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{projectContext.ownerEmail}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => setProjectContext(null)}>
                    <X className="w-3 h-3 mr-1" />Remove context
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <FolderOpen className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-[11px] text-muted-foreground">Select a project in the Projects tab to add context</p>
                </div>
              )}
            </Card>

            {/* Actions */}
            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={clearChat} disabled={messages.length === 0}>
              <Trash2 className="w-3 h-3 mr-1.5" />Clear conversation
            </Button>
          </div>

          {/* Right: Chat area */}
          <div className="flex-1 flex flex-col border rounded-xl overflow-hidden bg-card">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="p-4 rounded-2xl bg-primary/5 mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Ask about code, architecture, bugs, or anything about your projects.
                    Select a project for context-aware responses.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2 w-full max-w-sm">
                    {[
                      'Explain the project architecture',
                      'Find potential bugs in the codebase',
                      'How can I improve performance?',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInputText(suggestion)}
                        className="text-xs text-left px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} />
                  ))}
                  {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="bg-muted/50 border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3">
              {projectContext && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <FolderOpen className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary font-medium">{projectContext.name}</span>
                  <span className="text-xs text-muted-foreground">context active</span>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${currentModel?.name || 'AI'}… (Enter to send, Shift+Enter for newline)`}
                  className="flex-1 min-h-[40px] max-h-32 resize-none text-sm"
                  rows={1}
                  disabled={isStreaming}
                />
                {isStreaming ? (
                  <Button variant="destructive" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={stopStream}>
                    <StopCircle className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={sendMessage} disabled={!inputText.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== TAB: CLIENT PROJECTS ===== */}
        <TabsContent value="projects" className="flex-1 flex overflow-hidden m-0 mt-3 px-6 pb-6 gap-4">
          {/* Project list */}
          <div className="w-72 shrink-0 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <ScrollArea className="flex-1 border rounded-xl">
              {loadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-xs text-muted-foreground">No projects found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProject(project); setSelectedFile(null); setFileContent(''); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        selectedProject?.id === project.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <Code2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{project.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate ml-5">
                        {project.ownerEmail || project.ownerUsername || `User #${project.ownerId}`}
                      </p>
                      {project.language && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-5 mt-0.5">{project.language}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-[11px] text-muted-foreground text-center">{filteredProjects.length} of {allProjects.length} projects</p>
          </div>

          {/* File browser + editor */}
          {selectedProject ? (
            <div className="flex-1 flex gap-3 overflow-hidden">
              {/* File tree */}
              <div className="w-56 shrink-0 flex flex-col border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate">{selectedProject.name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => {
                        setProjectContext(selectedProject);
                        toast({ title: `Context set: ${selectedProject.name}`, description: 'Switch to AI Chat to ask questions' });
                      }}
                    >
                      <MessageSquare className="w-3 h-3" />Chat
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {selectedProject.ownerEmail || `User #${selectedProject.ownerId}`}
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  {loadingFiles ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-3.5 h-3.5 animate-spin" /></div>
                  ) : projectFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No files</p>
                  ) : (
                    <div className="p-1.5">
                      {projectFiles
                        .sort((a, b) => {
                          if (a.isDirectory && !b.isDirectory) return -1;
                          if (!a.isDirectory && b.isDirectory) return 1;
                          return (a.path || a.name || '').localeCompare(b.path || b.name || '');
                        })
                        .map(file => (
                          <button
                            key={file.id}
                            onClick={() => loadFile(file)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                              selectedFile?.id === file.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                            } ${file.isDirectory ? 'text-muted-foreground' : ''}`}
                          >
                            {file.isDirectory
                              ? <FolderOpen className="w-3 h-3 shrink-0" />
                              : <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
                            }
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Editor */}
              {selectedFile ? (
                <div className="flex-1 flex flex-col border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">{selectedFile.path}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={askAboutFile}>
                        <Bot className="w-3 h-3" />Ask AI
                      </Button>
                      <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={saveFile} disabled={isSavingFile}>
                        {isSavingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <CM6Editor
                      value={fileContent}
                      onChange={setFileContent}
                      language={selectedFile.name.split('.').pop() || 'text'}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 border rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Select a file to view and edit</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 border rounded-xl flex items-center justify-center">
              <div className="text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-sm mb-1">Select a project</p>
                <p className="text-xs text-muted-foreground">Choose a project from the list to browse its files</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB: LIVE SESSIONS ===== */}
        <TabsContent value="sessions" className="flex-1 overflow-auto m-0 mt-3 px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Live AI Sessions</h2>
              <p className="text-xs text-muted-foreground">All active AI agent sessions across all users</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => refetchSessions()}>
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
          </div>

          {agentSessions.length === 0 ? (
            <div className="border rounded-xl flex items-center justify-center py-16">
              <div className="text-center">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active sessions</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {agentSessions.map(session => (
                <Card key={session.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{session.userEmail || session.username || `User #${session.userId}`}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-green-500/10 text-green-600 border-green-500/20">
                            <span className="w-1 h-1 rounded-full bg-green-500 mr-1" />Active
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">Model: <span className="font-medium text-foreground">{session.model}</span></span>
                          {session.projectName && (
                            <span className="text-xs text-muted-foreground">Project: <span className="font-medium text-foreground">{session.projectName}</span></span>
                          )}
                          {session.tokensUsed !== undefined && (
                            <span className="text-xs text-muted-foreground">{session.tokensUsed.toLocaleString()} tokens</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Started {session.startedAt ? format(new Date(session.startedAt), 'MMM d, HH:mm') : 'unknown'}
                          {session.lastActivityAt && ` · Last active ${format(new Date(session.lastActivityAt), 'HH:mm')}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      disabled={terminatingId === session.id}
                      onClick={() => terminateSession(session.id)}
                    >
                      {terminatingId === session.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <StopCircle className="w-3 h-3 mr-1" />
                      )}
                      Terminate
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB: E-CODE PLATFORM ===== */}
        <TabsContent value="platform" className="flex-1 flex overflow-hidden m-0 mt-3 px-6 pb-6 gap-4">
          {/* Left: Platform tree + stats */}
          <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0">
            {/* Platform Stats Card */}
            {platformStats && (
              <Card className="p-3 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-none">{platformStats.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">v{platformStats.version}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Total Files</p>
                    <p className="text-sm font-bold text-foreground">{platformStats.fileCounts.total}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Node</p>
                    <p className="text-sm font-bold text-foreground">{platformStats.nodeVersion}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Deps</p>
                    <p className="text-sm font-bold text-foreground">{platformStats.dependencies}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Heap</p>
                    <p className="text-sm font-bold text-foreground">{Math.round(platformStats.memoryUsage.heapUsed / 1024 / 1024)}MB</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <div className="flex-1 rounded-md bg-blue-500/10 px-2 py-1">
                    <p className="text-[10px] text-blue-400">server/</p>
                    <p className="text-xs font-semibold text-blue-400">{platformStats.fileCounts.server} files</p>
                  </div>
                  <div className="flex-1 rounded-md bg-cyan-500/10 px-2 py-1">
                    <p className="text-[10px] text-cyan-400">client/</p>
                    <p className="text-xs font-semibold text-cyan-400">{platformStats.fileCounts.client} files</p>
                  </div>
                  <div className="flex-1 rounded-md bg-purple-500/10 px-2 py-1">
                    <p className="text-[10px] text-purple-400">shared/</p>
                    <p className="text-xs font-semibold text-purple-400">{platformStats.fileCounts.shared} files</p>
                  </div>
                </div>
              </Card>
            )}
            {/* File Tree */}
            <Card className="flex-1 flex flex-col overflow-hidden p-0">
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Codebase</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => refetchPlatformTree()}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="py-1 px-1">
                  {loadingPlatformTree ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : platformTree.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No files found</p>
                  ) : (
                    platformTree.map(node => (
                      <PlatformTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        selectedPath={platformSelectedPath}
                        expandedDirs={expandedPlatformDirs}
                        onToggleDir={togglePlatformDir}
                        onSelectFile={loadPlatformFile}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right: Editor */}
          {platformSelectedPath ? (
            <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
              <div className="flex items-center gap-2 shrink-0 bg-muted/30 rounded-lg px-3 py-2">
                <Code2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate flex-1 font-mono">{platformSelectedPath}</span>
                {isLoadingPlatformFile && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0 gap-1"
                  onClick={askAIAboutPlatformFile}
                  disabled={!platformEditedContent}
                >
                  <Sparkles className="w-3 h-3" />Ask AI
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0 gap-1"
                  onClick={savePlatformFile}
                  disabled={isSavingPlatformFile || isLoadingPlatformFile}
                >
                  {isSavingPlatformFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </Button>
              </div>
              <div className="flex-1 border rounded-xl overflow-hidden">
                {isLoadingPlatformFile ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Loading file...</p>
                    </div>
                  </div>
                ) : (
                  <CM6Editor
                    value={platformEditedContent}
                    onChange={setPlatformEditedContent}
                    language={platformFileExt}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 border rounded-xl flex items-center justify-center">
              <div className="text-center">
                <Server className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-sm mb-1">Select a source file</p>
                <p className="text-xs text-muted-foreground max-w-[200px]">Browse the E-Code platform codebase and click any file to view and edit it</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
