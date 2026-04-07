import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Download, Loader2, Film,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AnimationPreviewProps {
  projectId: string;
  artifactId?: string;
  previewUrl?: string | null;
  previewHtml?: string | null;
  exportDialogOpen?: boolean;
  onExportDialogClose?: () => void;
}

type Resolution = "720p" | "1080p";
type Framerate = 30 | 60;

const RESOLUTION_MAP: Record<Resolution, { width: number; height: number; label: string }> = {
  "720p": { width: 1280, height: 720, label: "720p (1280\u00d7720)" },
  "1080p": { width: 1920, height: 1080, label: "1080p (1920\u00d71080)" },
};

export default function AnimationPreview({
  projectId,
  artifactId,
  exportDialogOpen,
  onExportDialogClose,
}: AnimationPreviewProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [framerate, setFramerate] = useState<Framerate>(30);
  const [duration, setDuration] = useState(10);
  const [quality, setQuality] = useState<"standard" | "high">("standard");

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/animations/export/mp4`,
        {
          artifactId,
          width: RESOLUTION_MAP[resolution].width,
          height: RESOLUTION_MAP[resolution].height,
          fps: framerate,
          duration,
          quality,
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animation_${resolution}_${framerate}fps.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export complete", description: "Your MP4 has been downloaded." });
      onExportDialogClose?.();
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message || "Failed to render animation",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [projectId, artifactId, resolution, framerate, duration, quality, toast, onExportDialogClose]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "animation-duration" && typeof e.data.duration === "number") {
        setDuration(Math.ceil(e.data.duration));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const dialogOpen = exportDialogOpen ?? false;
  const handleOpenChange = (open: boolean) => {
    if (!open) onExportDialogClose?.();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-[var(--ide-panel)] border-[var(--ide-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--ide-text)]" data-testid="text-export-dialog-title">
            Export Animation as MP4
          </DialogTitle>
          <DialogDescription className="text-[var(--ide-text-muted)]">
            Configure quality settings for your video export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-[var(--ide-text-secondary)]">Resolution</Label>
            <div className="flex gap-2">
              {(["720p", "1080p"] as Resolution[]).map((r) => (
                <button
                  key={r}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    resolution === r
                      ? "border-[#7C65CB] bg-[#7C65CB]/10 text-[#7C65CB]"
                      : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"
                  }`}
                  onClick={() => setResolution(r)}
                  data-testid={`button-resolution-${r}`}
                >
                  {RESOLUTION_MAP[r].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[var(--ide-text-secondary)]">Frame Rate</Label>
            <div className="flex gap-2">
              {([30, 60] as Framerate[]).map((f) => (
                <button
                  key={f}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    framerate === f
                      ? "border-[#7C65CB] bg-[#7C65CB]/10 text-[#7C65CB]"
                      : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"
                  }`}
                  onClick={() => setFramerate(f)}
                  data-testid={`button-fps-${f}`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[var(--ide-text-secondary)]">
              Duration (seconds)
            </Label>
            <input
              type="number"
              min={1}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(120, parseInt(e.target.value) || 10)))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)] text-xs text-[var(--ide-text)]"
              data-testid="input-duration"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[var(--ide-text-secondary)]">Quality</Label>
            <div className="flex gap-2">
              {(["standard", "high"] as const).map((q) => (
                <button
                  key={q}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    quality === q
                      ? "border-[#7C65CB] bg-[#7C65CB]/10 text-[#7C65CB]"
                      : "border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)]"
                  }`}
                  onClick={() => setQuality(q)}
                  data-testid={`button-quality-${q}`}
                >
                  {q === "standard" ? "Standard" : "High Quality"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 text-xs border-[var(--ide-border)]"
            onClick={() => onExportDialogClose?.()}
            disabled={exporting}
            data-testid="button-export-cancel"
          >
            Cancel
          </Button>
          <Button
            className="flex-1 text-xs bg-[#7C65CB] hover:bg-[#6B56B8] text-white"
            onClick={handleExport}
            disabled={exporting}
            data-testid="button-export-render"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Rendering...
              </>
            ) : (
              <>
                <Film className="w-3.5 h-3.5 mr-1.5" />
                Render MP4
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}