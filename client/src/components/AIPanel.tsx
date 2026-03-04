import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Bot, User, Copy, Check, X, Sparkles } from "lucide-react";

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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0] || "";
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[#30363d]">
            <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] text-[10px] text-[#8b949e]">
              <span>{lang}</span>
              <button onClick={() => copyCode(code)} className="flex items-center gap-1 hover:text-white">
                {copied === code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="p-3 bg-[#0d1117] text-[12px] overflow-x-auto text-[#c9d1d9]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-l border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-[#c9d1d9]">AI Assistant</span>
          <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded" data-testid="text-ai-model">Claude Sonnet</span>
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-[#30363d] mb-3" />
            <p className="text-sm text-[#8b949e] mb-1">AI Coding Assistant</p>
            <p className="text-xs text-[#484f58] max-w-[200px]">Ask me anything about your code. I have context of your current file.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-md bg-purple-600/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-[#58a6ff]/20 text-[#c9d1d9] border border-[#58a6ff]/30"
                : "bg-[#161b22] text-[#c9d1d9] border border-[#30363d]"
            }`}>
              {msg.content ? renderContent(msg.content) : (
                <span className="flex items-center gap-1 text-[#8b949e]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                </span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-md bg-[#58a6ff]/20 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-[#58a6ff]" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[#30363d] shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your code..."
            className="flex-1 bg-[#0d1117] border-[#30363d] h-8 text-xs text-[#c9d1d9] rounded-md placeholder:text-[#484f58]"
            disabled={isStreaming}
            data-testid="input-ai-chat"
          />
          <Button type="submit" size="icon" className="w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-md shrink-0" disabled={isStreaming || !input.trim()} data-testid="button-ai-send">
            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
