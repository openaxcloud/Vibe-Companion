import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Terminal, FileCode2, Loader2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type { Project, File } from "@shared/schema";

export default function DemoProject() {
  const [, setLocation] = useLocation();
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ id: number; text: string; type: "info" | "error" | "success" }[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
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
      setActiveFileId(demoQuery.data.files[0].id);
      setCode(demoQuery.data.files[0].content);
    }
  }, [demoQuery.data, activeFileId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setShowConsole(true);
    setLogs([{ id: Date.now(), text: "Executing in sandbox...", type: "info" }]);

    try {
      const res = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: demoQuery.data?.project?.language || "javascript",
        }),
      });
      const result = await res.json();

      if (result.stdout) {
        setLogs((prev) => [...prev, { id: Date.now() + 1, text: result.stdout.trimEnd(), type: "success" }]);
      }
      if (result.stderr) {
        setLogs((prev) => [...prev, { id: Date.now() + 2, text: result.stderr.trimEnd(), type: "error" }]);
      }
      setLogs((prev) => [
        ...prev,
        { id: Date.now() + 3, text: `Process exited with code ${result.exitCode}`, type: result.exitCode === 0 ? "success" : "error" },
      ]);
    } catch (err: any) {
      setLogs((prev) => [...prev, { id: Date.now() + 4, text: `Error: ${err.message}`, type: "error" }]);
    } finally {
      setIsRunning(false);
    }
  };

  const switchFile = (file: File) => {
    setActiveFileId(file.id);
    setCode(file.content);
    setShowFiles(false);
  };

  const activeFile = demoQuery.data?.files?.find((f) => f.id === activeFileId);

  if (demoQuery.isLoading) {
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
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={() => setLocation("/")} data-testid="button-back-demo">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate max-w-[120px]">{activeFile?.filename || "..."}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
                READ-ONLY
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Public Demo</span>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-full h-8 px-4 font-medium bg-primary hover:bg-primary/90 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
          onClick={handleRun}
          disabled={isRunning}
          data-testid="button-run-demo"
        >
          {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1.5 fill-current" /> Run</>}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto relative pb-[80px]">
        <textarea
          value={code}
          readOnly
          spellCheck={false}
          className="w-full h-full min-h-[500px] p-4 bg-transparent text-gray-300 font-mono text-sm leading-relaxed resize-none outline-none cursor-default"
          style={{ fontFamily: "var(--font-mono)", tabSize: 2 }}
          data-testid="textarea-code-demo"
        />
      </div>

      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-black/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl flex flex-col z-30"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 px-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Output</span>
              </div>
              <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => setShowConsole(false)}>
                <ChevronLeft className="w-4 h-4 -rotate-90 text-muted-foreground" />
              </Button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {logs.map((log) => (
                <div key={log.id} className={`flex gap-2 ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-gray-400"}`}>
                  <span className="break-all whitespace-pre-wrap">{log.text}</span>
                </div>
              ))}
              {isRunning && <span className="animate-pulse font-bold text-primary">_</span>}
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
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-background/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl flex flex-col z-30"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 px-2">
                <FileCode2 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Files</span>
              </div>
              <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => setShowFiles(false)}>
                <ChevronLeft className="w-4 h-4 -rotate-90 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {demoQuery.data?.files?.map((file) => (
                <button
                  key={file.id}
                  onClick={() => switchFile(file)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${file.id === activeFileId ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5"}`}
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
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10" onClick={() => { setShowConsole(!showConsole); setShowFiles(false); }}>
          <Terminal className={`w-5 h-5 ${showConsole ? "text-primary" : "text-muted-foreground"}`} />
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10" onClick={() => { setShowFiles(!showFiles); setShowConsole(false); }}>
          <FileCode2 className={`w-5 h-5 ${showFiles ? "text-primary" : "text-muted-foreground"}`} />
        </Button>
      </div>
    </div>
  );
}
