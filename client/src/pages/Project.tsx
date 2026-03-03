import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Square, Terminal, FileCode2, MoreVertical, Plus, Save, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProjectWebSocket, type WsMessage } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import type { Project as ProjectType, File } from "@shared/schema";

export default function Project() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ id: number; text: string; type: "info" | "error" | "success" }[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [saved, setSaved] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
    if (filesQuery.data && filesQuery.data.length > 0 && !activeFileId) {
      setActiveFileId(filesQuery.data[0].id);
      setCode(filesQuery.data[0].content);
    }
  }, [filesQuery.data, activeFileId]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.type === "run_log" && msg.message) {
        setLogs((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), text: msg.message!, type: msg.logType || "info" },
        ]);
      }
      if (msg.type === "run_status") {
        if (msg.status === "completed" || msg.status === "failed") {
          setIsRunning(false);
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const saveMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { content });
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
  });

  const autoSave = useCallback(
    (newCode: string) => {
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (activeFileId) {
          saveMutation.mutate({ fileId: activeFileId, content: newCode });
        }
      }, 1500);
    },
    [activeFileId]
  );

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    autoSave(newCode);
  };

  const handleManualSave = () => {
    if (activeFileId) {
      saveMutation.mutate({ fileId: activeFileId, content: code });
    }
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      if (activeFileId && !saved) {
        await apiRequest("PATCH", `/api/files/${activeFileId}`, { content: code });
        setSaved(true);
      }
      const res = await apiRequest("POST", `/api/projects/${projectId}/run`, {
        code,
        language: projectQuery.data?.language || "javascript",
      });
      return res.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      setShowConsole(true);
    },
    onError: (err: any) => {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    setLogs([]);
    runMutation.mutate();
  };

  const switchFile = (file: File) => {
    if (activeFileId && !saved) {
      saveMutation.mutate({ fileId: activeFileId, content: code });
    }
    setActiveFileId(file.id);
    setCode(file.content);
    setSaved(true);
    setShowFiles(false);
  };

  const createFileMutation = useMutation({
    mutationFn: async () => {
      const lang = projectQuery.data?.language || "javascript";
      const ext = lang === "python" ? ".py" : ".ts";
      const name = `file_${Date.now()}${ext}`;
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, {
        filename: name,
        content: "",
      });
      return res.json();
    },
    onSuccess: (file: File) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setActiveFileId(file.id);
      setCode(file.content);
      setSaved(true);
      setShowFiles(false);
    },
  });

  const activeFile = filesQuery.data?.find((f) => f.id === activeFileId);
  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f111a]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0f111a]">
      <div className="flex items-center justify-between p-3 pt-10 bg-background/80 backdrop-blur-md border-b border-white/5 z-20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={() => setLocation("/dashboard")} data-testid="button-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate max-w-[120px]">{activeFile?.filename || "..."}</span>
              {saved ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-orange-400" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{project?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-8 h-8"
            onClick={handleManualSave}
            disabled={saved}
            data-testid="button-save"
          >
            <Save className={`w-4 h-4 ${saved ? "text-muted-foreground" : "text-orange-400"}`} />
          </Button>
          <Button
            size="sm"
            className={`rounded-full h-8 px-4 font-medium transition-colors ${isRunning ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90 shadow-[0_0_10px_rgba(139,92,246,0.3)]"}`}
            onClick={handleRun}
            disabled={runMutation.isPending}
            data-testid="button-run"
          >
            {runMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isRunning ? (
              <>
                <Square className="w-3 h-3 mr-1.5 fill-current" /> Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1.5 fill-current" /> Run
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative pb-[80px]">
        <textarea
          value={code}
          onChange={handleCodeChange}
          spellCheck={false}
          className="w-full h-full min-h-[500px] p-4 bg-transparent text-gray-300 font-mono text-sm leading-relaxed resize-none outline-none"
          style={{ fontFamily: "var(--font-mono)", tabSize: 2 }}
          data-testid="textarea-code"
        />
      </div>

      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-black/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col z-30"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 px-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Remote Terminal</span>
                {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </div>
              <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => setShowConsole(false)}>
                <ChevronLeft className="w-4 h-4 -rotate-90 text-muted-foreground" />
              </Button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {logs.length === 0 && !isRunning && (
                <p className="text-muted-foreground text-center py-4">Press Run to execute your code</p>
              )}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex gap-2 ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-gray-400"}`}
                >
                  <span className="opacity-40 select-none shrink-0">
                    {new Date(log.id).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{log.text}</span>
                </div>
              ))}
              {isRunning && (
                <div className="flex gap-2 text-gray-500 mt-2">
                  <span className="animate-pulse font-bold text-primary">_</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFiles && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-background/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col z-30"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 px-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Files</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => createFileMutation.mutate()} data-testid="button-add-file">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => setShowFiles(false)}>
                  <ChevronLeft className="w-4 h-4 -rotate-90 text-muted-foreground" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filesQuery.data?.map((file) => (
                <button
                  key={file.id}
                  onClick={() => switchFile(file)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${file.id === activeFileId ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5"}`}
                  data-testid={`file-item-${file.id}`}
                >
                  <FileCode2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium truncate">{file.filename}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center gap-1 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-20">
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10" onClick={() => { setShowConsole(!showConsole); setShowFiles(false); }} data-testid="button-toggle-console">
          <Terminal className={`w-5 h-5 ${showConsole ? "text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]" : "text-muted-foreground"}`} />
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10" onClick={() => { setShowFiles(!showFiles); setShowConsole(false); }} data-testid="button-toggle-files">
          <FileCode2 className={`w-5 h-5 ${showFiles ? "text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]" : "text-muted-foreground"}`} />
        </Button>
      </div>
    </div>
  );
}
