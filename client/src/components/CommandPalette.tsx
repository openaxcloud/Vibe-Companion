import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Square, Terminal, Plus, FolderPlus, Settings, Sparkles,
  Rocket, Monitor, FileCode2, ArrowLeft, Search,
  PanelLeft, Eye, Command,
} from "lucide-react";
import type { File } from "@shared/schema";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: "action" | "file";
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files?: File[];
  isRunning: boolean;
  onRun: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onToggleTerminal: () => void;
  onToggleAI: () => void;
  onTogglePreview: () => void;
  onToggleSidebar: () => void;
  onProjectSettings: () => void;
  onPublish: () => void;
  onGoToDashboard: () => void;
  onOpenFile: (file: File) => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;
  let score = 0;
  let qi = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (lastMatch === ti - 1) score += 5;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, { bg: string; text: string; label: string }> = {
    js: { bg: "bg-yellow-500", text: "text-black", label: "JS" },
    jsx: { bg: "bg-yellow-500", text: "text-black", label: "JS" },
    ts: { bg: "bg-blue-500", text: "text-white", label: "TS" },
    tsx: { bg: "bg-blue-500", text: "text-white", label: "TS" },
    py: { bg: "bg-green-500", text: "text-white", label: "PY" },
    css: { bg: "bg-pink-500", text: "text-white", label: "CS" },
    html: { bg: "bg-orange-500", text: "text-white", label: "HT" },
    json: { bg: "bg-amber-500", text: "text-black", label: "JS" },
    md: { bg: "bg-gray-500", text: "text-white", label: "MD" },
  };
  const icon = iconMap[ext];
  if (icon) {
    return (
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0 ${icon.bg}`}>
        <span className={`text-[7px] font-bold leading-none ${icon.text}`}>{icon.label}</span>
      </span>
    );
  }
  return <FileCode2 className="w-4 h-4 shrink-0 text-[#9DA2B0]" />;
}

export default function CommandPalette({
  open,
  onClose,
  files,
  isRunning,
  onRun,
  onNewFile,
  onNewFolder,
  onToggleTerminal,
  onToggleAI,
  onTogglePreview,
  onToggleSidebar,
  onProjectSettings,
  onPublish,
  onGoToDashboard,
  onOpenFile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actionCommands: CommandItem[] = useMemo(() => [
    { id: "run", label: isRunning ? "Stop" : "Run", icon: isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />, shortcut: "F5", category: "action", action: () => { onRun(); onClose(); } },
    { id: "new-file", label: "New File", icon: <Plus className="w-4 h-4" />, shortcut: "Ctrl+N", category: "action", action: () => { onNewFile(); onClose(); } },
    { id: "new-folder", label: "New Folder", icon: <FolderPlus className="w-4 h-4" />, category: "action", action: () => { onNewFolder(); onClose(); } },
    { id: "toggle-terminal", label: "Toggle Terminal", icon: <Terminal className="w-4 h-4" />, shortcut: "Ctrl+J", category: "action", action: () => { onToggleTerminal(); onClose(); } },
    { id: "toggle-ai", label: "Toggle AI Panel", icon: <Sparkles className="w-4 h-4" />, category: "action", action: () => { onToggleAI(); onClose(); } },
    { id: "toggle-preview", label: "Toggle Preview", icon: <Monitor className="w-4 h-4" />, shortcut: "Ctrl+\\", category: "action", action: () => { onTogglePreview(); onClose(); } },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: <PanelLeft className="w-4 h-4" />, shortcut: "Ctrl+B", category: "action", action: () => { onToggleSidebar(); onClose(); } },
    { id: "project-settings", label: "Project Settings", icon: <Settings className="w-4 h-4" />, category: "action", action: () => { onProjectSettings(); onClose(); } },
    { id: "publish", label: "Publish", icon: <Rocket className="w-4 h-4" />, category: "action", action: () => { onPublish(); onClose(); } },
    { id: "go-dashboard", label: "Go to Dashboard", icon: <ArrowLeft className="w-4 h-4" />, category: "action", action: () => { onGoToDashboard(); onClose(); } },
  ], [isRunning, onRun, onNewFile, onNewFolder, onToggleTerminal, onToggleAI, onTogglePreview, onToggleSidebar, onProjectSettings, onPublish, onGoToDashboard, onClose]);

  const fileCommands: CommandItem[] = useMemo(() => {
    if (!files) return [];
    return files.map((file) => ({
      id: `file-${file.id}`,
      label: file.filename,
      icon: <FileTypeIcon filename={file.filename} />,
      category: "file" as const,
      action: () => { onOpenFile(file); onClose(); },
    }));
  }, [files, onOpenFile, onClose]);

  const allCommands = useMemo(() => [...fileCommands, ...actionCommands], [fileCommands, actionCommands]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    return allCommands
      .filter((cmd) => fuzzyMatch(query, cmd.label))
      .sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label));
  }, [query, allCommands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) filtered[selectedIndex].action();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  if (!open) return null;

  const fileResults = filtered.filter((c) => c.category === "file");
  const actionResults = filtered.filter((c) => c.category === "action");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] bg-[#1C2333] border border-[#2B3245] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[#2B3245]">
          <Search className="w-4 h-4 text-[#676D7E] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search files..."
            className="flex-1 bg-transparent text-sm text-[#F5F9FC] placeholder:text-[#676D7E] outline-none"
            data-testid="input-command-palette"
          />
          <kbd className="text-[9px] text-[#676D7E] bg-[#0E1525] px-1.5 py-0.5 rounded border border-[#2B3245] font-mono shrink-0">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[#676D7E]">No results found</p>
            </div>
          )}

          {fileResults.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[#676D7E] uppercase tracking-wider">Files</span>
              </div>
              {fileResults.map((cmd, i) => {
                const globalIndex = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${globalIndex === selectedIndex ? "bg-[#2B3245] text-[#F5F9FC]" : "text-[#9DA2B0] hover:bg-[#2B3245]/50 hover:text-[#F5F9FC]"}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    data-testid={`command-item-${cmd.id}`}
                  >
                    {cmd.icon}
                    <span className="flex-1 text-[12px] truncate">{cmd.label}</span>
                    {cmd.shortcut && <kbd className="text-[9px] text-[#676D7E] bg-[#0E1525] px-1.5 py-0.5 rounded border border-[#2B3245] font-mono shrink-0">{cmd.shortcut}</kbd>}
                  </button>
                );
              })}
            </>
          )}

          {actionResults.length > 0 && (
            <>
              {fileResults.length > 0 && <div className="h-px bg-[#2B3245] mx-3 my-1" />}
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[#676D7E] uppercase tracking-wider">Commands</span>
              </div>
              {actionResults.map((cmd) => {
                const globalIndex = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${globalIndex === selectedIndex ? "bg-[#2B3245] text-[#F5F9FC]" : "text-[#9DA2B0] hover:bg-[#2B3245]/50 hover:text-[#F5F9FC]"}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    data-testid={`command-item-${cmd.id}`}
                  >
                    {cmd.icon}
                    <span className="flex-1 text-[12px]">{cmd.label}</span>
                    {cmd.shortcut && <kbd className="text-[9px] text-[#676D7E] bg-[#0E1525] px-1.5 py-0.5 rounded border border-[#2B3245] font-mono shrink-0">{cmd.shortcut}</kbd>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-[#2B3245] bg-[#0E1525]">
          <span className="text-[9px] text-[#676D7E] flex items-center gap-1"><kbd className="bg-[#1C2333] px-1 py-0.5 rounded border border-[#2B3245] font-mono">↑↓</kbd> navigate</span>
          <span className="text-[9px] text-[#676D7E] flex items-center gap-1"><kbd className="bg-[#1C2333] px-1 py-0.5 rounded border border-[#2B3245] font-mono">↵</kbd> select</span>
          <span className="text-[9px] text-[#676D7E] flex items-center gap-1"><kbd className="bg-[#1C2333] px-1 py-0.5 rounded border border-[#2B3245] font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
