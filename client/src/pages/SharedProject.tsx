import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Play, Terminal, Loader2, Globe,
  File as FileIcon, X, RefreshCw, Share2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import CodeEditor, { detectLanguage } from "@/components/CodeEditor";
import type { Project, File } from "@shared/schema";

interface SharedData {
  project: Project;
  files: File[];
}

export default function SharedProject() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview">("terminal");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<SharedData>({
    queryKey: ["/api/shared", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/shared/${projectId}`);
      if (!res.ok) throw new Error("Project not found or not published");
      return res.json();
    },
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    if (window.innerWidth < 768) setSidebarOpen(false);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (data?.files?.[0] && !activeFileId) {
      const f = data.files[0];
      setActiveFileId(f.id);
      setOpenTabs([f.id]);
    }
  }, [data, activeFileId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [output]);

  const activeFile = data?.files?.find((f) => f.id === activeFileId);

  const openFile = (file: File) => {
    if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
    setActiveFileId(file.id);
    if (isMobile) setSidebarOpen(false);
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) setActiveFileId(newTabs[newTabs.length - 1] || null);
  };

  const handleRun = async () => {
    if (!activeFile || isRunning) return;
    setIsRunning(true);
    setOutput("");
    setBottomTab("terminal");

    try {
      const res = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeFile.content, language: data?.project.language || "javascript" }),
      });
      const result = await res.json();
      let out = "";
      if (result.stdout) out += result.stdout;
      if (result.stderr) out += (out ? "\n" : "") + result.stderr;
      if (!out) out = `Process exited with code ${result.exitCode}`;
      setOutput(out);
    } catch {
      setOutput("Execution failed.");
    }
    setIsRunning(false);
  };

  const getFileColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const c: Record<string, string> = { js: "text-yellow-400", jsx: "text-yellow-400", ts: "text-blue-400", tsx: "text-blue-400", py: "text-green-400", json: "text-orange-400", css: "text-pink-400", html: "text-red-400", md: "text-gray-400" };
    return c[ext || ""] || "text-[#8b949e]";
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-[#58a6ff]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0d1117] gap-3">
        <Share2 className="w-10 h-10 text-[#30363d]" />
        <p className="text-sm text-[#8b949e]">This project is not available</p>
        <Button variant="ghost" className="text-[#58a6ff] text-xs" onClick={() => setLocation("/")} data-testid="button-back-shared-error">
          Go to Vibe Platform
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-sm select-none">
      <div className="flex items-center justify-between px-2 h-10 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/")} data-testid="button-back-shared">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d] sm:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FileIcon className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-semibold text-[#c9d1d9] truncate max-w-[140px]">{data?.project.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#30363d] text-[#8b949e] shrink-0">{data?.project.language}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-600/30 font-medium shrink-0">SHARED</span>
        </div>
        <Button
          size="sm"
          className="h-7 px-3 text-xs font-medium rounded-md gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleRun}
          disabled={isRunning || !activeFile}
          data-testid="button-run-shared"
        >
          {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Running</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            {isMobile && <div className="absolute inset-0 top-10 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} />}
            <div className={`${isMobile ? "absolute left-0 top-10 bottom-0 z-30" : "relative"} w-[220px] bg-[#0d1117] border-r border-[#30363d] flex flex-col shrink-0`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
                <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Files</span>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d] md:hidden" onClick={() => setSidebarOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {data?.files?.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${file.id === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"}`}
                    onClick={() => openFile(file)}
                    data-testid={`shared-file-${file.id}`}
                  >
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
            <div className="flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto shrink-0 scrollbar-hide">
              {openTabs.map((tabId) => {
                const file = data?.files?.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div key={tabId} className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#30363d] shrink-0 transition-colors ${isActive ? "bg-[#161b22] text-white border-t-2 border-t-[#58a6ff]" : "text-[#8b949e] hover:text-[#c9d1d9] border-t-2 border-t-transparent"}`} onClick={() => setActiveFileId(tabId)}>
                    <FileIcon className={`w-3 h-3 ${getFileColor(file.filename)}`} />
                    <span className="text-[11px] truncate">{file.filename}</span>
                    <button className="ml-0.5 p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => closeTab(tabId, e)}>
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
                value={activeFile.content}
                onChange={() => {}}
                language={detectLanguage(activeFile.filename)}
                readOnly
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[#484f58]">
                <p className="text-sm">Select a file to view</p>
              </div>
            )}
          </div>

          <div className="h-[200px] border-t border-[#30363d] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
              <div className="flex">
                <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 ${bottomTab === "terminal" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent"}`} onClick={() => setBottomTab("terminal")}>
                  <Terminal className="w-3 h-3" /> Console
                </button>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 ${bottomTab === "preview" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent"}`} onClick={() => setBottomTab("preview")}>
                  <Globe className="w-3 h-3" /> Preview
                </button>
              </div>
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setOutput("")}>
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            {bottomTab === "terminal" ? (
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                {output ? (
                  <pre className="text-[#8b949e] whitespace-pre-wrap">{output}</pre>
                ) : (
                  <p className="text-[#484f58] text-center py-4 text-xs">Press Run to execute the code</p>
                )}
                {isRunning && <span className="animate-pulse text-[#58a6ff]">_</span>}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-[#484f58]">
                <Globe className="w-6 h-6 mr-2" />
                <span className="text-xs">No preview available</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
