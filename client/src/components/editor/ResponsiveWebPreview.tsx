import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, RefreshCw, ExternalLink, Smartphone, Tablet, Monitor,
  Maximize2, Minimize2, Play, Square, Loader2, AlertCircle, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  const previewUrl = `/api/preview/projects/${projectId}/preview/`;

  const { data: statusData, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/preview/projects", projectId, "status"],
    queryFn: () => fetch(`/api/preview/projects/${projectId}/preview/status`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
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
      setPreviewStatus("error");
      setPreviewError(statusData.error || "Preview failed to start");
    }
  }, [statusData]);

  const startPreview = useCallback(async () => {
    setPreviewStatus("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/preview/projects/${projectId}/preview/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Start failed (${res.status})`);
      }
      setPreviewStatus("running");
      setShowIframe(true);
      setIframeLoaded(false);
      setRefreshKey(k => k + 1);
      refetchStatus();
    } catch (err: any) {
      if (err?.message?.includes("No runnable") || err?.message?.includes("No files")) {
        setShowIframe(true);
        setPreviewStatus("running");
        setRefreshKey(k => k + 1);
      } else {
        setPreviewStatus("error");
        setPreviewError(err?.message || "Failed to start preview");
      }
    }
  }, [projectId, refetchStatus]);

  const stopPreview = useCallback(async () => {
    try {
      await fetch(`/api/preview/projects/${projectId}/preview/stop`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setPreviewStatus("stopped");
    setShowIframe(false);
    setIframeLoaded(false);
    refetchStatus();
  }, [projectId, refetchStatus]);

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

  const openExternal = useCallback(() => {
    if (previewUrl) window.open(previewUrl, "_blank");
  }, [previewUrl]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(f => !f);
  }, [isFullscreen]);

  const device = DEVICES.find(d => d.id === selectedDevice) || DEVICES[0];
  const isResponsive = selectedDevice === "responsive";
  const isRunning = previewStatus === "running" && showIframe;

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
          onClick={refresh}
          disabled={!isRunning}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded disabled:opacity-30"
          data-testid="button-refresh-preview"
        >
          <RefreshCw className={cn("w-3 h-3", !iframeLoaded && isRunning && "animate-spin")} />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              previewStatus === "running" ? "bg-green-400" :
              previewStatus === "starting" ? "bg-yellow-400 animate-pulse" :
              previewStatus === "error" ? "bg-red-400" : "bg-gray-500"
            )} />
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
            <span className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate" data-testid="text-preview-url">
              {previewStatus === "starting" ? "Starting preview..." : previewUrl}
            </span>
          </div>
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

      <div className="flex-1 flex items-center justify-center overflow-auto bg-[var(--ide-surface)]">
        {previewStatus === "starting" && (
          <div className="text-center space-y-3" data-testid="preview-starting">
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
          <div className="text-center space-y-3 max-w-sm" data-testid="preview-error">
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
          <div className="text-center space-y-3" data-testid="preview-stopped">
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
            <iframe
              ref={iframeRef}
              key={refreshKey}
              src={previewUrl}
              className="w-full border-0"
              style={{ height: isResponsive ? "100%" : `calc(100% - ${isResponsive ? "0px" : "20px"})` }}
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              data-testid="iframe-web-preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
