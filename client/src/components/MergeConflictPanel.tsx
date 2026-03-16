import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken } from "@/lib/queryClient";
import {
  X, Check, AlertTriangle, GitMerge, ChevronRight,
  Loader2, FileCode, ArrowLeftRight
} from "lucide-react";
import type { MergeConflictFile, MergeResolution } from "@shared/schema";

interface MergeConflictPanelProps {
  projectId: string;
  conflicts: MergeConflictFile[];
  resolutions: MergeResolution[];
  onClose: () => void;
  onMergeComplete: () => void;
  onAbort: () => void;
  onResolutionChange?: (resolutions: MergeResolution[]) => void;
}

export default function MergeConflictPanel({
  projectId,
  conflicts,
  resolutions: initialResolutions,
  onClose,
  onMergeComplete,
  onAbort,
  onResolutionChange,
}: MergeConflictPanelProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<string>(conflicts[0]?.filename || "");
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const r of initialResolutions) {
      initial[r.filename] = r.resolvedContent;
    }
    setResolutions(initial);
  }, [initialResolutions]);

  const resolvedCount = Object.keys(resolutions).length;
  const totalCount = conflicts.length;
  const allResolved = resolvedCount >= totalCount;

  useEffect(() => {
    if (onResolutionChange) {
      const mergeResolutions: MergeResolution[] = Object.entries(resolutions).map(([filename, resolvedContent]) => ({
        filename,
        resolvedContent,
      }));
      onResolutionChange(mergeResolutions);
    }
  }, [resolutions, onResolutionChange]);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    return headers;
  }, []);

  const resolveFile = useCallback(async (filename: string, content: string) => {
    setResolutions(prev => ({ ...prev, [filename]: content }));
    try {
      const res = await fetch(`/api/projects/${projectId}/git/resolve-conflict`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ path: filename, resolvedContent: content }),
      });
      if (!res.ok) {
        const data = await res.json();
        setResolutions(prev => {
          const next = { ...prev };
          delete next[filename];
          return next;
        });
        toast({ title: "Failed to save resolution", description: data.message, variant: "destructive" });
      }
    } catch {
      setResolutions(prev => {
        const next = { ...prev };
        delete next[filename];
        return next;
      });
      toast({ title: "Failed to save resolution", variant: "destructive" });
    }
  }, [projectId, getHeaders, toast]);

  const handleCompleteMerge = useCallback(async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/git/complete-merge`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Merge failed", description: data.message, variant: "destructive" });
        return;
      }
      toast({ title: "Merge complete", description: "All conflicts resolved and merge commit created" });
      onMergeComplete();
    } catch (err: any) {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  }, [projectId, getHeaders, toast, onMergeComplete]);

  const handleAbortMerge = useCallback(async () => {
    setAborting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/git/abort-merge`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Abort failed", description: data.message, variant: "destructive" });
        return;
      }
      toast({ title: "Merge aborted", description: "Restored to pre-merge state" });
      onAbort();
    } catch (err: any) {
      toast({ title: "Abort failed", description: err.message, variant: "destructive" });
    } finally {
      setAborting(false);
    }
  }, [projectId, getHeaders, toast, onAbort]);

  const selectedConflict = conflicts.find(c => c.filename === selectedFile);
  const isBinaryConflict = selectedConflict?.mergedContent?.startsWith("[Binary file conflict");

  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="merge-conflict-panel">
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
        <div className="flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-[#F5A623]" />
          <span className="text-[12px] font-semibold">Merge Conflict Resolution</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30 font-mono" data-testid="text-merge-progress">
            {resolvedCount}/{totalCount} resolved
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[10px] text-red-400 hover:bg-red-500/10 rounded border border-red-500/30"
            onClick={handleAbortMerge}
            disabled={aborting || completing}
            data-testid="button-abort-merge"
          >
            {aborting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Abort Merge
          </Button>
          <Button
            className="h-7 px-2.5 text-[10px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/90 text-white rounded font-medium"
            onClick={handleCompleteMerge}
            disabled={!allResolved || completing || aborting}
            data-testid="button-complete-merge"
          >
            {completing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
            Complete Merge
          </Button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={onClose}
            data-testid="button-close-merge-panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-[var(--ide-border)] overflow-y-auto shrink-0 bg-[var(--ide-panel)]" data-testid="merge-file-list">
          <div className="px-3 py-2">
            <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Conflicting Files</span>
          </div>
          {conflicts.map((conflict) => {
            const isResolved = resolutions[conflict.filename] !== undefined;
            const isSelected = selectedFile === conflict.filename;
            const isBinary = conflict.mergedContent?.startsWith("[Binary file conflict");
            return (
              <button
                key={conflict.filename}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-[var(--ide-surface)] text-[var(--ide-text)]"
                    : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]"
                }`}
                onClick={() => setSelectedFile(conflict.filename)}
                data-testid={`merge-file-${conflict.filename}`}
              >
                {isResolved ? (
                  <Check className="w-3.5 h-3.5 text-[#0CCE6B] shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F5A623] shrink-0" />
                )}
                <span className="text-[11px] font-mono truncate flex-1">{conflict.filename}</span>
                {isBinary && <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400 shrink-0">BIN</span>}
                <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedConflict ? (
            <>
              <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  <span className="text-[11px] font-mono text-[var(--ide-text)]">{selectedFile}</span>
                  {resolutions[selectedFile] !== undefined && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30">Resolved</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[9px] text-[#0079F2] hover:bg-[#0079F2]/10 rounded border border-[#0079F2]/30"
                    onClick={() => resolveFile(selectedFile, selectedConflict.oursContent)}
                    data-testid={`button-accept-yours-${selectedFile}`}
                  >
                    Accept Yours
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[9px] text-[#F26522] hover:bg-[#F26522]/10 rounded border border-[#F26522]/30"
                    onClick={() => resolveFile(selectedFile, selectedConflict.theirsContent)}
                    data-testid={`button-accept-theirs-${selectedFile}`}
                  >
                    Accept Theirs
                  </Button>
                  {!isBinaryConflict && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] text-[#7C65CB] hover:bg-[#7C65CB]/10 rounded border border-[#7C65CB]/30"
                      onClick={() => {
                        const both = selectedConflict.oursContent + "\n" + selectedConflict.theirsContent;
                        resolveFile(selectedFile, both);
                      }}
                      data-testid={`button-accept-both-${selectedFile}`}
                    >
                      Accept Both
                    </Button>
                  )}
                  {!isBinaryConflict && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-[9px] rounded border ${
                        editMode[selectedFile]
                          ? "text-[#0CCE6B] border-[#0CCE6B]/30 bg-[#0CCE6B]/10"
                          : "text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:bg-[var(--ide-surface)]"
                      }`}
                      onClick={() => {
                        setEditMode(prev => ({ ...prev, [selectedFile]: !prev[selectedFile] }));
                        if (!resolutions[selectedFile]) {
                          resolveFile(selectedFile, selectedConflict.mergedContent);
                        }
                      }}
                      data-testid={`button-manual-edit-${selectedFile}`}
                    >
                      Manual Edit
                    </Button>
                  )}
                </div>
              </div>

              {editMode[selectedFile] ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1.5 bg-[var(--ide-surface)] border-b border-[var(--ide-border)]">
                    <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Merged Result (editable)</span>
                  </div>
                  <textarea
                    className="flex-1 w-full bg-[var(--ide-bg)] text-[var(--ide-text)] font-mono text-[12px] leading-[18px] p-3 resize-none outline-none border-none"
                    value={resolutions[selectedFile] || selectedConflict.mergedContent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResolutions(prev => ({ ...prev, [selectedFile]: val }));
                    }}
                    onBlur={() => {
                      if (resolutions[selectedFile] !== undefined) {
                        resolveFile(selectedFile, resolutions[selectedFile]);
                      }
                    }}
                    spellCheck={false}
                    data-testid={`textarea-manual-edit-${selectedFile}`}
                  />
                </div>
              ) : (
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--ide-border)]">
                    <div className="px-3 py-1.5 bg-[#0079F2]/5 border-b border-[var(--ide-border)] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0079F2]" />
                      <span className="text-[10px] font-semibold text-[#0079F2] uppercase tracking-wider">Yours (Local)</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <pre className="text-[12px] leading-[18px] font-mono p-3 whitespace-pre-wrap break-words text-[var(--ide-text)]" data-testid={`code-yours-${selectedFile}`}>
                        {selectedConflict.oursContent || "(empty)"}
                      </pre>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-8 shrink-0 bg-[var(--ide-panel)]">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-3 py-1.5 bg-[#F26522]/5 border-b border-[var(--ide-border)] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#F26522]" />
                      <span className="text-[10px] font-semibold text-[#F26522] uppercase tracking-wider">Theirs (Remote)</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <pre className="text-[12px] leading-[18px] font-mono p-3 whitespace-pre-wrap break-words text-[var(--ide-text)]" data-testid={`code-theirs-${selectedFile}`}>
                        {selectedConflict.theirsContent || "(empty)"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--ide-text-muted)]">
              <div className="text-center">
                <GitMerge className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-[12px]">Select a file to view conflicts</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-7 border-t border-[var(--ide-border)] bg-[var(--ide-panel)] flex items-center px-3 shrink-0">
        <div className="flex-1 bg-[var(--ide-bg)] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-[#0CCE6B] transition-all duration-300 rounded-full"
            style={{ width: `${totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0}%` }}
            data-testid="merge-progress-bar"
          />
        </div>
        <span className="text-[10px] text-[var(--ide-text-muted)] ml-2 font-mono" data-testid="text-merge-status">
          {allResolved ? "Ready to merge" : `${totalCount - resolvedCount} conflict${totalCount - resolvedCount !== 1 ? "s" : ""} remaining`}
        </span>
      </div>
    </div>
  );
}
