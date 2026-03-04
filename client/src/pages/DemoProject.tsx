import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Play, Terminal, Loader2, Eye,
  File as FileIcon, X, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
    setLogs([{ id: Date.now(), text: "Executing in sandbox...", type: "info" }]);

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
    setSidebarOpen(false);
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
    if (ext === "js") return "text-yellow-400";
    if (ext === "ts") return "text-blue-400";
    if (ext === "py") return "text-green-400";
    return "text-[#8b949e]";
  };

  const activeFile = demoQuery.data?.files?.find((f) => f.id === activeFileId);

  if (demoQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-[#58a6ff]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#161b22] border-b border-[#30363d] z-30 shrink-0" style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/")} data-testid="button-back-demo">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 ml-1">
            <Eye className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-white truncate">Demo Project</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">READ-ONLY</span>
          </div>
        </div>
        <Button size="sm" className="h-7 px-3 text-xs font-medium rounded-md gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleRun} disabled={isRunning} data-testid="button-run-demo">
          {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 fill-current" /> Run</>}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar toggle */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div className="absolute inset-0 bg-black/40 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
              <motion.div initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }} transition={{ type: "spring", bounce: 0, duration: 0.25 }} className="absolute left-0 top-0 bottom-0 w-[240px] bg-[#0d1117] border-r border-[#30363d] z-30 flex flex-col">
                <div className="px-3 py-2 border-b border-[#30363d]">
                  <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Files</span>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {demoQuery.data?.files?.map((file) => (
                    <div key={file.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${file.id === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"}`} onClick={() => openFile(file)}>
                      <FileIcon className={`w-3.5 h-3.5 ${getFileColor(file.filename)}`} />
                      <span className="text-xs truncate">{file.filename}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto shrink-0">
              <button className="px-2 py-1.5 text-[#8b949e] hover:text-white hover:bg-[#161b22] border-r border-[#30363d]" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <FileIcon className="w-3.5 h-3.5" />
              </button>
              {openTabs.map((tabId) => {
                const file = demoQuery.data?.files?.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div key={tabId} className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#30363d] shrink-0 ${isActive ? "bg-[#161b22] text-white border-t-2 border-t-[#58a6ff]" : "text-[#8b949e] hover:text-[#c9d1d9]"}`} onClick={() => openFile(file)}>
                    <FileIcon className={`w-3 h-3 ${getFileColor(file.filename)}`} />
                    <span className="text-[11px]">{file.filename}</span>
                    <button className="ml-1 p-0.5 rounded hover:bg-[#30363d]" onClick={(e) => closeTab(tabId, e)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <textarea value={code} readOnly spellCheck={false} className="w-full h-full min-h-[300px] p-4 bg-transparent text-[#c9d1d9] resize-none outline-none leading-relaxed cursor-default" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", tabSize: 2 }} data-testid="textarea-code-demo" />
          </div>

          {terminalVisible && (
            <div className="shrink-0 flex flex-col border-t border-[#30363d] bg-[#0d1117]" style={{ height: 200 }}>
              <div className="flex items-center justify-between px-3 py-1 border-b border-[#30363d] bg-[#161b22]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#8b949e]" />
                  <span className="text-[11px] font-medium text-[#c9d1d9]">Output</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLogs([])}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setTerminalVisible(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                {logs.map((log) => (
                  <div key={log.id} className={log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#8b949e]"}>
                    <span className="whitespace-pre-wrap break-all">{log.text}</span>
                  </div>
                ))}
                {isRunning && <span className="animate-pulse text-[#58a6ff]">█</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {!terminalVisible && (
        <div className="flex items-center px-3 py-1.5 bg-[#161b22] border-t border-[#30363d] shrink-0">
          <button className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-white" onClick={() => setTerminalVisible(true)}>
            <Terminal className="w-3 h-3" /> Terminal
          </button>
        </div>
      )}
    </div>
  );
}
