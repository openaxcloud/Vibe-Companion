import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Loader2, Plus, X, RotateCcw, RotateCw, Eye, Trash2,
  ChevronDown, ChevronRight, FileCode2, FilePlus, FileMinus, FileEdit,
  Rocket, Sparkles, AlertTriangle, User, Check, GitBranch,
} from "lucide-react";

interface CheckpointData {
  id: string;
  projectId: string;
  userId: string;
  description: string;
  type: string;
  trigger: string;
  fileCount: number;
  packageCount?: number;
  createdAt: string;
}

interface DiffData {
  added: string[];
  removed: string[];
  modified: { filename: string; current: string; checkpoint: string }[];
}

interface CheckpointsResponse {
  checkpoints: CheckpointData[];
  currentCheckpointId: string | null;
  divergedFromId: string | null;
}

function computeLineDiff(current: string, checkpoint: string): { type: "same" | "added" | "removed"; line: string }[] {
  const currentLines = current.split("\n");
  const checkpointLines = checkpoint.split("\n");
  const result: { type: "same" | "added" | "removed"; line: string }[] = [];

  let ci = 0;
  let cpi = 0;
  while (ci < currentLines.length || cpi < checkpointLines.length) {
    if (ci < currentLines.length && cpi < checkpointLines.length) {
      if (currentLines[ci] === checkpointLines[cpi]) {
        result.push({ type: "same", line: currentLines[ci] });
        ci++;
        cpi++;
      } else {
        result.push({ type: "removed", line: currentLines[ci] });
        result.push({ type: "added", line: checkpointLines[cpi] });
        ci++;
        cpi++;
      }
    } else if (ci < currentLines.length) {
      result.push({ type: "removed", line: currentLines[ci] });
      ci++;
    } else {
      result.push({ type: "added", line: checkpointLines[cpi] });
      cpi++;
    }
  }
  return result;
}

export default function CheckpointsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createMode, setCreateMode] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedDiffFile, setExpandedDiffFile] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [includeDatabase, setIncludeDatabase] = useState(false);

  const checkpointsQuery = useQuery<CheckpointsResponse>({
    queryKey: ["/api/projects", projectId, "checkpoints"],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/checkpoints`).then(r => r.json()),
  });

  const diffQuery = useQuery<DiffData>({
    queryKey: ["/api/projects", projectId, "checkpoints", previewId, "diff"],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/checkpoints/${previewId}/diff`).then(r => r.json()),
    enabled: !!previewId,
  });

  const createMutation = useMutation({
    mutationFn: (description: string) =>
      apiRequest("POST", `/api/projects/${projectId}/checkpoints`, { description: description || undefined, trigger: "manual" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
      setCreateMode(false);
      setNewDescription("");
      toast({ title: "Checkpoint created" });
    },
    onError: () => toast({ title: "Failed to create checkpoint", variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ cpId, includeDb }: { cpId: string; includeDb: boolean }) =>
      apiRequest("POST", `/api/projects/${projectId}/checkpoints/${cpId}/restore`, { includeDatabase: includeDb }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setConfirmRestoreId(null);
      toast({ title: "Restored to checkpoint" });
    },
    onError: () => toast({ title: "Failed to restore checkpoint", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (cpId: string) =>
      apiRequest("DELETE", `/api/projects/${projectId}/checkpoints/${cpId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
      toast({ title: "Checkpoint deleted" });
    },
    onError: () => toast({ title: "Failed to delete checkpoint", variant: "destructive" }),
  });

  const triggerIcon = (trigger: string) => {
    switch (trigger) {
      case "deployment": return <Rocket className="w-3 h-3" />;
      case "feature_complete": return <Sparkles className="w-3 h-3" />;
      case "pre_risky_op": return <AlertTriangle className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  const triggerColor = (trigger: string) => {
    switch (trigger) {
      case "deployment": return "#0079F2";
      case "feature_complete": return "#F5A623";
      case "pre_risky_op": return "#E54D4D";
      default: return "#0CCE6B";
    }
  };

  const triggerLabel = (trigger: string) => {
    switch (trigger) {
      case "deployment": return "Deploy";
      case "feature_complete": return "AI";
      case "pre_risky_op": return "Safety";
      default: return "Manual";
    }
  };

  const checkpoints = checkpointsQuery.data?.checkpoints || [];
  const currentPositionId = checkpointsQuery.data?.currentCheckpointId || null;
  const divergedFromId = checkpointsQuery.data?.divergedFromId || null;
  const currentIndex = currentPositionId ? checkpoints.findIndex(c => c.id === currentPositionId) : -1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="checkpoints-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Checkpoints</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => checkpointsQuery.refetch()} data-testid="button-refresh-checkpoints">
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={onClose} data-testid="button-close-checkpoints">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {divergedFromId && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[#7C65CB]/5" data-testid="divergence-banner">
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3 h-3 text-[#7C65CB]" />
            <span className="text-[10px] text-[#7C65CB] font-medium">
              Timeline diverged — new changes were made after rolling back
            </span>
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-[var(--ide-border)]">
        {!createMode ? (
          <Button
            size="sm"
            className="w-full h-8 text-[11px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white"
            onClick={() => setCreateMode(true)}
            data-testid="button-create-checkpoint"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Checkpoint
          </Button>
        ) : (
          <div className="space-y-2">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-xs text-[var(--ide-text)]"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") createMutation.mutate(newDescription); if (e.key === "Escape") setCreateMode(false); }}
              data-testid="input-checkpoint-description"
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white" onClick={() => createMutation.mutate(newDescription)} disabled={createMutation.isPending} data-testid="button-save-checkpoint">
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-[var(--ide-text-muted)]" onClick={() => { setCreateMode(false); setNewDescription(""); }} data-testid="button-cancel-checkpoint">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {checkpointsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-2">
              <Clock className="w-5 h-5 text-[var(--ide-text-muted)]" />
            </div>
            <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium" data-testid="text-no-checkpoints">No checkpoints yet</p>
            <p className="text-[10px] text-[#4A5068] mt-1">Create a checkpoint to save your project state</p>
          </div>
        ) : (
          <div className="pb-2">
            {checkpoints.map((cp, i) => {
              const isCurrentPosition = cp.id === currentPositionId;
              const isFuture = currentIndex >= 0 && i < currentIndex;
              const isDivergePoint = cp.id === divergedFromId;
              const color = triggerColor(cp.trigger);

              return (
                <div key={cp.id} data-testid={`checkpoint-${cp.id}`}>
                  <div className={`px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group ${isFuture ? "opacity-50" : ""}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 border-2"
                          style={{
                            borderColor: isCurrentPosition ? "#0CCE6B" : isDivergePoint ? "#7C65CB" : i === 0 && !currentPositionId ? "#0079F2" : color,
                            background: isCurrentPosition ? "#0CCE6B" : isDivergePoint ? "#7C65CB" : i === 0 && !currentPositionId ? "#0079F2" : "transparent",
                          }}
                        />
                        {i < checkpoints.length - 1 && (
                          <div className={`w-px flex-1 min-h-[28px] ${isFuture ? "bg-[var(--ide-surface)] border-l border-dashed border-[var(--ide-text-muted)]/30" : "bg-[var(--ide-surface)]"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
                          >
                            {triggerIcon(cp.trigger)}
                            {triggerLabel(cp.trigger)}
                          </span>
                          {isCurrentPosition && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/30">
                              Current
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-[#7C65CB]/10 text-[#7C65CB] border border-[#7C65CB]/30">
                              Future
                            </span>
                          )}
                          {isDivergePoint && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-[#7C65CB]/10 text-[#7C65CB] border border-[#7C65CB]/30">
                              Diverged
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--ide-text)] leading-snug line-clamp-2" data-testid={`text-checkpoint-desc-${cp.id}`}>
                          {cp.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{cp.id.slice(0, 7)}</span>
                          <span className="text-[9px] text-[#4A5068]">&middot;</span>
                          <span className="text-[9px] text-[#4A5068]">
                            {new Date(cp.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-[9px] text-[#4A5068]">
                            {new Date(cp.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {cp.fileCount > 0 && (
                            <>
                              <span className="text-[9px] text-[#4A5068]">&middot;</span>
                              <span className="text-[9px] text-[#4A5068]">{cp.fileCount} files</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isFuture ? (
                            <button
                              className="text-[9px] text-[#7C65CB] hover:text-[#7C65CB]/80 flex items-center gap-1 font-medium"
                              onClick={() => setConfirmRestoreId(cp.id)}
                              data-testid={`button-rollforward-${cp.id}`}
                            >
                              <RotateCw className="w-3 h-3" />
                              Roll forward
                            </button>
                          ) : (
                            <button
                              className="text-[9px] text-[#0079F2] hover:text-[#0079F2]/80 flex items-center gap-1 font-medium"
                              onClick={() => setConfirmRestoreId(cp.id)}
                              data-testid={`button-rollback-${cp.id}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </button>
                          )}
                          <span className="text-[9px] text-[#4A5068]">&middot;</span>
                          <button
                            className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] flex items-center gap-1"
                            onClick={() => { setPreviewId(previewId === cp.id ? null : cp.id); setExpandedDiffFile(null); }}
                            data-testid={`button-preview-${cp.id}`}
                          >
                            <Eye className="w-3 h-3" />
                            Diff
                          </button>
                          <span className="text-[9px] text-[#4A5068]">&middot;</span>
                          <button
                            className="text-[9px] text-[var(--ide-text-muted)] hover:text-[#E54D4D] flex items-center gap-1"
                            onClick={() => deleteMutation.mutate(cp.id)}
                            data-testid={`button-delete-checkpoint-${cp.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {confirmRestoreId === cp.id && (
                    <div className="mx-3 mb-2 p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`restore-confirm-${cp.id}`}>
                      <p className="text-[10px] text-[var(--ide-text-secondary)] mb-2 font-medium">
                        {isFuture ? "Roll forward" : "Rollback"} to this checkpoint?
                      </p>
                      <p className="text-[10px] text-[#4A5068] mb-2">
                        This will restore all files and project config to this checkpoint's state.
                      </p>
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeDatabase}
                          onChange={(e) => setIncludeDatabase(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[var(--ide-border)] accent-[#0079F2]"
                          data-testid={`checkbox-include-db-${cp.id}`}
                        />
                        <span className="text-[10px] text-[var(--ide-text-secondary)]">Include database (KV store, secrets, storage objects, AI conversations)</span>
                      </label>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1 h-6 text-[10px] bg-[#F5A623] hover:bg-[#F5A623]/90 text-white"
                          onClick={() => restoreMutation.mutate({ cpId: cp.id, includeDb: includeDatabase })}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-confirm-restore-${cp.id}`}
                        >
                          {restoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Restore"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-[var(--ide-text-muted)]"
                          onClick={() => { setConfirmRestoreId(null); setIncludeDatabase(false); }}
                          data-testid={`button-cancel-restore-${cp.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {previewId === cp.id && (
                    <div className="mx-3 mb-2 p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`diff-preview-${cp.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Changes since checkpoint</span>
                        <button className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setPreviewId(null)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {diffQuery.isLoading ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />
                        </div>
                      ) : diffQuery.data ? (
                        <div className="space-y-1">
                          {diffQuery.data.added.length === 0 && diffQuery.data.removed.length === 0 && diffQuery.data.modified.length === 0 && (
                            <p className="text-[10px] text-[#4A5068] py-1">No changes since this checkpoint</p>
                          )}
                          {diffQuery.data.added.map(f => (
                            <div key={f} className="flex items-center gap-1.5 text-[10px]" data-testid={`diff-added-${f}`}>
                              <FilePlus className="w-3 h-3 text-[#0CCE6B]" />
                              <span className="text-[#0CCE6B] font-mono truncate">{f}</span>
                              <span className="text-[#4A5068] ml-auto shrink-0">added</span>
                            </div>
                          ))}
                          {diffQuery.data.removed.map(f => (
                            <div key={f} className="flex items-center gap-1.5 text-[10px]" data-testid={`diff-removed-${f}`}>
                              <FileMinus className="w-3 h-3 text-[#E54D4D]" />
                              <span className="text-[#E54D4D] font-mono truncate">{f}</span>
                              <span className="text-[#4A5068] ml-auto shrink-0">removed</span>
                            </div>
                          ))}
                          {diffQuery.data.modified.map(f => (
                            <div key={f.filename} data-testid={`diff-modified-${f.filename}`}>
                              <button
                                className="flex items-center gap-1.5 text-[10px] w-full hover:bg-[var(--ide-surface)]/50 rounded px-1 py-0.5"
                                onClick={() => setExpandedDiffFile(expandedDiffFile === f.filename ? null : f.filename)}
                              >
                                {expandedDiffFile === f.filename ? <ChevronDown className="w-3 h-3 text-[#F5A623]" /> : <ChevronRight className="w-3 h-3 text-[#F5A623]" />}
                                <FileEdit className="w-3 h-3 text-[#F5A623]" />
                                <span className="text-[#F5A623] font-mono truncate">{f.filename}</span>
                                <span className="text-[#4A5068] ml-auto shrink-0">modified</span>
                              </button>
                              {expandedDiffFile === f.filename && (
                                <div className="mt-1 rounded border border-[var(--ide-border)] overflow-hidden max-h-[200px] overflow-y-auto" data-testid={`diff-content-${f.filename}`}>
                                  <div className="text-[9px] font-mono leading-relaxed">
                                    {computeLineDiff(f.current, f.checkpoint).slice(0, 100).map((line, idx) => (
                                      <div
                                        key={idx}
                                        className={`px-2 py-px whitespace-pre-wrap break-all ${
                                          line.type === "added"
                                            ? "bg-[#0CCE6B]/10 text-[#0CCE6B]"
                                            : line.type === "removed"
                                            ? "bg-[#E54D4D]/10 text-[#E54D4D]"
                                            : "text-[var(--ide-text-muted)]"
                                        }`}
                                      >
                                        <span className="select-none mr-2 text-[var(--ide-text-muted)]/50">
                                          {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                        </span>
                                        {line.line || " "}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#E54D4D]">Failed to load diff</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--ide-border)] shrink-0">
        <p className="text-[9px] text-[#4A5068]">
          {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""} &middot;
          Auto-created on deploy &amp; AI actions
        </p>
      </div>
    </div>
  );
}
