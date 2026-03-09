import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Send, Bot, User, Copy, Check, X, Sparkles, Trash2,
  FileCode, FilePlus, FileEdit, ChevronDown, Zap, MessageSquare,
  FileDown, Code2, Bug, Lightbulb, Gauge, Wrench, Layout, Database, Shield
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FileInfo = { id: string; filename: string; content: string };

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: AIModel;
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

type AIModel = "claude" | "gpt" | "gemini";
type AIMode = "chat" | "agent";

const MODEL_LABELS: Record<AIModel, { name: string; badge: string; color: string; icon: typeof Sparkles }> = {
  claude: { name: "Claude Sonnet", badge: "Anthropic", color: "text-[#7C65CB] bg-[#7C65CB]/10", icon: Sparkles },
  gpt: { name: "GPT-4o", badge: "OpenAI", color: "text-[#0CCE6B] bg-[#0CCE6B]/10", icon: Zap },
  gemini: { name: "Gemini Flash", badge: "Google", color: "text-[#4285F4] bg-[#4285F4]/10", icon: Zap },
};

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  typescript: { bg: "bg-blue-500/20", text: "text-blue-400" },
  ts: { bg: "bg-blue-500/20", text: "text-blue-400" },
  tsx: { bg: "bg-blue-500/20", text: "text-blue-400" },
  javascript: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  js: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  jsx: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  python: { bg: "bg-green-500/20", text: "text-green-400" },
  py: { bg: "bg-green-500/20", text: "text-green-400" },
  css: { bg: "bg-pink-500/20", text: "text-pink-400" },
  html: { bg: "bg-orange-500/20", text: "text-orange-400" },
  json: { bg: "bg-amber-500/20", text: "text-amber-400" },
  sql: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  bash: { bg: "bg-gray-500/20", text: "text-gray-400" },
  sh: { bg: "bg-gray-500/20", text: "text-gray-400" },
  rust: { bg: "bg-orange-600/20", text: "text-orange-500" },
  go: { bg: "bg-cyan-600/20", text: "text-cyan-400" },
  java: { bg: "bg-red-500/20", text: "text-red-400" },
};

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-[#9DA2B0] py-1">
      <span className="flex items-center gap-[3px]">
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_infinite]" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_0.2s_infinite]" style={{ animationDelay: "0.2s" }} />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_0.4s_infinite]" style={{ animationDelay: "0.4s" }} />
      </span>
      <span className="text-[11px] ml-1"> Thinking...</span>
    </span>
  );
}

function FileOpProgress({ ops }: { ops: { type: "created" | "updated"; filename: string }[] }) {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-[#0CCE6B]/20">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0CCE6B]/5 border-b border-[#0CCE6B]/20">
        <div className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />
        <span className="text-[10px] font-semibold text-[#0CCE6B] uppercase tracking-wider">Files Modified</span>
        <span className="text-[10px] text-[#0CCE6B]/60 ml-auto">{ops.length} file{ops.length > 1 ? "s" : ""}</span>
      </div>
      <div className="bg-[#0CCE6B]/5 p-2">
        {ops.map((op, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-[#F5F9FC] py-1 px-1">
            <div className={`w-5 h-5 rounded flex items-center justify-center ${op.type === "created" ? "bg-[#0CCE6B]/15" : "bg-[#0079F2]/15"}`}>
              {op.type === "created" ? <FilePlus className="w-3 h-3 text-[#0CCE6B]" /> : <FileEdit className="w-3 h-3 text-[#0079F2]" />}
            </div>
            <span className="font-mono text-[11px]">{op.filename}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${op.type === "created" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" : "bg-[#0079F2]/10 text-[#0079F2]"}`}>
              {op.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

class AIPanelErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1C2333] p-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
            <Bug className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#F5F9FC] mb-1" data-testid="text-ai-error-title">AI Panel Error</h3>
          <p className="text-xs text-[#676D7E] mb-4 text-center max-w-[260px]">
            {this.state.error?.message || "Something went wrong in the AI panel."}
          </p>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-xs font-medium transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
              data-testid="button-ai-retry"
            >
              Try Again
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-[#2B3245] hover:bg-[#323B4F] text-[#9DA2B0] text-xs font-medium transition-colors"
              onClick={this.props.onClose}
              data-testid="button-ai-close-error"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AIPanelInner({ context, onClose, projectId, files, onFileCreated, onFileUpdated, onApplyCode }: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [model, setModel] = useState<AIModel>("gpt");
  const [mode, setMode] = useState<AIMode>(projectId ? "agent" : "chat");
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

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
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", model }]);

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
        setLastFailedInput(userMsg.content);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: "⚠️ Connection error — the AI service is temporarily unavailable." } : m)
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

  const retryLastMessage = () => {
    if (!lastFailedInput) return;
    const retryInput = lastFailedInput;
    setLastFailedInput(null);
    setMessages((prev) => {
      const cleaned = prev.slice(0, -2);
      const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: retryInput };
      const assistantId = (Date.now() + 1).toString();
      const updatedMessages = [...cleaned, userMsg, { id: assistantId, role: "assistant" as const, content: "", model }];
      setIsStreaming(true);
      abortRef.current = new AbortController();
      const isAgent = mode === "agent" && !!projectId;
      const endpoint = isAgent ? "/api/ai/agent" : "/api/ai/chat";
      const body: any = { messages: [...cleaned, userMsg].map((m) => ({ role: m.role, content: m.content })), model };
      if (isAgent) body.projectId = projectId; else body.context = context;
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body), signal: abortRef.current.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error("AI request failed");
          await processSSEStream(res, assistantId, isAgent);
        })
        .catch((err: any) => {
          if (err.name !== "AbortError") {
            setLastFailedInput(retryInput);
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "⚠️ Connection error — the AI service is temporarily unavailable." } : m));
          }
        })
        .finally(() => { setIsStreaming(false); abortRef.current = null; });
      return updatedMessages;
    });
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

  const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;
    let tokenKey = 0;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(<span key={tokenKey++}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[2]) {
        tokens.push(<strong key={tokenKey++} className="font-semibold text-[#F5F9FC]">{match[2]}</strong>);
      } else if (match[3]) {
        tokens.push(<em key={tokenKey++} className="italic text-[#CFD7E6]">{match[3]}</em>);
      } else if (match[4]) {
        tokens.push(
          <code key={tokenKey++} className="bg-[#0E1525] px-1.5 py-0.5 rounded text-[#FF9940] font-mono text-[12px]">
            {match[4]}
          </code>
        );
      } else if (match[5] && match[6]) {
        tokens.push(
          <a key={tokenKey++} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-[#0079F2] underline hover:text-[#3399FF] transition-colors">
            {match[5]}
          </a>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      tokens.push(<span key={tokenKey++}>{text.slice(lastIndex)}</span>);
    }

    return tokens.length > 0 ? tokens : [<span key={0}>{text}</span>];
  };

  const renderMarkdownText = (text: string): React.ReactNode[] => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;
    let lineKey = 0;

    const flushList = () => {
      if (listItems) {
        if (listItems.type === "ul") {
          elements.push(
            <ul key={`list-${lineKey++}`} className="my-1.5 ml-4 space-y-0.5">
              {listItems.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[#CFD7E6]">
                  <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#676D7E] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`list-${lineKey++}`} className="my-1.5 ml-4 space-y-0.5">
              {listItems.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[#CFD7E6]">
                  <span className="text-[#676D7E] font-mono text-[11px] mt-[1px] shrink-0 min-w-[16px]">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        listItems = null;
      }
    };

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const headerText = headerMatch[2];
        const sizes = { 1: "text-[16px] font-bold", 2: "text-[14px] font-semibold", 3: "text-[13px] font-semibold" };
        elements.push(
          <div key={`h-${lineKey++}`} className={`${sizes[level as 1 | 2 | 3] || sizes[3]} text-[#F5F9FC] mt-3 mb-1.5`}>
            {renderInlineMarkdown(headerText)}
          </div>
        );
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        if (!listItems || listItems.type !== "ul") {
          flushList();
          listItems = { type: "ul", items: [] };
        }
        listItems.items.push(renderInlineMarkdown(bulletMatch[1]));
        continue;
      }

      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) {
        if (!listItems || listItems.type !== "ol") {
          flushList();
          listItems = { type: "ol", items: [] };
        }
        listItems.items.push(renderInlineMarkdown(numberedMatch[1]));
        continue;
      }

      flushList();

      if (line.trim() === "") {
        elements.push(<span key={`br-${lineKey++}`}>{"\n"}</span>);
      } else {
        elements.push(<span key={`ln-${lineKey++}`} className="whitespace-pre-wrap">{renderInlineMarkdown(line)}{"\n"}</span>);
      }
    }

    flushList();
    return elements;
  };

  const renderContent = (content: string, fileOps?: { type: "created" | "updated"; filename: string }[]) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0]?.trim() || "";
        const code = lines.slice(1).join("\n");
        const blockKey = `${content.slice(0, 20)}-block-${i}`;
        const targetFile = guessTargetFile(lang, code);
        const isApplied = appliedBlocks.has(blockKey);
        const langColor = LANG_COLORS[lang.toLowerCase()] || { bg: "bg-[#2B3245]", text: "text-[#9DA2B0]" };
        return (
          <div key={i} className="my-2.5 rounded-lg overflow-hidden border border-[#2B3245] shadow-lg">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0E1525] border-b border-[#2B3245]">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-[#676D7E]" />
                {lang && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${langColor.bg} ${langColor.text}`}>
                    {lang}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {mode === "chat" && targetFile && onApplyCode && (
                  <button
                    onClick={() => applyCodeToFile(code, targetFile, blockKey)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all ${isApplied ? "text-[#0CCE6B] bg-[#0CCE6B]/10" : "text-[#0079F2] hover:text-[#F5F9FC] hover:bg-[#0079F2]/10"}`}
                    data-testid={`button-apply-code-${i}`}
                  >
                    {isApplied ? <><Check className="w-3 h-3" /> Applied</> : <><FileDown className="w-3 h-3" /> Apply</>}
                  </button>
                )}
                <button
                  onClick={() => copyCode(code)}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-all"
                  data-testid="button-copy-code"
                >
                  {copied === code ? <><Check className="w-3 h-3 text-[#0CCE6B]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
            </div>
            <pre className="p-3 bg-[#0E1525] text-[12px] overflow-x-auto text-[#F5F9FC] leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
              <div key={`${i}-${j}`} className="flex items-center gap-2 my-1.5 px-3 py-2 rounded-lg bg-[#0E1525] border border-[#2B3245] text-[11px] animate-[slide-in_0.3s_ease-out]">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isCreating ? "bg-[#0CCE6B]/15" : "bg-[#0079F2]/15"}`}>
                  {isCreating ? <FilePlus className="w-3 h-3 text-[#0CCE6B]" /> : <FileEdit className="w-3 h-3 text-[#0079F2]" />}
                </div>
                <span className="text-[#F5F9FC]">{text}</span>
                <div className="ml-auto w-3 h-3 border-2 border-[#7C65CB]/40 border-t-[#7C65CB] rounded-full animate-spin" />
              </div>
            );
          }
          return <span key={`${i}-${j}`} className="whitespace-pre-wrap">{line}{"\n"}</span>;
        });
      }
      return <span key={i}>{renderMarkdownText(part)}</span>;
    });

    if (fileOps && fileOps.length > 0) {
      rendered.push(<FileOpProgress key="file-ops-summary" ops={fileOps} />);
    }

    return rendered;
  };

  const modelInfo = MODEL_LABELS[model];
  const ModelIcon = modelInfo.icon;

  const chatSuggestions = [
    { icon: Code2, label: "Explain this code", category: "Understand" },
    { icon: Bug, label: "Find bugs and fix them", category: "Debug" },
    { icon: Shield, label: "Add error handling", category: "Improve" },
    { icon: Gauge, label: "Optimize performance", category: "Optimize" },
  ];

  const agentSuggestions = [
    { icon: Layout, label: "Build a login form with validation", category: "UI" },
    { icon: Database, label: "Add a REST API endpoint", category: "Backend" },
    { icon: Wrench, label: "Create a utility functions file", category: "Utils" },
    { icon: Lightbulb, label: "Refactor this code for performance", category: "Refactor" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1C2333]">
      <div className="flex items-center justify-between px-3 h-10 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7C65CB]/30 to-[#7C65CB]/10 flex items-center justify-center ring-1 ring-[#7C65CB]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[#F5F9FC] tracking-tight">AI</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${modelInfo.color} hover:opacity-80 transition-opacity`} data-testid="button-model-select">
                  <ModelIcon className="w-2.5 h-2.5" />
                  {modelInfo.name}
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 bg-[#1C2333] border-[#2B3245] p-1">
                <DropdownMenuItem className="gap-2.5 text-xs text-[#F5F9FC] focus:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setModel("claude")} data-testid="model-claude">
                  <div className="w-5 h-5 rounded bg-[#7C65CB]/15 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-[#7C65CB]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">Claude Sonnet</span>
                    <span className="text-[10px] text-[#676D7E]">Anthropic</span>
                  </div>
                  {model === "claude" && <Check className="w-3.5 h-3.5 ml-auto text-[#0CCE6B]" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 text-xs text-[#F5F9FC] focus:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setModel("gpt")} data-testid="model-gpt">
                  <div className="w-5 h-5 rounded bg-[#0CCE6B]/15 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-[#0CCE6B]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">GPT-4o</span>
                    <span className="text-[10px] text-[#676D7E]">OpenAI</span>
                  </div>
                  {model === "gpt" && <Check className="w-3.5 h-3.5 ml-auto text-[#0CCE6B]" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 text-xs text-[#F5F9FC] focus:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setModel("gemini")} data-testid="model-gemini">
                  <div className="w-5 h-5 rounded bg-[#4285F4]/15 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-[#4285F4]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">Gemini Flash</span>
                    <span className="text-[10px] text-[#676D7E]">Google</span>
                  </div>
                  {model === "gemini" && <Check className="w-3.5 h-3.5 ml-auto text-[#0CCE6B]" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {projectId && (
            <div className="flex items-center mr-1 bg-[#2B3245]/30 rounded-lg p-0.5 ring-1 ring-[#2B3245]/50">
              <button
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${mode === "chat" ? "bg-[#2B3245] text-[#F5F9FC] shadow-sm" : "text-[#676D7E] hover:text-[#9DA2B0]"}`}
                onClick={() => setMode("chat")}
                data-testid="mode-chat"
              >
                <MessageSquare className="w-3 h-3" /> Chat
              </button>
              <button
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${mode === "agent" ? "bg-[#7C65CB]/25 text-[#7C65CB] shadow-sm" : "text-[#676D7E] hover:text-[#9DA2B0]"}`}
                onClick={() => setMode("agent")}
                data-testid="mode-agent"
              >
                <Bot className="w-3 h-3" /> Agent
              </button>
            </div>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setMessages([])} title="Clear chat" data-testid="button-clear-chat">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={onClose} data-testid="button-close-ai">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {context && mode === "chat" && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2B3245] bg-[#0E1525]/50 text-[10px] text-[#9DA2B0] shrink-0">
          <FileCode className="w-3 h-3 text-[#676D7E]" />
          <span className="px-1.5 py-0.5 rounded bg-[#2B3245] text-[#F5F9FC] font-mono">{context.filename}</span>
          <span className="text-[#676D7E]">{context.language}</span>
        </div>
      )}

      {mode === "agent" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#7C65CB]/15 bg-gradient-to-r from-[#7C65CB]/10 to-[#7C65CB]/5 text-[10px] text-[#7C65CB] shrink-0">
          <div className="w-4 h-4 rounded bg-[#7C65CB]/20 flex items-center justify-center">
            <Bot className="w-2.5 h-2.5" />
          </div>
          <span className="font-medium">Agent mode</span>
          <span className="text-[#7C65CB]/60">—</span>
          <span className="text-[#7C65CB]/70">AI can create and edit files in your project</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-[fade-in_0.4s_ease-out]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C65CB]/20 to-[#7C65CB]/5 flex items-center justify-center mb-4 ring-1 ring-[#7C65CB]/15">
              {mode === "agent" ? <Bot className="w-7 h-7 text-[#7C65CB]/70" /> : <Sparkles className="w-7 h-7 text-[#7C65CB]/70" />}
            </div>
            <p className="text-[15px] font-semibold text-[#F5F9FC] mb-1.5 tracking-tight" data-testid="text-ai-title">
              {mode === "agent" ? "AI Coding Agent" : "AI Assistant"}
            </p>
            <p className="text-[11px] text-[#676D7E] max-w-[260px] leading-relaxed mb-5">
              {mode === "agent"
                ? "I can build features, create files, and edit your code directly. Describe what you want to build."
                : "I can help you write code, debug issues, explain concepts, and suggest improvements."}
            </p>
            <div className="w-full max-w-[300px] grid grid-cols-2 gap-2">
              {(mode === "agent" ? agentSuggestions : chatSuggestions).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="flex items-start gap-2.5 w-full text-left px-3 py-2.5 rounded-lg bg-[#0E1525]/80 border border-[#2B3245]/60 text-xs text-[#9DA2B0] hover:text-[#F5F9FC] hover:border-[#7C65CB]/30 hover:bg-[#0E1525] hover:-translate-y-0.5 hover:shadow-md transition-all group"
                    onClick={() => { setInput(item.label); inputRef.current?.focus(); }}
                    data-testid={`suggestion-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-[#2B3245]/40 flex items-center justify-center shrink-0 group-hover:bg-[#7C65CB]/15 transition-colors">
                      <Icon className="w-3.5 h-3.5 group-hover:text-[#7C65CB] transition-colors" />
                    </div>
                    <div className="flex flex-col min-w-0 pt-0.5">
                      <span className="text-[11px] font-medium leading-tight truncate">{item.label}</span>
                      <span className="text-[9px] text-[#676D7E] mt-0.5">{item.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const msgModel = msg.model ? MODEL_LABELS[msg.model] : null;
          const MsgModelIcon = msgModel?.icon || Sparkles;
          return (
            <div key={msg.id} className={`flex gap-2.5 animate-[fade-in_0.2s_ease-out] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 ${
                msg.role === "assistant" ? "bg-[#7C65CB]/15 ring-1 ring-[#7C65CB]/20" : "bg-[#0079F2] ring-1 ring-[#0079F2]/30"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-[#7C65CB]" /> : <User className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className={`max-w-[82%] rounded-lg text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#0079F2]/8 text-[#F5F9FC] px-3.5 py-2.5"
                  : "bg-[#0E1525]/50 text-[#F5F9FC] px-3.5 py-2.5"
              }`}>
                {msg.role === "assistant" && msgModel && (
                  <div className="flex items-center gap-1.5 mb-1.5" data-testid={`badge-model-${msg.model}`}>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${msgModel.color}`}>
                      <MsgModelIcon className="w-2.5 h-2.5" />
                      {msgModel.name}
                    </span>
                  </div>
                )}
                {msg.content ? renderContent(msg.content, msg.fileOps) : <TypingIndicator />}
                {msg.role === "assistant" && lastFailedInput && idx === messages.length - 1 && msg.content.includes("⚠️") && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] font-medium transition-colors"
                      onClick={retryLastMessage}
                      data-testid="button-ai-retry-message"
                    >
                      <Zap className="w-3 h-3" /> Retry
                    </button>
                    <span className="text-[10px] text-[#676D7E]">or try a different model</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2.5 border-t border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="relative rounded-xl border border-[#2B3245] bg-[#1C2333]/50 focus-within:border-[#7C65CB]/40 focus-within:ring-1 focus-within:ring-[#7C65CB]/15 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything..."
            rows={3}
            className="w-full bg-transparent text-[13px] text-[#F5F9FC] rounded-xl px-3.5 py-2.5 pr-12 resize-none placeholder:text-[#676D7E]/80 focus:outline-none min-h-[68px] max-h-[160px]"
            disabled={isStreaming}
            data-testid="input-ai-chat"
          />
          <div className="absolute right-2 bottom-2">
            {isStreaming ? (
              <Button
                onClick={stopStreaming}
                size="icon"
                className="w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded-full shadow-sm"
                data-testid="button-ai-stop"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </Button>
            ) : (
              <Button
                onClick={sendMessage}
                size="icon"
                className="w-7 h-7 bg-[#7C65CB] hover:bg-[#6B56B8] rounded-full shadow-sm shadow-[#7C65CB]/20 disabled:opacity-30 disabled:shadow-none"
                disabled={!input.trim()}
                data-testid="button-ai-send"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1.5">
          <span className="text-[9px] text-[#4A5068]">Shift+Enter for new line</span>
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <span className="flex items-center gap-1.5 text-[10px] text-[#7C65CB]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7C65CB] animate-pulse" />
                Generating...
              </span>
            ) : (
              <span className={`text-[9px] ${input.length > 3800 ? "text-red-400" : "text-[#4A5068]"}`} data-testid="text-char-count">
                {input.length > 0 ? `${input.length.toLocaleString()} chars` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIPanel(props: AIPanelProps) {
  return (
    <AIPanelErrorBoundary onClose={props.onClose}>
      <AIPanelInner {...props} />
    </AIPanelErrorBoundary>
  );
}
