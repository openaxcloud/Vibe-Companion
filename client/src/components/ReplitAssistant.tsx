import { useState, useEffect, useRef } from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { 
  Sparkles, Send, X, Copy, Check, ChevronDown, ChevronUp,
  Code, FileText, HelpCircle, Zap, RefreshCw, Play,
  Terminal, Bug, TestTube, FileCode, MessageSquare,
  Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { LightSyntaxHighlighter, darkStyle } from '@/components/ui/LightSyntaxHighlighter';

interface ReplitAssistantProps {
  projectId: number;
  currentFile?: string;
  selectedCode?: string;
  onApplyCode?: (code: string, fileName?: string) => void;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  isStreaming?: boolean;
  error?: boolean;
}

interface CodeBlock {
  language: string;
  code: string;
  fileName?: string;
  applied?: boolean;
}

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain this', icon: HelpCircle, color: 'text-blue-500' },
  { id: 'fix', label: 'Fix this', icon: Bug, color: 'text-red-500' },
  { id: 'improve', label: 'Improve this', icon: Sparkles, color: 'text-purple-500' },
  { id: 'test', label: 'Write tests', icon: TestTube, color: 'text-green-500' },
  { id: 'refactor', label: 'Refactor', icon: RefreshCw, color: 'text-orange-500' }
];

export function ReplitAssistant({ 
  projectId, 
  currentFile, 
  selectedCode,
  onApplyCode,
  className 
}: ReplitAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'system',
      content: 'Hi! I\'m your AI assistant powered by Claude. I can help you understand, debug, and improve your code. Select some code or ask me anything!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const extractCodeBlocks = (content: string): CodeBlock[] => {
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
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

  const sendMessage = async (content: string, quickAction?: string) => {
    if (!content.trim() && !quickAction) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: quickAction ? `${quickAction}: ${content}` : content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context
      const context: any = {
        mode: 'assistant',
        file: currentFile,
        selectedCode: selectedCode || content
      };

      // Use Claude (Anthropic) as the provider
      const response = await apiRequest('POST', `/api/ai/${projectId}/chat`, {
        message: userMessage.content,
        context,
        provider: 'anthropic' // Force Claude
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || data.response || '',
        timestamp: new Date(),
        codeBlocks: extractCodeBlocks(data.content || data.response || '')
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Assistant error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error while processing your request. Please make sure the Anthropic API key is configured in the Secrets tab.',
        timestamp: new Date(),
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: 'Assistant Error',
        description: 'Failed to get AI response. Check your API keys.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    if (selectedCode) {
      const action = QUICK_ACTIONS.find(a => a.id === actionId);
      sendMessage(selectedCode, action?.label);
    } else {
      toast({
        title: 'Select Code First',
        description: 'Please select some code to use this action.',
        variant: 'destructive'
      });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    
    toast({
      title: 'Copied!',
      description: 'Code copied to clipboard.'
    });
  };

  const applyCode = (code: string, fileName?: string) => {
    if (onApplyCode) {
      onApplyCode(code, fileName || currentFile);
      toast({
        title: 'Code Applied',
        description: fileName ? `Applied to ${fileName}` : 'Code applied successfully.'
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)]", className)}>
      {/* Header */}
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <div>
            <span className="text-xs font-medium text-[var(--ecode-text)]">AI Assistant</span>
          </div>
        </div>
        {currentFile && (
          <Badge variant="secondary" className="text-[10px] h-5">
            {currentFile}
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      {selectedCode && (
        <div className="px-4 py-2 border-b border-[var(--ecode-border)]">
          <p className="text-[11px] text-[var(--ecode-text-secondary)] mb-2">Quick actions for selected code:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(action => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.id)}
                className="text-[11px]"
                disabled={isLoading}
              >
                <action.icon className={cn("h-3 w-3 mr-1", action.color)} />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.map((message) => (
            <LazyMotionDiv
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' && "flex-row-reverse"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                message.role === 'user' 
                  ? "bg-[var(--ecode-accent)] text-white"
                  : message.role === 'system'
                  ? "bg-gradient-to-br from-purple-500 to-blue-600"
                  : "bg-gradient-to-br from-orange-500 to-pink-600"
              )}>
                {message.role === 'user' ? (
                  <span className="text-[11px] font-bold">U</span>
                ) : message.role === 'system' ? (
                  <MessageSquare className="h-4 w-4 text-white" />
                ) : (
                  <Sparkles className="h-4 w-4 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div className={cn(
                "flex-1 rounded-lg p-3",
                message.role === 'user' 
                  ? "bg-[var(--ecode-accent)] text-white"
                  : "bg-[var(--ecode-bg-primary)] border border-[var(--ecode-border)]",
                message.error && "border-red-500/50"
              )}>
                {message.isStreaming ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[13px]">Thinking...</span>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const language = match ? match[1] : '';
                          
                          if (node && node.position && language) {
                            const code = String(children).replace(/\n$/, '');
                            const codeBlock = message.codeBlocks?.find(
                              block => block.code === code
                            );
                            
                            return (
                              <div className="relative group my-2">
                                <div className="flex items-center justify-between bg-[var(--ecode-bg-secondary)] rounded-t-md px-3 py-1 border border-[var(--ecode-border)] border-b-0">
                                  <span className="text-[11px] text-[var(--ecode-text-secondary)]">
                                    {language}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyCode(code)}
                                      className="h-6 px-2"
                                    >
                                      {copiedCode === code ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                    {onApplyCode && message.role === 'assistant' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => applyCode(code, codeBlock?.fileName)}
                                        className="h-6 px-2"
                                      >
                                        <Play className="h-3 w-3 mr-1" />
                                        Apply
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <LightSyntaxHighlighter
                                  language={language}
                                  style={darkStyle}
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: '0 0 0.375rem 0.375rem',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {code}
                                </LightSyntaxHighlighter>
                              </div>
                            );
                          }
                          
                          return (
                            <code className={cn(
                              "px-1 py-0.5 rounded text-[11px]",
                              message.role === 'user'
                                ? "bg-white/20 text-white"
                                : "bg-[var(--ecode-bg-secondary)] text-[var(--ecode-accent)]"
                            )} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.error && (
                    <span className="text-[11px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  )}
                </div>
              </div>
            </LazyMotionDiv>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-[var(--ecode-border)] p-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedCode ? "Ask about the selected code..." : "Ask me anything..."}
            className="min-h-[40px] max-h-[120px] pr-12 resize-none"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-2 right-2 h-8 w-8 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-[var(--ecode-text-secondary)] mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}