import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, RefreshCw, ExternalLink, Smartphone, Tablet, Monitor,
  Maximize2, Minimize2, RotateCcw, X, ChevronLeft, ChevronRight
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

export function ResponsiveWebPreview({ projectId }: ResponsiveWebPreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState("responsive");
  const [refreshKey, setRefreshKey] = useState(0);
  const [url, setUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}`).then(r => r.json()),
  });

  const { data: devUrlData } = useQuery<any>({
    queryKey: ["/api/projects", projectId, "dev-url"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/projects/${projectId}/dev-url`);
        return res.json();
      } catch {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  const previewUrl = devUrlData?.fullDevUrl || devUrlData?.url || (project?.isPublished && project?.publishedSlug
    ? `/deployed/${project.publishedSlug}/`
    : null);

  useEffect(() => {
    if (previewUrl && !url) {
      setUrl(previewUrl);
    }
  }, [previewUrl, url]);

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

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-[var(--ide-panel)]">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          data-testid="button-refresh-preview"
        >
          <RefreshCw className={cn("w-3 h-3", !iframeLoaded && previewUrl && "animate-spin")} />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
            <span className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate" data-testid="text-preview-url">
              {previewUrl || "No preview available"}
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
          disabled={!previewUrl}
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
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
        {previewUrl ? (
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
              <div className="h-5 bg-gray-100 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1 shrink-0">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="ml-2 text-[8px] text-gray-400 font-mono truncate">{device.label} - {device.width} x {device.height}</span>
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
        ) : (
          <div className="text-center">
            <Globe className="w-10 h-10 text-[var(--ide-text-muted)]/30 mx-auto mb-3" />
            <p className="text-[12px] text-[var(--ide-text-muted)] font-medium mb-1" data-testid="text-no-preview">No preview available</p>
            <p className="text-[10px] text-[var(--ide-text-muted)]/60">Run your app or deploy it to see a live preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
