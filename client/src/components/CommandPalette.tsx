import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Square, Terminal, Plus, FolderPlus, Settings, Sparkles,
  Rocket, Monitor, FileCode2, ArrowLeft, Search,
  PanelLeft, Eye, Command, Columns, Map, GitFork,
  ChevronRight, Code2, Loader2,
} from "lucide-react";
import type { File } from "@shared/schema";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: "action" | "file" | "search-result";
  action: () => void;
  children?: CommandItem[];
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
  onSplitEditor?: () => void;
  onToggleMinimap?: () => void;
  onForkProject?: () => void;
  getShortcutDisplay?: (commandId: string) => string | null;
  projectId?: string;
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

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: CommandItem[];
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
  onSplitEditor,
  onToggleMinimap,
  onForkProject,
  getShortcutDisplay,
  projectId,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [codeSearchResults, setCodeSearchResults] = useState<{ filename: string; line: string }[]>([]);
  const [codeSearchLoading, setCodeSearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout>(undefined);

  const sc = (id: string, fallback: string): string | undefined => {
    const val = getShortcutDisplay?.(id);
    if (val === null) return undefined;
    return val ?? fallback;
  };

  const actionCommands: CommandItem[] = useMemo(() => [
    { id: "run", label: isRunning ? "Stop" : "Run", icon: isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />, shortcut: sc("run", "F5"), category: "action", action: () => { onRun(); onClose(); } },
    { id: "new-file", label: "New File", icon: <Plus className="w-4 h-4" />, shortcut: sc("new-file", "Ctrl+N"), category: "action", action: () => { onNewFile(); onClose(); } },
    { id: "new-folder", label: "New Folder", icon: <FolderPlus className="w-4 h-4" />, category: "action", action: () => { onNewFolder(); onClose(); } },
    { id: "toggle-terminal", label: "Toggle Terminal", icon: <Terminal className="w-4 h-4" />, shortcut: sc("toggle-terminal", "Ctrl+J"), category: "action", action: () => { onToggleTerminal(); onClose(); } },
    { id: "toggle-ai", label: "Toggle AI Panel", icon: <Sparkles className="w-4 h-4" />, category: "action", action: () => { onToggleAI(); onClose(); } },
    { id: "toggle-preview", label: "Toggle Preview", icon: <Monitor className="w-4 h-4" />, shortcut: sc("toggle-preview", "Ctrl+\\"), category: "action", action: () => { onTogglePreview(); onClose(); } },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: <PanelLeft className="w-4 h-4" />, shortcut: sc("toggle-sidebar", "Ctrl+B"), category: "action", action: () => { onToggleSidebar(); onClose(); } },
    { id: "project-settings", label: "Project Settings", icon: <Settings className="w-4 h-4" />, category: "action", action: () => { onProjectSettings(); onClose(); } },
    { id: "publish", label: "Publish", icon: <Rocket className="w-4 h-4" />, category: "action", action: () => { onPublish(); onClose(); } },
    { id: "go-dashboard", label: "Go to Dashboard", icon: <ArrowLeft className="w-4 h-4" />, category: "action", action: () => { onGoToDashboard(); onClose(); } },
    ...(onSplitEditor ? [{ id: "split-editor", label: "Split Editor Right", icon: <Columns className="w-4 h-4" />, category: "action" as const, action: () => { onSplitEditor(); onClose(); } }] : []),
    ...(onToggleMinimap ? [{ id: "toggle-minimap", label: "Toggle Minimap", icon: <Map className="w-4 h-4" />, category: "action" as const, action: () => { onToggleMinimap(); onClose(); } }] : []),
    ...(onForkProject ? [{ id: "fork-project", label: "Fork Project", icon: <GitFork className="w-4 h-4" />, category: "action" as const, action: () => { onForkProject(); onClose(); } }] : []),
  ], [isRunning, onRun, onNewFile, onNewFolder, onToggleTerminal, onToggleAI, onTogglePreview, onToggleSidebar, onProjectSettings, onPublish, onGoToDashboard, onClose, onSplitEditor, onToggleMinimap, onForkProject, getShortcutDisplay]);

  const categories: CategoryDef[] = useMemo(() => [
    {
      id: "editor",
      label: "Editor",
      icon: <Code2 className="w-4 h-4" />,
      children: actionCommands.filter(c => ["toggle-sidebar", "toggle-minimap", "split-editor"].includes(c.id)),
    },
    {
      id: "view",
      label: "View",
      icon: <Eye className="w-4 h-4" />,
      children: actionCommands.filter(c => ["toggle-terminal", "toggle-ai", "toggle-preview"].includes(c.id)),
    },
    {
      id: "project",
      label: "Project",
      icon: <Settings className="w-4 h-4" />,
      children: actionCommands.filter(c => ["run", "new-file", "new-folder", "project-settings", "publish", "fork-project", "go-dashboard"].includes(c.id)),
    },
  ], [actionCommands]);

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

  const isCodeSearch = query.startsWith(">search ");
  const codeSearchQuery = isCodeSearch ? query.slice(8).trim() : "";

  useEffect(() => {
    if (!isCodeSearch || !codeSearchQuery || !projectId) {
      setCodeSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setCodeSearchLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, { credentials: "include" });
        if (!res.ok) return;
        const allFiles: File[] = await res.json();
        const q = codeSearchQuery.toLowerCase();
        const matches: { filename: string; line: string }[] = [];
        for (const f of allFiles) {
          if (f.isBinary) continue;
          const lines = f.content.split("\n");
          for (const l of lines) {
            if (l.toLowerCase().includes(q)) {
              matches.push({ filename: f.filename, line: l.trim().slice(0, 120) });
              if (matches.length >= 30) break;
            }
          }
          if (matches.length >= 30) break;
        }
        setCodeSearchResults(matches);
      } catch (err) {
        setCodeSearchResults([]);
      } finally {
        setCodeSearchLoading(false);
      }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [isCodeSearch, codeSearchQuery, projectId]);

  const filtered = useMemo(() => {
    if (isCodeSearch) {
      return codeSearchResults.map((r, i) => ({
        id: `code-search-${i}`,
        label: r.filename,
        icon: <Code2 className="w-4 h-4" />,
        category: "search-result" as const,
        action: () => {
          const file = files?.find(f => f.filename === r.filename);
          if (file) { onOpenFile(file); onClose(); }
        },
        sublabel: r.line,
      }));
    }

    if (breadcrumb.length > 0) {
      const cat = categories.find(c => c.id === breadcrumb[0]);
      if (cat) {
        if (!query.trim()) return cat.children;
        return cat.children.filter(c => fuzzyMatch(query, c.label)).sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label));
      }
    }

    const allCommands = [...fileCommands, ...actionCommands];
    if (!query.trim()) return allCommands;
    return allCommands
      .filter((cmd) => fuzzyMatch(query, cmd.label))
      .sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label));
  }, [query, fileCommands, actionCommands, breadcrumb, categories, isCodeSearch, codeSearchResults, files, onOpenFile, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setBreadcrumb([]);
      setCodeSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, breadcrumb]);

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
      const item = filtered[selectedIndex];
      if (item) {
        if ('children' in item && (item as any).children?.length > 0) {
          setBreadcrumb(prev => [...prev, item.id]);
          setQuery("");
        } else {
          item.action();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (breadcrumb.length > 0) {
        setBreadcrumb(prev => prev.slice(0, -1));
        setQuery("");
      } else {
        onClose();
      }
    } else if (e.key === "Backspace" && query === "" && breadcrumb.length > 0) {
      setBreadcrumb(prev => prev.slice(0, -1));
    }
  }, [filtered, selectedIndex, onClose, breadcrumb, query]);

  if (!open) return null;

  const fileResults = filtered.filter((c) => c.category === "file");
  const actionResults = filtered.filter((c) => c.category === "action");
  const searchResults = filtered.filter((c) => c.category === "search-result");

  const showCategories = !query.trim() && breadcrumb.length === 0 && !isCodeSearch;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[520px] bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 px-4 pt-2 pb-0">
            {breadcrumb.map((b, i) => {
              const cat = categories.find(c => c.id === b);
              return (
                <span key={i} className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)]">
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <button
                    className="hover:text-[var(--ide-text)] transition-colors px-1 py-0.5 rounded hover:bg-[var(--ide-surface)]"
                    onClick={() => { setBreadcrumb(prev => prev.slice(0, i)); setQuery(""); }}
                    data-testid={`breadcrumb-${b}`}
                  >
                    {cat?.label || b}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--ide-border)]">
          <Search className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCodeSearch ? "Search code in project..." : breadcrumb.length > 0 ? "Filter commands..." : "Type a command, search files, or >search code..."}
            className="flex-1 bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
            data-testid="input-command-palette"
          />
          {codeSearchLoading && <Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" />}
          <kbd className="text-[9px] text-[var(--ide-text-muted)] bg-[var(--ide-bg)] px-1.5 py-0.5 rounded border border-[var(--ide-border)] font-mono shrink-0">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
          {filtered.length === 0 && !codeSearchLoading && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[var(--ide-text-muted)]">
                {isCodeSearch ? "No code matches found" : "No results found"}
              </p>
            </div>
          )}

          {showCategories && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Categories</span>
              </div>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50 hover:text-[var(--ide-text)]"
                  onClick={() => { setBreadcrumb([cat.id]); setQuery(""); }}
                  data-testid={`command-category-${cat.id}`}
                >
                  {cat.icon}
                  <span className="flex-1 text-[12px]">{cat.label}</span>
                  <span className="text-[10px] text-[var(--ide-text-muted)]">{cat.children.length} commands</span>
                  <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />
                </button>
              ))}
              <div className="h-px bg-[var(--ide-border)] mx-3 my-1" />
            </>
          )}

          {isCodeSearch && searchResults.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Code Results</span>
              </div>
              {searchResults.map((cmd, i) => {
                const item = cmd as any;
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${i === selectedIndex ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(i)}
                    data-testid={`command-item-${cmd.id}`}
                  >
                    {cmd.icon}
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] block truncate">{cmd.label}</span>
                      {item.sublabel && <span className="text-[10px] text-[var(--ide-text-muted)] block truncate font-mono">{item.sublabel}</span>}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {!isCodeSearch && fileResults.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Files</span>
              </div>
              {fileResults.map((cmd) => {
                const globalIndex = filtered.indexOf(cmd as any);
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${globalIndex === selectedIndex ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50 hover:text-[var(--ide-text)]"}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    data-testid={`command-item-${cmd.id}`}
                  >
                    {cmd.icon}
                    <span className="flex-1 text-[12px] truncate">{cmd.label}</span>
                    {(cmd as any).shortcut && <kbd className="text-[9px] text-[var(--ide-text-muted)] bg-[var(--ide-bg)] px-1.5 py-0.5 rounded border border-[var(--ide-border)] font-mono shrink-0">{(cmd as any).shortcut}</kbd>}
                  </button>
                );
              })}
            </>
          )}

          {!isCodeSearch && actionResults.length > 0 && (
            <>
              {fileResults.length > 0 && <div className="h-px bg-[var(--ide-border)] mx-3 my-1" />}
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Commands</span>
              </div>
              {actionResults.map((cmd) => {
                const globalIndex = filtered.indexOf(cmd as any);
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${globalIndex === selectedIndex ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50 hover:text-[var(--ide-text)]"}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    data-testid={`command-item-${cmd.id}`}
                  >
                    {cmd.icon}
                    <span className="flex-1 text-[12px]">{cmd.label}</span>
                    {(cmd as any).shortcut && <kbd className="text-[9px] text-[var(--ide-text-muted)] bg-[var(--ide-bg)] px-1.5 py-0.5 rounded border border-[var(--ide-border)] font-mono shrink-0">{(cmd as any).shortcut}</kbd>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--ide-border)] bg-[var(--ide-bg)]">
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">↑↓</kbd> navigate</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">↵</kbd> select</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">esc</kbd> {breadcrumb.length > 0 ? "back" : "close"}</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] ml-auto">&gt;search to find code</span>
        </div>
      </div>
    </div>
  );
}
