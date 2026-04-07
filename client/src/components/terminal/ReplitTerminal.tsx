import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Square,
  RotateCcw,
  Settings,
  Copy,
  Search,
  ChevronDown,
  Power,
  PowerOff,
  Zap,
  Clock,
} from "lucide-react";
import "xterm/css/xterm.css";

interface TerminalSession {
  id: string;
  name: string;
  isActive: boolean;
  status: "running" | "stopped" | "error";
  lastActivity: Date;
  workingDirectory: string;
  process?: string;
}

interface ReplitTerminalProps {
  projectId: number;
  className?: string;
  defaultCommand?: string;
  onCommandExecute?: (command: string) => void;
  maxHeight?: number;
  theme?: "dark" | "light";
  allowMultipleSessions?: boolean;
}

export function ReplitTerminal({
  projectId,
  className = "",
  defaultCommand,
  onCommandExecute,
  maxHeight = 400,
  theme = "dark",
  allowMultipleSessions = true,
}: ReplitTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: "main",
      name: "Shell",
      isActive: true,
      status: "running",
      lastActivity: new Date(),
      workingDirectory: "/",
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("main");
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentInput, setCurrentInput] = useState("");

  // Configuration du thème du terminal
  const terminalTheme = theme === "dark" ? {
    background: "#0d1117",
    foreground: "#e6edf3",
    cursor: "#f85149",
    cursorAccent: "#f85149",
    selection: "#264f78",
    black: "#484f58",
    red: "#ff7b72",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39c5cf",
    white: "#e6edf3",
    brightBlack: "#6e7681",
    brightRed: "#ffa198",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#39c5cf",
    brightWhite: "#f0f6fc",
  } : {
    background: "#ffffff",
    foreground: "#24292f",
    cursor: "#0969da",
    cursorAccent: "#0969da",
    selection: "#b6d7ff",
    black: "#24292f",
    red: "#cf222e",
    green: "#116329",
    yellow: "#4d2d00",
    blue: "#0969da",
    magenta: "#8250df",
    cyan: "#1b7c83",
    white: "#6e7781",
    brightBlack: "#656d76",
    brightRed: "#a40e26",
    brightGreen: "#0f5323",
    brightYellow: "#633c01",
    brightBlue: "#0550ae",
    brightMagenta: "#6f42c1",
    brightCyan: "#1b7c83",
    brightWhite: "#24292f",
  };

  // Initialisation du terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Configuration du terminal
    const terminal = new Terminal({
      theme: terminalTheme,
      fontSize: 13,
      fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
      rows: 24,
      cols: 80,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: " ()[]{}',\"`",
    });

    // Addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Ouverture du terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Message de bienvenue
    terminal.writeln("\x1b[1;32m╭─────────────────────────────────────────╮\x1b[0m");
    terminal.writeln("\x1b[1;32m│\x1b[0m \x1b[1;36mWelcome to Replit Terminal\x1b[0m           \x1b[1;32m│\x1b[0m");
    terminal.writeln("\x1b[1;32m│\x1b[0m \x1b[90mConnecting to workspace...\x1b[0m            \x1b[1;32m│\x1b[0m");
    terminal.writeln("\x1b[1;32m╰─────────────────────────────────────────╯\x1b[0m");
    terminal.writeln("");

    // Configuration WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        terminal.writeln("\x1b[1;32m✓ Connected to terminal server\x1b[0m");
        terminal.write("\x1b[1;36muser@replit\x1b[0m:\x1b[1;34m/workspace\x1b[0m$ ");
        
        if (defaultCommand) {
          terminal.writeln(defaultCommand);
          ws.send(JSON.stringify({
            type: "input",
            sessionId: activeSessionId,
            data: defaultCommand + "\r"
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "output":
              terminal.write(message.data);
              break;
            case "error":
              terminal.write(`\x1b[1;31m${message.data}\x1b[0m`);
              break;
            case "session_status":
              updateSessionStatus(message.sessionId, message.status);
              break;
            case "working_directory":
              updateSessionWorkingDirectory(message.sessionId, message.path);
              break;
          }
        } catch (error) {
          terminal.write(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        terminal.writeln("\r\n\x1b[1;31m✗ Connection lost. Attempting to reconnect...\x1b[0m");
        
        // Tentative de reconnexion
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = () => {
        terminal.writeln("\r\n\x1b[1;31m✗ Connection error\x1b[0m");
      };
    };

    // Gestion des entrées du terminal
    terminal.onData((data) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      // Gestion de l'historique des commandes
      if (data === "\x1b[A") { // Flèche haut
        if (historyIndex < commandHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          const command = commandHistory[commandHistory.length - 1 - historyIndex - 1];
          if (command) {
            // Effacer la ligne actuelle et afficher la commande de l'historique
            terminal.write("\x1b[2K\r\x1b[1;36muser@replit\x1b[0m:\x1b[1;34m/workspace\x1b[0m$ " + command);
            setCurrentInput(command);
          }
        }
        return;
      }

      if (data === "\x1b[B") { // Flèche bas
        if (historyIndex >= 0) {
          setHistoryIndex(historyIndex - 1);
          const command = historyIndex > 0 ? commandHistory[commandHistory.length - historyIndex] : "";
          terminal.write("\x1b[2K\r\x1b[1;36muser@replit\x1b[0m:\x1b[1;34m/workspace\x1b[0m$ " + command);
          setCurrentInput(command);
        }
        return;
      }

      // Sauvegarder la commande dans l'historique
      if (data === "\r") {
        if (currentInput.trim()) {
          setCommandHistory(prev => [...prev.slice(-49), currentInput.trim()]);
          onCommandExecute?.(currentInput.trim());
        }
        setCurrentInput("");
        setHistoryIndex(-1);
      } else if (data === "\x7f") { // Backspace
        setCurrentInput(prev => prev.slice(0, -1));
      } else if (data.charCodeAt(0) >= 32) { // Caractères imprimables
        setCurrentInput(prev => prev + data);
      }

      // Envoyer au serveur
      wsRef.current.send(JSON.stringify({
        type: "input",
        sessionId: activeSessionId,
        data: data
      }));
    });

    // Démarrer la connexion
    connectWebSocket();

    // Ajustement automatique de la taille
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
      wsRef.current?.close();
    };
  }, [projectId, activeSessionId, theme]);

  // Mise à jour du statut des sessions
  const updateSessionStatus = (sessionId: string, status: TerminalSession["status"]) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, status, lastActivity: new Date() }
        : session
    ));
  };

  const updateSessionWorkingDirectory = (sessionId: string, path: string) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, workingDirectory: path, lastActivity: new Date() }
        : session
    ));
  };

  // Gestion des sessions multiples
  const createNewSession = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: TerminalSession = {
      id: newSessionId,
      name: `Shell ${sessions.length + 1}`,
      isActive: false,
      status: "running",
      lastActivity: new Date(),
      workingDirectory: "/",
    };

    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSessionId);
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length <= 1) return;

    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId && filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });

    // Fermer la session WebSocket
    wsRef.current?.send(JSON.stringify({
      type: "close_session",
      sessionId: sessionId
    }));
  };

  const clearTerminal = () => {
    terminalInstanceRef.current?.clear();
  };

  const restartSession = () => {
    wsRef.current?.send(JSON.stringify({
      type: "restart",
      sessionId: activeSessionId
    }));
  };

  const copySelection = () => {
    const selection = terminalInstanceRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      terminalInstanceRef.current?.paste(text);
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  if (isMinimized) {
    return (
      <div className={`bg-[var(--replit-surface)] border border-[var(--replit-border)] rounded-md ${className}`}>
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4 w-4 text-[var(--replit-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--replit-text)]">Terminal</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${isConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(false)}
            className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-col bg-[var(--replit-surface)] border border-[var(--replit-border)] rounded-md ${isFullscreen ? 'fixed inset-4 z-50' : className}`}>
        {/* Header du terminal */}
        <div className="flex items-center justify-between p-2 border-b border-[var(--replit-border)]">
          <div className="flex items-center space-x-2">
            {/* Onglets des sessions */}
            <div className="flex items-center space-x-1">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center">
                  <Button
                    variant={session.id === activeSessionId ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSessionId(session.id)}
                    className={`h-6 px-2 text-xs ${
                      session.id === activeSessionId
                        ? "bg-[var(--replit-accent)] text-white"
                        : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                    }`}
                  >
                    <TerminalIcon className="h-3 w-3 mr-1" />
                    {session.name}
                    <div className={`ml-1 h-1.5 w-1.5 rounded-full ${
                      session.status === "running" ? "bg-green-400" :
                      session.status === "error" ? "bg-red-400" : "bg-gray-400"
                    }`} />
                  </Button>
                  
                  {sessions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => closeSession(session.id)}
                      className="h-4 w-4 p-0 ml-1 text-[var(--replit-text-secondary)] hover:text-[var(--replit-danger)]"
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  )}
                </div>
              ))}
              
              {allowMultipleSessions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={createNewSession}
                  className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Status de connexion */}
            <Badge 
              variant="outline" 
              className={`text-xs ${isConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
            >
              {isConnected ? (
                <>
                  <Zap className="h-2 w-2 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <PowerOff className="h-2 w-2 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center space-x-1">
            {/* Actions du terminal */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearTerminal}
                  className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
                >
                  <Square className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear Terminal</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={restartSession}
                  className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart Session</TooltipContent>
            </Tooltip>

            {/* Menu des options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40 bg-[var(--replit-surface)] border-[var(--replit-border)]">
                <DropdownMenuItem onClick={copySelection} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Copy className="mr-2 h-3 w-3" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={pasteFromClipboard} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Copy className="mr-2 h-3 w-3" />
                  Paste
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
                <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Search className="mr-2 h-3 w-3" />
                  Find
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
            >
              {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-6 w-6 p-0 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)]"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Zone du terminal */}
        <div 
          className="flex-1 terminal-container bg-[var(--replit-editor-bg)] overflow-hidden"
          style={{ maxHeight: isFullscreen ? 'none' : `${maxHeight}px` }}
        >
          <div
            ref={terminalRef}
            className="h-full w-full p-2 replit-scrollbar"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* Footer avec informations de session */}
        {activeSession && (
          <div className="flex items-center justify-between px-3 py-1 bg-[var(--replit-surface-secondary)] border-t border-[var(--replit-border)] text-xs text-[var(--replit-text-secondary)]">
            <div className="flex items-center space-x-4">
              <span>
                <Clock className="h-3 w-3 inline mr-1" />
                {activeSession.lastActivity.toLocaleTimeString()}
              </span>
              <span>
                PWD: {activeSession.workingDirectory}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {activeSession.process && (
                <Badge variant="outline" className="text-xs">
                  {activeSession.process}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}