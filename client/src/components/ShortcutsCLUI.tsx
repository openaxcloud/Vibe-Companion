import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileCode2, Users, Sparkles, Plus, Folder, Code2, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface SearchResults {
  projects?: { id: string; name: string; language: string }[];
  templates?: { id: string; name: string; language: string }[];
  code?: { projectId: string; projectName: string; filename: string; line: string }[];
  users?: { id: string; displayName: string | null; username: string | null; avatarUrl: string | null }[];
}

interface ShortcutsCLUIProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsCLUI({ open, onClose }: ShortcutsCLUIProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({});
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const quickActions = [
    { id: "new-repl", label: "Create New Repl", icon: <Plus className="w-4 h-4" />, action: () => { onClose(); setLocation("/dashboard"); } },
    { id: "my-repls", label: "My Repls", icon: <Folder className="w-4 h-4" />, action: () => { onClose(); setLocation("/dashboard"); } },
    { id: "cli", label: "Open CLI", icon: <Code2 className="w-4 h-4" />, action: () => { onClose(); setLocation("/cli"); } },
  ];

  const allItems: { id: string; label: string; sublabel?: string; icon: React.ReactNode; category: string; action: () => void }[] = [];

  if (!query.trim()) {
    quickActions.forEach(a => allItems.push({ ...a, category: "Quick Actions" }));
  } else {
    (results.projects || []).forEach(p => {
      allItems.push({ id: `proj-${p.id}`, label: p.name, sublabel: p.language, icon: <FileCode2 className="w-4 h-4" />, category: "Projects", action: () => { onClose(); setLocation(`/project/${p.id}`); } });
    });
    (results.templates || []).forEach(t => {
      allItems.push({ id: `tmpl-${t.id}`, label: t.name, sublabel: t.language, icon: <Sparkles className="w-4 h-4" />, category: "Templates", action: () => { onClose(); setLocation("/dashboard"); } });
    });
    (results.code || []).forEach((c, i) => {
      allItems.push({ id: `code-${i}`, label: `${c.filename} in ${c.projectName}`, sublabel: c.line.slice(0, 80), icon: <Code2 className="w-4 h-4" />, category: "Code", action: () => { onClose(); setLocation(`/project/${c.projectId}`); } });
    });
    (results.users || []).forEach(u => {
      allItems.push({ id: `user-${u.id}`, label: u.displayName || u.username || "User", sublabel: u.username ? `@${u.username}` : undefined, icon: <Users className="w-4 h-4" />, category: "People", action: () => {} });
    });
    if (allItems.length === 0 && !loading) {
      quickActions.forEach(a => allItems.push({ ...a, category: "Quick Actions" }));
    }
  }

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) allItems[selectedIndex].action();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  const categories = [...new Set(allItems.map(i => i.category))];

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]" onClick={onClose} data-testid="shortcuts-clui-overlay">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} data-testid="shortcuts-clui">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--ide-border)]">
          <Search className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, templates, code, people..."
            className="flex-1 bg-transparent text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
            data-testid="input-shortcuts-search"
          />
          {loading && <Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" />}
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" data-testid="button-close-shortcuts">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1">
          {allItems.length === 0 && !loading && query.trim() && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[var(--ide-text-muted)]">No results found for "{query}"</p>
            </div>
          )}

          {categories.map((cat, catIdx) => {
            const items = allItems.filter(i => i.category === cat);
            return (
              <div key={cat}>
                {catIdx > 0 && <div className="h-px bg-[var(--ide-border)] mx-3 my-1" />}
                <div className="px-4 py-1.5">
                  <span className="text-[9px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">{cat}</span>
                </div>
                {items.map(item => {
                  const globalIndex = allItems.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${globalIndex === selectedIndex ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      data-testid={`shortcuts-item-${item.id}`}
                    >
                      <span className="text-[var(--ide-text-muted)]">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] block truncate">{item.label}</span>
                        {item.sublabel && <span className="text-[10px] text-[var(--ide-text-muted)] block truncate">{item.sublabel}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--ide-border)] bg-[var(--ide-bg)]">
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">↑↓</kbd> navigate</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">↵</kbd> open</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1"><kbd className="bg-[var(--ide-panel)] px-1 py-0.5 rounded border border-[var(--ide-border)] font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
