import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { WifiOff, Terminal } from "lucide-react";

interface WorkspaceTerminalProps {
  wsUrl: string | null;
  runnerOffline: boolean;
  visible: boolean;
}

const THEME = {
  background: "#0d1117",
  foreground: "#c9d1d9",
  cursor: "#58a6ff",
  selectionBackground: "#58a6ff33",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39d2c0",
  white: "#c9d1d9",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

export default function WorkspaceTerminal({ wsUrl, runnerOffline, visible }: WorkspaceTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const connectedUrlRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initTerminal = useCallback(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      theme: THEME,
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "input", data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });
  }, []);

  const closeSocket = useCallback((intentional: boolean) => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    intentionalCloseRef.current = intentional;
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    connectedUrlRef.current = null;
  }, []);

  const connect = useCallback((url: string) => {
    closeSocket(true);
    connectedUrlRef.current = url;
    intentionalCloseRef.current = false;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      termRef.current?.writeln("\r\n\x1b[32mConnected to workspace terminal.\x1b[0m\r\n");
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      }
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "output" && msg.data) {
            termRef.current?.write(msg.data);
          } else if (msg.type === "error") {
            termRef.current?.writeln(`\r\n\x1b[31m${msg.message || "Error"}\x1b[0m`);
          }
        } catch {
          termRef.current?.write(ev.data);
        }
      }
    };

    ws.onclose = () => {
      if (!intentionalCloseRef.current && connectedUrlRef.current === url) {
        termRef.current?.writeln("\r\n\x1b[33mDisconnected from terminal. Reconnecting...\x1b[0m");
        retryTimeoutRef.current = setTimeout(() => {
          if (connectedUrlRef.current === url) {
            connect(url);
          }
        }, 3000);
      }
    };

    ws.onerror = () => {};
  }, [closeSocket]);

  useEffect(() => {
    initTerminal();
  }, [initTerminal]);

  useEffect(() => {
    if (wsUrl && visible) {
      if (!termRef.current) initTerminal();
      if (connectedUrlRef.current === wsUrl && socketRef.current?.readyState === WebSocket.OPEN) return;
      connect(wsUrl);
    } else {
      closeSocket(true);
    }
  }, [wsUrl, visible, connect, closeSocket, initTerminal]);

  useEffect(() => {
    if (!visible || !fitAddonRef.current) return;
    const raf = requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [visible]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (visible && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    return () => {
      closeSocket(true);
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [closeSocket]);

  const showPlaceholder = runnerOffline || !wsUrl;

  return (
    <div className="w-full h-full relative bg-[#0d1117]">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: showPlaceholder ? "none" : "block" }}
        data-testid="workspace-terminal"
      />
      {runnerOffline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#484f58] gap-2">
          <WifiOff className="w-8 h-8 text-orange-400/60" />
          <p className="text-xs text-orange-400/80">Terminal unavailable (runner offline)</p>
        </div>
      )}
      {!runnerOffline && !wsUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#484f58] gap-2">
          <Terminal className="w-8 h-8" />
          <p className="text-xs">Start the workspace to access the terminal</p>
        </div>
      )}
    </div>
  );
}
