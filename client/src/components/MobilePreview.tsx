import { useState, useCallback, useEffect } from "react";
import { Smartphone, Tablet, RotateCcw, ExternalLink, QrCode, Wifi, Monitor, Server, ArrowRight, Loader2 } from "lucide-react";
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
  projectName?: string;
  expoGoUrl?: string | null;
}

function QRCodeDisplay({ expoGoUrl, projectName }: { expoGoUrl: string | null; projectName?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expoGoUrl) {
      setQrDataUrl(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/qrcode?data=${encodeURIComponent(expoGoUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
        } else {
          setError("Failed to generate QR code");
        }
      })
      .catch(() => setError("Failed to generate QR code"))
      .finally(() => setLoading(false));
  }, [expoGoUrl]);

  if (!expoGoUrl) {
    return (
      <div className="flex flex-col items-center gap-3 p-4" data-testid="qr-code-panel">
        <div className="w-8 h-8 rounded-lg bg-[#7C65CB]/15 flex items-center justify-center">
          <QrCode className="w-4 h-4 text-[#7C65CB]" />
        </div>
        <p className="text-[11px] font-semibold text-[var(--ide-text)] text-center">
          Expo Go QR Code
        </p>
        <div className="w-40 h-40 rounded-xl border-2 border-dashed border-[var(--ide-border)] flex items-center justify-center">
          <p className="text-[10px] text-[var(--ide-text-muted)] text-center px-4">
            Run the project to generate an Expo Go QR code for device testing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4" data-testid="qr-code-panel">
      <div className="w-8 h-8 rounded-lg bg-[#7C65CB]/15 flex items-center justify-center">
        <QrCode className="w-4 h-4 text-[#7C65CB]" />
      </div>
      <p className="text-[11px] font-semibold text-[var(--ide-text)] text-center">
        Scan with Expo Go
      </p>
      <div className="rounded-xl overflow-hidden border-2 border-[#7C65CB]/30 bg-white p-2" data-testid="qr-code-image">
        {loading ? (
          <div className="w-40 h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#7C65CB] animate-spin" />
          </div>
        ) : error ? (
          <div className="w-40 h-40 flex items-center justify-center">
            <p className="text-xs text-red-500 text-center">{error}</p>
          </div>
        ) : qrDataUrl ? (
          <img src={qrDataUrl} alt="Expo Go QR Code" width={160} height={160} />
        ) : null}
      </div>
      <div className="text-center space-y-1">
        <p className="text-[10px] text-[var(--ide-text-secondary)]">
          Open <span className="font-semibold text-[#7C65CB]">Expo Go</span> on your phone
        </p>
        <p className="text-[10px] text-[var(--ide-text-muted)]">
          Scan this QR code to preview{projectName ? ` "${projectName}"` : ""} on device
        </p>
      </div>
      <div className="w-full rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] p-2.5 mt-1">
        <p className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate" data-testid="text-expo-url">
          {expoGoUrl}
        </p>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="flex flex-col items-center gap-3 p-4" data-testid="architecture-panel">
      <p className="text-[10px] font-semibold text-[var(--ide-text)] uppercase tracking-wider">Architecture</p>
      <div className="w-full flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0079F2]/10 border border-[#0079F2]/20">
          <Server className="w-5 h-5 text-[#0079F2]" />
          <span className="text-[9px] font-semibold text-[#0079F2]">Replit Cloud</span>
          <span className="text-[8px] text-[var(--ide-text-muted)]">Expo Dev Server</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ArrowRight className="w-4 h-4 text-[var(--ide-text-muted)]" />
          <Wifi className="w-3 h-3 text-[var(--ide-text-muted)]" />
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0CCE6B]/10 border border-[#0CCE6B]/20">
          <Smartphone className="w-5 h-5 text-[#0CCE6B]" />
          <span className="text-[9px] font-semibold text-[#0CCE6B]">Your Device</span>
          <span className="text-[8px] text-[var(--ide-text-muted)]">Expo Go App</span>
        </div>
      </div>
      <div className="w-full rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] p-2.5 space-y-1.5 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0079F2]" />
          <span className="text-[9px] text-[var(--ide-text-secondary)]">Metro bundler runs on Replit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B]" />
          <span className="text-[9px] text-[var(--ide-text-secondary)]">Native app runs on your phone via Expo Go</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
          <span className="text-[9px] text-[var(--ide-text-secondary)]">Web preview available in browser</span>
        </div>
      </div>
    </div>
  );
}

export default function MobilePreview({ previewUrl, previewHtml, projectName, expoGoUrl }: MobilePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<MobileDevice>(MOBILE_DEVICES[0]);
  const [iframeKey, setIframeKey] = useState(0);
  const [activePanel, setActivePanel] = useState<"preview" | "qr" | "arch">("preview");

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
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <div className="flex items-center gap-0.5 mr-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[10px] rounded gap-1 ${activePanel === "preview" ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setActivePanel("preview")}
            data-testid="button-panel-preview"
          >
            <Monitor className="w-3 h-3" />
            <span>Preview</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[10px] rounded gap-1 ${activePanel === "qr" ? "bg-[#7C65CB]/15 text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setActivePanel("qr")}
            data-testid="button-panel-qr"
          >
            <QrCode className="w-3 h-3" />
            <span>QR Code</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[10px] rounded gap-1 ${activePanel === "arch" ? "bg-[#0079F2]/15 text-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setActivePanel("arch")}
            data-testid="button-panel-arch"
          >
            <Server className="w-3 h-3" />
            <span>Architecture</span>
          </Button>
        </div>
        <div className="flex-1" />
        {activePanel === "preview" && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded gap-1"
                  data-testid="button-mobile-device-select"
                >
                  <DeviceIcon className="w-3 h-3" />
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
          </>
        )}
      </div>

      {activePanel === "qr" && (
        <div className="flex-1 flex items-center justify-center overflow-auto" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
          <div className="bg-[var(--ide-panel)] rounded-xl border border-[var(--ide-border)] shadow-xl max-w-sm w-full mx-4">
            <QRCodeDisplay
              expoGoUrl={expoGoUrl ?? null}
              projectName={projectName}
            />
          </div>
        </div>
      )}

      {activePanel === "arch" && (
        <div className="flex-1 flex items-center justify-center overflow-auto" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
          <div className="bg-[var(--ide-panel)] rounded-xl border border-[var(--ide-border)] shadow-xl max-w-sm w-full mx-4">
            <ArchitectureDiagram />
          </div>
        </div>
      )}

      {activePanel === "preview" && (
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
      )}
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
