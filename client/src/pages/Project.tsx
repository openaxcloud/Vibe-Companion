import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, Play, Square, Terminal, FileCode2, Plus, Save, Loader2, Check,
  X, Trash2, Pencil, FolderOpen, Settings, ChevronDown, MoreHorizontal,
  File as FileIcon, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProjectWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Project as ProjectType, File } from "@shared/schema";

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "error" | "success";
}

export default function Project() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLang, setProjectLang] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(200);

  const { messages, connected } = useProjectWebSocket(projectId);

  const projectQuery = useQuery<ProjectType>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Project not found");
      return res.json();
    },
  });

  const filesQuery = useQuery<File[]>({
    queryKey: ["/api/projects", projectId, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });

  useEffect(() => {
    if (filesQuery.data && filesQuery.data.length > 0 && openTabs.length === 0) {
      const firstFile = filesQuery.data[0];
      setOpenTabs([firstFile.id]);
      setActiveFileId(firstFile.id);
      setFileContents((prev) => ({ ...prev, [firstFile.id]: firstFile.content }));
    }
  }, [filesQuery.data]);

  useEffect(() => {
    if (projectQuery.data) {
      setProjectName(projectQuery.data.name);
      setProjectLang(projectQuery.data.language);
    }
  }, [projectQuery.data]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.type === "run_log" && msg.message) {
        setLogs((prev) => [...prev, { id: Date.now() + Math.random(), text: msg.message!, type: msg.logType || "info" }]);
      }
      if (msg.type === "run_status" && (msg.status === "completed" || msg.status === "failed")) {
        setIsRunning(false);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const saveMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { content });
    },
    onSuccess: (_, vars) => {
      setDirtyFiles((prev) => { const n = new Set(prev); n.delete(vars.fileId); return n; });
    },
  });

  const autoSave = useCallback((fileId: string, newCode: string) => {
    setDirtyFiles((prev) => new Set(prev).add(fileId));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ fileId, content: newCode });
    }, 2000);
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeFileId) return;
    const newCode = e.target.value;
    setFileContents((prev) => ({ ...prev, [activeFileId]: newCode }));
    autoSave(activeFileId, newCode);
  };

  const handleManualSave = () => {
    if (activeFileId && fileContents[activeFileId] !== undefined) {
      saveMutation.mutate({ fileId: activeFileId, content: fileContents[activeFileId] });
    }
  };

  const openFile = (file: File) => {
    if (!openTabs.includes(file.id)) {
      setOpenTabs((prev) => [...prev, file.id]);
    }
    if (!fileContents[file.id]) {
      setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
    }
    setActiveFileId(file.id);
    setSidebarOpen(false);
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (dirtyFiles.has(fileId) && fileContents[fileId] !== undefined) {
      saveMutation.mutate({ fileId, content: fileContents[fileId] });
    }
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) {
      setActiveFileId(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
    }
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      if (activeFileId && dirtyFiles.has(activeFileId)) {
        await apiRequest("PATCH", `/api/files/${activeFileId}`, { content: fileContents[activeFileId] });
        setDirtyFiles((prev) => { const n = new Set(prev); n.delete(activeFileId); return n; });
      }
      const codeToRun = activeFileId ? fileContents[activeFileId] || "" : "";
      const res = await apiRequest("POST", `/api/projects/${projectId}/run`, {
        code: codeToRun,
        language: projectQuery.data?.language || "javascript",
      });
      return res.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      setTerminalVisible(true);
    },
    onError: (err: any) => {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = () => {
    if (isRunning) { setIsRunning(false); return; }
    setLogs([]);
    runMutation.mutate();
  };

  const createFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, { filename, content: "" });
      return res.json();
    },
    onSuccess: (file: File) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      openFile(file);
      setNewFileDialogOpen(false);
      setNewFileName("");
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: (_, fileId) => {
      closeTab(fileId);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ fileId, filename }: { fileId: string; filename: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { filename });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setRenamingFileId(null);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; language?: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setProjectSettingsOpen(false);
      toast({ title: "Project updated" });
    },
  });

  const handleTerminalDrag = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - e.touches[0].clientY;
    setTerminalHeight(Math.max(100, Math.min(500, dragStartH.current + delta)));
  };

  const activeFile = filesQuery.data?.find((f) => f.id === activeFileId);
  const project = projectQuery.data;
  const currentCode = activeFileId ? fileContents[activeFileId] ?? "" : "";

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const colors: Record<string, string> = {
      js: "text-yellow-400", ts: "text-blue-400", tsx: "text-blue-400",
      jsx: "text-yellow-400", py: "text-green-400", json: "text-orange-400",
      css: "text-pink-400", html: "text-red-400", md: "text-gray-400",
    };
    return colors[ext || ""] || "text-muted-foreground";
  };

  if (projectQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#161b22] border-b border-[#30363d] z-30 shrink-0" style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/dashboard")} data-testid="button-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="button-toggle-sidebar">
            <FolderOpen className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 ml-1 min-w-0">
            <span className="text-xs font-semibold text-[#c9d1d9] truncate max-w-[100px]">{project?.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#30363d] text-[#8b949e]">{project?.language}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]"
            onClick={handleManualSave}
            disabled={dirtyFiles.size === 0}
            data-testid="button-save"
          >
            <Save className={`w-3.5 h-3.5 ${dirtyFiles.size > 0 ? "text-orange-400" : ""}`} />
          </Button>
          <Button
            size="sm"
            className={`h-7 px-3 text-xs font-medium rounded-md gap-1 ${isRunning
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"}`}
            onClick={handleRun}
            disabled={runMutation.isPending}
            data-testid="button-run"
          >
            {runMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isRunning ? (
              <><Square className="w-3 h-3 fill-current" /> Stop</>
            ) : (
              <><Play className="w-3 h-3 fill-current" /> Run</>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1c2128] border-[#30363d] rounded-lg">
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setProjectSettingsOpen(true)}>
                <Settings className="w-3.5 h-3.5" /> Project Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setTerminalVisible(!terminalVisible)}>
                <Terminal className="w-3.5 h-3.5" /> Toggle Terminal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                className="absolute inset-0 bg-black/40 z-20 md:hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                className="absolute left-0 top-0 bottom-0 w-[260px] bg-[#0d1117] border-r border-[#30363d] z-30 flex flex-col"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
                  <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Explorer</span>
                  <Button
                    variant="ghost" size="icon"
                    className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d]"
                    onClick={() => setNewFileDialogOpen(true)}
                    data-testid="button-new-file"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {filesQuery.data?.map((file) => (
                    <div
                      key={file.id}
                      className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                        file.id === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"
                      }`}
                      onClick={() => openFile(file)}
                      data-testid={`file-item-${file.id}`}
                    >
                      <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileIcon(file.filename)}`} />
                      {renamingFileId === file.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => {
                            if (renameValue.trim() && renameValue !== file.filename) {
                              renameFileMutation.mutate({ fileId: file.id, filename: renameValue.trim() });
                            } else {
                              setRenamingFileId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (renameValue.trim() && renameValue !== file.filename) {
                                renameFileMutation.mutate({ fileId: file.id, filename: renameValue.trim() });
                              } else {
                                setRenamingFileId(null);
                              }
                            }
                            if (e.key === "Escape") setRenamingFileId(null);
                          }}
                          className="flex-1 bg-[#0d1117] border border-[#58a6ff] rounded px-1 py-0.5 text-xs text-white outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 text-xs truncate">{file.filename}</span>
                      )}
                      {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white"
                          onClick={(e) => { e.stopPropagation(); setRenamingFileId(file.id); setRenameValue(file.filename); }}
                          data-testid={`rename-file-${file.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-red-400"
                          onClick={(e) => { e.stopPropagation(); deleteFileMutation.mutate(file.id); }}
                          data-testid={`delete-file-${file.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto shrink-0">
              {openTabs.map((tabId) => {
                const file = filesQuery.data?.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div
                    key={tabId}
                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#30363d] shrink-0 transition-colors ${
                      isActive ? "bg-[#161b22] text-white border-t-2 border-t-[#58a6ff]" : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50"
                    }`}
                    onClick={() => {
                      setActiveFileId(tabId);
                      if (!fileContents[tabId] && file) {
                        setFileContents((prev) => ({ ...prev, [tabId]: file.content }));
                      }
                    }}
                    data-testid={`tab-${tabId}`}
                  >
                    <FileIcon className={`w-3 h-3 ${getFileIcon(file.filename)}`} />
                    <span className="text-[11px]">{file.filename}</span>
                    {dirtyFiles.has(tabId) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    <button
                      className="ml-1 p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white"
                      onClick={(e) => closeTab(tabId, e)}
                      data-testid={`close-tab-${tabId}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 overflow-hidden relative">
            {activeFileId ? (
              <textarea
                value={currentCode}
                onChange={handleCodeChange}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="w-full h-full p-4 bg-transparent text-[#c9d1d9] resize-none outline-none leading-relaxed"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", tabSize: 2 }}
                data-testid="textarea-code"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#484f58] gap-3">
                <FileCode2 className="w-12 h-12" />
                <p className="text-sm">Open a file to start editing</p>
                <Button
                  variant="ghost" size="sm"
                  className="text-[#58a6ff] hover:bg-[#161b22] text-xs"
                  onClick={() => setSidebarOpen(true)}
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Open Explorer
                </Button>
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          {terminalVisible && (
            <div className="shrink-0 flex flex-col border-t border-[#30363d] bg-[#0d1117]" style={{ height: terminalHeight }}>
              {/* Drag handle */}
              <div
                className="h-1.5 cursor-ns-resize hover:bg-[#58a6ff]/30 transition-colors flex items-center justify-center"
                onTouchStart={(e) => { dragStartY.current = e.touches[0].clientY; dragStartH.current = terminalHeight; }}
                onTouchMove={handleTerminalDrag}
                onTouchEnd={() => { dragStartY.current = null; }}
              >
                <div className="w-8 h-0.5 rounded-full bg-[#30363d]" />
              </div>
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-3 py-1 border-b border-[#30363d] bg-[#161b22]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#8b949e]" />
                  <span className="text-[11px] font-medium text-[#c9d1d9]">Terminal</span>
                  {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {isRunning && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-600/30 animate-pulse">
                      Running
                    </span>
                  )}
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
              {/* Terminal Output */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                {logs.length === 0 && !isRunning && (
                  <p className="text-[#484f58] text-center py-4 text-xs">Press Run to execute your code</p>
                )}
                {logs.map((log) => (
                  <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#8b949e]"}`}>
                    <span className="whitespace-pre-wrap break-all">{log.text}</span>
                  </div>
                ))}
                {isRunning && <span className="animate-pulse text-[#58a6ff]">█</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar - only when terminal is closed */}
      {!terminalVisible && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-t border-[#30363d] shrink-0">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-white" onClick={() => setTerminalVisible(true)}>
              <Terminal className="w-3 h-3" /> Terminal
            </button>
            <span className="text-[10px] text-[#484f58]">
              {logs.length > 0 ? `${logs.length} lines` : "No output"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {connected && <span className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Connected</span>}
            <span className="text-[10px] text-[#484f58]">{project?.language}</span>
          </div>
        </div>
      )}

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">New File</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newFileName.trim()) createFileMutation.mutate(newFileName.trim());
            }}
            className="space-y-3 mt-1"
          >
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Filename</Label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={project?.language === "python" ? "script.py" : "module.ts"}
                className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg"
                autoFocus
                data-testid="input-new-filename"
              />
            </div>
            <Button type="submit" className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs" disabled={createFileMutation.isPending}>
              {createFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create File"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Settings Dialog */}
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">Project Settings</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProjectMutation.mutate({ name: projectName, language: projectLang });
            }}
            className="space-y-3 mt-1"
          >
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg"
                data-testid="input-project-name-settings"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Language</Label>
              <div className="flex gap-2">
                {["javascript", "typescript", "python"].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setProjectLang(lang)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                      projectLang === lang ? "bg-[#58a6ff] text-white" : "bg-[#30363d] text-[#8b949e] hover:text-white"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-9 bg-[#58a6ff] hover:bg-[#4c96eb] text-white rounded-lg text-xs" disabled={updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
