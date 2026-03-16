import { useState, useCallback } from "react";
import { Smartphone, Tablet, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface MobileDevice {
  id: string;
  label: string;
  width: number;
  height: number;
  type: "iphone" | "android" | "ipad";
  notchStyle: "notch" | "dynamic-island" | "none";
}

const MOBILE_DEVICES: MobileDevice[] = [
  { id: "iphone-15", label: "iPhone 15", width: 393, height: 852, type: "iphone", notchStyle: "dynamic-island" },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, type: "iphone", notchStyle: "none" },
  { id: "iphone-15-pro-max", label: "iPhone 15 Pro Max", width: 430, height: 932, type: "iphone", notchStyle: "dynamic-island" },
  { id: "pixel-8", label: "Pixel 8", width: 412, height: 915, type: "android", notchStyle: "none" },
  { id: "galaxy-s24", label: "Galaxy S24", width: 360, height: 780, type: "android", notchStyle: "none" },
  { id: "ipad-air", label: "iPad Air", width: 820, height: 1180, type: "ipad", notchStyle: "none" },
];

interface MobilePreviewProps {
  previewUrl: string | null;
  previewHtml: string | null;
}

export default function MobilePreview({ previewUrl, previewHtml }: MobilePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<MobileDevice>(MOBILE_DEVICES[0]);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  const handleDeviceChange = useCallback((device: MobileDevice) => {
    setSelectedDevice(device);
  }, []);

  const DeviceIcon = selectedDevice.type === "ipad" ? Tablet : Smartphone;

  const scale = (() => {
    const maxW = 420;
    const maxH = 700;
    const scaleW = maxW / selectedDevice.width;
    const scaleH = maxH / selectedDevice.height;
    return Math.min(scaleW, scaleH, 1);
  })();

  const frameWidth = selectedDevice.width;
  const frameHeight = selectedDevice.height;
  const borderRadius = selectedDevice.type === "ipad" ? 24 : 44;

  const hasContent = previewUrl || previewHtml;

  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)]" data-testid="mobile-preview-container">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <DeviceIcon className="w-3.5 h-3.5 text-[var(--ide-text-secondary)]" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded gap-1"
              data-testid="button-mobile-device-select"
            >
              <span>{selectedDevice.label}</span>
              <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">
                {selectedDevice.width}x{selectedDevice.height}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-[var(--ide-panel)] border-[var(--ide-border)]">
            {MOBILE_DEVICES.map((device, i) => {
              const showSep = i > 0 && MOBILE_DEVICES[i - 1].type !== device.type;
              return (
                <div key={device.id}>
                  {showSep && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className={`text-xs gap-2 cursor-pointer ${selectedDevice.id === device.id ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)]"}`}
                    onClick={() => handleDeviceChange(device)}
                    data-testid={`mobile-device-${device.id}`}
                  >
                    {device.type === "ipad" ? <Tablet className="w-3.5 h-3.5 shrink-0" /> : <Smartphone className="w-3.5 h-3.5 shrink-0" />}
                    <span className="flex-1">{device.label}</span>
                    <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{device.width}x{device.height}</span>
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
          onClick={handleRefresh}
          data-testid="button-mobile-refresh"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
        {previewUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={() => window.open(previewUrl, "_blank")}
            data-testid="button-mobile-external"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden p-4" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
        <div
          style={{
            width: frameWidth + 16,
            height: frameHeight + 16,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              width: frameWidth + 16,
              height: frameHeight + 16,
              borderRadius: borderRadius + 4,
              background: "#1a1a1a",
              padding: 8,
              boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.05)",
              position: "relative",
            }}
            data-testid="mobile-device-frame"
          >
            {selectedDevice.notchStyle === "dynamic-island" && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 34,
                  borderRadius: 20,
                  background: "#000",
                  zIndex: 10,
                }}
                data-testid="mobile-dynamic-island"
              />
            )}

            {selectedDevice.type !== "ipad" && selectedDevice.notchStyle === "none" && selectedDevice.type === "iphone" && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 60,
                  height: 4,
                  borderRadius: 2,
                  background: "#333",
                  zIndex: 10,
                }}
              />
            )}

            <div
              style={{
                width: frameWidth,
                height: frameHeight,
                borderRadius: borderRadius,
                overflow: "hidden",
                background: "#fff",
                position: "relative",
              }}
            >
              {hasContent ? (
                <iframe
                  key={iframeKey}
                  src={previewUrl || undefined}
                  srcDoc={!previewUrl && previewHtml ? previewHtml : undefined}
                  style={{
                    width: frameWidth,
                    height: frameHeight,
                    border: "none",
                    background: "#fff",
                  }}
                  title="Mobile Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  data-testid="mobile-preview-iframe"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-[#f5f5f5]">
                  <Smartphone className="w-10 h-10 text-[#ccc] mb-3" />
                  <p className="text-sm font-medium text-[#999]" data-testid="text-mobile-no-preview">No preview available</p>
                  <p className="text-xs text-[#bbb] mt-1">Run your app to see the preview</p>
                </div>
              )}
            </div>

            {selectedDevice.type !== "ipad" && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 140,
                  height: 5,
                  borderRadius: 3,
                  background: "#444",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function isMobileAppProject(files: { filename: string; content: string }[]): boolean {
  const hasAppJson = files.some(f => f.filename === "app.json" && f.content.includes('"expo"'));
  const hasReactNative = files.some(f =>
    f.filename === "package.json" && (f.content.includes('"react-native"') || f.content.includes('"expo"'))
  );
  return hasAppJson || hasReactNative;
}
