import { useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Smartphone, Tablet, Monitor, Wrench, ChevronDown } from "lucide-react";

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
  { id: "desktop-1920", label: "Desktop 1920px", width: 1920, height: 1080, icon: "desktop" },
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
}: {
  selectedPreset: string;
  onSelect: (preset: DevicePreset) => void;
}) {
  const current = DEVICE_PRESETS.find(p => p.id === selectedPreset) || DEVICE_PRESETS[0];

  return (
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
          <span className="hidden sm:inline max-w-[80px] truncate">{current.label}</span>
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
                onClick={() => onSelect(preset)}
                data-testid={`device-preset-${preset.id}`}
              >
                <DeviceIcon type={preset.icon} className="w-3.5 h-3.5 shrink-0" />
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
}: {
  children: React.ReactNode;
  selectedPreset: string;
  className?: string;
}) {
  const preset = DEVICE_PRESETS.find(p => p.id === selectedPreset);
  const isConstrained = preset && preset.width !== null && preset.height !== null;

  if (!isConstrained) {
    return <div className={`flex-1 overflow-hidden ${className || ""}`} data-testid="device-frame-responsive">{children}</div>;
  }

  return (
    <div className={`flex-1 overflow-auto flex items-start justify-center bg-[var(--ide-bg)] p-4 ${className || ""}`} data-testid="device-frame-container">
      <div
        className="relative bg-white border-2 border-[var(--ide-border)] rounded-lg shadow-lg overflow-hidden shrink-0"
        style={{
          width: `${preset!.width}px`,
          height: `${preset!.height}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
        data-testid="device-frame"
      >
        <div className="absolute top-0 left-0 right-0 h-5 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] flex items-center justify-center z-10">
          <span className="text-[8px] text-[var(--ide-text-muted)] font-mono">{preset!.label} — {preset!.width}×{preset!.height}</span>
        </div>
        <div className="w-full h-full pt-5 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
