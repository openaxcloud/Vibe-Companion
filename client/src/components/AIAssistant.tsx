import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bot, Send, Sparkles, Code, FileText, HelpCircle,
  Lightbulb, Zap, RefreshCw, Copy, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, Terminal, History, Settings,
  X, Minimize2, Maximize2, MessageSquare, Wand2, BookTemplate
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { CustomPromptsModal } from './CustomPromptsModal';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AIAssistantProps {
  projectId: number;
  selectedFile?: string;
  selectedCode?: string;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'code' | 'explanation' | 'suggestion' | 'error';
  metadata?: {
    language?: string;
    fileName?: string;
    lineNumbers?: number[];
  };
}

interface CodeSuggestion {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  confidence: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'explain', label: 'Explain Code', icon: <HelpCircle className="h-4 w-4" />, prompt: 'Explain this code:' },
  { id: 'improve', label: 'Improve Code', icon: <Sparkles className="h-4 w-4" />, prompt: 'How can I improve this code?' },
  { id: 'debug', label: 'Debug Error', icon: <Terminal className="h-4 w-4" />, prompt: 'Help me debug this error:' },
  { id: 'generate', label: 'Generate Code', icon: <Zap className="h-4 w-4" />, prompt: 'Generate code for:' },
  { id: 'refactor', label: 'Refactor', icon: <RefreshCw className="h-4 w-4" />, prompt: 'Refactor this code:' }
];

export function AIAssistant({ projectId, selectedFile, selectedCode, className }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [showCustomPrompts, setShowCustomPrompts] = useState(false);
  const [activePromptRules, setActivePromptRules] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);
  const lastScrollTimeRef = useRef(0);
  const { toast } = useToast();

  // Fetch active AI rules for this project
  const { data: projectRules = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/ai-rules`, { activeOnly: true }],
    enabled: !!projectId,
  });

  // Load active rules count
  useEffect(() => {
    if (projectRules && projectRules.length > 0) {
      setActivePromptRules(projectRules.filter((rule: any) => rule.isActive));
    }
  }, [projectRules]);

  // Smart scroll: Check if user is near bottom
  const checkIfNearBottom = useCallback(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) {
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isUserNearBottomRef.current = distanceFromBottom < 150;
      }
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserNearBottomRef.current = distanceFromBottom < 150;
  }, []);

  // Smart scroll: Listen for scroll events
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') || 
                            messagesEndRef.current?.parentElement;
    if (scrollContainer) {
      const handleScroll = () => {
        lastScrollTimeRef.current = Date.now();
        checkIfNearBottom();
      };
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [checkIfNearBottom]);

  // Smart auto-scroll to bottom only if user is near bottom
  useEffect(() => {
    const timeSinceLastScroll = Date.now() - lastScrollTimeRef.current;
    if (timeSinceLastScroll < 100) return;
    if (!isUserNearBottomRef.current) return;
    
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, [messages, streamingMessage]);

  useEffect(() => {
    // Load chat history
    loadChatHistory();
  }, [projectId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      isUserNearBottomRef.current = true;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, []);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/ai/${projectId}/history`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const generateSuggestions = async () => {
    if (!selectedCode) return;

    try {
      const data = await apiRequest<{ suggestions: CodeSuggestion[] }>('POST', `/api/ai/${projectId}/suggestions`, {
        code: selectedCode,
        file: selectedFile,
        projectId
      });
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  };

  const sendMessage = async (content: string, quickAction?: QuickAction) => {
    if (!content.trim() && !quickAction) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: quickAction ? `${quickAction.prompt} ${content}` : content,
      timestamp: new Date(),
      metadata: {
        fileName: selectedFile,
        language: selectedFile?.split('.').pop()
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await apiRequest<{ id?: string; content: string; timestamp?: string }>('POST', `/api/ai/${projectId}/chat`, {
        message: userMessage.content,
        context: {
          projectId,
          file: selectedFile,
          code: selectedCode,
          history: messages.slice(-20)
        }
      });

      const assistantMessage: Message = {
        id: data.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || '',
        timestamp: new Date(data.timestamp || Date.now()),
        type: quickAction?.id === 'explain' ? 'explanation' : 
               quickAction?.id === 'generate' ? 'code' : 'suggestion'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      
      toast({
        title: "AI service unavailable",
        description: "Unable to connect to AI service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };






  const handleQuickAction = (action: QuickAction) => {
    if (selectedCode) {
      sendMessage(selectedCode, action);
    } else {
      setInput(action.prompt + ' ');
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    try {
      await apiRequest('POST', '/api/ai/feedback', { messageId, feedback });
      
      toast({
        title: "Feedback Recorded",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2 max-w-[80%]`}>
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {isUser ? 'U' : <Bot className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          
          <div className={`rounded-lg p-3 ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            {message.metadata?.fileName && (
              <div className="text-[11px] opacity-70 mb-1">
                {message.metadata.fileName}
              </div>
            )}
            
            <div className="text-[13px] whitespace-pre-wrap">
              {message.content.split(codeBlockRegex).map((part, index) => {
                if (index % 3 === 2) {
                  // This is code content
                  const language = message.content.split(codeBlockRegex)[index - 1] || 'plaintext';
                  return (
                    <div key={index} className="relative my-2">
                      <div className="bg-background rounded p-3 border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-[11px]">
                            {language}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyCode(part)}
                            className="h-6 w-6"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <pre className="text-[11px] overflow-x-auto">
                          <code>{part}</code>
                        </pre>
                      </div>
                    </div>
                  );
                }
                return index % 3 === 0 ? part : null;
              })}
            </div>
            
            {!isUser && (
              <div className="flex items-center space-x-2 mt-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleFeedback(message.id, 'positive')}
                  className="h-6 w-6"
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleFeedback(message.id, 'negative')}
                  className="h-6 w-6"
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isMinimized) {
    return (
      <Button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 rounded-full shadow-lg"
        size="icon"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Card className={`${className} ${isExpanded ? 'w-96' : 'w-80'} transition-all duration-200`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center">
            <Bot className="h-4 w-4 mr-2" />
            AI Assistant
            {activePromptRules.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-[11px]">
                {activePromptRules.length} Rule{activePromptRules.length > 1 ? 's' : ''} Active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCustomPrompts(true)}
              className="h-7 w-7"
              title="Manage Custom Prompts"
            >
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7"
            >
              {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMinimized(true)}
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="chat" className="text-[11px]">Chat</TabsTrigger>
            <TabsTrigger value="suggestions" className="text-[11px]">Suggestions</TabsTrigger>
            <TabsTrigger value="history" className="text-[11px]">History</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-0">
            {/* Quick Actions */}
            <div className="px-3 py-2 border-b">
              <ScrollArea className="w-full">
                <div className="flex space-x-2">
                  {QUICK_ACTIONS.map(action => (
                    <Button
                      key={action.id}
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(action)}
                      className="flex-shrink-0"
                    >
                      {action.icon}
                      <span className="ml-1">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="h-96 px-3 py-3">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-[13px]">Hi! I'm your AI assistant.</p>
                  <p className="text-[11px] mt-1">Ask me anything about your code!</p>
                </div>
              ) : (
                <>
                  {messages.map(message => renderMessage(message))}
                  {streamingMessage && (
                    <div className="flex justify-start mb-4">
                      <div className="flex items-start space-x-2 max-w-[80%]">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg p-3 bg-muted">
                          <div className="text-[13px] whitespace-pre-wrap">
                            {streamingMessage}
                            <span className="inline-block w-2 h-4 ml-1 bg-foreground/50 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex space-x-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your code..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="mt-0">
            <ScrollArea className="h-[480px]">
              <div className="p-4 space-y-3">
                {suggestions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-[13px]">No suggestions yet</p>
                    <p className="text-[11px] mt-1">Select some code to get AI suggestions</p>
                  </div>
                ) : (
                  suggestions.map(suggestion => (
                    <Card key={suggestion.id} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-[13px] font-medium">{suggestion.title}</h4>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {suggestion.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>
                      {suggestion.code && (
                        <div className="mt-2">
                          <pre className="text-[11px] p-2 bg-muted rounded overflow-x-auto">
                            <code>{suggestion.code}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCode(suggestion.code)}
                            className="mt-2"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <ScrollArea className="h-[480px]">
              <div className="p-4">
                <div className="space-y-2">
                  {messages
                    .filter(msg => msg.role === 'user')
                    .reverse()
                    .map(msg => (
                      <Button
                        key={msg.id}
                        variant="ghost"
                        className="w-full justify-start text-left"
                        onClick={() => setInput(msg.content)}
                      >
                        <History className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate text-[13px]">{msg.content}</span>
                      </Button>
                    ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Custom Prompts Modal */}
      <CustomPromptsModal
        projectId={String(projectId)}
        isOpen={showCustomPrompts}
        onClose={() => setShowCustomPrompts(false)}
      />
    </Card>
  );
}