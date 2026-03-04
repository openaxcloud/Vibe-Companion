import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User, Copy, Check, X, Sparkles, Trash2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AIPanelProps {
  context?: { language: string; filename: string; code: string };
  onClose: () => void;
}

export default function AIPanel({ context, onClose }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!res.ok) throw new Error("AI request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, AI service is temporarily unavailable." } : m)
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0] || "";
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[#30363d]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] text-[10px] text-[#8b949e]">
              <span className="font-medium">{lang}</span>
              <button onClick={() => copyCode(code)} className="flex items-center gap-1 hover:text-white transition-colors">
                {copied === code ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
            <pre className="p-3 bg-[#0d1117] text-[12px] overflow-x-auto text-[#c9d1d9] leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">AI Agent</span>
            <span className="ml-2 text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded" data-testid="text-ai-model">Claude Sonnet</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setMessages([])} title="Clear chat" data-testid="button-clear-chat">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={onClose} data-testid="button-close-ai">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {context && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#30363d] bg-[#161b22]/50 text-[10px] text-[#8b949e] shrink-0">
          <span className="text-[#484f58]">Context:</span>
          <span className="px-1.5 py-0.5 rounded bg-[#30363d] text-[#c9d1d9] font-mono">{context.filename}</span>
          <span className="text-[#484f58]">({context.language})</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 flex items-center justify-center mb-4 border border-purple-600/20">
              <Bot className="w-8 h-8 text-purple-400/60" />
            </div>
            <p className="text-base font-semibold text-white mb-2">AI Coding Agent</p>
            <p className="text-xs text-[#8b949e] max-w-[280px] leading-relaxed mb-6">
              I can help you write code, debug issues, explain concepts, and generate solutions. I have context of your current file.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
              {[
                "Explain this code",
                "Find bugs and fix them",
                "Add error handling",
                "Write unit tests",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="text-left px-3 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-[#8b949e] hover:text-white hover:border-[#484f58] transition-colors"
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  data-testid={`suggestion-${suggestion.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "assistant" ? "bg-purple-600/20" : "bg-[#58a6ff]/20"
            }`}>
              {msg.role === "assistant" ? <Bot className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-[#58a6ff]" />}
            </div>
            <div className={`max-w-[85%] rounded-lg px-3 py-2.5 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "bg-[#58a6ff]/15 text-[#c9d1d9] border border-[#58a6ff]/20"
                : "bg-[#161b22] text-[#c9d1d9] border border-[#30363d]"
            }`}>
              {msg.content ? renderContent(msg.content) : (
                <span className="flex items-center gap-2 text-[#8b949e]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your code..."
            rows={1}
            className="flex-1 bg-[#0d1117] border border-[#30363d] text-sm text-[#c9d1d9] rounded-lg px-3 py-2 resize-none placeholder:text-[#484f58] focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 min-h-[36px] max-h-[120px]"
            disabled={isStreaming}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            data-testid="input-ai-chat"
          />
          <Button
            onClick={sendMessage}
            size="icon"
            className="w-9 h-9 bg-purple-600 hover:bg-purple-700 rounded-lg shrink-0"
            disabled={isStreaming || !input.trim()}
            data-testid="button-ai-send"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
