import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Send, Loader2, Bot, User, Copy, Check, X, Sparkles, Trash2,
  FileCode, FilePlus, FileEdit, ChevronDown, Zap, MessageSquare,
  FileDown, FileUp
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FileInfo = { id: string; filename: string; content: string };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  fileOps?: { type: "created" | "updated"; filename: string }[];
}

interface AIPanelProps {
  context?: { language: string; filename: string; code: string };
  onClose: () => void;
  projectId?: string;
  files?: FileInfo[];
  onFileCreated?: (file: FileInfo) => void;
  onFileUpdated?: (file: FileInfo) => void;
  onApplyCode?: (filename: string, code: string) => void;
}

type AIModel = "claude" | "gpt";
type AIMode = "chat" | "agent";

const MODEL_LABELS: Record<AIModel, { name: string; badge: string; color: string }> = {
  claude: { name: "Claude Sonnet", badge: "Anthropic", color: "text-purple-400 bg-purple-400/10" },
  gpt: { name: "GPT-5.2", badge: "OpenAI", color: "text-green-400 bg-green-400/10" },
};

export default function AIPanel({ context, onClose, projectId, files, onFileCreated, onFileUpdated, onApplyCode }: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [model, setModel] = useState<AIModel>("claude");
  const [mode, setMode] = useState<AIMode>(projectId ? "agent" : "chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const processSSEStream = useCallback(async (
    response: Response,
    assistantId: string,
    isAgent: boolean
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No stream");

    const decoder = new TextDecoder();
    let buffer = "";
    const fileOps: { type: "created" | "updated"; filename: string }[] = [];

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

          if (isAgent) {
            if (data.type === "text") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
              );
            } else if (data.type === "tool_use") {
              const opLabel = data.name === "create_file" ? "Creating" : "Editing";
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  content: m.content + `\n\n> ${opLabel} \`${data.input.filename}\`...\n`
                } : m)
              );
            } else if (data.type === "file_created") {
              fileOps.push({ type: "created", filename: data.file.filename });
              onFileCreated?.(data.file);
            } else if (data.type === "file_updated") {
              fileOps.push({ type: "updated", filename: data.file.filename });
              onFileUpdated?.(data.file);
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + `\n\nError: ${data.message}` } : m)
              );
            }
          } else {
            if (data.content) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
              );
            }
          }
        } catch {}
      }
    }

    if (fileOps.length > 0) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, fileOps } : m)
      );
    }
  }, [onFileCreated, onFileUpdated]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const isAgent = mode === "agent" && !!projectId;
      const endpoint = isAgent ? "/api/ai/agent" : "/api/ai/chat";

      const body: any = {
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        model,
      };

      if (isAgent) {
        body.projectId = projectId;
      } else {
        body.context = context;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("AI request failed");

      await processSSEStream(res, assistantId, isAgent);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, the AI service is temporarily unavailable. Please try again." } : m)
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
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

  const [appliedBlocks, setAppliedBlocks] = useState<Set<string>>(new Set());

  const applyCodeToFile = async (code: string, targetFilename: string, blockKey: string) => {
    if (onApplyCode) {
      onApplyCode(targetFilename, code);
      setAppliedBlocks((prev) => new Set(prev).add(blockKey));
      setTimeout(() => setAppliedBlocks((prev) => { const next = new Set(prev); next.delete(blockKey); return next; }), 2000);
    }
  };

  const guessTargetFile = (lang: string, code: string): string | null => {
    const commentMatch = code.match(/^\/\/\s*(\S+\.\w+)/m) || code.match(/^#\s*(\S+\.\w+)/m);
    if (commentMatch) return commentMatch[1];
    if (context?.filename) return context.filename;
    if (files && files.length === 1) return files[0].filename;
    return null;
  };

  const renderContent = (content: string, fileOps?: { type: "created" | "updated"; filename: string }[]) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0] || "";
        const code = lines.slice(1).join("\n");
        const blockKey = `${content.slice(0, 20)}-block-${i}`;
        const targetFile = guessTargetFile(lang, code);
        const isApplied = appliedBlocks.has(blockKey);
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[#30363d]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] text-[10px] text-[#8b949e]">
              <div className="flex items-center gap-2">
                <FileCode className="w-3 h-3" />
                <span className="font-medium">{lang}</span>
              </div>
              <div className="flex items-center gap-2">
                {mode === "chat" && targetFile && onApplyCode && (
                  <button
                    onClick={() => applyCodeToFile(code, targetFile, blockKey)}
                    className={`flex items-center gap-1 transition-colors ${isApplied ? "text-green-400" : "text-[#58a6ff] hover:text-white"}`}
                    data-testid={`button-apply-code-${i}`}
                  >
                    {isApplied ? <><Check className="w-3 h-3" /> Applied</> : <><FileDown className="w-3 h-3" /> Apply</>}
                  </button>
                )}
                <button onClick={() => copyCode(code)} className="flex items-center gap-1 hover:text-white transition-colors" data-testid="button-copy-code">
                  {copied === code ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
            </div>
            <pre className="p-3 bg-[#0d1117] text-[12px] overflow-x-auto text-[#c9d1d9] leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      if (part.match(/^>\s/m)) {
        return part.split("\n").map((line, j) => {
          if (line.startsWith("> ")) {
            const text = line.slice(2);
            const isCreating = text.includes("Creating");
            return (
              <div key={`${i}-${j}`} className="flex items-center gap-2 my-1 px-2 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-[11px]">
                {isCreating ? <FilePlus className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <FileEdit className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                <span className="text-[#c9d1d9]">{text}</span>
              </div>
            );
          }
          return <span key={`${i}-${j}`} className="whitespace-pre-wrap">{line}{"\n"}</span>;
        });
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });

    if (fileOps && fileOps.length > 0) {
      rendered.push(
        <div key="file-ops-summary" className="mt-3 p-2.5 rounded-lg bg-green-600/10 border border-green-600/20">
          <div className="text-[10px] font-semibold text-green-400 uppercase mb-1.5">Files Modified</div>
          {fileOps.map((op, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-[#c9d1d9] py-0.5">
              {op.type === "created" ? <FilePlus className="w-3 h-3 text-green-400" /> : <FileEdit className="w-3 h-3 text-blue-400" />}
              <span className="font-mono">{op.filename}</span>
              <span className="text-[9px] text-[#8b949e]">{op.type}</span>
            </div>
          ))}
        </div>
      );
    }

    return rendered;
  };

  const modelInfo = MODEL_LABELS[model];

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">AI</span>
            {mode === "agent" ? (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${modelInfo.color}`} title="Agent mode uses Claude for tool capabilities" data-testid="button-model-select">
                Claude Sonnet
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${modelInfo.color} hover:opacity-80 transition-opacity`} data-testid="button-model-select">
                    {modelInfo.name} <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 bg-[#1c2128] border-[#30363d]">
                  <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setModel("claude")} data-testid="model-claude">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Claude Sonnet
                    {model === "claude" && <Check className="w-3 h-3 ml-auto text-green-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setModel("gpt")} data-testid="model-gpt">
                    <Zap className="w-3.5 h-3.5 text-green-400" /> GPT-5.2
                    {model === "gpt" && <Check className="w-3 h-3 ml-auto text-green-400" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {projectId && (
            <div className="flex items-center mr-1 bg-[#30363d]/50 rounded-md p-0.5">
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${mode === "chat" ? "bg-[#30363d] text-white" : "text-[#8b949e] hover:text-white"}`}
                onClick={() => setMode("chat")}
                data-testid="mode-chat"
              >
                <MessageSquare className="w-3 h-3" /> Chat
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${mode === "agent" ? "bg-purple-600/30 text-purple-400" : "text-[#8b949e] hover:text-white"}`}
                onClick={() => { setMode("agent"); setModel("claude"); }}
                data-testid="mode-agent"
              >
                <Bot className="w-3 h-3" /> Agent
              </button>
            </div>
          )}
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

      {context && mode === "chat" && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#30363d] bg-[#161b22]/50 text-[10px] text-[#8b949e] shrink-0">
          <FileCode className="w-3 h-3 text-[#484f58]" />
          <span className="px-1.5 py-0.5 rounded bg-[#30363d] text-[#c9d1d9] font-mono">{context.filename}</span>
          <span className="text-[#484f58]">{context.language}</span>
        </div>
      )}

      {mode === "agent" && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#30363d] bg-purple-600/5 text-[10px] text-purple-400 shrink-0">
          <Bot className="w-3 h-3" />
          <span>Agent mode — AI can create and edit files in your project</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 flex items-center justify-center mb-4 border border-purple-600/20">
              {mode === "agent" ? <Bot className="w-8 h-8 text-purple-400/60" /> : <Sparkles className="w-8 h-8 text-purple-400/60" />}
            </div>
            <p className="text-base font-semibold text-white mb-2">
              {mode === "agent" ? "AI Coding Agent" : "AI Assistant"}
            </p>
            <p className="text-xs text-[#8b949e] max-w-[280px] leading-relaxed mb-6">
              {mode === "agent"
                ? "I can build features, create files, and edit your code directly. Describe what you want to build."
                : "I can help you write code, debug issues, explain concepts, and suggest improvements."}
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
              {(mode === "agent" ? [
                "Build a login form with validation",
                "Add a REST API endpoint",
                "Create a utility functions file",
                "Refactor this code for performance",
              ] : [
                "Explain this code",
                "Find bugs and fix them",
                "Add error handling",
                "Optimize performance",
              ]).map((suggestion) => (
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
              {msg.content ? renderContent(msg.content, msg.fileOps) : (
                <span className="flex items-center gap-2 text-[#8b949e]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {mode === "agent" ? "Working..." : "Thinking..."}
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
            placeholder={mode === "agent" ? "Tell the agent what to build..." : "Ask anything about your code..."}
            rows={1}
            className="flex-1 bg-[#0d1117] border border-[#30363d] text-sm text-[#c9d1d9] rounded-lg px-3 py-2 resize-none placeholder:text-[#484f58] focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 min-h-[36px] max-h-[120px]"
            disabled={isStreaming}
            data-testid="input-ai-chat"
          />
          {isStreaming ? (
            <Button
              onClick={stopStreaming}
              size="icon"
              className="w-9 h-9 bg-red-600 hover:bg-red-700 rounded-lg shrink-0"
              data-testid="button-ai-stop"
            >
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              size="icon"
              className="w-9 h-9 bg-purple-600 hover:bg-purple-700 rounded-lg shrink-0"
              disabled={!input.trim()}
              data-testid="button-ai-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
