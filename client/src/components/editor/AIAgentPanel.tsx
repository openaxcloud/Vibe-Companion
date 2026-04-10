import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot, Loader2, Settings, History, Zap, Code, MessageSquare, X, ChevronDown, ChevronUp, Bug, TestTube, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { handleSSEWarning, type SSEWarningData } from '@/lib/sse-warning-handler';
import { streamCodeAction, createStreamController } from '@/lib/streaming';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: boolean;
  actions?: any[];
  error?: string;
}

interface AIAgentPanelProps {
  projectId: string | number;
  onClose?: () => void;
  selectedCode?: string;
  currentFilePath?: string;
  language?: string;
}

export function AIAgentPanel({ projectId, onClose, selectedCode, currentFilePath, language = 'javascript' }: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCodeActionStreaming, setIsCodeActionStreaming] = useState(false);
  const [codeActionContent, setCodeActionContent] = useState('');
  const [activeCodeAction, setActiveCodeAction] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openai');
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [highPower, setHighPower] = useState(false);
  const [conversationId] = useState(`conv-${Date.now()}`);
  const [currentStreamMessage, setCurrentStreamMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamMessage, codeActionContent]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleStreamChat = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setCurrentStreamMessage('');

    try {
      // Create EventSource for Server-Sent Events
      const response = await apiRequest('POST', '/api/agent/chat/stream', {
        message: userMessage.content,
        projectId,
        conversationId,
        provider: selectedModel,
        context: messages.slice(-20), // Send last 20 messages as context for better memory
        systemPrompt: extendedThinking ? 
          'Think step by step through the problem. Show your reasoning process.' : 
          undefined,
        temperature: highPower ? 0.9 : 0.7,
        maxTokens: highPower ? 8192 : 4096
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: extendedThinking
      };

      // Add empty assistant message
      setMessages(prev => [...prev, assistantMessage]);
      
      const warningMessages: Message[] = []; // Accumulate warnings during streaming
      
      while (true) {
        const { done, value } = await reader!.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle context truncation warnings (check for presence of warning-specific fields)
              if (data.message && typeof data.message === 'string' && !data.content && !data.totalTokens) {
                const warningResult = handleSSEWarning(data as SSEWarningData, { toast });
                if (warningResult.shouldShow && warningResult.systemMessageContent) {
                  // Accumulate warning to be added after streaming completes
                  const systemMessage: Message = {
                    id: `system-${Date.now()}`,
                    role: 'system',
                    content: warningResult.systemMessageContent,
                    timestamp: new Date()
                  };
                  warningMessages.push(systemMessage);
                }
                continue;
              }
              
              if (data.content) {
                // Update the assistant message content
                assistantMessage.content += data.content;
                setCurrentStreamMessage(assistantMessage.content);
              }
              
              if (data.totalTokens) {
                setTokenCount(prev => prev + data.totalTokens);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Update final message and add any accumulated warnings
      setMessages(prev => [
        ...prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: assistantMessage.content }
            : msg
        ),
        ...warningMessages
      ]);
      
      setCurrentStreamMessage('');
      
    } catch (error: any) {
      console.error('Streaming error:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        timestamp: new Date(),
        error: error.message
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: 'AI Error',
        description: error.message || 'Failed to get response from AI',
        variant: 'destructive'
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const clearChat = () => {
    setMessages([]);
    setTokenCount(0);
    setCodeActionContent('');
    setActiveCodeAction(null);
  };

  const handleCodeAction = async (action: string) => {
    const codeToAnalyze = selectedCode || '';
    
    if (!codeToAnalyze.trim()) {
      toast({
        title: 'No Code Selected',
        description: 'Please select some code in the editor first.',
        variant: 'destructive'
      });
      return;
    }

    if (isCodeActionStreaming) return;

    setCodeActionContent('');
    setActiveCodeAction(action);
    setIsCodeActionStreaming(true);

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `${action}: ${codeToAnalyze.length > 100 ? codeToAnalyze.substring(0, 100) + '...' : codeToAnalyze}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      await streamCodeAction(
        action,
        codeToAnalyze,
        language,
        {
          onChunk: (chunk) => {
            setCodeActionContent(prev => prev + chunk);
          },
          onComplete: (provider) => {
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: codeActionContent + ` [${provider}]` }
                : msg
            ));
            setIsCodeActionStreaming(false);
            setActiveCodeAction(null);
          },
          onError: (error) => {
            toast({
              title: 'Code Action Failed',
              description: error,
              variant: 'destructive'
            });
            setIsCodeActionStreaming(false);
            setActiveCodeAction(null);
          }
        },
        String(projectId),
        currentFilePath,
        selectedModel
      );

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: codeActionContent }
          : msg
      ));
    } catch (error: any) {
      toast({
        title: 'Code Action Error',
        description: error.message || 'Failed to execute code action',
        variant: 'destructive'
      });
      setIsCodeActionStreaming(false);
      setActiveCodeAction(null);
    }
  };

  const stopCodeActionStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsCodeActionStreaming(false);
    setActiveCodeAction(null);
  };

  const quickActions = [
    { label: 'Explain', icon: Code, action: 'explain' },
    { label: 'Debug', icon: Bug, action: 'debug' },
    { label: 'Test', icon: TestTube, action: 'test' },
    { label: 'Document', icon: FileCode, action: 'document' },
    { label: 'Optimize', icon: Zap, action: 'optimize' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">AI Agent</span>
          <Badge className={cn(
            "h-4 px-1 text-[9px] rounded",
            isStreaming ? "bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)]" : "bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)]"
          )}>
            {isStreaming ? 'Live' : 'Ready'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Settings Panel */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-2 text-[13px]">
            Settings
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 py-2 border-b space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="model">Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">GPT-5.1</SelectItem>
                <SelectItem value="anthropic">Claude Sonnet 4.5</SelectItem>
                <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="thinking">Extended Thinking</Label>
            <Switch
              id="thinking"
              checked={extendedThinking}
              onCheckedChange={setExtendedThinking}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="power">High Power Mode</Label>
            <Switch
              id="power"
              checked={highPower}
              onCheckedChange={setHighPower}
            />
          </div>
          
          <div className="text-[11px] text-muted-foreground">
            Tokens used: {tokenCount.toLocaleString()}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Quick Actions - Streaming Code Actions */}
      <div className="flex flex-wrap gap-2 p-2 border-b">
        {quickActions.map((qa) => (
          <Button
            key={qa.label}
            variant={activeCodeAction === qa.action ? 'default' : 'outline'}
            size="sm"
            className="text-[11px]"
            onClick={() => handleCodeAction(qa.action)}
            disabled={isStreaming || isCodeActionStreaming}
            data-testid={`code-action-${qa.action}`}
          >
            {activeCodeAction === qa.action ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <qa.icon className="h-3 w-3 mr-1" />
            )}
            {qa.label}
          </Button>
        ))}
        {isCodeActionStreaming && (
          <Button
            variant="destructive"
            size="sm"
            className="text-[11px]"
            onClick={stopCodeActionStreaming}
            data-testid="stop-code-action"
          >
            <X className="h-3 w-3 mr-1" />
            Stop
          </Button>
        )}
        {selectedCode && (
          <Badge variant="secondary" className="ml-auto text-[11px]">
            {selectedCode.length} chars selected
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-status-warning/20" />
              <p className="text-[13px]">Ask me anything about your code!</p>
              <p className="text-[11px] mt-2">I can help you build, debug, and improve your application.</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-status-warning" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-status-info text-primary-foreground'
                    : message.role === 'system'
                    ? 'bg-status-critical/10 text-status-critical dark:text-status-critical'
                    : 'bg-muted dark:bg-muted'
                }`}
              >
                {message.thinking && (
                  <Badge variant="secondary" className="mb-2">
                    Extended Thinking
                  </Badge>
                )}
                <p className="text-[13px] whitespace-pre-wrap">{message.content}</p>
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[11px] font-medium mb-1">Actions:</p>
                    {message.actions.map((action, i) => (
                      <Badge key={i} variant="outline" className="mr-1 text-[11px]">
                        {action.type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-status-info/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-status-info" />
                </div>
              )}
            </div>
          ))}
          
          {isStreaming && currentStreamMessage && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-status-warning animate-spin" />
              </div>
              <div className="max-w-[80%] rounded-lg px-3 py-2 bg-muted dark:bg-muted">
                <p className="text-[13px] whitespace-pre-wrap">{currentStreamMessage}</p>
              </div>
            </div>
          )}
          
          {isCodeActionStreaming && codeActionContent && (
            <div className="flex gap-3 justify-start" data-testid="streaming-code-action">
              <div className="h-8 w-8 rounded-full bg-status-warning/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-status-warning animate-spin" />
              </div>
              <div className="max-w-[80%] rounded-lg px-3 py-2 bg-muted dark:bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {activeCodeAction}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground animate-pulse">
                    Streaming...
                  </span>
                </div>
                <p className="text-[13px] whitespace-pre-wrap font-mono">{codeActionContent}<span className="animate-pulse">▌</span></p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleStreamChat();
              }
            }}
            placeholder="Ask anything... (Shift+Enter for new line)"
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleStreamChat}
              disabled={!input.trim() || isStreaming}
              size="icon"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {isStreaming && (
              <Button
                onClick={stopStreaming}
                variant="destructive"
                size="icon"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            disabled={messages.length === 0 || isStreaming}
          >
            Clear Chat
          </Button>
          <div className="text-[11px] text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}