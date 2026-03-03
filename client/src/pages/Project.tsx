import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Square, Terminal, FileCode2, MoreVertical, LayoutPanelTop } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";

const DEFAULT_CODE = `import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Vibe Mobile!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;

export default function Project() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{id: number, text: string, type: 'info' | 'error' | 'success'}[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      addLog("Process terminated by user.", "error");
      return;
    }
    
    setIsRunning(true);
    setShowConsole(true);
    setLogs([]);
    addLog("Mounting workspace on remote server...", "info");
    
    setTimeout(() => addLog("Installing dependencies...", "info"), 600);
    setTimeout(() => addLog("Starting development server...", "info"), 1500);
    setTimeout(() => addLog("Server running on port 3000", "success"), 2500);
  };

  const addLog = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { id: Date.now(), text, type }]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col bg-[#0f111a]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pt-10 bg-background/80 backdrop-blur-md border-b border-white/5 z-20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={() => setLocation("/dashboard")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">index.ts</span>
            <span className="text-[10px] text-muted-foreground">vibe-mobile-app</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            className={`rounded-full h-8 px-4 font-medium transition-colors ${isRunning ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90 shadow-[0_0_10px_rgba(139,92,246,0.3)]'}`}
            onClick={handleRun}
          >
            {isRunning ? (
              <><Square className="w-3 h-3 mr-1.5 fill-current" /> Stop</>
            ) : (
              <><Play className="w-3 h-3 mr-1.5 fill-current" /> Run</>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto relative pb-[120px]">
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={code => Prism.highlight(code, Prism.languages.typescript, 'typescript')}
          padding={16}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            minHeight: '100%',
            outline: 'none',
          }}
          className="text-gray-300 editor-container focus:outline-none"
        />
      </div>

      {/* Bottom Panel (Console) */}
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
              </div>
              <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full hover:bg-white/10" onClick={() => setShowConsole(false)}>
                <ChevronLeft className="w-4 h-4 -rotate-90 text-muted-foreground" />
              </Button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
              {logs.map((log) => (
                <div key={log.id} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                  <span className="opacity-40 select-none shrink-0">{new Date(log.id).toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
                  <span className="break-all">{log.text}</span>
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

      {/* Floating Action Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center gap-1 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-20">
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10" onClick={() => setShowConsole(!showConsole)}>
          <Terminal className={`w-5 h-5 ${showConsole ? 'text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'text-muted-foreground'}`} />
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 bg-white/5 hover:bg-white/10 text-primary">
          <FileCode2 className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-white/10 text-muted-foreground">
          <LayoutPanelTop className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}