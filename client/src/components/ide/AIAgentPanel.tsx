import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Bot, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
  };
}

interface AIAgentPanelProps {
  projectId: string;
  onFileCreate?: (path: string, content: string) => void;
}

export function AIAgentPanel({ projectId, onFileCreate }: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial-1',
      role: 'assistant',
      content: 'Hello! I\'m your AI coding assistant. I can help you write code, debug issues, and answer questions about your project. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Auto-resize textarea based on content (max 200px)
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);
  
  // Resize on input change
  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);
  
  // Load conversation history if exists
  const { data: conversation } = useQuery({
    queryKey: [`/api/agent/conversation/${projectId}`],
    enabled: !!projectId,
    retry: false
  });
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      setIsStreaming(true);
      
      // Add user message
      const userMessage: Message = { 
        id: `user-${Date.now()}`,
        role: 'user', 
        content: message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Call AI endpoint
      const data = await apiRequest('POST', '/api/agent/chat', {
        projectId,
        message,
        conversationHistory: messages
      });
      
      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.response || 'Sorry, I couldn\'t process that request.',
        timestamp: new Date(),
        metadata: data.metadata
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Handle file creation if AI wants to create files
      if (data.fileCreated && onFileCreate) {
        onFileCreate(data.filePath, data.fileContent);
        toast({
          title: 'File created',
          description: `Created ${data.filePath}`
        });
        
        // Invalidate files cache
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      }
      
      return data;
    },
    onSuccess: () => {
      setIsStreaming(false);
      setInput('');
    },
    onError: (error: any) => {
      setIsStreaming(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive'
      });
      
      // Remove last user message on error
      setMessages(prev => prev.slice(0, -1));
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    sendMutation.mutate(input);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)] flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          AI Assistant
        </h3>
        {isStreaming && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ecode-text-muted)]" />
        )}
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
              data-testid={`message-${message.role}-${message.id}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={cn(
                  "rounded-lg px-4 py-2 max-w-[80%]",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-[13px] whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {message.role === 'user' && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isStreaming && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-2 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isStreaming}
            data-testid="input-agent-message"
            rows={1}
            className={cn(
              "flex-1 resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-[13px] ring-offset-background",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "min-h-[40px] max-h-[200px]"
            )}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || isStreaming}
            data-testid="button-send-message"
            size="icon"
            className="shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
