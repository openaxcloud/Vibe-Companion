import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Play, Terminal, Loader2,
  File as FileIcon, X, RefreshCw, Globe
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import CodeEditor, { detectLanguage } from "@/components/CodeEditor";
import type { Project, File } from "@shared/schema";

export default function DemoProject() {
  const [, setLocation] = useLocation();
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ id: number; text: string; type: "info" | "error" | "success" }[]>([]);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview">("terminal");
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const demoQuery = useQuery<{ project: Project; files: File[] }>({
    queryKey: ["/api/demo/project"],
    queryFn: async () => {
      const res = await fetch("/api/demo/project");
      if (!res.ok) throw new Error("Demo not available");
      return res.json();
    },
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    if (window.innerWidth >= 768) setSidebarOpen(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (demoQuery.data?.files?.length && !activeFileId) {
      const first = demoQuery.data.files[0];
      setActiveFileId(first.id);
      setOpenTabs([first.id]);
      setCode(first.content);
    }
  }, [demoQuery.data, activeFileId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTerminalVisible(true);
    setBottomTab("terminal");
    setLogs([{ id: Date.now(), text: `━━━ Run started at ${new Date().toLocaleTimeString()} ━━━`, type: "info" }]);

    try {
      const res = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: demoQuery.data?.project?.language || "javascript" }),
      });
      const result = await res.json();
      if (result.stdout) setLogs((prev) => [...prev, { id: Date.now() + 1, text: result.stdout.trimEnd(), type: "success" }]);
      if (result.stderr) setLogs((prev) => [...prev, { id: Date.now() + 2, text: result.stderr.trimEnd(), type: "error" }]);
      setLogs((prev) => [...prev, { id: Date.now() + 3, text: `Process exited with code ${result.exitCode}`, type: result.exitCode === 0 ? "success" : "error" }]);
    } catch (err: any) {
      setLogs((prev) => [...prev, { id: Date.now() + 4, text: `Error: ${err.message}`, type: "error" }]);
    } finally {
      setIsRunning(false);
    }
  };

  const openFile = (file: File) => {
    if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
    setActiveFileId(file.id);
    setCode(file.content);
    if (isMobile) setSidebarOpen(false);
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) {
      const nextId = newTabs[newTabs.length - 1] || null;
      setActiveFileId(nextId);
      const f = demoQuery.data?.files?.find((f) => f.id === nextId);
      if (f) setCode(f.content);
    }
  };

  const getFileColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const c: Record<string, string> = { js: "text-yellow-400", ts: "text-blue-400", py: "text-green-400", json: "text-orange-400", css: "text-pink-400", html: "text-red-400" };
    return c[ext || ""] || "text-[var(--ide-text-secondary)]";
  };

  const activeFile = demoQuery.data?.files?.find((f) => f.id === activeFileId);

  if (demoQuery.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-panel)]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0079F2]" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-panel)] text-sm select-none">
      <div className="flex items-center justify-between px-2 h-10 bg-[var(--ide-panel)] border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]" onClick={() => setLocation("/")} data-testid="button-back-demo">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] sm:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FileIcon className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-semibold text-[var(--ide-text)]">Demo Project</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-600/30 font-medium">DEMO</span>
        </div>
        <Button size="sm" className="h-7 px-3 text-xs font-medium rounded-md gap-1.5 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] font-medium" onClick={handleRun} disabled={isRunning} data-testid="button-run-demo">
          {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Running</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            {isMobile && <div className="absolute inset-0 top-10 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} />}
            <div className={`${isMobile ? "absolute left-0 top-10 bottom-0 z-30" : "relative"} w-[220px] bg-[var(--ide-panel)] border-r border-[var(--ide-border)] flex flex-col shrink-0`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
                <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Files</span>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] md:hidden" onClick={() => setSidebarOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {demoQuery.data?.files?.map((file) => (
                  <div key={file.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${file.id === activeFileId ? "bg-[var(--ide-surface)] text-white" : "text-[var(--ide-text)] hover:bg-[var(--ide-panel)]"}`} onClick={() => openFile(file)} data-testid={`demo-file-${file.id}`}>
                    <FileIcon className={`w-3.5 h-3.5 ${getFileColor(file.filename)}`} />
                    <span className="text-xs truncate">{file.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {openTabs.length > 0 && (
            <div className="flex items-center bg-[var(--ide-panel)] border-b border-[var(--ide-border)] overflow-x-auto shrink-0 scrollbar-hide">
              {openTabs.map((tabId) => {
                const file = demoQuery.data?.files?.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div key={tabId} className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[var(--ide-border)] shrink-0 transition-colors ${isActive ? "bg-[var(--ide-panel)] text-white border-t-2 border-t-[#0079F2]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border-t-2 border-t-transparent"}`} onClick={() => openFile(file)}>
                    <FileIcon className={`w-3 h-3 ${getFileColor(file.filename)}`} />
                    <span className="text-[11px]">{file.filename}</span>
                    <button className="ml-0.5 p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-secondary)] hover:text-white" onClick={(e) => closeTab(tabId, e)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <CodeEditor
                value={code}
                onChange={() => {}}
                language={detectLanguage(activeFile.filename)}
                readOnly
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)]">
                <p className="text-sm">Select a file to view</p>
              </div>
            )}
          </div>

          {terminalVisible && (
            <div className="shrink-0 flex flex-col border-t border-[var(--ide-border)] bg-[var(--ide-panel)]" style={{ height: 200 }}>
              <div className="flex items-center justify-between px-2 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
                <div className="flex">
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 ${bottomTab === "terminal" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-secondary)] border-transparent"}`} onClick={() => setBottomTab("terminal")}>
                    <Terminal className="w-3 h-3" /> Console
                  </button>
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 ${bottomTab === "preview" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-secondary)] border-transparent"}`} onClick={() => setBottomTab("preview")}>
                    <Globe className="w-3 h-3" /> Preview
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]" onClick={() => setLogs([])}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]" onClick={() => setTerminalVisible(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {bottomTab === "terminal" ? (
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                  {logs.map((log) => (
                    <div key={log.id} className={log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[var(--ide-text-secondary)]"}>
                      <span className="whitespace-pre-wrap break-all">{log.text}</span>
                    </div>
                  ))}
                  {isRunning && <span className="animate-pulse text-[#0079F2]">_</span>}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[var(--ide-panel)] text-[var(--ide-text-muted)]">
                  <Globe className="w-6 h-6 mr-2" />
                  <span className="text-xs">No preview available</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!terminalVisible && (
        <div className="flex items-center px-3 h-6 bg-[var(--ide-panel)] border-t border-[var(--ide-border)] shrink-0">
          <button className="flex items-center gap-1 text-[10px] text-[var(--ide-text-secondary)] hover:text-white" onClick={() => setTerminalVisible(true)}>
            <Terminal className="w-3 h-3" /> Console
          </button>
        </div>
      )}
    </div>
  );
}
