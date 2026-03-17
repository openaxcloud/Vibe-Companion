import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Smartphone, Tablet, Monitor, Wrench, ChevronDown, Settings2, Globe, Presentation, Film, BarChart3, Gamepad2, FileText, Table2, Palette, Zap, ChevronLeft, ChevronRight, Download, RefreshCw, Play, Pause, SkipBack, SkipForward, Maximize2 } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { getCsrfToken } from "@/lib/queryClient";
import type { ArtifactType } from "@shared/schema";

export interface DevicePreset {
  id: string;
  label: string;
  width: number | null;
  height: number | null;
  icon: "phone" | "tablet" | "desktop";
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "responsive", label: "Responsive", width: null, height: null, icon: "desktop" },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, icon: "phone" },
  { id: "iphone-14", label: "iPhone 14", width: 390, height: 844, icon: "phone" },
  { id: "iphone-14-pro-max", label: "iPhone 14 Pro Max", width: 430, height: 932, icon: "phone" },
  { id: "galaxy-s21", label: "Galaxy S21", width: 360, height: 800, icon: "phone" },
  { id: "pixel-7", label: "Pixel 7", width: 412, height: 915, icon: "phone" },
  { id: "ipad-mini", label: "iPad Mini", width: 768, height: 1024, icon: "tablet" },
  { id: "ipad-air", label: "iPad Air", width: 820, height: 1180, icon: "tablet" },
  { id: "ipad-pro", label: "iPad Pro 12.9\"", width: 1024, height: 1366, icon: "tablet" },
  { id: "desktop-1280", label: "Desktop 1280px", width: 1280, height: 800, icon: "desktop" },
  { id: "desktop-1440", label: "Desktop 1440px", width: 1440, height: 900, icon: "desktop" },
  { id: "desktop-1920", label: "Desktop 1920px", width: 1920, height: 1080, icon: "desktop" },
  { id: "custom", label: "Custom", width: null, height: null, icon: "desktop" },
];

interface ErudaWindow extends Window {
  eruda?: {
    _isInit?: boolean;
    init: () => void;
    show: () => void;
    destroy: () => void;
  };
}

function DeviceIcon({ type, className }: { type: "phone" | "tablet" | "desktop"; className?: string }) {
  if (type === "phone") return <Smartphone className={className} />;
  if (type === "tablet") return <Tablet className={className} />;
  return <Monitor className={className} />;
}

export function DevicePresetSelector({
  selectedPreset,
  onSelect,
  projectId,
  customWidth,
  customHeight,
  onCustomSizeChange,
}: {
  selectedPreset: string;
  onSelect: (preset: DevicePreset) => void;
  projectId?: string;
  customWidth?: number | null;
  customHeight?: number | null;
  onCustomSizeChange?: (width: number, height: number) => void;
}) {
  const current = DEVICE_PRESETS.find(p => p.id === selectedPreset) || DEVICE_PRESETS[0];
  const [customW, setCustomW] = useState(customWidth || 800);
  const [customH, setCustomH] = useState(customHeight || 600);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (customWidth) setCustomW(customWidth);
    if (customHeight) setCustomH(customHeight);
  }, [customWidth, customHeight]);

  const displayDimensions = selectedPreset === "custom"
    ? `${customW}×${customH}`
    : current.width && current.height
      ? `${current.width}×${current.height}`
      : null;

  const handlePresetSelect = (preset: DevicePreset) => {
    if (preset.id === "custom") {
      setCustomOpen(true);
      const customPreset = { ...preset, width: customW, height: customH };
      onSelect(customPreset);
      persistPreset(preset.id, customW, customH);
    } else {
      onSelect(preset);
      persistPreset(preset.id);
    }
  };

  const persistPreset = (presetId: string, w?: number, h?: number) => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/device-preset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      credentials: "include",
      body: JSON.stringify({ preset: presetId, customWidth: w || null, customHeight: h || null }),
    }).catch(() => {});
  };

  const applyCustomSize = () => {
    const w = Math.max(100, Math.min(3840, customW));
    const h = Math.max(100, Math.min(2160, customH));
    setCustomW(w);
    setCustomH(h);
    const customPreset: DevicePreset = { id: "custom", label: "Custom", width: w, height: h, icon: "desktop" };
    onSelect(customPreset);
    onCustomSizeChange?.(w, h);
    persistPreset("custom", w, h);
    setCustomOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded gap-1"
            title="Device preset"
            data-testid="button-device-preset"
          >
            <DeviceIcon type={current.icon} className="w-3 h-3" />
            <span className="hidden sm:inline max-w-[100px] truncate">{current.label}</span>
            {displayDimensions && (
              <span className="hidden sm:inline text-[8px] text-[var(--ide-text-muted)] font-mono">{displayDimensions}</span>
            )}
            <ChevronDown className="w-2.5 h-2.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)]">
          {DEVICE_PRESETS.map((preset, i) => {
            const showSep = i > 0 && DEVICE_PRESETS[i - 1].icon !== preset.icon;
            return (
              <div key={preset.id}>
                {showSep && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className={`text-xs gap-2 cursor-pointer ${selectedPreset === preset.id ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)]"}`}
                  onClick={() => handlePresetSelect(preset)}
                  data-testid={`device-preset-${preset.id}`}
                >
                  {preset.id === "custom" ? (
                    <Settings2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <DeviceIcon type={preset.icon} className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="flex-1">{preset.label}</span>
                  {preset.width && preset.height && (
                    <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{preset.width}×{preset.height}</span>
                  )}
                </DropdownMenuItem>
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedPreset === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
              data-testid="button-custom-size-edit"
            >
              <Settings2 className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 bg-[var(--ide-panel)] border-[var(--ide-border)] p-3" align="start">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[var(--ide-text)] uppercase tracking-wider">Custom Size</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Width</label>
                  <Input
                    type="number"
                    min={100}
                    max={3840}
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="h-6 text-[11px] bg-[var(--ide-bg)] border-[var(--ide-border)]"
                    data-testid="input-custom-width"
                  />
                </div>
                <span className="text-[var(--ide-text-muted)] text-xs mt-3">×</span>
                <div className="flex-1">
                  <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Height</label>
                  <Input
                    type="number"
                    min={100}
                    max={2160}
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="h-6 text-[11px] bg-[var(--ide-bg)] border-[var(--ide-border)]"
                    data-testid="input-custom-height"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-6 text-[10px]"
                onClick={applyCustomSize}
                data-testid="button-apply-custom-size"
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function DevToolsToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`w-6 h-6 rounded ${active ? "text-[#0079F2] bg-[#0079F2]/10 hover:bg-[#0079F2]/20" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`}
      onClick={onToggle}
      title={active ? "Hide DevTools" : "Show DevTools"}
      data-testid="button-devtools-toggle"
    >
      <Wrench className="w-3 h-3" />
    </Button>
  );
}

const ERUDA_CDN = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";

const ERUDA_INJECTION_SNIPPET = `<script src="${ERUDA_CDN}"></script><script>if(typeof eruda!=='undefined'){eruda.init();eruda.show();}</script>`;

export function injectErudaIntoHtml(html: string, active: boolean): string {
  if (!active || !html) return html;
  if (html.includes("eruda")) return html;
  const bodyCloseIndex = html.lastIndexOf("</body>");
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + ERUDA_INJECTION_SNIPPET + html.slice(bodyCloseIndex);
  }
  return html + ERUDA_INJECTION_SNIPPET;
}

export function useErudaInjection(
  iframeId: string,
  devToolsActive: boolean,
  previewHtml: string | null,
  livePreviewUrl: string | null,
): void {
  const injectedRef = useRef(false);

  const injectEruda = useCallback((iframe: HTMLIFrameElement): void => {
    if (!iframe) return;

    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document || null;
    } catch (e) {
      console.warn(`[DevTools] Cannot access iframe "${iframeId}" document — skipping client-side injection (server proxy handles this).`);
      return;
    }

    if (!doc) return;
    if (doc.getElementById("eruda-injected-script")) return;

    const script = doc.createElement("script");
    script.id = "eruda-injected-script";
    script.src = ERUDA_CDN;
    script.onload = () => {
      try {
        const initScript = doc!.createElement("script");
        initScript.textContent = `
          if (typeof eruda !== 'undefined' && !eruda._isInit) {
            eruda.init();
            eruda.show();
          }
        `;
        doc!.body.appendChild(initScript);
      } catch (e) {
        console.warn(`[DevTools] Failed to initialize Eruda in iframe "${iframeId}":`, e);
      }
    };
    script.onerror = () => {
      console.warn(`[DevTools] Failed to load Eruda script from CDN in iframe "${iframeId}".`);
    };
    doc.head.appendChild(script);
    injectedRef.current = true;
  }, [iframeId]);

  const removeEruda = useCallback((iframe: HTMLIFrameElement) => {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const win = iframe.contentWindow as ErudaWindow | null;
      if (win?.eruda?._isInit) {
        win.eruda.destroy();
      }
      const script = doc.getElementById("eruda-injected-script");
      if (script) script.remove();
      injectedRef.current = false;
    } catch {
      // Cross-origin iframe — removal handled by proxy reload
    }
  }, [iframeId]);

  useEffect(() => {
    if (!devToolsActive) {
      const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (iframe) removeEruda(iframe);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryInject = () => {
      const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (!iframe) return;
      injectEruda(iframe);
    };

    const handleLoad = () => {
      injectedRef.current = false;
      tryInject();
    };

    const startListening = () => {
      const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (iframe) {
        iframe.addEventListener("load", handleLoad);
        try {
          if (iframe.contentDocument?.readyState === "complete") {
            tryInject();
          }
        } catch {
          // Cross-origin — server proxy handles injection
        }
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      }
    };

    startListening();

    if (!document.getElementById(iframeId)) {
      pollTimer = setInterval(() => {
        if (cancelled) { if (pollTimer) clearInterval(pollTimer); return; }
        if (document.getElementById(iframeId)) {
          startListening();
        }
      }, 500);
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (iframe) iframe.removeEventListener("load", handleLoad);
    };
  }, [iframeId, devToolsActive, injectEruda, removeEruda, previewHtml, livePreviewUrl]);
}

export function DeviceFrame({
  children,
  selectedPreset,
  className,
  customWidth,
  customHeight,
}: {
  children: React.ReactNode;
  selectedPreset: string;
  className?: string;
  customWidth?: number | null;
  customHeight?: number | null;
}) {
  const preset = DEVICE_PRESETS.find(p => p.id === selectedPreset);

  let frameWidth: number | null = null;
  let frameHeight: number | null = null;
  let frameLabel = preset?.label || "Responsive";
  let deviceType: "phone" | "tablet" | "desktop" = preset?.icon || "desktop";

  if (selectedPreset === "custom" && customWidth && customHeight) {
    frameWidth = customWidth;
    frameHeight = customHeight;
    frameLabel = "Custom";
  } else if (preset && preset.width !== null && preset.height !== null) {
    frameWidth = preset.width;
    frameHeight = preset.height;
  }

  const isConstrained = frameWidth !== null && frameHeight !== null;

  if (!isConstrained) {
    return <div className={`flex-1 overflow-hidden ${className || ""}`} data-testid="device-frame-responsive">{children}</div>;
  }

  const isPhone = deviceType === "phone";
  const isTablet = deviceType === "tablet";
  const hasDynamicIsland = isPhone && (selectedPreset.includes("14") || selectedPreset.includes("15") || selectedPreset.includes("pro"));
  const isAndroid = selectedPreset.includes("galaxy") || selectedPreset.includes("pixel");

  if (isPhone) {
    return (
      <div className={`flex-1 overflow-auto flex items-start justify-center bg-[var(--ide-bg)] p-4 ${className || ""}`} data-testid="device-frame-container">
        <div
          className="relative shrink-0"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
          data-testid="device-frame"
        >
          <div className="relative bg-[#1a1a1a] rounded-[40px] p-3 shadow-2xl" style={{ width: `${frameWidth! + 24}px` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
              {hasDynamicIsland && !isAndroid ? (
                <div className="w-[90px] h-[25px] bg-black rounded-b-[14px] flex items-center justify-center gap-2" data-testid="device-notch-dynamic-island">
                  <div className="w-[8px] h-[8px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
                </div>
              ) : !isAndroid ? (
                <div className="w-[150px] h-[28px] bg-black rounded-b-[16px] flex items-center justify-center gap-2" data-testid="device-notch">
                  <div className="w-[10px] h-[10px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
                  <div className="w-[40px] h-[4px] rounded-full bg-[#1a1a2e]" />
                </div>
              ) : null}
            </div>
            {isAndroid && (
              <div className="absolute top-[6px] left-1/2 -translate-x-1/2 z-20" data-testid="device-camera-punch">
                <div className="w-[10px] h-[10px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
              </div>
            )}
            <div className="relative overflow-hidden rounded-[28px] bg-white" style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}>
              <div className="absolute top-0 left-0 right-0 h-[44px] bg-black/5 backdrop-blur-sm flex items-center justify-between px-6 z-10 pointer-events-none" data-testid="device-status-bar">
                <span className="text-[10px] font-semibold text-black/70">9:41</span>
                <div className="flex items-center gap-1">
                  <svg width="15" height="10" viewBox="0 0 15 10" fill="none"><rect x="0" y="3" width="3" height="7" rx="0.5" fill="black" fillOpacity="0.7"/><rect x="4" y="2" width="3" height="8" rx="0.5" fill="black" fillOpacity="0.7"/><rect x="8" y="1" width="3" height="9" rx="0.5" fill="black" fillOpacity="0.7"/><rect x="12" y="0" width="3" height="10" rx="0.5" fill="black" fillOpacity="0.7"/></svg>
                  <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="19" height="9" rx="2" stroke="black" strokeOpacity="0.35"/><rect x="2" y="2" width="14" height="6" rx="1" fill="black" fillOpacity="0.7"/><rect x="21" y="3" width="1.5" height="4" rx="0.5" fill="black" fillOpacity="0.35"/></svg>
                </div>
              </div>
              <div className="w-full h-full overflow-hidden">
                {children}
              </div>
            </div>
            <div className="flex items-center justify-center mt-1" data-testid="device-home-indicator">
              <div className="w-[100px] h-[4px] rounded-full bg-white/30" />
            </div>
          </div>
          <div className="text-center mt-2">
            <span className="text-[8px] text-[var(--ide-text-muted)] font-mono">{frameLabel} — {frameWidth}×{frameHeight}</span>
          </div>
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className={`flex-1 overflow-auto flex items-start justify-center bg-[var(--ide-bg)] p-4 ${className || ""}`} data-testid="device-frame-container">
        <div
          className="relative shrink-0"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
          data-testid="device-frame"
        >
          <div className="relative bg-[#2a2a2a] rounded-[20px] p-3 shadow-2xl" style={{ width: `${frameWidth! + 24}px` }}>
            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-20" data-testid="device-tablet-camera">
              <div className="w-[8px] h-[8px] rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a3e]" />
            </div>
            <div className="relative overflow-hidden rounded-[8px] bg-white" style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}>
              <div className="absolute top-0 left-0 right-0 h-[24px] bg-black/5 backdrop-blur-sm flex items-center justify-between px-5 z-10 pointer-events-none" data-testid="device-status-bar">
                <span className="text-[9px] font-medium text-black/60">9:41</span>
                <div className="flex items-center gap-1">
                  <svg width="14" height="9" viewBox="0 0 15 10" fill="none"><rect x="0" y="3" width="3" height="7" rx="0.5" fill="black" fillOpacity="0.5"/><rect x="4" y="2" width="3" height="8" rx="0.5" fill="black" fillOpacity="0.5"/><rect x="8" y="1" width="3" height="9" rx="0.5" fill="black" fillOpacity="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5" fill="black" fillOpacity="0.5"/></svg>
                  <svg width="20" height="9" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="19" height="9" rx="2" stroke="black" strokeOpacity="0.3"/><rect x="2" y="2" width="14" height="6" rx="1" fill="black" fillOpacity="0.5"/><rect x="21" y="3" width="1.5" height="4" rx="0.5" fill="black" fillOpacity="0.3"/></svg>
                </div>
              </div>
              <div className="w-full h-full overflow-hidden">
                {children}
              </div>
            </div>
            <div className="flex items-center justify-center mt-1" data-testid="device-home-indicator">
              <div className="w-[80px] h-[4px] rounded-full bg-white/25" />
            </div>
          </div>
          <div className="text-center mt-2">
            <span className="text-[8px] text-[var(--ide-text-muted)] font-mono">{frameLabel} — {frameWidth}×{frameHeight}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-auto flex items-start justify-center bg-[var(--ide-bg)] p-4 ${className || ""}`} data-testid="device-frame-container">
      <div
        className="relative bg-white border-2 border-[var(--ide-border)] rounded-lg shadow-lg overflow-hidden shrink-0"
        style={{
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
        data-testid="device-frame"
      >
        <div className="absolute top-0 left-0 right-0 h-5 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] flex items-center justify-center z-10">
          <span className="text-[8px] text-[var(--ide-text-muted)] font-mono">{frameLabel} — {frameWidth}×{frameHeight}</span>
        </div>
        <div className="w-full h-full pt-5 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

const ARTIFACT_TYPE_META: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  "web-app": { icon: Globe, color: "#0079F2", label: "Web App" },
  "mobile-app": { icon: Smartphone, color: "#0CCE6B", label: "Mobile App" },
  "slides": { icon: Presentation, color: "#7C65CB", label: "Slides" },
  "animation": { icon: Film, color: "#F26522", label: "Animation" },
  "data-viz": { icon: BarChart3, color: "#00B4D8", label: "Data Viz" },
  "3d-game": { icon: Gamepad2, color: "#E63946", label: "3D Game" },
  "document": { icon: FileText, color: "#8B8B8B", label: "Document" },
  "spreadsheet": { icon: Table2, color: "#2D9B4E", label: "Spreadsheet" },
  "design": { icon: Palette, color: "#E040FB", label: "Design" },
  "automation": { icon: Zap, color: "#FFB800", label: "Automation" },
};

export function ArtifactTypeIcon({ type, className }: { type: string; className?: string }) {
  const meta = ARTIFACT_TYPE_META[type] || ARTIFACT_TYPE_META["web-app"];
  const Icon = meta.icon;
  return <Icon className={className} style={{ color: meta.color }} />;
}

export function getArtifactTypeMeta(type: string) {
  return ARTIFACT_TYPE_META[type] || ARTIFACT_TYPE_META["web-app"];
}

export function ArtifactTypeControls({
  artifactType,
  onRefresh,
  onExport,
}: {
  artifactType: string | null;
  onRefresh?: () => void;
  onExport?: () => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [totalSlides] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    const timer = setInterval(onRefresh, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, onRefresh]);

  if (!artifactType) return null;

  if (artifactType === "slides") {
    return (
      <div className="flex items-center gap-1" data-testid="controls-slides">
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
          disabled={slideIndex === 0}
          title="Previous slide" data-testid="button-slide-prev"><ChevronLeft className="w-3 h-3" /></Button>
        <span className="text-[9px] text-[var(--ide-text-secondary)] font-mono tabular-nums min-w-[28px] text-center" data-testid="text-slide-index">{slideIndex + 1}/{totalSlides}</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          onClick={() => setSlideIndex(Math.min(totalSlides - 1, slideIndex + 1))}
          disabled={slideIndex >= totalSlides - 1}
          title="Next slide" data-testid="button-slide-next"><ChevronRight className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          title="Present fullscreen" data-testid="button-slide-present"><Maximize2 className="w-3 h-3" /></Button>
      </div>
    );
  }

  if (artifactType === "animation") {
    return (
      <div className="flex items-center gap-1" data-testid="controls-animation">
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Pause" : "Play"} data-testid="button-anim-play">{isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</Button>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
          title="Restart" data-testid="button-anim-restart"><SkipBack className="w-3 h-3" /></Button>
        {onExport && (
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
            onClick={onExport}
            title="Export" data-testid="button-anim-export"><Download className="w-3 h-3" /></Button>
        )}
      </div>
    );
  }

  if (artifactType === "data-viz") {
    return (
      <div className="flex items-center gap-1" data-testid="controls-dataviz">
        <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors ${autoRefresh ? "text-[#00B4D8] bg-[#00B4D8]/10 hover:bg-[#00B4D8]/20" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
          title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh (5s)"} data-testid="button-dataviz-autorefresh"><RefreshCw className="w-3 h-3" /></Button>
        {onRefresh && (
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
            onClick={onRefresh}
            title="Refresh now" data-testid="button-dataviz-refresh"><SkipForward className="w-3 h-3" /></Button>
        )}
        {onExport && (
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
            onClick={onExport}
            title="Export data" data-testid="button-dataviz-export"><Download className="w-3 h-3" /></Button>
        )}
      </div>
    );
  }

  return null;
}

export function useDevicePresetPersistence(projectId: string | undefined) {
  const [savedPreset, setSavedPreset] = useState<string>("responsive");
  const [savedCustomWidth, setSavedCustomWidth] = useState<number | null>(null);
  const [savedCustomHeight, setSavedCustomHeight] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/device-preset`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSavedPreset(data.preset || "responsive");
          setSavedCustomWidth(data.customWidth || null);
          setSavedCustomHeight(data.customHeight || null);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId]);

  return { savedPreset, savedCustomWidth, savedCustomHeight, loaded };
}
