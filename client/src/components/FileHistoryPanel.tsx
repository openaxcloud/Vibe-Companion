import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  X, RotateCcw, ChevronDown, ChevronRight, GitCommitHorizontal,
  FileCode2, Loader2, User, ImageIcon, FileWarning, ChevronsUpDown,
  Search, ArrowDown, ChevronLeft, Play, Pause, SkipBack, SkipForward,
  GitCompare,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { diffLines as jsDiffLines } from "diff";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { go } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";

interface FileHistoryEntry {
  commitId: string;
  message: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  content: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalVersions: number;
  totalPages: number;
  hasMore: boolean;
}

interface FileHistoryResponse {
  entries: FileHistoryEntry[];
  pagination: PaginationInfo;
}

interface FileHistoryPanelProps {
  projectId: string;
  files: { id: string; filename: string; content: string }[];
  onClose: () => void;
  onFileRestored?: (fileId: string, filename: string, content: string) => void;
  initialFile?: string | null;
  openCounter?: number;
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg", "avif", "tiff", "tif",
  "mp3", "mp4", "wav", "ogg", "webm", "avi", "mov", "flac", "aac", "m4a",
  "pdf", "zip", "gz", "tar", "rar", "7z", "bz2", "xz",
  "woff", "woff2", "ttf", "otf", "eot",
  "exe", "dll", "so", "dylib", "bin", "dat",
  "sqlite", "db", "sqlite3",
  "psd", "ai", "sketch", "fig",
  "lock",
]);

const classToColor: Record<string, string> = {
  "tok-keyword": "#FF6166",
  "tok-variableName": "#CFD7E6",
  "tok-function": "#56B6C2",
  "tok-propertyName": "#56B6C2",
  "tok-typeName": "#FFCB6B",
  "tok-className": "#FFCB6B",
  "tok-number": "#FF9940",
  "tok-string": "#0CCE6B",
  "tok-comment": "#676D7E",
  "tok-operator": "#FF6166",
  "tok-bool": "#FF9940",
  "tok-atom": "#FF9940",
  "tok-meta": "#676D7E",
  "tok-tagName": "#FF6166",
  "tok-attributeName": "#FFCB6B",
  "tok-attributeValue": "#0CCE6B",
  "tok-regexp": "#56B6C2",
  "tok-escape": "#56B6C2",
  "tok-link": "#56B6C2",
  "tok-invalid": "#F44747",
  "tok-labelName": "#56B6C2",
  "tok-namespace": "#FFCB6B",
  "tok-macroName": "#CFD7E6",
  "tok-literal": "#FF9940",
  "tok-separator": "#CFD7E6",
  "tok-angleBracket": "#CFD7E6",
  "tok-punctuation": "#CFD7E6",
  "tok-name": "#CFD7E6",
  "tok-definition": "#CFD7E6",
  "tok-heading": "#FF6166",
  "tok-emphasis": "#CFD7E6",
  "tok-strong": "#CFD7E6",
  "tok-strikethrough": "#9DA2B0",
  "tok-url": "#56B6C2",
  "tok-variableName2": "#FF9940",
  "tok-local": "#CFD7E6",
  "tok-special": "#56B6C2",
  "tok-processingInstruction": "#0CCE6B",
  "tok-inserted": "#0CCE6B",
  "tok-deleted": "#F44747",
  "tok-changed": "#FFCB6B",
  "tok-constant": "#FF9940",
  "tok-standard": "#FF9940",
  "tok-color": "#FF9940",
  "tok-self": "#FFCB6B",
  "tok-modifier": "#FFCB6B",
  "tok-annotation": "#FFCB6B",
  "tok-character": "#CFD7E6",
};

function isBinaryFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

function isBinaryContent(content: string): boolean {
  if (!content) return false;
  if (content.startsWith("data:")) return true;
  for (let i = 0; i < Math.min(content.length, 512); i++) {
    const code = content.charCodeAt(i);
    if (code === 0) return true;
  }
  return false;
}

function getLanguageSupport(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "js": case "jsx": case "mjs": case "cjs": return javascript({ jsx: true });
    case "ts": case "tsx": case "mts": case "cts": return javascript({ jsx: true, typescript: true });
    case "py": case "pyw": case "pyi": return python();
    case "html": case "htm": case "svelte": case "vue": case "xml": case "xhtml": case "xsl": case "xslt": return html();
    case "css": case "scss": case "less": case "sass": return css();
    case "json": case "jsonc": case "json5": case "jsonl": return json();
    case "md": case "mdx": case "markdown": return markdown();
    case "go": return go();
    case "java": case "kt": case "kts": case "groovy": case "gradle": return java();
    case "c": case "cpp": case "cc": case "cxx": case "h": case "hpp": case "hxx": return cpp();
    case "rs": return rust();
    default: return null;
  }
}

function highlightCode(text: string, filename: string): string {
  const lang = getLanguageSupport(filename);
  if (!lang) return escapeHtml(text);

  try {
    const tree = lang.language.parser.parse(text);
    const parts: { from: number; to: number; color: string }[] = [];

    highlightTree(tree, classHighlighter, (from, to, classes) => {
      const classNames = classes.split(" ");
      let color: string | null = null;
      for (const cn of classNames) {
        if (classToColor[cn]) { color = classToColor[cn]; break; }
      }
      if (color) parts.push({ from, to, color });
    });

    if (parts.length === 0) return escapeHtml(text);

    let result = "";
    let pos = 0;
    for (const part of parts) {
      if (part.from > pos) result += escapeHtml(text.slice(pos, part.from));
      result += `<span style="color:${part.color}">${escapeHtml(text.slice(part.from, part.to))}</span>`;
      pos = part.to;
    }
    if (pos < text.length) result += escapeHtml(text.slice(pos));
    return result;
  } catch {
    return escapeHtml(text);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

interface DiffLine {
  type: "same" | "added" | "removed";
  oldNum: number | null;
  newNum: number | null;
  text: string;
}

interface CollapsedSection {
  type: "collapsed";
  startOldNum: number;
  startNewNum: number;
  lineCount: number;
}

type DiffDisplayItem = DiffLine | CollapsedSection;

const CONTEXT_LINES = 3;

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const changes = jsDiffLines(oldText, newText);
  const result: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    if (change.added) {
      for (const line of lines) {
        result.push({ type: "added", oldNum: null, newNum, text: line });
        newNum++;
      }
    } else if (change.removed) {
      for (const line of lines) {
        result.push({ type: "removed", oldNum, newNum: null, text: line });
        oldNum++;
      }
    } else {
      for (const line of lines) {
        result.push({ type: "same", oldNum, newNum, text: line });
        oldNum++;
        newNum++;
      }
    }
  }

  return result;
}

function collapseUnchanged(diffLines: DiffLine[]): DiffDisplayItem[] {
  if (diffLines.length <= 2 * CONTEXT_LINES + 5) return diffLines;

  const changedIndices = new Set<number>();
  diffLines.forEach((line, i) => {
    if (line.type !== "same") changedIndices.add(i);
  });

  const visible = new Set<number>();
  changedIndices.forEach(idx => {
    for (let j = Math.max(0, idx - CONTEXT_LINES); j <= Math.min(diffLines.length - 1, idx + CONTEXT_LINES); j++) {
      visible.add(j);
    }
  });

  for (let i = 0; i < Math.min(CONTEXT_LINES, diffLines.length); i++) visible.add(i);
  for (let i = Math.max(0, diffLines.length - CONTEXT_LINES); i < diffLines.length; i++) visible.add(i);

  const result: DiffDisplayItem[] = [];
  let i = 0;
  while (i < diffLines.length) {
    if (visible.has(i)) {
      result.push(diffLines[i]);
      i++;
    } else {
      let collapsedCount = 0;
      const startLine = diffLines[i];
      while (i < diffLines.length && !visible.has(i)) {
        collapsedCount++;
        i++;
      }
      result.push({
        type: "collapsed",
        startOldNum: startLine.oldNum ?? 0,
        startNewNum: startLine.newNum ?? 0,
        lineCount: collapsedCount,
      });
    }
  }

  return result;
}

function BinaryFileIndicator({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg", "avif"].includes(ext);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-8" data-testid="diff-binary-file">
      {isImage ? (
        <ImageIcon className="w-10 h-10 text-[var(--ide-text-muted)]" />
      ) : (
        <FileWarning className="w-10 h-10 text-[var(--ide-text-muted)]" />
      )}
      <div className="text-center">
        <div className="text-[12px] text-[var(--ide-text-secondary)] font-medium">Binary file</div>
        <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">
          {isImage ? "Image files cannot be diffed" : "Binary files cannot be displayed as text"}
        </div>
      </div>
    </div>
  );
}

function DiffViewer({ oldContent, newContent, filename }: { oldContent: string; newContent: string; filename: string }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const isBinary = useMemo(() => isBinaryFile(filename) || isBinaryContent(oldContent) || isBinaryContent(newContent), [filename, oldContent, newContent]);

  const rawDiffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  const displayItems = useMemo(() => {
    const collapsed = collapseUnchanged(rawDiffLines);
    if (expandedSections.size === 0) return collapsed;
    const result: DiffDisplayItem[] = [];
    for (let i = 0; i < collapsed.length; i++) {
      const item = collapsed[i];
      if (item.type === "collapsed" && expandedSections.has(i)) {
        const startIdx = rawDiffLines.findIndex(
          l => l.type === "same" && l.oldNum === (item as CollapsedSection).startOldNum && l.newNum === (item as CollapsedSection).startNewNum
        );
        if (startIdx >= 0) {
          for (let j = startIdx; j < startIdx + (item as CollapsedSection).lineCount; j++) {
            if (rawDiffLines[j]) result.push(rawDiffLines[j]);
          }
        } else {
          result.push(item);
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }, [rawDiffLines, expandedSections]);

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    rawDiffLines.forEach(l => { if (l.type === "added") added++; if (l.type === "removed") removed++; });
    return { added, removed };
  }, [rawDiffLines]);

  const highlightedOld = useMemo(() => {
    const lines = oldContent.split("\n");
    return lines.map(line => highlightCode(line, filename));
  }, [oldContent, filename]);

  const highlightedNew = useMemo(() => {
    const lines = newContent.split("\n");
    return lines.map(line => highlightCode(line, filename));
  }, [newContent, filename]);

  const getHighlightedText = useCallback((line: DiffLine): string => {
    if (line.type === "removed" && line.oldNum !== null) return highlightedOld[line.oldNum - 1] || escapeHtml(line.text);
    if (line.type === "added" && line.newNum !== null) return highlightedNew[line.newNum - 1] || escapeHtml(line.text);
    if (line.newNum !== null) return highlightedNew[line.newNum - 1] || escapeHtml(line.text);
    return escapeHtml(line.text);
  }, [highlightedOld, highlightedNew]);

  if (isBinary) return <BinaryFileIndicator filename={filename} />;

  if (oldContent === newContent) {
    return (
      <div className="flex items-center justify-center h-24 text-[11px] text-[var(--ide-text-muted)]" data-testid="diff-no-changes">
        No changes in this version
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="diff-viewer">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono truncate">{filename}</span>
        <div className="flex items-center gap-2 text-[10px] shrink-0">
          {stats.added > 0 && <span className="text-[#0CCE6B] font-medium">+{stats.added}</span>}
          {stats.removed > 0 && <span className="text-[#F44747] font-medium">-{stats.removed}</span>}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-[12px] leading-[1.65]" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
          {displayItems.map((item, i) => {
            if (item.type === "collapsed") {
              const sec = item as CollapsedSection;
              return (
                <button
                  key={`collapsed-${i}`}
                  className="w-full flex items-center gap-2 px-3 py-1 bg-[var(--ide-surface)]/50 hover:bg-[var(--ide-surface)] border-y border-[var(--ide-border)]/50 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] transition-colors cursor-pointer"
                  onClick={() => setExpandedSections(prev => { const next = new Set(prev); next.add(i); return next; })}
                  data-testid={`diff-expand-${i}`}
                >
                  <ChevronsUpDown className="w-3 h-3 shrink-0" />
                  <span>Show {sec.lineCount} unchanged line{sec.lineCount !== 1 ? "s" : ""}</span>
                </button>
              );
            }

            const line = item as DiffLine;
            return (
              <div
                key={i}
                className={`flex whitespace-pre ${
                  line.type === "added" ? "bg-[rgba(12,206,107,0.08)]" :
                  line.type === "removed" ? "bg-[rgba(244,71,71,0.08)]" : ""
                }`}
                data-testid={`diff-line-${i}`}
              >
                <span className={`w-10 shrink-0 text-right pr-1 select-none text-[11px] ${
                  line.type === "removed" ? "text-[#F44747]/50 bg-[rgba(244,71,71,0.04)]" :
                  line.type === "added" ? "text-transparent" : "text-[var(--ide-text-muted)]/60"
                }`}>
                  {line.oldNum ?? ""}
                </span>
                <span className={`w-10 shrink-0 text-right pr-2 select-none text-[11px] ${
                  line.type === "added" ? "text-[#0CCE6B]/50 bg-[rgba(12,206,107,0.04)]" :
                  line.type === "removed" ? "text-transparent" : "text-[var(--ide-text-muted)]/60"
                }`}>
                  {line.newNum ?? ""}
                </span>
                <span className={`w-4 shrink-0 text-center select-none font-bold ${
                  line.type === "added" ? "text-[#0CCE6B]" :
                  line.type === "removed" ? "text-[#F44747]" : "text-transparent"
                }`}>
                  {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                </span>
                <span
                  className="flex-1 px-1"
                  dangerouslySetInnerHTML={{ __html: getHighlightedText(line) || "&nbsp;" }}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function CodePreview({ content, filename }: { content: string; filename: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const highlighted = useMemo(() => lines.map(line => highlightCode(line, filename)), [lines, filename]);
  const isBinary = useMemo(() => isBinaryFile(filename) || isBinaryContent(content), [filename, content]);

  if (isBinary) return <BinaryFileIndicator filename={filename} />;

  return (
    <ScrollArea className="flex-1">
      <div className="font-mono text-[12px] leading-[1.65]" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
        {lines.map((line, i) => (
          <div key={i} className="flex whitespace-pre" data-testid={`preview-line-${i}`}>
            <span className="w-10 shrink-0 text-right pr-2 select-none text-[11px] text-[var(--ide-text-muted)]/60">{i + 1}</span>
            <span className="flex-1 px-1" dangerouslySetInnerHTML={{ __html: highlighted[i] || "&nbsp;" }} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function TimelineSkeleton() {
  return (
    <div className="px-3 py-2 space-y-3" data-testid="file-history-skeleton">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-2">
          <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FileHistoryPanel({ projectId, files, onClose, onFileRestored, initialFile, openCounter = 0 }: FileHistoryPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(initialFile ?? null);
  const prevOpenCounter = useRef(openCounter);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [accumulatedEntries, setAccumulatedEntries] = useState<FileHistoryEntry[]>([]);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [compareLatest, setCompareLatest] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialFile && openCounter !== prevOpenCounter.current) {
      prevOpenCounter.current = openCounter;
      setSelectedFile(initialFile);
      setSelectedIndex(-1);
      setCurrentPage(1);
      setAccumulatedEntries([]);
      setCompareLatest(false);
      setIsPlaying(false);
    }
  }, [initialFile, openCounter]);

  useEffect(() => {
    if (fileDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [fileDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFileDropdownOpen(false);
        setSearchQuery("");
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFileDropdownOpen(false);
        setSearchQuery("");
      }
    }
    if (fileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [fileDropdownOpen]);

  const historyQuery = useQuery<FileHistoryResponse>({
    queryKey: ["/api/projects", projectId, "file-history", selectedFile, currentPage],
    queryFn: async () => {
      if (!selectedFile) return { entries: [], pagination: { page: 1, pageSize: 50, totalVersions: 0, totalPages: 0, hasMore: false } };
      const res = await apiRequest("GET", `/api/projects/${projectId}/file-history/${encodeURIComponent(selectedFile)}?page=${currentPage}&pageSize=50`);
      return res.json();
    },
    enabled: !!selectedFile,
  });

  useEffect(() => {
    if (historyQuery.data?.entries) {
      if (currentPage === 1) {
        setAccumulatedEntries(historyQuery.data.entries);
      } else {
        setAccumulatedEntries(prev => {
          const existingIds = new Set(prev.map(e => e.commitId));
          const newEntries = historyQuery.data!.entries.filter(e => !existingIds.has(e.commitId));
          return [...prev, ...newEntries];
        });
      }
      setIsLoadingMore(false);
    }
  }, [historyQuery.data, currentPage]);

  const entries = accumulatedEntries;
  const pagination = historyQuery.data?.pagination;

  const reversedEntries = useMemo(() => [...entries].reverse(), [entries]);

  const currentFileContent = useMemo(() => {
    if (!selectedFile) return "";
    const f = files.find(ff => ff.filename === selectedFile);
    return f?.content ?? "";
  }, [selectedFile, files]);

  const selectedEntry = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= entries.length) return null;
    return entries[selectedIndex];
  }, [selectedIndex, entries]);

  useEffect(() => {
    if (isPlaying && reversedEntries.length > 0) {
      const currentReversedIndex = selectedIndex >= 0 ? entries.length - 1 - selectedIndex : 0;
      let playIdx = currentReversedIndex;

      playbackTimerRef.current = setInterval(() => {
        playIdx++;
        if (playIdx >= reversedEntries.length) {
          setIsPlaying(false);
          if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
          return;
        }
        setSelectedIndex(entries.length - 1 - playIdx);
      }, playbackSpeed);

      return () => {
        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      };
    }
  }, [isPlaying, playbackSpeed, reversedEntries.length, entries.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        setIsPlaying(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) return;
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedFile || entries.length === 0) return;
      if (fileDropdownOpen || restoreConfirmOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(entries.length - 1, prev + 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPlaying, selectedFile, entries.length, fileDropdownOpen, restoreConfirmOpen]);

  const restoreMutation = useMutation({
    mutationFn: async ({ filename, content, commitId }: { filename: string; content: string; commitId: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/file-history/restore`, { filename, content, commitId });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "File restored", description: `${variables.filename} has been restored to the selected version.` });
      setCurrentPage(1);
      setAccumulatedEntries([]);
      setSelectedIndex(-1);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "file-history"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/commits`] });
      if (onFileRestored && variables.filename) {
        const file = files.find(f => f.filename === variables.filename);
        if (file) {
          onFileRestored(file.id, variables.filename, variables.content);
        }
      }
    },
    onError: () => {
      toast({ title: "Restore failed", description: "Could not restore the file. Please try again.", variant: "destructive" });
    },
  });

  const handleRestore = useCallback(() => {
    setRestoreConfirmOpen(true);
  }, []);

  const confirmRestore = useCallback(() => {
    if (!selectedEntry || !selectedFile) return;
    restoreMutation.mutate({ filename: selectedFile, content: selectedEntry.content, commitId: selectedEntry.commitId });
    setRestoreConfirmOpen(false);
  }, [selectedEntry, selectedFile, restoreMutation]);

  const handleSelectFile = useCallback((filename: string) => {
    setSelectedFile(filename);
    setSelectedIndex(-1);
    setFileDropdownOpen(false);
    setSearchQuery("");
    setCurrentPage(1);
    setAccumulatedEntries([]);
    setCompareLatest(false);
    setIsPlaying(false);
  }, []);

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setCurrentPage(prev => prev + 1);
  }, []);

  const handleStartPlayback = useCallback(() => {
    if (entries.length < 2) return;
    setSelectedIndex(entries.length - 1);
    setIsPlaying(true);
  }, [entries.length]);

  const sortedFiles = useMemo(() =>
    [...files]
      .filter(f => !f.content.startsWith("data:") && !isBinaryContent(f.content))
      .sort((a, b) => a.filename.localeCompare(b.filename)),
  [files]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return sortedFiles;
    const q = searchQuery.toLowerCase();
    return sortedFiles.filter(f => f.filename.toLowerCase().includes(q));
  }, [sortedFiles, searchQuery]);

  const selectedFileBinary = useMemo(() => selectedFile ? isBinaryFile(selectedFile) : false, [selectedFile]);

  return (
    <div className="flex flex-col h-full" ref={panelRef} data-testid="file-history-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">File History</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={onClose} data-testid="button-close-file-history">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-[var(--ide-border)]">
        <div className="relative" ref={dropdownRef}>
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[11px] text-[var(--ide-text)] hover:border-[#0079F2]/50 transition-colors"
            onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
            data-testid="button-select-file"
          >
            <FileCode2 className="w-3.5 h-3.5 text-[var(--ide-text-muted)] shrink-0" />
            <span className="flex-1 text-left truncate">{selectedFile || "Select a file..."}</span>
            <ChevronDown className={`w-3 h-3 text-[var(--ide-text-muted)] shrink-0 transition-transform ${fileDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {fileDropdownOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md bg-[var(--ide-panel)] border border-[var(--ide-border)] shadow-xl overflow-hidden" data-testid="file-dropdown">
              <div className="px-2 py-1.5 border-b border-[var(--ide-border)]">
                <div className="flex items-center gap-1.5 px-1.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)]">
                  <Search className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[11px] text-[var(--ide-text)] py-1 outline-none placeholder:text-[var(--ide-text-muted)]"
                    data-testid="input-search-files"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredFiles.map(f => (
                  <button
                    key={f.id}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--ide-surface)] transition-colors truncate flex items-center gap-2 ${
                      selectedFile === f.filename ? "text-[#0079F2] bg-[#0079F2]/5" : "text-[var(--ide-text-secondary)]"
                    }`}
                    onClick={() => handleSelectFile(f.filename)}
                    data-testid={`file-option-${f.id}`}
                  >
                    <FileCode2 className="w-3 h-3 shrink-0 opacity-50" />
                    <span className="truncate">{f.filename}</span>
                  </button>
                ))}
                {filteredFiles.length === 0 && (
                  <div className="px-3 py-3 text-[11px] text-[var(--ide-text-muted)] text-center">
                    {searchQuery ? "No files match your search" : "No files found"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6" data-testid="file-history-empty">
          <div className="w-12 h-12 rounded-full bg-[var(--ide-surface)] flex items-center justify-center">
            <GitCommitHorizontal className="w-6 h-6 text-[var(--ide-text-muted)]" />
          </div>
          <div className="text-center">
            <div className="text-[12px] text-[var(--ide-text-secondary)] font-medium">No file selected</div>
            <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">Select a file above to view its version history</div>
          </div>
        </div>
      ) : historyQuery.isLoading ? (
        <TimelineSkeleton />
      ) : historyQuery.isError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6" data-testid="file-history-error">
          <div className="w-12 h-12 rounded-full bg-[rgba(244,71,71,0.1)] flex items-center justify-center">
            <FileWarning className="w-6 h-6 text-[#F44747]" />
          </div>
          <div className="text-center">
            <div className="text-[12px] text-[#F44747] font-medium">Failed to load history</div>
            <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">Check your connection and try again</div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]" onClick={() => historyQuery.refetch()} data-testid="button-retry-history">
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6" data-testid="file-history-no-commits">
          <div className="w-12 h-12 rounded-full bg-[var(--ide-surface)] flex items-center justify-center">
            <GitCommitHorizontal className="w-6 h-6 text-[var(--ide-text-muted)]" />
          </div>
          <div className="text-center">
            <div className="text-[12px] text-[var(--ide-text-secondary)] font-medium">No history yet</div>
            <div className="text-[11px] text-[var(--ide-text-muted)] mt-0.5">
              {selectedFileBinary
                ? "Binary files have limited history tracking"
                : "Edit this file to start automatic version tracking"}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {entries.length > 1 && (
            <div className="px-3 py-2 border-b border-[var(--ide-border)] shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="range"
                  min={0}
                  max={entries.length - 1}
                  value={selectedIndex >= 0 ? selectedIndex : 0}
                  onChange={(e) => { setSelectedIndex(parseInt(e.target.value)); setIsPlaying(false); }}
                  className="flex-1 h-1 accent-[#F5A623] cursor-pointer"
                  data-testid="history-slider"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    onClick={() => { setSelectedIndex(entries.length - 1); setIsPlaying(false); }}
                    title="First version"
                    data-testid="button-first-version"
                  >
                    <SkipBack className="w-3 h-3" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    onClick={() => { setSelectedIndex(prev => Math.min(entries.length - 1, prev + 1)); setIsPlaying(false); }}
                    title="Previous version (Left arrow)"
                    data-testid="button-prev-version"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${isPlaying ? "bg-[#F5A623]/20 text-[#F5A623]" : "hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => isPlaying ? setIsPlaying(false) : handleStartPlayback()}
                    title={isPlaying ? "Pause playback (Space)" : "Play through versions"}
                    data-testid="button-playback"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    onClick={() => { setSelectedIndex(prev => Math.max(0, prev - 1)); setIsPlaying(false); }}
                    title="Next version (Right arrow)"
                    data-testid="button-next-version"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                    onClick={() => { setSelectedIndex(0); setIsPlaying(false); }}
                    title="Latest version"
                    data-testid="button-latest-version"
                  >
                    <SkipForward className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  {isPlaying && (
                    <select
                      className="text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1 py-0.5 text-[var(--ide-text-secondary)]"
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                      data-testid="select-playback-speed"
                    >
                      <option value={2000}>0.5x</option>
                      <option value={1000}>1x</option>
                      <option value={500}>2x</option>
                      <option value={250}>4x</option>
                    </select>
                  )}
                  <button
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      compareLatest ? "bg-[#0079F2]/15 text-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]"
                    }`}
                    onClick={() => setCompareLatest(!compareLatest)}
                    title="Toggle diff comparison with current file"
                    data-testid="button-compare-latest"
                  >
                    <GitCompare className="w-3 h-3" />
                    <span>Diff</span>
                  </button>
                </div>
              </div>
              {selectedEntry && (
                <div className="mt-1.5 text-[10px] text-[var(--ide-text-muted)]">
                  Version {selectedEntry.message} · {formatRelativeDate(selectedEntry.createdAt)}
                </div>
              )}
            </div>
          )}

          <div className={`${selectedIndex >= 0 ? "max-h-[180px] shrink-0" : "flex-1"} overflow-y-auto border-b border-[var(--ide-border)]`}>
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">
                {pagination ? pagination.totalVersions : entries.length} Version{(pagination?.totalVersions ?? entries.length) !== 1 ? "s" : ""}
              </span>
              {selectedIndex >= 0 && (
                <button
                  className="text-[10px] text-[#0079F2] hover:text-[#0079F2]/80 transition-colors"
                  onClick={() => { setSelectedIndex(-1); setIsPlaying(false); }}
                  data-testid="button-clear-selection"
                >
                  Clear selection
                </button>
              )}
            </div>
            {entries.map((entry, i) => {
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={entry.commitId}
                  className={`w-full text-left px-3 py-2.5 transition-colors group ${
                    isSelected ? "bg-[#0079F2]/10 border-l-2 border-[#0079F2]" : "hover:bg-[var(--ide-surface)] border-l-2 border-transparent"
                  }`}
                  onClick={() => { setSelectedIndex(isSelected ? -1 : i); setIsPlaying(false); }}
                  title={formatFullDate(entry.createdAt)}
                  data-testid={`history-entry-${entry.commitId}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex flex-col items-center shrink-0">
                      <div className={`w-2 h-2 rounded-full transition-colors ${isSelected ? "bg-[#0079F2]" : "bg-[var(--ide-text-muted)] group-hover:bg-[var(--ide-text-secondary)]"}`} />
                      {i < entries.length - 1 && <div className="w-px flex-1 bg-[var(--ide-border)] min-h-[20px]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-[var(--ide-text)] truncate leading-tight">{entry.message}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-[var(--ide-text-secondary)]" data-testid={`history-author-${entry.commitId}`}>
                          <User className="w-2.5 h-2.5" />
                          {entry.authorName}
                        </span>
                        <span className="text-[10px] text-[var(--ide-text-muted)]">·</span>
                        <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid={`history-date-${entry.commitId}`}>{formatRelativeDate(entry.createdAt)}</span>
                      </div>
                    </div>
                    {isSelected ? <ChevronDown className="w-3 h-3 text-[#0079F2] mt-0.5 shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </div>
                </button>
              );
            })}

            {pagination && pagination.hasMore && (
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-[#0079F2] hover:text-[#0079F2]/80 hover:bg-[var(--ide-surface)] transition-colors border-t border-[var(--ide-border)] disabled:opacity-50"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                data-testid="button-load-more-history"
              >
                {isLoadingMore ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {isLoadingMore
                  ? "Loading..."
                  : `Load older versions (${Math.max(0, pagination.totalVersions - entries.length)} remaining)`}
              </button>
            )}
          </div>

          {selectedEntry && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ide-border)] shrink-0 bg-[var(--ide-surface)]/30">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-[var(--ide-text-muted)] truncate">
                    {compareLatest ? (
                      <>Comparing <span className="font-mono text-[var(--ide-text-secondary)]">{selectedEntry.message}</span> with current</>
                    ) : (
                      <>{selectedEntry.message} · {formatRelativeDate(selectedEntry.createdAt)}</>
                    )}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[10px] bg-[#F26522] hover:bg-[#F26522]/80 text-white font-medium shrink-0 ml-2"
                  onClick={handleRestore}
                  disabled={restoreMutation.isPending}
                  data-testid="button-restore-version"
                >
                  {restoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  Restore
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {compareLatest ? (
                  <DiffViewer
                    oldContent={selectedEntry.content}
                    newContent={currentFileContent}
                    filename={selectedFile!}
                  />
                ) : (
                  <CodePreview content={selectedEntry.content} filename={selectedFile!} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent className="bg-[var(--ide-bg)] border-[var(--ide-border)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--ide-text)] text-base">Restore file to previous version?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ide-text-muted)] text-[13px]">
              This will replace the current content of <span className="font-mono text-[var(--ide-text-secondary)]">{selectedFile}</span> with the selected version. A new version will be created to record this change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[var(--ide-surface)] border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/80 text-[12px]" data-testid="button-cancel-restore">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              className="bg-[#F26522] hover:bg-[#F26522]/80 text-white text-[12px]"
              data-testid="button-confirm-restore"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
