// @ts-nocheck
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  MessageSquare,
  History,
  Settings,
  Trash2,
  Plus,
  Search,
  Star,
  StarOff,
  ChevronRight,
  Sparkles,
  Zap,
  Brain,
  Clock,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TABLET_GRID_CLASSES } from '@shared/responsive-config';
import { AIAssistant } from '@/components/AIAssistant';

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  messageCount: number;
  model: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  capability: 'basic' | 'advanced' | 'expert';
}

const AI_MODELS: AIModel[] = [
  // OpenAI
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', description: 'OpenAI flagship — best coding, instruction following, and long context', speed: 'fast', capability: 'advanced' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', description: 'Fast and efficient — best price-to-performance ratio', speed: 'fast', capability: 'standard' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', description: 'Smallest fastest model — for latency-sensitive tasks', speed: 'fast', capability: 'basic' },
  { id: 'o4-mini', name: 'o4-mini', provider: 'OpenAI', description: 'Best thinking model — fast reasoning for STEM and coding', speed: 'fast', capability: 'advanced' },
  { id: 'o3', name: 'o3', provider: 'OpenAI', description: 'Most powerful reasoning — frontier performance on hard benchmarks', speed: 'medium', capability: 'expert' },
  // Anthropic
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4', provider: 'Anthropic', description: 'Best overall — top intelligence for coding, reasoning & agentic tasks', speed: 'fast', capability: 'advanced' },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4', provider: 'Anthropic', description: 'Most powerful Claude — complex analysis and deep reasoning', speed: 'medium', capability: 'expert' },
  // Google Gemini
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: 'Most powerful Gemini — state-of-the-art reasoning and 1M context', speed: 'medium', capability: 'expert' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', description: 'Fast multimodal AI — thinking capabilities with 1M context', speed: 'fast', capability: 'advanced' },
];

export default function AssistantPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [streamResponse, setStreamResponse] = useState(true);
  const [codeContext, setCodeContext] = useState(true);
  const [autoSuggestions, setAutoSuggestions] = useState(true);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    if (showStarredOnly) {
      filtered = filtered.filter(c => c.starred);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.preview.toLowerCase().includes(query)
      );
    }
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [conversations, showStarredOnly, searchQuery]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const toggleStar = (id: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c)
    );
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedConversation === id) setSelectedConversation(null);
    toast({ title: 'Conversation deleted', description: 'The conversation has been removed.' });
  };

  const startNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      preview: 'Start typing to begin...',
      timestamp: new Date(),
      starred: false,
      messageCount: 0,
      model: selectedModel,
    };
    setConversations(prev => [newConv, ...prev]);
    setSelectedConversation(newConv.id);
    setActiveTab('chat');
    toast({ title: 'New conversation started', description: 'Ready to chat!' });
  };

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-assistant"
      >
        <PageHeader
          title="AI Assistant"
          description="Your intelligent coding companion powered by advanced language models."
          icon={Bot}
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px] border-border bg-card" data-testid="select-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id} data-testid={`select-model-${model.id}`}>
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        <span>{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                onClick={startNewConversation}
                data-testid="button-new-conversation"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>
          )}
        />

        <div className={`grid ${TABLET_GRID_CLASSES.settingsTabletOptimized} mt-6`}>
          <div className="md:col-span-1 lg:col-span-1">
            <nav
              className="space-y-1 p-2 rounded-xl border border-border bg-card"
              data-testid="nav-assistant-sidebar"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 min-h-[44px] ${
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab(item.id)}
                    data-testid={`button-assistant-${item.id}`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {currentModel && (
              <Card className={`${cardClassName} mt-4`} data-testid="card-current-model">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Current Model
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium text-foreground">{currentModel.name}</div>
                  <div className="text-[11px] text-muted-foreground">{currentModel.provider}</div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[11px]">
                      <Zap className="h-3 w-3 mr-1" />
                      {currentModel.speed}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {currentModel.capability}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className={TABLET_GRID_CLASSES.settingsContentTabletOptimized}>
            {activeTab === 'chat' && (
              <Card className={`${cardClassName} min-h-[600px]`} data-testid="card-chat">
                <CardContent className="p-0 h-full">
                  <AIAssistant
                    projectId={1}
                    className="border-0 shadow-none w-full h-full"
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'history' && (
              <Card className={cardClassName} data-testid="card-history">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">Conversation History</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Browse and manage your past conversations
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStarredOnly(!showStarredOnly)}
                      className={showStarredOnly ? 'bg-primary/10 text-primary' : ''}
                      data-testid="button-filter-starred"
                    >
                      <Star className={`h-4 w-4 mr-1 ${showStarredOnly ? 'fill-primary' : ''}`} />
                      Starred
                    </Button>
                  </div>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${inputClassName} pl-10`}
                      data-testid="input-search-conversations"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredConversations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No conversations found</p>
                        </div>
                      ) : (
                        filteredConversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={`p-4 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all duration-200 ${
                              selectedConversation === conv.id ? 'bg-primary/5 border-primary/50' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedConversation(conv.id)}
                            data-testid={`card-conversation-${conv.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-foreground truncate">{conv.title}</h4>
                                  {conv.starred && (
                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-[13px] text-muted-foreground truncate mt-1">{conv.preview}</p>
                                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimestamp(conv.timestamp)}
                                  </span>
                                  <span>{conv.messageCount} messages</span>
                                  <Badge variant="outline" className="text-[11px]">{conv.model}</Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); toggleStar(conv.id); }}
                                  data-testid={`button-star-${conv.id}`}
                                >
                                  {conv.starred ? (
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  ) : (
                                    <StarOff className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                                  data-testid={`button-delete-${conv.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card className={cardClassName} data-testid="card-settings">
                <CardHeader>
                  <CardTitle className="text-foreground">AI Settings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure your AI assistant preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground">Model Selection</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className={inputClassName} data-testid="select-settings-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODELS.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{model.name}</span>
                                <span className="text-[11px] text-muted-foreground">{model.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground">Temperature: {temperature[0]}</Label>
                      </div>
                      <Slider
                        value={temperature}
                        onValueChange={setTemperature}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                        data-testid="slider-temperature"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Higher values make output more random, lower values more deterministic.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground">Max Tokens: {maxTokens[0]}</Label>
                      </div>
                      <Slider
                        value={maxTokens}
                        onValueChange={setMaxTokens}
                        min={256}
                        max={8192}
                        step={256}
                        className="w-full"
                        data-testid="slider-max-tokens"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Maximum number of tokens in the response.
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                        <div className="space-y-0.5">
                          <Label className="text-foreground">Stream Responses</Label>
                          <p className="text-[13px] text-muted-foreground">
                            Show responses as they are generated
                          </p>
                        </div>
                        <Switch
                          checked={streamResponse}
                          onCheckedChange={setStreamResponse}
                          data-testid="switch-stream-response"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                        <div className="space-y-0.5">
                          <Label className="text-foreground">Code Context</Label>
                          <p className="text-[13px] text-muted-foreground">
                            Include current file context in prompts
                          </p>
                        </div>
                        <Switch
                          checked={codeContext}
                          onCheckedChange={setCodeContext}
                          data-testid="switch-code-context"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200">
                        <div className="space-y-0.5">
                          <Label className="text-foreground">Auto Suggestions</Label>
                          <p className="text-[13px] text-muted-foreground">
                            Automatically suggest improvements for selected code
                          </p>
                        </div>
                        <Switch
                          checked={autoSuggestions}
                          onCheckedChange={setAutoSuggestions}
                          data-testid="switch-auto-suggestions"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    className="min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-save-ai-settings"
                  >
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
