import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, RefreshCw, ExternalLink, Smartphone, Tablet, Monitor,
  Maximize2, Minimize2, Play, Square, Loader2, AlertCircle, RotateCcw,
  ChevronLeft, ChevronRight, Terminal, X, Copy, Wrench,
  ChevronDown, RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCsrfToken } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ResponsiveWebPreviewProps {
  projectId: string;
}

const DEVICES = [
  { id: "responsive", label: "Responsive", icon: Monitor, width: "100%", height: "100%" },
  { id: "iphone-14", label: "iPhone 14", icon: Smartphone, width: "390px", height: "844px" },
  { id: "iphone-se", label: "iPhone SE", icon: Smartphone, width: "375px", height: "667px" },
  { id: "pixel-7", label: "Pixel 7", icon: Smartphone, width: "412px", height: "915px" },
  { id: "ipad", label: "iPad", icon: Tablet, width: "810px", height: "1080px" },
  { id: "ipad-pro", label: "iPad Pro", icon: Tablet, width: "1024px", height: "1366px" },
];

const ERUDA_CDN = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";

type PreviewStatus = "stopped" | "starting" | "running" | "error";

export function ResponsiveWebPreview({ projectId }: ResponsiveWebPreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState("responsive");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("stopped");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showIframe, setShowIframe] = useState(false);
  const [urlPath, setUrlPath] = useState("/");
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("/");
  const [showConsole, setShowConsole] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<Array<{ type: string; text: string; time: string }>>([]);
  const [navHistory, setNavHistory] = useState<string[]>(["/"]);
  const [navIndex, setNavIndex] = useState(0);
  const [devToolsActive, setDevToolsActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [availablePorts, setAvailablePorts] = useState<number[]>([]);
  const [primaryPort, setPrimaryPort] = useState<number | null>(null);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [isSwitchingPort, setIsSwitchingPort] = useState(false);
  const [deviceRotated, setDeviceRotated] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [showCustomDims, setShowCustomDims] = useState(false);
  const [slowBoot, setSlowBoot] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const previewStatusRef = useRef<PreviewStatus>("stopped");
  const wsReconnectRef = useRef<NodeJS.Timeout | null>(null);
  const wsReconnectAttempts = useRef(0);
  const slowBootTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeLoadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const erudaInjected = useRef(false);
  const { toast } = useToast();

  const basePreviewUrl = `/api/preview/projects/${projectId}/preview`;
  const previewUrl = `${basePreviewUrl}${urlPath === "/" ? "/" : urlPath}`;

  const { data: statusData, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/preview/projects", projectId, "status"],
    queryFn: () => fetch(`${basePreviewUrl}/status`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
    refetchInterval: previewStatus === "starting" ? 2000 : previewStatus === "running" ? 30000 : false,
    staleTime: 3000,
  });

  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "running" || statusData.running) {
      setPreviewStatus("running");
      setPreviewError(null);
      setShowIframe(true);
      if (statusData.ports?.length) setAvailablePorts(statusData.ports);
      if (statusData.primaryPort) {
        setPrimaryPort(statusData.primaryPort);
        if (!selectedPort) setSelectedPort(statusData.primaryPort);
      }
    } else if (statusData.status === "starting") {
      setPreviewStatus("starting");
    } else if (statusData.status === "error") {
      setPreviewStatus("error");
      setShowIframe(false);
      setPreviewError(statusData.message || statusData.error || "Preview server reported an error");
    }
  }, [statusData]);

  // Keep previewStatusRef in sync so WS message handlers always read current status
  // without relying on stale closures captured at connection setup.
  useEffect(() => { previewStatusRef.current = previewStatus; }, [previewStatus]);

  // Errors surface explicitly via error state UI. User clicks Retry to restart.

  const startPreview = useCallback(async () => {
    setPreviewStatus("starting");
    setPreviewError(null);
    setSlowBoot(false);
    setShowIframe(true);
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
    if (slowBootTimerRef.current) clearTimeout(slowBootTimerRef.current);
    slowBootTimerRef.current = setTimeout(() => setSlowBoot(true), 30000);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${basePreviewUrl}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || data.message || `Start failed (${res.status})`;
        if (res.status >= 500) throw new Error(`Preview server error (${res.status}): ${msg}`);
        throw new Error(msg);
      }
      clearTimeout(slowBootTimerRef.current);
      setSlowBoot(false);
      // Use status returned by backend; WS transitions "starting" → "running" via preview:ready
      const backendStatus: string = data.preview?.status ?? data.status ?? "starting";
      if (backendStatus === "running") {
        setPreviewStatus("running");
      } else {
        // Keep "starting" — WS preview:ready/preview:status will flip to "running"
        setPreviewStatus("starting");
      }
      if (data.preview?.ports?.length) setAvailablePorts(data.preview.ports);
      if (data.preview?.primaryPort) {
        setPrimaryPort(data.preview.primaryPort);
        setSelectedPort(prev => prev || data.preview.primaryPort);
      }
      refetchStatus();
    } catch (err: unknown) {
      clearTimeout(slowBootTimerRef.current);
      setSlowBoot(false);
      setPreviewStatus("error");
      setPreviewError(err instanceof Error ? err.message : "Failed to start preview");
      setShowIframe(false);
    }
  }, [basePreviewUrl, refetchStatus]);

  const stopPreview = useCallback(async () => {
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${basePreviewUrl}/stop`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "x-csrf-token": csrf } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.message || `Stop failed (${res.status})`;
        toast({ title: "Stop request failed", description: msg, variant: "destructive" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not reach preview server";
      toast({ title: "Stop request failed", description: msg, variant: "destructive" });
    }
    // Update UI state regardless — keep local view consistent
    setPreviewStatus("stopped");
    setShowIframe(false);
    setIframeLoaded(false);
    setAvailablePorts([]);
    setPrimaryPort(null);
    setSelectedPort(null);
    refetchStatus();
  }, [basePreviewUrl, refetchStatus]);

  const restartPreview = useCallback(async () => {
    await stopPreview();
    setTimeout(() => startPreview(), 500);
  }, [stopPreview, startPreview]);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    if (previewStatus === "stopped") {
      startPreview();
    }
  }, []);

  const refresh = useCallback(() => {
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
  }, []);

  const navigateToPath = useCallback((path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    setUrlPath(normalizedPath);
    setUrlInput(normalizedPath);
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
    setNavHistory(prev => {
      const newHistory = [...prev.slice(0, navIndex + 1), normalizedPath];
      setNavIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [navIndex]);

  const handleUrlSubmit = useCallback((e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    setUrlEditing(false);
    navigateToPath(urlInput);
  }, [urlInput, navigateToPath]);

  const goBack = useCallback(() => {
    if (navIndex > 0) {
      const newIndex = navIndex - 1;
      setNavIndex(newIndex);
      const path = navHistory[newIndex];
      setUrlPath(path);
      setUrlInput(path);
      setIframeLoaded(false);
      setRefreshKey(k => k + 1);
    }
  }, [navIndex, navHistory]);

  const goForward = useCallback(() => {
    if (navIndex < navHistory.length - 1) {
      const newIndex = navIndex + 1;
      setNavIndex(newIndex);
      const path = navHistory[newIndex];
      setUrlPath(path);
      setUrlInput(path);
      setIframeLoaded(false);
      setRefreshKey(k => k + 1);
    }
  }, [navIndex, navHistory]);

  const openExternal = useCallback(() => {
    if (previewUrl) window.open(previewUrl, "_blank");
  }, [previewUrl]);

  const copyUrl = useCallback(async () => {
    const fullUrl = `${window.location.origin}${previewUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: "URL copied", description: "Preview URL copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [previewUrl, toast]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const switchPort = useCallback(async (port: number) => {
    setIsSwitchingPort(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${basePreviewUrl}/switch-port`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ port }),
      });
      if (res.ok) {
        setSelectedPort(port);
        setIframeLoaded(false);
        setRefreshKey(k => k + 1);
        toast({ title: `Switched to port ${port}` });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Port switch failed", description: data.error || "Could not switch port", variant: "destructive" });
      }
    } catch {
      toast({ title: "Port switch failed", variant: "destructive" });
    } finally {
      setIsSwitchingPort(false);
    }
  }, [basePreviewUrl, toast]);

  const injectEruda = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      if (doc.getElementById("eruda-injected-script")) return;
      const script = doc.createElement("script");
      script.id = "eruda-injected-script";
      script.src = ERUDA_CDN;
      script.onload = () => {
        try {
          const initScript = doc.createElement("script");
          initScript.textContent = `if(typeof eruda!=='undefined'&&!eruda._isInit){eruda.init();eruda.show();}`;
          doc.body?.appendChild(initScript);
        } catch {}
      };
      doc.head?.appendChild(script);
      erudaInjected.current = true;
    } catch {
      // Cross-origin iframe — DevTools not available
      toast({ title: "DevTools unavailable", description: "Cannot inject DevTools into cross-origin iframe", variant: "destructive" });
    }
  }, [toast]);

  const removeEruda = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      const win = iframeRef.current.contentWindow as any;
      if (win?.eruda?._isInit) win.eruda.destroy();
      const script = doc.getElementById("eruda-injected-script");
      if (script) script.remove();
      erudaInjected.current = false;
    } catch {}
  }, []);

  const toggleDevTools = useCallback(() => {
    if (!devToolsActive) {
      setDevToolsActive(true);
      setTimeout(injectEruda, 200);
    } else {
      setDevToolsActive(false);
      removeEruda();
    }
  }, [devToolsActive, injectEruda, removeEruda]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/preview`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        wsReconnectAttempts.current = 0;
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", projectId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ping") { ws.send(JSON.stringify({ type: "pong" })); return; }
          if (data.projectId != null && String(data.projectId) !== String(projectId)) return;

          switch (data.type) {
            case "preview:start":
              setPreviewStatus("starting");
              setPreviewError(null);
              break;
            case "preview:ready":
              setPreviewStatus("running");
              setPreviewError(null);
              setShowIframe(true);
              if (data.ports?.length) setAvailablePorts(data.ports);
              if (data.primaryPort || data.port) {
                const p = data.primaryPort || data.port;
                setPrimaryPort(p);
                setSelectedPort(prev => prev || p);
              }
              setRefreshKey(k => k + 1);
              refetchStatus();
              break;
            case "preview:stop":
              setPreviewStatus("stopped");
              setShowIframe(false);
              setAvailablePorts([]);
              setPrimaryPort(null);
              setSelectedPort(null);
              break;
            case "preview:error":
              setPreviewStatus("error");
              setPreviewError(data.error || "Preview server error");
              setShowIframe(false);
              break;
            case "preview:file-change":
              // The backend's hot-reload script (injected into the preview HTML) already
              // handles CSS hot-swap via hotSwapCSS() for .css changes.
              // We must NOT force a full iframe reload for CSS files — that would override
              // the CSS hot-swap and cause a full page flash. Only reload for non-CSS changes.
              if (previewStatusRef.current === "running") {
                const isCSS = typeof data.filePath === "string" && data.filePath.toLowerCase().endsWith(".css");
                if (!isCSS) {
                  setIframeLoaded(false);
                  setRefreshKey(k => k + 1);
                }
              }
              break;
            case "preview:rebuild":
              // Full rebuild: always force a fresh iframe load regardless of file type
              if (previewStatusRef.current === "running") {
                setIframeLoaded(false);
                setRefreshKey(k => k + 1);
              }
              break;
            case "preview:status":
              if (data.status === "running") {
                setPreviewStatus("running");
                setShowIframe(true);
                if (data.ports?.length) setAvailablePorts(data.ports);
                if (data.primaryPort) {
                  setPrimaryPort(data.primaryPort);
                  setSelectedPort(prev => prev || data.primaryPort);
                }
              } else if (data.status === "starting") {
                setPreviewStatus("starting");
              } else if (data.status === "stopped") {
                setPreviewStatus("stopped");
              } else if (data.status === "error") {
                setPreviewStatus("error");
                setPreviewError(data.error || "Preview error");
              }
              break;
          }
        } catch (e) {
          console.warn("[Preview WS] Failed to parse message:", e);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setWsConnected(false);
        if (wsReconnectAttempts.current < 10) {
          wsReconnectAttempts.current++;
          wsReconnectRef.current = setTimeout(connectWebSocket, Math.min(2000 * wsReconnectAttempts.current, 15000));
        }
      };

      ws.onerror = (e) => {
        console.warn("[Preview WS] WebSocket error:", e);
        setWsConnected(false);
      };
    } catch (e) {
      console.warn("[Preview WS] Failed to establish connection:", e);
    }
  // previewStatus intentionally excluded: WS handlers use previewStatusRef.current
  // so the callback does not need to be recreated on every status change.
  }, [projectId, refetchStatus]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      if (wsRef.current) {
        try { wsRef.current.send(JSON.stringify({ type: "unsubscribe" })); } catch {}
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin && e.origin !== window.location.origin) return;
      if (e.data?.type === "preview-console") {
        setConsoleMessages(prev => [...prev.slice(-99), {
          type: e.data.level || "log",
          text: e.data.message || String(e.data.args),
          time: new Date().toLocaleTimeString(),
        }]);
      }
      if (e.data?.type === "preview-navigate" && typeof e.data.path === "string") {
        const newPath = e.data.path;
        setUrlPath(newPath);
        setUrlInput(newPath);
        setNavHistory(prev => {
          const nh = [...prev.slice(0, navIndex + 1), newPath];
          setNavIndex(nh.length - 1);
          return nh;
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navIndex]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        refetchStatus();
        setIframeLoaded(false);
        setRefreshKey(k => k + 1);
      }, 3000);
    };
    window.addEventListener("ecode:preview-refresh", handler);
    return () => window.removeEventListener("ecode:preview-refresh", handler);
  }, [refetchStatus]);

  const injectConsoleBridge = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const script = iframe.contentDocument?.createElement("script");
      if (!script) return;
      script.textContent = `
        (function() {
          if (window.__consoleBridgeInjected) return;
          window.__consoleBridgeInjected = true;
          var orig = {};
          ["log","warn","error","info"].forEach(function(level) {
            orig[level] = console[level];
            console[level] = function() {
              orig[level].apply(console, arguments);
              try {
                var args = Array.prototype.slice.call(arguments).map(function(a) {
                  try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
                }).join(" ");
                window.parent.postMessage({ type: "preview-console", level: level, message: args }, "*");
              } catch(e) {}
            };
          });
          window.addEventListener("error", function(e) {
            window.parent.postMessage({ type: "preview-console", level: "error", message: e.message + " at " + (e.filename||"") + ":" + (e.lineno||0) }, "*");
          });
        })();
      `;
      iframe.contentDocument?.head?.appendChild(script);
      if (devToolsActive) injectEruda();
    } catch (_) {}
  }, [devToolsActive, injectEruda]);

  const deviceBase = DEVICES.find(d => d.id === selectedDevice) || DEVICES[0];
  const isResponsive = selectedDevice === "responsive";
  const device = isResponsive ? deviceBase : {
    ...deviceBase,
    width: deviceRotated ? deviceBase.height : deviceBase.width,
    height: deviceRotated ? deviceBase.width : deviceBase.height,
  };
  const effectiveWidth = customWidth && !isResponsive ? customWidth : device.width;
  const effectiveHeight = customHeight && !isResponsive ? customHeight : device.height;
  const isRunning = previewStatus === "running" && showIframe;
  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;
  const showPortSwitcher = availablePorts.length > 1;

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-[var(--ide-panel)]">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        {previewStatus === "running" ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={stopPreview}
            className="w-6 h-6 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
            title="Stop preview"
            data-testid="button-stop-preview"
          >
            <Square className="w-3 h-3" />
          </Button>
        ) : previewStatus === "starting" ? (
          <Button
            variant="ghost"
            size="icon"
            disabled
            className="w-6 h-6 text-[var(--ide-text-muted)] rounded"
            data-testid="button-starting-preview"
          >
            <Loader2 className="w-3 h-3 animate-spin" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={startPreview}
            className="w-6 h-6 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded"
            title="Start preview"
            data-testid="button-start-preview"
          >
            <Play className="w-3 h-3" />
          </Button>
        )}

        {isRunning && (
          <Button
            variant="ghost"
            size="icon"
            onClick={restartPreview}
            className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
            title="Restart preview"
            data-testid="button-restart-preview"
          >
            <RotateCw className="w-3 h-3" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          disabled={!canGoBack || !isRunning}
          className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-20"
          title="Back"
          data-testid="button-nav-back"
        >
          <ChevronLeft className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goForward}
          disabled={!canGoForward || !isRunning}
          className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-20"
          title="Forward"
          data-testid="button-nav-forward"
        >
          <ChevronRight className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          disabled={!isRunning}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-30"
          title="Refresh"
          data-testid="button-refresh-preview"
        >
          <RefreshCw className={cn("w-3 h-3", !iframeLoaded && isRunning && "animate-spin")} />
        </Button>

        <div className="flex-1 min-w-0">
          {urlEditing ? (
            <form onSubmit={handleUrlSubmit} className="flex items-center h-[24px]">
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onBlur={() => { setUrlEditing(false); setUrlInput(urlPath); }}
                onKeyDown={e => { if (e.key === "Escape") { setUrlEditing(false); setUrlInput(urlPath); } }}
                className="w-full h-full px-3 text-[10px] font-mono bg-[var(--ide-panel)] border border-[#7C65CB]/50 rounded-full outline-none text-[var(--ide-text)] focus:border-[#7C65CB]"
                autoFocus
                data-testid="input-preview-url"
              />
            </form>
          ) : (
            <button
              onClick={() => {
                if (isRunning) {
                  setUrlEditing(true);
                  setUrlInput(urlPath);
                  setTimeout(() => urlInputRef.current?.select(), 50);
                }
              }}
              className="flex items-center gap-2 w-full h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70 hover:border-[var(--ide-border)] transition-colors cursor-text"
              data-testid="button-url-bar"
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                previewStatus === "running" ? "bg-green-400" :
                previewStatus === "starting" ? "bg-yellow-400 animate-pulse" :
                previewStatus === "error" ? "bg-red-400" : "bg-gray-500"
              )} />
              <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
              <span className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate text-left flex-1" data-testid="text-preview-url">
                {previewStatus === "starting"
                  ? "Starting preview..."
                  : isRunning
                  ? `${window.location.origin}${basePreviewUrl}${urlPath === "/" ? "" : urlPath}`
                  : urlPath}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {DEVICES.slice(0, 4).map(d => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => { setSelectedDevice(d.id); setDeviceRotated(false); setCustomWidth(""); setCustomHeight(""); }}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  selectedDevice === d.id
                    ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                    : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                )}
                title={d.label}
                data-testid={`button-device-${d.id}`}
              >
                <Icon className="w-3 h-3" />
              </button>
            );
          })}

          {!isResponsive && (
            <button
              onClick={() => setDeviceRotated(r => !r)}
              className={cn(
                "w-6 h-6 flex items-center justify-center rounded transition-colors",
                deviceRotated
                  ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                  : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
              )}
              title="Rotate (landscape/portrait)"
              data-testid="button-device-rotate"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {!isResponsive && (
            <button
              onClick={() => setShowCustomDims(v => !v)}
              className={cn(
                "h-6 px-1.5 rounded text-[9px] font-mono transition-colors",
                showCustomDims
                  ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                  : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
              )}
              title="Custom dimensions"
              data-testid="button-custom-dims-toggle"
            >
              {effectiveWidth}×{effectiveHeight}
            </button>
          )}
        </div>

        {showPortSwitcher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded gap-1"
                title="Switch port"
                data-testid="button-port-switcher"
                disabled={isSwitchingPort}
              >
                {isSwitchingPort ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                <span className="font-mono">{selectedPort || primaryPort}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)]">
              <DropdownMenuLabel className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)]">Switch Port</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availablePorts.map(port => (
                <DropdownMenuItem
                  key={port}
                  className={cn(
                    "text-xs gap-2 cursor-pointer font-mono",
                    port === selectedPort ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)]"
                  )}
                  onClick={() => switchPort(port)}
                  data-testid={`port-option-${port}`}
                >
                  :{port}
                  {port === primaryPort && <span className="ml-auto text-[8px] text-[var(--ide-text-muted)]">primary</span>}
                  {port === selectedPort && <span className="ml-auto text-[8px] text-green-400">active</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={copyUrl}
          disabled={!isRunning}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-30"
          title="Copy URL"
          data-testid="button-copy-url"
        >
          <Copy className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDevTools}
          className={cn(
            "w-6 h-6 rounded transition-colors",
            devToolsActive
              ? "text-[#0079F2] bg-[#0079F2]/10 hover:bg-[#0079F2]/20"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          )}
          title={devToolsActive ? "Hide DevTools" : "Show DevTools (Eruda)"}
          data-testid="button-devtools-toggle"
        >
          <Wrench className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowConsole(v => !v)}
          className={cn(
            "w-6 h-6 rounded transition-colors",
            showConsole
              ? "text-[#7C65CB] bg-[#7C65CB]/10"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          )}
          title="Toggle console"
          data-testid="button-toggle-console"
        >
          <Terminal className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={openExternal}
          disabled={!isRunning}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-30"
          title="Open in new tab"
          data-testid="button-open-external"
        >
          <ExternalLink className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          data-testid="button-fullscreen-preview"
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>

        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0 ml-0.5",
            wsConnected ? "bg-green-500" : "bg-gray-500"
          )}
          title={wsConnected ? "Live updates connected" : "Live updates disconnected"}
          data-testid="indicator-ws-connection"
        />
      </div>

      {showCustomDims && !isResponsive && (
        <div className="flex items-center gap-1.5 px-2 h-7 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
          <span className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)]">Size</span>
          <input
            type="number"
            value={customWidth.replace("px", "")}
            onChange={e => setCustomWidth(e.target.value ? `${e.target.value}px` : "")}
            placeholder={device.width.replace("px", "")}
            className="w-14 h-5 px-1.5 text-[10px] font-mono bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#7C65CB]/50"
            data-testid="input-custom-width"
          />
          <span className="text-[9px] text-[var(--ide-text-muted)]">×</span>
          <input
            type="number"
            value={customHeight.replace("px", "")}
            onChange={e => setCustomHeight(e.target.value ? `${e.target.value}px` : "")}
            placeholder={device.height.replace("px", "")}
            className="w-14 h-5 px-1.5 text-[10px] font-mono bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#7C65CB]/50"
            data-testid="input-custom-height"
          />
          <span className="text-[9px] text-[var(--ide-text-muted)]">px</span>
          {(customWidth || customHeight) && (
            <button
              onClick={() => { setCustomWidth(""); setCustomHeight(""); }}
              className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] ml-0.5"
              data-testid="button-clear-custom-dims"
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div className={cn("flex-1 flex flex-col overflow-hidden", showConsole && "")}>
  
        <div className={cn("flex-1 flex items-center justify-center overflow-auto bg-[var(--ide-surface)]", showConsole && "min-h-0")}>
          {previewStatus === "starting" && !showIframe && (
            <div className="text-center space-y-3 animate-in fade-in duration-300" data-testid="preview-starting">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#7C65CB] animate-spin" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--ide-text)]">Starting preview</p>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">
                  {slowBoot ? "Taking longer than usual — your app may need to install dependencies." : "Detecting framework and starting server..."}
                </p>
                {slowBoot && (
                  <p className="text-[10px] text-amber-400 mt-1" data-testid="text-slow-boot">
                    This can take up to 2 minutes on first run.
                  </p>
                )}
              </div>
            </div>
          )}

          {previewStatus === "error" && (
            <div className="text-center space-y-3 max-w-sm animate-in fade-in duration-300" data-testid="preview-error">
              <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--ide-text)]">Preview failed</p>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1 max-w-xs mx-auto">{previewError || "An unexpected error occurred. Check the console for details."}</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" variant="outline" onClick={startPreview} className="text-[11px]" data-testid="button-retry-preview">
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowConsole(true)} className="text-[11px]" data-testid="button-show-console-error">
                  <Terminal className="w-3 h-3 mr-1" /> Console
                </Button>
              </div>
            </div>
          )}

          {previewStatus === "stopped" && (
            <div className="text-center space-y-3 animate-in fade-in duration-300" data-testid="preview-stopped">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center">
                <Globe className="w-6 h-6 text-[var(--ide-text-muted)]/30" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--ide-text)]">Preview stopped</p>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">Click the play button to start your app</p>
              </div>
              <Button size="sm" variant="outline" onClick={startPreview} className="text-[11px]" data-testid="button-run-preview">
                <Play className="w-3 h-3 mr-1" /> Run
              </Button>
            </div>
          )}

          {isRunning && (
            <div
              className={cn(
                "relative bg-white dark:bg-gray-900 transition-all duration-300",
                !isResponsive && "rounded-lg shadow-lg border border-[var(--ide-border)] overflow-hidden"
              )}
              style={{
                width: isResponsive ? "100%" : effectiveWidth,
                height: isResponsive ? "100%" : effectiveHeight,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              {!isResponsive && (
                <div className="h-5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="ml-2 text-[8px] text-gray-400 font-mono truncate">
                    {device.label}{deviceRotated ? " (landscape)" : ""} — {effectiveWidth} × {effectiveHeight}
                  </span>
                </div>
              )}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--ide-surface)]/80 z-10">
                  <Loader2 className="w-5 h-5 text-[#7C65CB] animate-spin" />
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={`${refreshKey}-${urlPath}`}
                src={previewUrl}
                className="w-full border-0"
                style={{ height: isResponsive ? "100%" : `calc(100% - ${isResponsive ? "0px" : "20px"})` }}
                onLoad={() => { setIframeLoaded(true); injectConsoleBridge(); }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                data-testid="iframe-web-preview"
              />
            </div>
          )}
        </div>

        {showConsole && (
          <div className="h-32 border-t border-[var(--ide-border)] bg-[var(--ide-bg)] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-2 h-6 border-b border-[var(--ide-border)]/50 shrink-0">
              <span className="text-[9px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">Console</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConsoleMessages([])}
                  className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] px-1 rounded"
                  data-testid="button-clear-console"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowConsole(false)}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)]"
                  data-testid="button-close-console"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto font-mono text-[9px] p-1.5 space-y-0.5" data-testid="console-output">
              {consoleMessages.length === 0 ? (
                <p className="text-[var(--ide-text-muted)] italic px-1">No console output yet</p>
              ) : (
                consoleMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 px-1 py-0.5 rounded",
                      msg.type === "error" ? "text-red-400 bg-red-500/5" :
                      msg.type === "warn" ? "text-yellow-400 bg-yellow-500/5" :
                      "text-[var(--ide-text-secondary)]"
                    )}
                    data-testid={`console-message-${i}`}
                  >
                    <span className="text-[var(--ide-text-muted)] shrink-0">{msg.time}</span>
                    <span className="break-all">{msg.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
