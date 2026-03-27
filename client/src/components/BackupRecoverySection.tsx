import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Shield, Download, Upload, Loader2, Check, AlertTriangle, RefreshCw } from "lucide-react";

interface BackupStatus {
  lastBackupAt: string | null;
  backupCount: number;
  totalSizeBytes: number;
  health: "green" | "yellow" | "red";
}

interface BackupEntry {
  id: string;
  version: number;
  sizeBytes: number;
  trigger: string;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const triggerColors: Record<string, string> = {
  commit: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  deploy: "bg-green-500/15 text-green-400 border-green-500/30",
  agent: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  manual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function BackupRecoverySection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [showBackupList, setShowBackupList] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const statusQuery = useQuery<BackupStatus>({
    queryKey: ["/api/projects", projectId, "git/backup-status"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/backup-status`, { credentials: "include" });
      if (!res.ok) return { lastBackupAt: null, backupCount: 0, totalSizeBytes: 0, health: "red" as const };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const backupsQuery = useQuery<BackupEntry[]>({
    queryKey: ["/api/projects", projectId, "git/backups"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/backups`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showBackupList,
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/backup`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Backup created", description: "Manual backup saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/backup-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/backups"] });
    },
    onError: (err: Error) => {
      toast({ title: "Backup failed", description: err.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (version?: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/backup/restore`, { version });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Restored from backup", description: "Your repository has been restored successfully" });
      setConfirmRestore(false);
      setRestoreVersion(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/backup-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
      setConfirmRestore(false);
    },
  });

  const status = statusQuery.data;
  const healthColor = status?.health === "green" ? "bg-[#0CCE6B]" : status?.health === "yellow" ? "bg-[#F5A623]" : "bg-red-500";
  const healthLabel = status?.health === "green" ? "Healthy" : status?.health === "yellow" ? "Aging" : "No backup";

  return (
    <div className="border-t border-[var(--ide-border)]" data-testid="backup-recovery-section">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Backup & Recovery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${healthColor}`} data-testid="backup-health-indicator" title={healthLabel} />
          <span className="text-[9px] text-[var(--ide-text-muted)]">{healthLabel}</span>
        </div>
      </div>

      <div className="px-3 pb-2 space-y-2">
        {status?.lastBackupAt && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--ide-text-muted)]">Last backup</span>
            <span className="text-[var(--ide-text-secondary)]" data-testid="text-last-backup">{timeAgo(status.lastBackupAt)}</span>
          </div>
        )}
        {status && status.backupCount > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--ide-text-muted)]">Backups</span>
            <span className="text-[var(--ide-text-secondary)]" data-testid="text-backup-count">{status.backupCount} ({formatBytes(status.totalSizeBytes)})</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            className="flex-1 h-7 text-[10px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)] rounded gap-1"
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            data-testid="button-create-backup"
          >
            {createBackupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Create Backup
          </Button>
          <Button
            variant="ghost"
            className="flex-1 h-7 text-[10px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)] rounded gap-1"
            onClick={() => {
              if (!confirmRestore) {
                setConfirmRestore(true);
              } else {
                restoreMutation.mutate(restoreVersion ?? undefined);
              }
            }}
            disabled={restoreMutation.isPending || (status?.backupCount ?? 0) === 0}
            data-testid="button-restore-backup"
          >
            {restoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmRestore ? <AlertTriangle className="w-3 h-3 text-amber-400" /> : <Download className="w-3 h-3" />}
            {confirmRestore ? "Confirm Restore" : "Restore"}
          </Button>
        </div>

        {confirmRestore && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5" data-testid="restore-confirm-panel">
            <p className="text-[10px] text-amber-400">This will replace your current Git state with the backup. This cannot be undone.</p>
            {(backupsQuery.data?.length ?? 0) > 0 && (
              <select
                value={restoreVersion ?? ""}
                onChange={(e) => setRestoreVersion(e.target.value ? Number(e.target.value) : null)}
                className="w-full text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 text-[var(--ide-text)] outline-none"
                data-testid="select-restore-version"
              >
                <option value="">Latest backup</option>
                {backupsQuery.data!.map(b => (
                  <option key={b.version} value={b.version}>v{b.version} - {b.trigger} - {timeAgo(b.createdAt)}</option>
                ))}
              </select>
            )}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                className="flex-1 h-6 text-[9px] text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 rounded"
                onClick={() => restoreMutation.mutate(restoreVersion ?? undefined)}
                disabled={restoreMutation.isPending}
                data-testid="button-confirm-restore"
              >
                {restoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Restore Now
              </Button>
              <Button
                variant="ghost"
                className="h-6 text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded"
                onClick={() => { setConfirmRestore(false); setRestoreVersion(null); }}
                data-testid="button-cancel-restore"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <button
          className="w-full text-left text-[10px] text-[#0079F2] hover:text-[#0079F2]/80 py-0.5"
          onClick={() => { setShowBackupList(!showBackupList); if (!showBackupList) backupsQuery.refetch(); }}
          data-testid="button-toggle-backup-list"
        >
          {showBackupList ? "Hide backup history" : "Show backup history"}
        </button>

        {showBackupList && (
          <div className="space-y-1" data-testid="backup-list">
            {backupsQuery.isLoading ? (
              <div className="flex justify-center py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ide-text-muted)]" /></div>
            ) : (backupsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-[10px] text-[#4A5068] text-center py-2">No backups yet</p>
            ) : (
              backupsQuery.data!.map(backup => (
                <div key={backup.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[var(--ide-surface)]/50" data-testid={`backup-entry-${backup.version}`}>
                  <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono w-6">v{backup.version}</span>
                  <span className={`text-[8px] px-1 py-0.5 rounded-full border ${triggerColors[backup.trigger] || "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>{backup.trigger}</span>
                  <span className="text-[9px] text-[#4A5068] flex-1">{timeAgo(backup.createdAt)}</span>
                  <span className="text-[9px] text-[#4A5068]">{formatBytes(backup.sizeBytes)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
