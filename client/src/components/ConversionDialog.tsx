import React, { useState, useEffect } from "react";
import { Loader2, ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import ArtifactTypeCarousel from "./ArtifactTypeCarousel";
import { getCsrfToken } from "@/lib/queryClient";

interface ConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  frameId: string;
  frameName: string;
  initialTargetType?: string;
}

export default function ConversionDialog({ open, onOpenChange, projectId, frameId, frameName, initialTargetType }: ConversionDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(initialTargetType || "web");

  useEffect(() => {
    if (initialTargetType) setSelectedType(initialTargetType);
  }, [initialTargetType]);
  const [status, setStatus] = useState<"idle" | "converting" | "complete" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleConvert = async () => {
    if (!selectedType) return;
    setStatus("converting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/projects/${projectId}/conversions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ frameId, targetArtifactType: selectedType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to start conversion");
      }

      const pollConversion = async (conversionId: string) => {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const pollRes = await fetch(`/api/projects/${projectId}/conversions/${conversionId}`, { credentials: "include" });
          if (!pollRes.ok) continue;
          const conversion = await pollRes.json();
          if (conversion.status === "complete") {
            setStatus("complete");
            return;
          }
          if (conversion.status === "failed") {
            throw new Error(conversion.error || "Conversion failed");
          }
        }
        throw new Error("Conversion timed out");
      };

      const conversion = await res.json();
      await pollConversion(conversion.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Conversion failed");
      setStatus("error");
    }
  };

  const handleClose = () => {
    if (status !== "converting") {
      setStatus("idle");
      setErrorMsg("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] max-w-lg" data-testid="conversion-dialog">
        <DialogHeader>
          <DialogTitle className="text-[var(--ide-text)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7C65CB]" />
            Convert to App
          </DialogTitle>
          <DialogDescription className="text-[var(--ide-text-muted)]">
            Convert <span className="text-[var(--ide-text)] font-medium">"{frameName}"</span> into a real application.
            The frame's design patterns will be extracted and used to generate source code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {status === "idle" && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mb-2">
                  Target Type
                </label>
                <ArtifactTypeCarousel
                  selectedType={selectedType}
                  onSelectType={setSelectedType}
                  size="sm"
                />
              </div>

              {selectedType && (
                <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)]/50 p-3">
                  <div className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-1.5">What will be created</div>
                  <ul className="space-y-1 text-[11px] text-[var(--ide-text-secondary)]">
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[#0CCE6B]" />
                      A new artifact of type "{selectedType}"
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[#0CCE6B]" />
                      Design tokens (colors, fonts, spacing) extracted from the frame
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[#0CCE6B]" />
                      Source files matching the frame's layout and style
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[var(--ide-text-muted)]" />
                      Original frame remains unchanged
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--ide-text-secondary)]"
                  onClick={handleClose}
                  data-testid="button-cancel-conversion"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-[#7C65CB] hover:bg-[#6A55B9] text-white"
                  disabled={!selectedType}
                  onClick={handleConvert}
                  data-testid="button-start-conversion"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Convert
                </Button>
              </div>
            </>
          )}

          {status === "converting" && (
            <div className="flex flex-col items-center py-8 gap-3" data-testid="conversion-progress">
              <Loader2 className="w-8 h-8 text-[#7C65CB] animate-spin" />
              <div className="text-sm font-medium text-[var(--ide-text)]">Converting frame...</div>
              <div className="text-[11px] text-[var(--ide-text-muted)]">Analyzing design and generating code</div>
            </div>
          )}

          {status === "complete" && (
            <div className="flex flex-col items-center py-8 gap-3" data-testid="conversion-complete">
              <div className="w-12 h-12 rounded-full bg-[#0CCE6B]/15 flex items-center justify-center">
                <Check className="w-6 h-6 text-[#0CCE6B]" />
              </div>
              <div className="text-sm font-medium text-[var(--ide-text)]">Conversion Complete</div>
              <div className="text-[11px] text-[var(--ide-text-muted)] text-center">
                A new {selectedType} artifact has been created from "{frameName}".
              </div>
              <Button
                size="sm"
                className="mt-2"
                onClick={handleClose}
                data-testid="button-close-conversion"
              >
                Done
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-6 gap-3" data-testid="conversion-error">
              <div className="text-sm font-medium text-red-400">Conversion Failed</div>
              <div className="text-[11px] text-[var(--ide-text-muted)] text-center">{errorMsg}</div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--ide-text-secondary)]"
                  onClick={handleClose}
                  data-testid="button-dismiss-error"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setStatus("idle"); setErrorMsg(""); }}
                  data-testid="button-retry-conversion"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
