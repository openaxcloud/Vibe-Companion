import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, RefreshCw, ExternalLink, Smartphone, Tablet, Monitor,
  Maximize2, Minimize2, Play, Square, Loader2, AlertCircle, RotateCcw,
  ChevronLeft, ChevronRight, Terminal, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCsrfToken } from "@/lib/queryClient";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const basePreviewUrl = `/api/preview/projects/${projectId}/preview`;
  const previewUrl = `${basePreviewUrl}${urlPath === "/" ? "/" : urlPath}`;

  const { data: statusData, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/preview/projects", projectId, "status"],
    queryFn: () => fetch(`${basePreviewUrl}/status`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
    refetchInterval: previewStatus === "starting" ? 2000 : previewStatus === "running" ? 15000 : false,
    staleTime: 3000,
  });

  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "running" || statusData.running) {
      setPreviewStatus("running");
      setPreviewError(null);
      setShowIframe(true);
    } else if (statusData.status === "starting") {
      setPreviewStatus("starting");
    } else if (statusData.status === "error") {
      // Don't surface raw failures to the user — keep showing the "starting" loader
      // and let the silent auto-retry effect below handle it in the background.
      setPreviewStatus("starting");
      setShowIframe(true);
      setPreviewError(null);
    }
  }, [statusData]);

  // Silent retry loop: while the dev server isn't running yet (typical when the
  // agent is still generating files), keep re-calling /start every ~6 seconds
  // until it succeeds. The user only ever sees the loader, never raw errors.
  const startRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "running" || statusData.running) {
      if (startRetryTimerRef.current) { clearTimeout(startRetryTimerRef.current); startRetryTimerRef.current = null; }
      return;
    }
    if (statusData.status !== "error") return;
    // Schedule a silent retry
    if (startRetryTimerRef.current) clearTimeout(startRetryTimerRef.current);
    startRetryTimerRef.current = setTimeout(async () => {
      try {
        const csrf = getCsrfToken();
        await fetch(`${basePreviewUrl}/start`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        });
      } catch {}
      refetchStatus();
    }, 6000);
    return () => { if (startRetryTimerRef.current) clearTimeout(startRetryTimerRef.current); };
  }, [statusData, basePreviewUrl, refetchStatus]);

  // Surface dev-server build/compile errors (Vite, webpack, postcss, etc.)
  const buildErrors: string[] = (() => {
    const logs: string[] = statusData?.logs || [];
    const out: string[] = [];
    for (const line of logs) {
      const norm = String(line).trim();
      if (!norm) continue;
      if (/\b(error|failed to resolve|cannot find module|syntaxerror|module not found|enoent)\b/i.test(norm)) {
        out.push(norm.replace(/\[[^\]]*dev server:\d+\]\s*/g, "").trim());
      }
    }
    return out.slice(-5);
  })();

  // Auto-fix: silently dispatch errors to the agent once per unique error set (1.5s debounce).
  // The user never sees the raw error — they just see a "Finishing setup" loader while the agent fixes it.
  const lastAutoFixFingerprintRef = useRef<string>("");
  useEffect(() => {
    if (buildErrors.length === 0) return;
    const fingerprint = buildErrors.join("\n");
    if (fingerprint === lastAutoFixFingerprintRef.current) return;
    const t = setTimeout(() => {
      if (fingerprint === lastAutoFixFingerprintRef.current) return;
      lastAutoFixFingerprintRef.current = fingerprint;
      const prompt = `Auto-detected build errors from the preview dev server. Please fix them silently and continue:\n\n${buildErrors.map(e => `- ${e}`).join("\n")}\n\nFor each missing import, create the file. For each missing npm package, add it to package.json (and install it if needed). After fixing, the preview will reload automatically.`;
      window.dispatchEvent(new CustomEvent('ecode:agent-send-message', {
        detail: { projectId, content: prompt }
      }));
      // Reload the iframe progressively so it picks up fixes without user action
      setTimeout(() => setRefreshKey(k => k + 1), 6000);
      setTimeout(() => setRefreshKey(k => k + 1), 15000);
      setTimeout(() => setRefreshKey(k => k + 1), 30000);
    }, 1500);
    return () => clearTimeout(t);
  }, [buildErrors.join("\n"), projectId]);

  const startPreview = useCallback(async () => {
    setPreviewStatus("starting");
    setPreviewError(null);
    // Show the iframe immediately so the server-side "Building your app..." splash
    // (with spinner + auto-refresh) is visible while the dev server boots.
    setShowIframe(true);
    setIframeLoaded(false);
    setRefreshKey(k => k + 1);
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${basePreviewUrl}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Start failed (${res.status})`);
      }
      setPreviewStatus("running");
      refetchStatus();
    } catch (err: any) {
      if (err?.message?.includes("No runnable") || err?.message?.includes("No files")) {
        // Files still being generated by AI — keep iframe visible on splash page.
        setPreviewStatus("running");
      } else {
        setPreviewStatus("error");
        setPreviewError(err?.message || "Failed to start preview");
        setShowIframe(false);
      }
    }
  }, [basePreviewUrl, refetchStatus]);

  const stopPreview = useCallback(async () => {
    try {
      const csrf = getCsrfToken();
      await fetch(`${basePreviewUrl}/stop`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "x-csrf-token": csrf } : {},
      });
    } catch {}
    setPreviewStatus("stopped");
    setShowIframe(false);
    setIframeLoaded(false);
    refetchStatus();
  }, [basePreviewUrl, refetchStatus]);

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

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
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
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

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
    } catch (_) {}
  }, []);

  const device = DEVICES.find(d => d.id === selectedDevice) || DEVICES[0];
  const isResponsive = selectedDevice === "responsive";
  const isRunning = previewStatus === "running" && showIframe;
  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

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
                {previewStatus === "starting" ? "Starting preview..." : urlPath}
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
                onClick={() => setSelectedDevice(d.id)}
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
        </div>

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
          data-testid="button-open-external"
        >
          <ExternalLink className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          data-testid="button-fullscreen-preview"
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>
      </div>

      <div className={cn("flex-1 flex flex-col overflow-hidden", showConsole && "")}>
        <div className={cn("flex-1 flex items-center justify-center overflow-auto bg-[var(--ide-surface)]", showConsole && "min-h-0")}>
          {previewStatus === "starting" && !showIframe && (
            <div className="text-center space-y-3 animate-in fade-in duration-300" data-testid="preview-starting">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#7C65CB] animate-spin" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--ide-text)]">Starting preview</p>
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">Detecting framework and starting server...</p>
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
                <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">{previewError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={startPreview} className="text-[11px]" data-testid="button-retry-preview">
                <RotateCcw className="w-3 h-3 mr-1" /> Retry
              </Button>
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
                width: isResponsive ? "100%" : device.width,
                height: isResponsive ? "100%" : device.height,
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              {!isResponsive && (
                <div className="h-5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="ml-2 text-[8px] text-gray-400 font-mono truncate">{device.label} - {device.width} x {device.height}</span>
                </div>
              )}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--ide-surface)]/80 z-10">
                  <Loader2 className="w-5 h-5 text-[#7C65CB] animate-spin" />
                </div>
              )}
              {iframeLoaded && buildErrors.length > 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--ide-surface)]/95 backdrop-blur-sm" data-testid="preview-finalizing">
                  <div className="text-center space-y-3 max-w-xs">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#7C65CB] animate-spin" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--ide-text)]">Finishing setup</p>
                      <p className="text-[11px] text-[var(--ide-text-muted)] mt-1">Installing dependencies and wiring things up — your app will appear in a moment.</p>
                    </div>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={`${refreshKey}-${urlPath}`}
                src={previewUrl}
                className="w-full border-0"
                style={{ height: isResponsive ? "100%" : `calc(100% - ${isResponsive ? "0px" : "20px"})` }}
                onLoad={() => { setIframeLoaded(true); injectConsoleBridge(); }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
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
                  className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] px-1"
                  data-testid="button-clear-console"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowConsole(false)}
                  className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  data-testid="button-close-console"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1 font-mono text-[10px]">
              {consoleMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)]/50 text-[10px]">
                  No console output
                </div>
              ) : (
                consoleMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "px-2 py-0.5 border-b border-[var(--ide-border)]/20",
                    msg.type === "error" ? "text-red-400 bg-red-500/5" :
                    msg.type === "warn" ? "text-yellow-400 bg-yellow-500/5" :
                    "text-[var(--ide-text-muted)]"
                  )}>
                    <span className="text-[var(--ide-text-muted)]/40 mr-2">{msg.time}</span>
                    {msg.text}
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
