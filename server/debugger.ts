import WebSocket from "ws";
import { log } from "./index";
import { getActiveProcess } from "./executor";

export interface DebugSession {
  projectId: string;
  inspectorUrl: string;
  inspectorWs: WebSocket | null;
  clientWs: WebSocket | null;
  breakpoints: Breakpoint[];
  paused: boolean;
  callFrames: CallFrame[];
  scopeVariables: Record<string, ScopeVariable[]>;
  scripts: DebugScript[];
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  enabled: boolean;
  resolved: boolean;
  breakpointId?: string;
}

export interface CallFrame {
  callFrameId: string;
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
  scopeChain: ScopeDescriptor[];
}

export interface ScopeDescriptor {
  type: string;
  name?: string;
  objectId: string;
}

export interface ScopeVariable {
  name: string;
  value: string;
  type: string;
  objectId?: string;
  expandable: boolean;
}

export interface DebugScript {
  scriptId: string;
  url: string;
  startLine: number;
  endLine: number;
}

const activeSessions = new Map<string, DebugSession>();
let msgIdCounter = 1;

function nextId(): number {
  return msgIdCounter++;
}

export function getDebugSession(projectId: string): DebugSession | undefined {
  return activeSessions.get(projectId);
}

export function createDebugSession(projectId: string): DebugSession {
  const existing = activeSessions.get(projectId);
  if (existing) {
    cleanupSession(existing);
  }

  const session: DebugSession = {
    projectId,
    inspectorUrl: "",
    inspectorWs: null,
    clientWs: null,
    breakpoints: [],
    paused: false,
    callFrames: [],
    scopeVariables: {},
    scripts: [],
  };

  activeSessions.set(projectId, session);
  return session;
}

export function cleanupSession(session: DebugSession) {
  try {
    if (session.inspectorWs && session.inspectorWs.readyState === WebSocket.OPEN) {
      session.inspectorWs.close();
    }
  } catch {}
  activeSessions.delete(session.projectId);
}

export async function connectToInspector(
  session: DebugSession,
  inspectPort: number
): Promise<boolean> {
  const maxRetries = 10;
  const retryDelay = 800;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const listUrl = `http://127.0.0.1:${inspectPort}/json`;
      const resp = await fetch(listUrl);
      const targets = await resp.json() as any[];

      if (!targets || targets.length === 0) {
        log(`No debug targets found (attempt ${attempt + 1}/${maxRetries})`, "debugger");
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }

      const target = targets[0];
      const wsUrl = target.webSocketDebuggerUrl;
      if (!wsUrl) {
        log("No webSocketDebuggerUrl in target", "debugger");
        return false;
      }

      session.inspectorUrl = wsUrl;

      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        session.inspectorWs = ws;

        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.on("open", () => {
          clearTimeout(timeout);
          log(`Connected to inspector at ${wsUrl}`, "debugger");

          sendToInspector(session, "Debugger.enable", {});
          sendToInspector(session, "Runtime.enable", {});
          sendToInspector(session, "Runtime.runIfWaitingForDebugger", {});

          resolve(true);
        });

        ws.on("message", (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());
            handleInspectorMessage(session, msg);
          } catch (e) {
            log(`Inspector message parse error: ${e}`, "debugger");
          }
        });

        ws.on("close", () => {
          log("Inspector connection closed", "debugger");
          session.inspectorWs = null;
          session.paused = false;
          notifyClient(session, { type: "disconnected" });
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          log(`Inspector connection error: ${err.message}`, "debugger");
          resolve(false);
        });
      });
    } catch (err: any) {
      log(`Inspector fetch failed (attempt ${attempt + 1}/${maxRetries}): ${err.message}`, "debugger");
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  log("Failed to connect to inspector after all retries", "debugger");
  return false;
}

function sendToInspector(
  session: DebugSession,
  method: string,
  params: Record<string, any>
): number {
  const id = nextId();
  if (session.inspectorWs && session.inspectorWs.readyState === WebSocket.OPEN) {
    session.inspectorWs.send(JSON.stringify({ id, method, params }));
  }
  return id;
}

function notifyClient(session: DebugSession, msg: any) {
  if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
    session.clientWs.send(JSON.stringify(msg));
  }
}

function handleInspectorMessage(session: DebugSession, msg: any) {
  if (msg.method === "Debugger.paused") {
    session.paused = true;
    session.callFrames = (msg.params.callFrames || []).map((cf: any) => ({
      callFrameId: cf.callFrameId,
      functionName: cf.functionName || "(anonymous)",
      url: cf.url || "",
      lineNumber: cf.location?.lineNumber ?? 0,
      columnNumber: cf.location?.columnNumber ?? 0,
      scopeChain: (cf.scopeChain || []).map((s: any) => ({
        type: s.type,
        name: s.name,
        objectId: s.object?.objectId || "",
      })),
    }));

    notifyClient(session, {
      type: "paused",
      reason: msg.params.reason,
      callFrames: session.callFrames,
      hitBreakpoints: msg.params.hitBreakpoints || [],
    });
  } else if (msg.method === "Debugger.resumed") {
    session.paused = false;
    session.callFrames = [];
    notifyClient(session, { type: "resumed" });
  } else if (msg.method === "Debugger.scriptParsed") {
    const script: DebugScript = {
      scriptId: msg.params.scriptId,
      url: msg.params.url || "",
      startLine: msg.params.startLine || 0,
      endLine: msg.params.endLine || 0,
    };
    session.scripts.push(script);
    notifyClient(session, { type: "scriptParsed", script });
  } else if (msg.method === "Debugger.breakpointResolved") {
    const bp = session.breakpoints.find(
      (b) => b.breakpointId === msg.params.breakpointId
    );
    if (bp) {
      bp.resolved = true;
      bp.line = msg.params.location?.lineNumber ?? bp.line;
    }
    notifyClient(session, {
      type: "breakpointResolved",
      breakpointId: msg.params.breakpointId,
      location: msg.params.location,
    });
  } else if (msg.id && msg.result) {
    notifyClient(session, { type: "result", id: msg.id, result: msg.result });
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params.args || []).map((a: any) => ({
      type: a.type,
      value: a.value !== undefined ? String(a.value) : a.description || a.type,
    }));
    notifyClient(session, {
      type: "console",
      logType: msg.params.type,
      args,
    });
  } else if (msg.method === "Runtime.exceptionThrown") {
    notifyClient(session, {
      type: "exception",
      text: msg.params.exceptionDetails?.text || "Exception",
      description:
        msg.params.exceptionDetails?.exception?.description || "",
      lineNumber: msg.params.exceptionDetails?.lineNumber,
      url: msg.params.exceptionDetails?.url,
    });
  }
}

export function handleDebugCommand(
  session: DebugSession,
  command: string,
  params: Record<string, any>
): void {
  switch (command) {
    case "setBreakpoint": {
      const { file, line, condition } = params;
      const scriptUrl = file;
      const bp: Breakpoint = {
        id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        line,
        condition,
        enabled: true,
        resolved: false,
      };

      const bpParams: any = {
        location: { scriptId: "", lineNumber: line },
        condition: condition || undefined,
      };

      const matchingScript = session.scripts.find(
        (s) => s.url.endsWith(file) || s.url === scriptUrl
      );

      if (matchingScript) {
        bpParams.location.scriptId = matchingScript.scriptId;
        const id = sendToInspector(session, "Debugger.setBreakpoint", bpParams);
        bp.breakpointId = String(id);
      } else {
        const urlPattern = `*${file}`;
        const id = sendToInspector(session, "Debugger.setBreakpointByUrl", {
          lineNumber: line,
          urlRegex: file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          condition: condition || undefined,
        });
        bp.breakpointId = String(id);
      }

      session.breakpoints.push(bp);
      notifyClient(session, { type: "breakpointAdded", breakpoint: bp });
      break;
    }

    case "removeBreakpoint": {
      const { breakpointId } = params;
      const idx = session.breakpoints.findIndex(
        (b) => b.id === breakpointId || b.breakpointId === breakpointId
      );
      if (idx >= 0) {
        const bp = session.breakpoints[idx];
        if (bp.breakpointId) {
          sendToInspector(session, "Debugger.removeBreakpoint", {
            breakpointId: bp.breakpointId,
          });
        }
        session.breakpoints.splice(idx, 1);
        notifyClient(session, { type: "breakpointRemoved", breakpointId });
      }
      break;
    }

    case "resume":
      sendToInspector(session, "Debugger.resume", {});
      break;

    case "stepOver":
      sendToInspector(session, "Debugger.stepOver", {});
      break;

    case "stepInto":
      sendToInspector(session, "Debugger.stepInto", {});
      break;

    case "stepOut":
      sendToInspector(session, "Debugger.stepOut", {});
      break;

    case "pause":
      sendToInspector(session, "Debugger.pause", {});
      break;

    case "evaluate": {
      const { expression, callFrameId } = params;
      if (callFrameId) {
        sendToInspector(session, "Debugger.evaluateOnCallFrame", {
          callFrameId,
          expression,
          returnByValue: true,
        });
      } else {
        sendToInspector(session, "Runtime.evaluate", {
          expression,
          returnByValue: true,
        });
      }
      break;
    }

    case "getProperties": {
      const { objectId } = params;
      sendToInspector(session, "Runtime.getProperties", {
        objectId,
        ownProperties: true,
        generatePreview: true,
      });
      break;
    }

    case "getScopeVariables": {
      const { scopeObjectId } = params;
      sendToInspector(session, "Runtime.getProperties", {
        objectId: scopeObjectId,
        ownProperties: false,
        generatePreview: true,
      });
      break;
    }

    default:
      log(`Unknown debug command: ${command}`, "debugger");
  }
}

export function getInspectPort(projectId: string): number {
  const hash = projectId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 9229 + (hash % 100);
}
