import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { WifiOff, Terminal } from "lucide-react";

interface WorkspaceTerminalProps {
  wsUrl: string | null;
  runnerOffline: boolean;
  visible: boolean;
  onLastCommand?: (command: string) => void;
  shellBell?: boolean;
  accessibleTerminal?: boolean;
  theme?: "dark" | "light";
}

export interface WorkspaceTerminalHandle {
  searchNext: (query: string) => boolean;
  searchPrevious: (query: string) => boolean;
  clearSearch: () => void;
}

const DARK_THEME = {
  background: "#0E1525",
  foreground: "#F5F9FC",
  cursor: "#0079F2",
  cursorAccent: "#0E1525",
  selectionBackground: "#0079F233",
  selectionForeground: "#F5F9FC",
  black: "#676D7E",
  red: "#ff7b72",
  green: "#0CCE6B",
  yellow: "#d29922",
  blue: "#0079F2",
  magenta: "#7C65CB",
  cyan: "#39d2c0",
  white: "#F5F9FC",
  brightBlack: "#9DA2B0",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

const LIGHT_THEME = {
  background: "#FFFFFF",
  foreground: "#1E1E1E",
  cursor: "#0079F2",
  cursorAccent: "#FFFFFF",
  selectionBackground: "#0079F230",
  selectionForeground: "#1E1E1E",
  black: "#1E1E1E",
  red: "#CD3131",
  green: "#00BC7C",
  yellow: "#949800",
  blue: "#0451A5",
  magenta: "#BC05BC",
  cyan: "#0598BC",
  white: "#F5F5F5",
  brightBlack: "#666666",
  brightRed: "#E74856",
  brightGreen: "#16C60C",
  brightYellow: "#C19C00",
  brightBlue: "#3B78FF",
  brightMagenta: "#B4009E",
  brightCyan: "#61D6D6",
  brightWhite: "#FFFFFF",
};

const WorkspaceTerminal = forwardRef<WorkspaceTerminalHandle, WorkspaceTerminalProps>(
  function WorkspaceTerminal({ wsUrl, runnerOffline, visible, onLastCommand, shellBell = false, accessibleTerminal = false, theme: themeProp }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlDark, setHtmlDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setHtmlDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const resolvedTheme = themeProp || (htmlDark ? "dark" : "light");
  const xtermTheme = resolvedTheme === "light" ? LIGHT_THEME : DARK_THEME;
  const termRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const connectedUrlRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLastCommandRef = useRef(onLastCommand);
  onLastCommandRef.current = onLastCommand;

  useImperativeHandle(ref, () => ({
    searchNext: (query: string) => {
      if (searchAddonRef.current && query) {
        return searchAddonRef.current.findNext(query, { regex: false, caseSensitive: false, wholeWord: false, incremental: true });
      }
      return false;
    },
    searchPrevious: (query: string) => {
      if (searchAddonRef.current && query) {
        return searchAddonRef.current.findPrevious(query, { regex: false, caseSensitive: false, wholeWord: false, incremental: true });
      }
      return false;
    },
    clearSearch: () => {
      searchAddonRef.current?.clearDecorations();
    },
  }));

  const initTerminal = useCallback(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      theme: xtermTheme,
      allowProposedApi: true,
      scrollback: 5000,
      screenReaderMode: accessibleTerminal,
      bellStyle: shellBell ? "sound" : "none",
    } as any);

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

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
  }, [accessibleTerminal, shellBell, xtermTheme]);

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
          } else if (msg.type === "lastCommand" && msg.command) {
            onLastCommandRef.current?.(msg.command);
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
    if (termRef.current) {
      termRef.current.options.theme = xtermTheme;
    }
  }, [xtermTheme]);

  useEffect(() => {
    if (wsUrl) {
      if (!termRef.current) initTerminal();
      if (connectedUrlRef.current === wsUrl && socketRef.current?.readyState === WebSocket.OPEN) return;
      connect(wsUrl);
    } else {
      closeSocket(true);
    }
  }, [wsUrl, connect, closeSocket, initTerminal]);

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
      searchAddonRef.current = null;
    };
  }, [closeSocket]);

  const showPlaceholder = runnerOffline || !wsUrl;

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: xtermTheme.background }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: showPlaceholder ? "none" : "block" }}
        data-testid="workspace-terminal"
      />
      {runnerOffline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: xtermTheme.brightBlack }}>
          <WifiOff className="w-8 h-8 text-orange-400/60" />
          <p className="text-xs text-orange-400/80">Terminal unavailable (runner offline)</p>
        </div>
      )}
      {!runnerOffline && !wsUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: xtermTheme.brightBlack }}>
          <Terminal className="w-8 h-8" />
          <p className="text-xs">Connecting to terminal...</p>
        </div>
      )}
    </div>
  );
});

export default WorkspaceTerminal;
