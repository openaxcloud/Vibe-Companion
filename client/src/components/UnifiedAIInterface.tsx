import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Send,
  Code,
  FileText,
  Terminal,
  Zap,
  Brain,
  Sparkles,
  Settings,
  History,
  Copy,
  Download,
  Share,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  FileCode,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedAIInterfaceProps {
  projectId: number;
  currentFile?: string;
  selectedCode?: string;
  onApplyCode?: (code: string) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
  effort?: number;
}

export function UnifiedAIInterface({
  projectId,
  currentFile,
  selectedCode,
  onApplyCode,
}: UnifiedAIInterfaceProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"agent" | "assistant" | "advanced">("agent");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [autoRun, setAutoRun] = useState(true);
  const [showEffortPricing, setShowEffortPricing] = useState(false);
  const [totalEffort, setTotalEffort] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load agent prompt if available
  useEffect(() => {
    const storedPrompt = window.sessionStorage.getItem(
      `agent-prompt-${projectId}`,
    );
    if (storedPrompt) {
      setInput(storedPrompt);
      window.sessionStorage.removeItem(`agent-prompt-${projectId}`);
      // Auto-send if in agent mode
      if (mode === "agent" && storedPrompt) {
        handleSend();
      }
    }
  }, [projectId, mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: userMessage.content,
          projectId,
          model,
          provider: model.includes("claude") ? "anthropic" : 
                   model.includes("gpt") ? "openai" : 
                   model.includes("gemini") ? "gemini" : 
                   model.includes("grok") ? "xai" : "openai",
          context: selectedCode ? [{ type: "code", content: selectedCode, file: currentFile }] : [],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let tokenCount: number | undefined;
      const messageId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          model,
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                accumulatedContent += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              }
              
              if (data.totalTokens !== undefined) {
                tokenCount = data.totalTokens;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, tokens: tokenCount }
                      : msg
                  )
                );
                if (mode === "agent") {
                  setTotalEffort((prev) => prev + (tokenCount || 0));
                }
              }
            } catch {
            }
          }
        }
      }

      setIsLoading(false);

      if (
        userMessage.content.toLowerCase().includes("preview") ||
        userMessage.content.toLowerCase().includes("show") ||
        userMessage.content.toLowerCase().includes("display")
      ) {
        window.postMessage({ type: "show-preview" }, "*");
      }

      if (autoRun && mode === "agent") {
        toast({
          title: "Running project",
          description:
            "Your changes are being applied and the project is running",
        });
      }
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const handleApplyCodeFromMessage = (content: string) => {
    // Extract code from message
    const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeMatch && onApplyCode) {
      onApplyCode(codeMatch[1]);
      toast({
        title: "Code applied",
        description: "The code has been applied to your file",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">AI Assistant</span>
          <Badge variant="secondary" className="text-[10px] h-5">
            Claude 4.0
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as any)}
            className="w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 h-6">
              <TabsTrigger value="agent" className="text-[10px] px-2">
                Agent
              </TabsTrigger>
              <TabsTrigger value="assistant" className="text-[10px] px-2">
                Assistant
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-[10px] px-2">
                Advanced
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Settings Bar */}
      {(mode === "advanced" || mode === "agent") && (
        <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-sidebar-hover)]">
          <div className="flex items-center gap-4">
            {mode === "advanced" && (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                  <SelectItem value="claude-sonnet-4-20250514">
                    Claude Sonnet 4
                  </SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                  <SelectItem value="grok-3">Grok 3</SelectItem>
                </SelectContent>
              </Select>
            )}

            {mode === "agent" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-run"
                  checked={autoRun}
                  onCheckedChange={setAutoRun}
                />
                <Label htmlFor="auto-run" className="text-[13px]">
                  Auto-run
                </Label>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEffortPricing(!showEffortPricing)}
            >
              <Zap className="h-4 w-4 mr-1" />
              {totalEffort} effort
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-[15px] font-medium mb-2">
                {mode === "agent"
                  ? "AI Agent Ready"
                  : mode === "assistant"
                    ? "AI Assistant Ready"
                    : "Advanced AI Ready"}
              </p>
              <p className="text-[13px]">
                {mode === "agent"
                  ? "Describe what you want to build and I'll create it for you"
                  : mode === "assistant"
                    ? "Select code or ask questions about your project"
                    : "Use advanced AI models for complex tasks"}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-4",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {message.role === "assistant" && (
                      <Bot className="h-4 w-4" />
                    )}
                    <span className="text-[11px] opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                    {message.model && (
                      <Badge variant="secondary" className="text-[11px]">
                        {message.model}
                      </Badge>
                    )}
                    {message.effort && (
                      <Badge variant="outline" className="text-[11px]">
                        {message.effort} effort
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyMessage(message.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {message.role === "assistant" &&
                      message.content.includes("```") &&
                      onApplyCode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleApplyCodeFromMessage(message.content)
                          }
                        >
                          <FileCode className="h-3 w-3" />
                        </Button>
                      )}
                  </div>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">AI is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Effort Pricing Display */}
      {showEffortPricing && totalEffort > 0 && (
        <div className="p-3 border-t bg-muted/50">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Total effort used:</span>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{totalEffort} effort points</span>
              <span className="text-muted-foreground">
                (${(totalEffort * 0.001).toFixed(3)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        {currentFile && mode === "assistant" && (
          <div className="flex items-center gap-2 mb-2 text-[13px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>Working on: {currentFile}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              mode === "agent"
                ? "Describe what you want to build..."
                : mode === "assistant"
                  ? "Ask about your code or select code to analyze..."
                  : "Enter your advanced query..."
            }
            className="min-h-[60px] resize-none"
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setMessages([]);
                  setTotalEffort(0);
                }}
                title="Clear chat"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
