import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Bug, Play, Pause, SkipForward, ArrowDownToLine, ArrowUpFromLine,
  StepForward, ChevronRight, ChevronDown, Circle, CircleDot,
  X, Loader2, Wifi, WifiOff, Terminal, Trash2, Plus, FileCode2,
  Variable, Layers, CornerDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallFrame {
  callFrameId: string;
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
  scopeChain: ScopeDescriptor[];
}

interface ScopeDescriptor {
  type: string;
  name?: string;
  objectId: string;
}

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  enabled: boolean;
  resolved: boolean;
}

interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: number;
}

type DebugStatus = "disconnected" | "connecting" | "connected" | "paused";

export function ReplitDebuggerPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<DebugStatus>("disconnected");
  const [callFrames, setCallFrames] = useState<CallFrame[]>([]);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [expandedFrame, setExpandedFrame] = useState<string | null>(null);
  const [scopeVars, setScopeVars] = useState<Record<string, any[]>>({});
  const [evalInput, setEvalInput] = useState("");
  const [newBpFile, setNewBpFile] = useState("");
  const [newBpLine, setNewBpLine] = useState("");
  const [showAddBp, setShowAddBp] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/debugger?projectId=${projectId}`);
    wsRef.current = ws;

    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      setStatus((current) => {
        if (current === "connecting") {
          setConsoleEntries(prev => [...prev.slice(-200), { type: "error", text: "Debug session failed to start. Make sure your project has a valid entry point.", timestamp: Date.now() }]);
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          return "disconnected";
        }
        return current;
      });
    }, 10000);

    ws.onopen = () => {
      setStatus("connecting");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "connected":
            if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
            setStatus("connected");
            addConsole("info", "Debugger attached to process");
            break;
          case "notRunning":
            if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
            setStatus("disconnected");
            addConsole("error", msg.message || "No debuggable process found. Click 'Start Debug Session' to launch your project in debug mode.");
            break;
          case "paused":
            setStatus("paused");
            setPauseReason(msg.reason || "breakpoint");
            setCallFrames(msg.callFrames || []);
            addConsole("info", `Paused on ${msg.reason || "breakpoint"}`);
            break;
          case "resumed":
            setStatus("connected");
            setCallFrames([]);
            setScopeVars({});
            addConsole("info", "Resumed");
            break;
          case "breakpointAdded":
            if (msg.breakpoint) {
              setBreakpoints(prev => [...prev.filter(b => b.id !== msg.breakpoint.id), msg.breakpoint]);
            }
            break;
          case "breakpointRemoved":
            setBreakpoints(prev => prev.filter(b => b.id !== msg.breakpointId));
            break;
          case "console":
            const text = (msg.args || []).map((a: any) => a.value || a.type).join(" ");
            addConsole(msg.logType || "log", text);
            break;
          case "exception":
            addConsole("error", `${msg.text}: ${msg.description || ""}`);
            break;
          case "result":
            if (msg.result?.result) {
              const val = msg.result.result;
              addConsole("result", val.value !== undefined ? String(val.value) : val.description || val.type);
            }
            if (msg.result?.result?.properties) {
              handleScopeProperties(msg.id, msg.result.result.properties);
            }
            break;
          case "disconnected":
            setStatus("disconnected");
            setCallFrames([]);
            addConsole("info", "Debugger disconnected");
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };
  }, [projectId]);

  const addConsole = (type: string, text: string) => {
    setConsoleEntries(prev => [...prev.slice(-200), { type, text, timestamp: Date.now() }]);
    setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleScopeProperties = (id: string, properties: any[]) => {
    const vars = properties.map((p: any) => ({
      name: p.name,
      value: p.value?.value !== undefined ? String(p.value.value) : p.value?.description || p.value?.type || "undefined",
      type: p.value?.type || "undefined",
    }));
    setScopeVars(prev => ({ ...prev, [id]: vars }));
  };

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const debugRunMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/projects/${projectId}/debug-run`);
    },
    onSuccess: (data: any) => {
      if (data.status === "started" && data.inspectPort) {
        addConsole("info", `Debug session started (${data.entryFile}) — connecting to inspector on port ${data.inspectPort}...`);
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            send({ type: "reconnect" });
          } else {
            connect();
          }
        }, 300);
      } else if (data.language === "python") {
        addConsole("info", `Python debug session started (${data.entryFile}). Note: Python debugging uses print-based output.`);
        setStatus("connected");
      } else {
        addConsole("error", data.message || "Debug session could not start.");
        setStatus("disconnected");
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "Debug session failed to start. Make sure your project has a valid entry point.";
      addConsole("error", msg);
      toast({ title: "Debug Error", description: msg, variant: "destructive" });
      setStatus("disconnected");
    },
  });

  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const addBreakpoint = () => {
    const line = parseInt(newBpLine);
    if (!newBpFile || isNaN(line) || line < 0) return;
    send({ command: "setBreakpoint", params: { file: newBpFile, line: line - 1 } });
    setNewBpFile("");
    setNewBpLine("");
    setShowAddBp(false);
  };

  const removeBreakpoint = (bp: Breakpoint) => {
    send({ command: "removeBreakpoint", params: { breakpointId: bp.id } });
    setBreakpoints(prev => prev.filter(b => b.id !== bp.id));
  };

  const evalExpression = () => {
    if (!evalInput.trim()) return;
    addConsole("eval", `> ${evalInput}`);
    const activeFrame = callFrames[0];
    send({
      command: "evaluate",
      params: {
        expression: evalInput,
        callFrameId: activeFrame?.callFrameId,
      },
    });
    setEvalInput("");
  };

  const loadScopeVars = (frame: CallFrame) => {
    if (expandedFrame === frame.callFrameId) {
      setExpandedFrame(null);
      return;
    }
    setExpandedFrame(frame.callFrameId);
    frame.scopeChain.forEach(scope => {
      if (scope.objectId && scope.type !== "global") {
        send({ command: "getScopeVariables", params: { scopeObjectId: scope.objectId } });
      }
    });
  };

  const isActive = status === "connected" || status === "paused";

  return (
    <div className="h-full flex flex-col bg-[var(--ide-panel)] text-[var(--ide-text)]" data-testid="debugger-panel">
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-[13px] font-semibold">Debugger</span>
          <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
            status === "connected" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" :
            status === "paused" ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
            status === "connecting" ? "bg-blue-500/10 text-blue-400" :
            "bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
          }`} data-testid="debug-status">
            {status === "connected" && <><Wifi className="w-2.5 h-2.5" /> Running</>}
            {status === "paused" && <><Pause className="w-2.5 h-2.5" /> Paused</>}
            {status === "connecting" && <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Connecting</>}
            {status === "disconnected" && <><WifiOff className="w-2.5 h-2.5" /> Disconnected</>}
          </span>
        </div>
      </div>

      {!isActive && status !== "connecting" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center">
            <Bug className="w-7 h-7 text-[#F59E0B]" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold mb-1">Node.js Debugger</h3>
            <p className="text-[11px] text-[var(--ide-text-muted)] max-w-[240px]">
              Start a debug session to set breakpoints, step through code, and inspect variables in real-time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-[#F59E0B] hover:bg-[#D97706] text-black text-[11px] h-8 gap-1.5"
              onClick={() => debugRunMutation.mutate()}
              disabled={debugRunMutation.isPending}
              data-testid="button-debug-start"
            >
              {debugRunMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start Debug Session
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-8 gap-1.5 border-[var(--ide-border)] text-[var(--ide-text-muted)]"
              onClick={connect}
              data-testid="button-debug-attach"
            >
              <Wifi className="w-3.5 h-3.5" />
              Attach
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-bg)]/50 shrink-0">
            <button
              className="p-1.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[#0CCE6B] transition-colors disabled:opacity-30"
              onClick={() => send({ command: "resume" })}
              disabled={status !== "paused"}
              title="Resume (F8)"
              data-testid="button-debug-resume"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[#F59E0B] transition-colors disabled:opacity-30"
              onClick={() => send({ command: "pause" })}
              disabled={status !== "connected"}
              title="Pause (F8)"
              data-testid="button-debug-pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-[var(--ide-border)] mx-0.5" />
            <button
              className="p-1.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors disabled:opacity-30"
              onClick={() => send({ command: "stepOver" })}
              disabled={status !== "paused"}
              title="Step Over (F10)"
              data-testid="button-debug-step-over"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors disabled:opacity-30"
              onClick={() => send({ command: "stepInto" })}
              disabled={status !== "paused"}
              title="Step Into (F11)"
              data-testid="button-debug-step-into"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors disabled:opacity-30"
              onClick={() => send({ command: "stepOut" })}
              disabled={status !== "paused"}
              title="Step Out (Shift+F11)"
              data-testid="button-debug-step-out"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1" />
            <button
              className="p-1.5 rounded hover:bg-red-500/10 text-[var(--ide-text-muted)] hover:text-red-400 transition-colors"
              onClick={() => {
                if (wsRef.current) wsRef.current.close();
                setStatus("disconnected");
                setCallFrames([]);
                setScopeVars({});
              }}
              title="Stop Debugging"
              data-testid="button-debug-stop"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-[var(--ide-border)]">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)]">CALL STACK</span>
              </div>
              {callFrames.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-[var(--ide-text-muted)] italic">
                  {status === "paused" ? "No call frames" : "Not paused"}
                </div>
              ) : (
                <div className="pb-1">
                  {callFrames.map((frame, idx) => {
                    const fileName = frame.url.split("/").pop() || frame.url;
                    const isExpanded = expandedFrame === frame.callFrameId;
                    return (
                      <div key={frame.callFrameId}>
                        <button
                          className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--ide-surface)] transition-colors ${idx === 0 ? "bg-[#F59E0B]/5" : ""}`}
                          onClick={() => loadScopeVars(frame)}
                          data-testid={`callframe-${idx}`}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" />}
                          <span className="text-[11px] font-medium text-[var(--ide-text)] truncate">{frame.functionName}</span>
                          <span className="text-[10px] text-[var(--ide-text-muted)] ml-auto shrink-0">{fileName}:{frame.lineNumber + 1}</span>
                        </button>
                        {isExpanded && (
                          <div className="ml-6 border-l border-[var(--ide-border)] pl-2 py-1">
                            {frame.scopeChain.filter(s => s.type !== "global").map((scope, si) => (
                              <div key={si} className="mb-1">
                                <div className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase mb-0.5">{scope.type}{scope.name ? ` (${scope.name})` : ""}</div>
                                {(scopeVars[scope.objectId] || []).map((v: any, vi: number) => (
                                  <div key={vi} className="flex items-center gap-1.5 py-0.5 px-1">
                                    <Variable className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                                    <span className="text-[10px] font-mono text-[#7C65CB]">{v.name}</span>
                                    <span className="text-[10px] text-[var(--ide-text-muted)]">=</span>
                                    <span className="text-[10px] font-mono text-[#0CCE6B] truncate">{v.value}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-b border-[var(--ide-border)]">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)]">BREAKPOINTS</span>
                  <span className="text-[10px] text-[var(--ide-text-muted)]">({breakpoints.length})</span>
                </div>
                <button
                  className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  onClick={() => setShowAddBp(!showAddBp)}
                  data-testid="button-add-breakpoint"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {showAddBp && (
                <div className="px-3 pb-2 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="file.js"
                    value={newBpFile}
                    onChange={(e) => setNewBpFile(e.target.value)}
                    className="flex-1 h-7 text-[10px] px-2 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#F59E0B]/50"
                    data-testid="input-bp-file"
                  />
                  <input
                    type="number"
                    placeholder="Line"
                    value={newBpLine}
                    onChange={(e) => setNewBpLine(e.target.value)}
                    className="w-16 h-7 text-[10px] px-2 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#F59E0B]/50"
                    onKeyDown={(e) => e.key === "Enter" && addBreakpoint()}
                    data-testid="input-bp-line"
                  />
                  <Button size="sm" className="h-7 text-[10px] bg-[#F59E0B] hover:bg-[#D97706] text-black" onClick={addBreakpoint} data-testid="button-bp-add-confirm">
                    Add
                  </Button>
                </div>
              )}

              {breakpoints.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[var(--ide-text-muted)] italic">No breakpoints set</div>
              ) : (
                <div className="pb-1">
                  {breakpoints.map(bp => (
                    <div key={bp.id} className="flex items-center gap-1.5 px-3 py-1 hover:bg-[var(--ide-surface)] group">
                      <Circle className={`w-3 h-3 shrink-0 ${bp.resolved ? "text-red-400 fill-red-400" : "text-red-400/40"}`} />
                      <FileCode2 className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                      <span className="text-[10px] font-mono text-[var(--ide-text)] truncate">{bp.file}</span>
                      <span className="text-[10px] text-[var(--ide-text-muted)]">:{bp.line + 1}</span>
                      <button
                        className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                        onClick={() => removeBreakpoint(bp)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 px-3 py-2">
                <Terminal className="w-3.5 h-3.5 text-[#0CCE6B]" />
                <span className="text-[11px] font-semibold text-[var(--ide-text-secondary)]">DEBUG CONSOLE</span>
                <div className="flex-1" />
                <button
                  className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  onClick={() => setConsoleEntries([])}
                  data-testid="button-clear-debug-console"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto px-3 font-mono">
                {consoleEntries.map((entry, idx) => (
                  <div key={idx} className={`text-[10px] py-0.5 flex gap-1.5 ${
                    entry.type === "error" ? "text-red-400" :
                    entry.type === "warn" ? "text-[#F59E0B]" :
                    entry.type === "result" ? "text-[#0CCE6B]" :
                    entry.type === "eval" ? "text-[#7C65CB]" :
                    "text-[var(--ide-text-muted)]"
                  }`}>
                    {entry.type === "eval" && <CornerDownRight className="w-2.5 h-2.5 shrink-0 mt-0.5" />}
                    <span className="break-all">{entry.text}</span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
              {isActive && (
                <div className="px-3 py-2 border-t border-[var(--ide-border)]">
                  <div className="flex gap-1.5">
                    <span className="text-[10px] text-[#7C65CB] font-mono shrink-0 mt-1">{">"}</span>
                    <input
                      type="text"
                      placeholder="Evaluate expression..."
                      value={evalInput}
                      onChange={(e) => setEvalInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && evalExpression()}
                      className="flex-1 h-6 text-[10px] px-2 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] font-mono placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]/50"
                      data-testid="input-debug-eval"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
