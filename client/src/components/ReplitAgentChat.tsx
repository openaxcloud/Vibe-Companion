import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Sparkles, 
  Code2, 
  User, 
  Copy, 
  Check, 
  RefreshCw,
  X,
  ChevronDown,
  Bot,
  Loader2,
  FileCode,
  Play,
  Plus
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  isLoading?: boolean;
}

interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

interface ReplitAgentChatProps {
  projectId: number;
  currentFile?: {
    name: string;
    content: string;
    language: string;
  };
  onApplyCode?: (code: string, filename?: string) => void;
  onRunCode?: () => void;
}

export const ReplitAgentChat: React.FC<ReplitAgentChatProps> = ({
  projectId,
  currentFile,
  onApplyCode,
  onRunCode
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI agent. I can help you write code, debug issues, explain concepts, and more. What would you like to work on today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/ai/chat`, {
        message,
        context: currentFile ? {
          filename: currentFile.name,
          content: currentFile.content,
          language: currentFile.language
        } : undefined
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Update the loading message with the actual response
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? {
          ...msg,
          content: data.response,
          codeBlocks: extractCodeBlocks(data.response),
          isLoading: false
        } : msg
      ));
    },
    onError: (error: Error) => {
      // Remove the loading message on error
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Extract code blocks from markdown content
  const extractCodeBlocks = (content: string): CodeBlock[] => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'plaintext',
        code: match[2].trim()
      });
    }

    return blocks;
  };

  // Handle sending a message
  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    
    chatMutation.mutate(input.trim());
  };

  // Handle copying code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Code copied",
      description: "The code has been copied to your clipboard.",
    });

    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: 'Explain this code', icon: FileCode },
    { label: 'Find bugs', icon: Bot },
    { label: 'Add comments', icon: Code2 },
    { label: 'Improve performance', icon: RefreshCw },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <h2 className="font-medium">AI Agent</h2>
          <Badge variant="secondary" className="text-xs">GPT-4</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        </Button>
      </div>

      {/* Quick Actions */}
      {currentFile && messages.length === 1 && (
        <div className="p-4 border-b">
          <p className="text-sm text-muted-foreground mb-2">Quick actions for {currentFile.name}:</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setInput(action.label)}
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === 'user' && "flex-row-reverse")}>
              <Avatar className="h-8 w-8 shrink-0">
                {message.role === 'assistant' ? (
                  <>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </>
                ) : (
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
              
              <div className={cn("flex-1 space-y-2", message.role === 'user' && "items-end")}>
                <Card className={cn(
                  "p-3",
                  message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {message.content.replace(/```[\s\S]*?```/g, '')}
                      </Markdown>
                    </div>
                  )}
                </Card>
                
                {/* Code blocks */}
                {message.codeBlocks && message.codeBlocks.map((block, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="bg-muted px-3 py-2 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <Code2 className="h-3 w-3" />
                        <span className="text-xs font-mono">{block.language}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyCode(block.code)}
                        >
                          {copiedCode === block.code ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        {onApplyCode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => onApplyCode(block.code, block.filename)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Apply
                          </Button>
                        )}
                      </div>
                    </div>
                    <SyntaxHighlighter
                      language={block.language}
                      style={oneDark}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.75rem',
                        background: 'transparent'
                      }}
                    >
                      {block.code}
                    </SyntaxHighlighter>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your code..."
            className="flex-1 min-h-[80px] resize-none"
            disabled={chatMutation.isPending}
          />
          <div className="flex flex-col gap-2">
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {onRunCode && (
              <Button
                size="icon"
                variant="outline"
                onClick={onRunCode}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Ctrl+Enter to send • Powered by GPT-4
        </p>
      </div>
    </div>
  );
};