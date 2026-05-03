// MobilePreviewPanel — IDE web-preview panel for mobile/tablet layout.
// NOTE: Not the same as MobilePreview.tsx (Expo/RN device-frame, Project.tsx only).
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Globe, RefreshCw, ExternalLink, Play, Square, Loader2, AlertCircle,
  RotateCw, Copy, Wrench, Smartphone, Tablet, Monitor, ChevronDown,
  ChevronLeft, ChevronRight, Terminal, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { getCsrfToken } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface MobilePreviewPanelProps {
  projectId: string;
}

type PreviewStatus = "stopped" | "starting" | "running" | "error";

interface DevicePreset {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  width?: string;
  height?: string;
}

const MOBILE_DEVICES: DevicePreset[] = [
  { id: "responsive", label: "Responsive", icon: Monitor },
  { id: "iphone-14", label: "iPhone 14", icon: Smartphone, width: "390px", height: "844px" },
  { id: "ipad", label: "iPad", icon: Tablet, width: "810px", height: "1080px" },
];

const ERUDA_CDN = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";

export function MobilePreviewPanel({ projectId }: MobilePreviewPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("stopped");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [availablePorts, setAvailablePorts] = useState<number[]>([]);
  const [primaryPort, setPrimaryPort] = useState<number | null>(null);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [isSwitchingPort, setIsSwitchingPort] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("responsive");
  const [devToolsActive, setDevToolsActive] = useState(false);
  const [deviceRotated, setDeviceRotated] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [showCustomDims, setShowCustomDims] = useState(false);
  const [urlPath, setUrlPath] = useState("/");
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("/");
  const [navHistory, setNavHistory] = useState<string[]>(["/"]);
  const [navIndex, setNavIndex] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<Array<{ type: string; text: string; time: string }>>([]);
  const [slowBoot, setSlowBoot] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<NodeJS.Timeout | null>(null);
  const wsReconnectAttempts = useRef(0);
  const slowBootTimerRef = useRef<NodeJS.Timeout | null>(null);
  const erudaInjected = useRef(false);
  const autoStarted = useRef(false);
  const previewStatusRef = useRef<PreviewStatus>("stopped");
  const { toast } = useToast();

  const basePreviewUrl = `/api/preview/projects/${projectId}/preview`;
  const isRunning = previewStatus === "running";

  // Keep previewStatusRef in sync so WS message handlers always read current status
  // without relying on stale closures captured at connection setup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { previewStatusRef.current = previewStatus; }, [previewStatus]);

  const mobileDeviceBase = MOBILE_DEVICES.find(d => d.id === selectedDevice) || MOBILE_DEVICES[0];
  const isResponsive = selectedDevice === "responsive";
  const device: DevicePreset = isResponsive ? mobileDeviceBase : {
    ...mobileDeviceBase,
    width: deviceRotated ? (mobileDeviceBase.height ?? "844px") : (mobileDeviceBase.width ?? "390px"),
    height: deviceRotated ? (mobileDeviceBase.width ?? "390px") : (mobileDeviceBase.height ?? "844px"),
  };
  const effectiveWidth = customWidth && !isResponsive ? customWidth : (device.width ?? "100%");
  const effectiveHeight = customHeight && !isResponsive ? customHeight : (device.height ?? "100%");
  const showPortSwitcher = availablePorts.length > 1;
  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

  const currentPreviewUrl = `${basePreviewUrl}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;

  const startPreview = useCallback(async () => {
    setPreviewStatus("starting");
    setPreviewError(null);
    setSlowBoot(false);
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
      } else {
        clearTimeout(slowBootTimerRef.current);
        setSlowBoot(false);
        // Use status returned by backend; WS transitions "starting" → "running" via preview:ready
        const backendStatus: string = data.preview?.status ?? data.status ?? "starting";
        if (backendStatus === "running") {
          setPreviewStatus("running");
        } else {
          setPreviewStatus("starting");
        }
        if (data.preview?.ports?.length) setAvailablePorts(data.preview.ports);
        if (data.preview?.primaryPort) {
          setPrimaryPort(data.preview.primaryPort);
          setSelectedPort((prev: number | null) => prev || data.preview.primaryPort);
        }
        setIframeLoaded(false);
        setRefreshKey(k => k + 1);
      }
    } catch (err: unknown) {
      clearTimeout(slowBootTimerRef.current);
      setSlowBoot(false);
      setPreviewStatus("error");
      setPreviewError(err instanceof Error ? err.message : "Failed to start preview");
    }
  }, [basePreviewUrl]);

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
    setPreviewStatus("stopped");
    setIframeLoaded(false);
    setAvailablePorts([]);
    setPrimaryPort(null);
    setSelectedPort(null);
  }, [basePreviewUrl]);

  const restartPreview = useCallback(async () => {
    await stopPreview();
    setTimeout(() => startPreview(), 500);
  }, [stopPreview, startPreview]);

  const refresh = useCallback(() => {
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
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

  const copyUrl = useCallback(async () => {
    const fullUrl = `${window.location.origin}${currentPreviewUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: "URL copied", description: "Preview URL copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [currentPreviewUrl, toast]);

  const navigateTo = useCallback((path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    setUrlPath(normalized);
    setUrlInput(normalized);
    const newHistory = navHistory.slice(0, navIndex + 1).concat(normalized);
    setNavHistory(newHistory);
    setNavIndex(newHistory.length - 1);
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
  }, [navHistory, navIndex]);

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

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setUrlEditing(false);
    navigateTo(urlInput);
  }, [urlInput, navigateTo]);

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
      toast({ title: "DevTools unavailable", description: "Cannot inject into cross-origin iframe", variant: "destructive" });
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

  const checkStatus = useCallback(async (): Promise<PreviewStatus | null> => {
    try {
      const res = await fetch(`${basePreviewUrl}/status`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === "running" || data.running) {
        setPreviewStatus("running");
        setPreviewError(null);
        if (data.ports?.length) setAvailablePorts(data.ports);
        if (data.primaryPort) {
          setPrimaryPort(data.primaryPort);
          setSelectedPort(prev => prev || data.primaryPort);
        }
        return "running";
      } else if (data.status === "starting") {
        setPreviewStatus("starting");
        return "starting";
      } else if (data.status === "error") {
        setPreviewStatus("error");
        setPreviewError(data.message || data.error || "Preview server error");
        return "error";
      }
      return "stopped";
    } catch {
      return null;
    }
  }, [basePreviewUrl]);

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
              setIframeLoaded(false);
              setRefreshKey(k => k + 1);
              if (data.ports?.length) setAvailablePorts(data.ports);
              if (data.primaryPort || data.port) {
                const p = data.primaryPort || data.port;
                setPrimaryPort(p);
                setSelectedPort(prev => prev || p);
              }
              // Sync any additional status details (ports etc.) from HTTP
              checkStatus();
              break;
            case "preview:stop":
              setPreviewStatus("stopped");
              setIframeLoaded(false);
              setAvailablePorts([]);
              setPrimaryPort(null);
              setSelectedPort(null);
              break;
            case "preview:error":
              setPreviewStatus("error");
              setPreviewError(data.error || "Preview server error");
              break;
            case "preview:file-change":
              // The backend's hot-reload script (injected into preview HTML) already
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
                setPreviewError(null);
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
                setPreviewError(data.error || data.message || "Preview error");
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
  // isRunning intentionally excluded: WS handlers use previewStatusRef.current
  // so the callback does not need to be recreated on every status change.
  }, [projectId]);

  useEffect(() => {
    checkStatus().then((status) => {
      if (!autoStarted.current) {
        autoStarted.current = true;
        // Only auto-start if nothing is already running/starting
        if (status === "stopped" || status === null) {
          startPreview();
        }
      }
    });
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
    const handler = () => {
      setTimeout(() => {
        setIframeLoaded(false);
        setRefreshKey(k => k + 1);
      }, 3000);
    };
    window.addEventListener("ecode:preview-refresh", handler);
    return () => window.removeEventListener("ecode:preview-refresh", handler);
  }, []);

  const onIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (devToolsActive) setTimeout(injectEruda, 200);
    // Inject console bridge so preview logs appear in the console panel
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      if (doc.getElementById("mobile-console-bridge")) return;
      const script = doc.createElement("script");
      script.id = "mobile-console-bridge";
      script.textContent = `(function(){['log','info','warn','error','debug'].forEach(function(l){var o=console[l];console[l]=function(){var args=Array.prototype.slice.call(arguments);var msg=args.map(function(a){try{return typeof a==='object'?JSON.stringify(a):String(a);}catch(e){return String(a);}}).join(' ');try{window.parent.postMessage({type:'preview-console',level:l,message:msg},'*');}catch(e){}o.apply(console,arguments);};});window.addEventListener('error',function(e){window.parent.postMessage({type:'preview-console',level:'error',message:e.message+' at '+(e.filename||'')+':'+(e.lineno||0)},'*');});})();`;
      doc.head?.appendChild(script);
    } catch {}
  }, [devToolsActive, injectEruda]);

  // Listen for console messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "preview-console") {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
        setConsoleMessages(prev => [...prev.slice(-199), { type: event.data.level || "log", text: event.data.message, time }]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--ide-panel)]">
      <div className="flex items-center gap-0.5 px-1.5 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        {previewStatus === "running" ? (
          <button
            onClick={stopPreview}
            className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Stop preview"
            data-testid="button-mobile-stop"
          >
            <Square className="w-3 h-3" />
          </button>
        ) : previewStatus === "starting" ? (
          <button disabled className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] opacity-60" data-testid="button-mobile-starting">
            <Loader2 className="w-3 h-3 animate-spin" />
          </button>
        ) : (
          <button
            onClick={startPreview}
            className="w-6 h-6 flex items-center justify-center rounded text-green-400 hover:text-green-300 hover:bg-green-500/10"
            title="Start preview"
            data-testid="button-mobile-start"
          >
            <Play className="w-3 h-3" />
          </button>
        )}

        {isRunning && (
          <button
            onClick={restartPreview}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            title="Restart preview"
            data-testid="button-mobile-restart"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={refresh}
          disabled={!isRunning}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] disabled:opacity-30"
          title="Refresh"
          data-testid="button-mobile-refresh"
        >
          <RefreshCw className={cn("w-3 h-3", !iframeLoaded && isRunning && "animate-spin")} />
        </button>

        <button
          onClick={goBack}
          disabled={!canGoBack || !isRunning}
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] disabled:opacity-20"
          title="Back"
          data-testid="button-mobile-nav-back"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward || !isRunning}
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] disabled:opacity-20"
          title="Forward"
          data-testid="button-mobile-nav-forward"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        <div className="flex-1 min-w-0 mx-0.5">
          {urlEditing ? (
            <form onSubmit={handleUrlSubmit} className="flex items-center h-[22px]">
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onBlur={() => { setUrlEditing(false); setUrlInput(urlPath); }}
                onKeyDown={e => { if (e.key === "Escape") { setUrlEditing(false); setUrlInput(urlPath); } }}
                className="w-full h-full px-2 text-[9px] font-mono bg-[var(--ide-panel)] border border-[#7C65CB]/50 rounded-full outline-none text-[var(--ide-text)] focus:border-[#7C65CB]"
                autoFocus
                data-testid="input-mobile-preview-url"
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
              className="flex items-center gap-1 w-full h-[22px] px-2 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70 hover:border-[var(--ide-border)] transition-colors cursor-text"
              data-testid="button-mobile-url-bar"
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isRunning ? "bg-green-400" :
                previewStatus === "starting" ? "bg-yellow-400 animate-pulse" :
                previewStatus === "error" ? "bg-red-400" : "bg-gray-500"
              )} />
              <Globe className="w-2 h-2 text-[var(--ide-text-muted)] shrink-0" />
              <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate flex-1" data-testid="text-mobile-url">
                {previewStatus === "starting"
                  ? "Starting..."
                  : isRunning
                  ? `${window.location.origin}${basePreviewUrl}${urlPath === "/" ? "" : urlPath}`
                  : "Preview stopped"}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {MOBILE_DEVICES.map(d => {
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
                data-testid={`button-mobile-device-${d.id}`}
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
              data-testid="button-mobile-device-rotate"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          )}

          {!isResponsive && (
            <button
              onClick={() => setShowCustomDims(v => !v)}
              className={cn(
                "h-6 px-1 rounded text-[8px] font-mono transition-colors",
                showCustomDims
                  ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                  : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
              )}
              title="Custom dimensions"
              data-testid="button-mobile-custom-dims-toggle"
            >
              {effectiveWidth}×{effectiveHeight}
            </button>
          )}
        </div>

        {showPortSwitcher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-0.5 h-6 px-1.5 rounded text-[9px] font-mono text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] disabled:opacity-30"
                title="Switch port"
                data-testid="button-mobile-port-switcher"
                disabled={isSwitchingPort}
              >
                {isSwitchingPort ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                <span>:{selectedPort || primaryPort}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 bg-[var(--ide-panel)] border-[var(--ide-border)]">
              <DropdownMenuLabel className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)]">Switch Port</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availablePorts.map(port => (
                <DropdownMenuItem
                  key={port}
                  className={cn("text-xs gap-2 cursor-pointer font-mono", port === selectedPort ? "bg-[var(--ide-surface)]" : "")}
                  onClick={() => switchPort(port)}
                  data-testid={`port-option-mobile-${port}`}
                >
                  :{port}
                  {port === primaryPort && <span className="ml-auto text-[8px] text-[var(--ide-text-muted)]">primary</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <button
          onClick={copyUrl}
          disabled={!isRunning}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] disabled:opacity-30"
          title="Copy URL"
          data-testid="button-mobile-copy-url"
        >
          <Copy className="w-3 h-3" />
        </button>

        <button
          onClick={toggleDevTools}
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded transition-colors",
            devToolsActive
              ? "text-[#0079F2] bg-[#0079F2]/10"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          )}
          title={devToolsActive ? "Hide DevTools" : "Show DevTools (Eruda)"}
          data-testid="button-mobile-devtools"
        >
          <Wrench className="w-3 h-3" />
        </button>

        <button
          onClick={() => setShowConsole(v => !v)}
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded transition-colors",
            showConsole
              ? "text-[#7C65CB] bg-[#7C65CB]/10"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          )}
          title="Toggle console"
          data-testid="button-mobile-console"
        >
          <Terminal className="w-3 h-3" />
        </button>

        {isRunning && (
          <button
            onClick={() => window.open(currentPreviewUrl, "_blank")}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            title="Open in new tab"
            data-testid="button-mobile-external"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}

        <div
          className={cn("w-1.5 h-1.5 rounded-full shrink-0 ml-0.5", wsConnected ? "bg-green-500" : "bg-gray-500")}
          title={wsConnected ? "Live updates connected" : "Disconnected"}
          data-testid="indicator-mobile-ws"
        />
      </div>

      {showCustomDims && !isResponsive && (
        <div className="flex items-center gap-1.5 px-2 h-7 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
          <span className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)]">Size</span>
          <input
            type="number"
            value={customWidth ? String(customWidth).replace("px", "") : ""}
            onChange={e => setCustomWidth(e.target.value ? `${e.target.value}px` : "")}
            placeholder={String(mobileDeviceBase.width ?? "390px").replace("px", "")}
            className="w-14 h-5 px-1.5 text-[10px] font-mono bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#7C65CB]/50"
            data-testid="input-mobile-custom-width"
          />
          <span className="text-[9px] text-[var(--ide-text-muted)]">×</span>
          <input
            type="number"
            value={customHeight ? String(customHeight).replace("px", "") : ""}
            onChange={e => setCustomHeight(e.target.value ? `${e.target.value}px` : "")}
            placeholder={String(mobileDeviceBase.height ?? "844px").replace("px", "")}
            className="w-14 h-5 px-1.5 text-[10px] font-mono bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#7C65CB]/50"
            data-testid="input-mobile-custom-height"
          />
          <span className="text-[9px] text-[var(--ide-text-muted)]">px</span>
          {(customWidth || customHeight) && (
            <button
              onClick={() => { setCustomWidth(""); setCustomHeight(""); }}
              className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] ml-0.5"
              data-testid="button-mobile-clear-custom-dims"
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div className={cn("flex-1 min-h-0 flex flex-col overflow-hidden", showConsole && "")}>
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-[var(--ide-surface)]">
        {previewStatus === "error" && (
          <div className="flex flex-col items-center text-center p-4 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-[12px] font-medium text-[var(--ide-text)]">Preview failed</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] max-w-[200px]">{previewError || "An error occurred. Check the console for details."}</p>
            <button
              onClick={startPreview}
              className="text-[10px] px-3 py-1 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-panel)]"
              data-testid="button-mobile-retry"
            >
              Retry
            </button>
          </div>
        )}

        {previewStatus === "stopped" && (
          <div className="flex flex-col items-center text-center gap-2">
            <Globe className="w-8 h-8 text-[var(--ide-text-muted)]/30" />
            <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-no-mobile-preview">Run your app to see the preview</p>
            <button
              onClick={startPreview}
              className="text-[10px] px-3 py-1 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-panel)]"
              data-testid="button-mobile-run"
            >
              <Play className="w-3 h-3 inline mr-1" />Run
            </button>
          </div>
        )}

        {previewStatus === "starting" && (
          <div className="flex flex-col items-center text-center gap-2" data-testid="mobile-preview-starting">
            <Loader2 className="w-8 h-8 text-[#7C65CB] animate-spin" />
            <p className="text-[11px] text-[var(--ide-text-muted)]">Starting preview...</p>
            {slowBoot && (
              <p className="text-[10px] text-amber-400 max-w-[180px]" data-testid="text-mobile-slow-boot">
                Taking longer than usual. First run may install dependencies.
              </p>
            )}
          </div>
        )}

        {isRunning && (
          <div
            className={cn(
              "relative bg-white dark:bg-gray-900 transition-all",
              !isResponsive && "rounded-xl shadow-lg border border-[var(--ide-border)] overflow-hidden"
            )}
            style={isResponsive
              ? { width: "100%", height: "100%" }
              : { width: effectiveWidth, height: effectiveHeight, maxWidth: "100%", maxHeight: "100%" }
            }
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
              key={refreshKey}
              src={currentPreviewUrl}
              className="w-full border-0"
              style={{
                height: isResponsive ? "100%" : `calc(100% - 20px)`,
                background: "#0d1117",
              }}
              onLoad={onIframeLoad}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              data-testid="iframe-mobile-preview"
            />
          </div>
        )}
      </div>

      {showConsole && (
        <div className="border-t border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col" style={{ height: "140px" }}>
          <div className="flex items-center justify-between px-2 h-6 border-b border-[var(--ide-border)] shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-[var(--ide-text-muted)] font-medium">Console</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConsoleMessages([])}
                className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] px-1"
                data-testid="button-mobile-console-clear"
              >
                Clear
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                data-testid="button-mobile-console-close"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[9px] p-1 space-y-px" data-testid="mobile-console-log">
            {consoleMessages.length === 0 ? (
              <div className="text-[var(--ide-text-muted)] italic p-1 text-center">No console output</div>
            ) : (
              consoleMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-1.5 px-1 py-0.5 rounded",
                    msg.type === "error" ? "text-red-400 bg-red-500/5" :
                    msg.type === "warn" ? "text-yellow-400 bg-yellow-500/5" :
                    "text-[var(--ide-text-secondary)]"
                  )}
                  data-testid={`mobile-console-msg-${i}`}
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
