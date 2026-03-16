import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, HardDrive, X, Plus, Trash2, Pencil, Upload, Download, File as FileIcon, Key, Database } from "lucide-react";
import { UPLOAD_LIMITS } from "@shared/schema";

interface AppStoragePanelProps {
  projectId: string;
  onClose: () => void;
}

interface KvEntry {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

interface StorageObj {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface StorageUsage {
  kvCount: number;
  kvSizeBytes: number;
  objectCount: number;
  objectSizeBytes: number;
  totalBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function AppStoragePanel({ projectId, onClose }: AppStoragePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"kv" | "objects">("kv");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kvQuery = useQuery<KvEntry[]>({
    queryKey: ["/api/projects", projectId, "storage/kv"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/kv`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const objectsQuery = useQuery<StorageObj[]>({
    queryKey: ["/api/projects", projectId, "storage/objects"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/objects`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const usageQuery = useQuery<StorageUsage>({
    queryKey: ["/api/projects", projectId, "storage/usage"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/usage`, { credentials: "include" });
      if (!res.ok) return { kvCount: 0, kvSizeBytes: 0, objectCount: 0, objectSizeBytes: 0, totalBytes: 0 };
      return res.json();
    },
  });

  const setKvMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/storage/kv`, { key, value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/kv"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/usage"] });
      setNewKey("");
      setNewValue("");
      setEditingKey(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const deleteKvMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/storage/kv/${encodeURIComponent(key)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/kv"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/usage"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("file", file);
      const headers: Record<string, string> = {};
      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const res = await fetch(`/api/projects/${projectId}/storage/objects`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/usage"] });
      toast({ title: "File uploaded" });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteObjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/storage/objects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "storage/usage"] });
    },
  });

  const validateAndUpload = (file: globalThis.File) => {
    if (file.size === 0) {
      toast({ title: "Upload failed", description: "Empty file (0 bytes) cannot be uploaded", variant: "destructive" });
      return;
    }
    if (file.size > UPLOAD_LIMITS.objectStorage) {
      toast({ title: "Upload failed", description: `File exceeds ${formatBytes(UPLOAD_LIMITS.objectStorage)} limit`, variant: "destructive" });
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const usage = usageQuery.data;

  return (
    <div className="flex flex-col h-full" data-testid="app-storage-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-[#7C65CB]" /> App Storage
        </span>
        <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-storage">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {usage && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">Storage Usage</span>
            <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-storage-total">{formatBytes(usage.totalBytes)}</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--ide-bg)] rounded-full overflow-hidden">
            <div className="h-full bg-[#7C65CB] rounded-full transition-all" style={{ width: `${Math.min(100, (usage.totalBytes / (50 * 1024 * 1024)) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-[var(--ide-text-muted)]">{usage.kvCount} keys · {usage.objectCount} files</span>
            <span className="text-[9px] text-[var(--ide-text-muted)]">50 MB limit</span>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--ide-border)]">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors ${activeTab === "kv" ? "text-[var(--ide-text)] border-b-2 border-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("kv")}
          data-testid="tab-kv"
        >
          <Key className="w-3 h-3" /> Key-Value
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors ${activeTab === "objects" ? "text-[var(--ide-text)] border-b-2 border-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("objects")}
          data-testid="tab-objects"
        >
          <Database className="w-3 h-3" /> Objects
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "kv" && (
          <div>
            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <div className="flex gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Key"
                  className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB] font-mono"
                  data-testid="input-kv-key"
                />
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB] font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter" && newKey.trim() && newValue.trim()) setKvMutation.mutate({ key: newKey.trim(), value: newValue.trim() }); }}
                  data-testid="input-kv-value"
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded shrink-0"
                  onClick={() => { if (newKey.trim() && newValue.trim()) setKvMutation.mutate({ key: newKey.trim(), value: newValue.trim() }); }}
                  disabled={!newKey.trim() || !newValue.trim() || setKvMutation.isPending}
                  data-testid="button-add-kv"
                >
                  {setKvMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {kvQuery.isLoading && (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
            )}

            {kvQuery.data && kvQuery.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Key className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                <p className="text-xs text-[var(--ide-text-muted)]">No key-value pairs</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">Add a key-value pair above</p>
              </div>
            )}

            {kvQuery.data && kvQuery.data.length > 0 && (
              <div>
                {kvQuery.data.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30 group" data-testid={`kv-entry-${entry.key}`}>
                    <Key className="w-3 h-3 text-[#7C65CB] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[var(--ide-text)] font-mono font-medium">{entry.key}</span>
                      {editingKey === entry.key ? (
                        <div className="flex gap-1 mt-0.5">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-[var(--ide-text)] outline-none focus:border-[#7C65CB] font-mono"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setKvMutation.mutate({ key: entry.key, value: editValue });
                              if (e.key === "Escape") setEditingKey(null);
                            }}
                            data-testid={`input-edit-kv-${entry.key}`}
                          />
                          <Button size="sm" className="h-5 px-1.5 text-[9px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded"
                            onClick={() => setKvMutation.mutate({ key: entry.key, value: editValue })}
                            data-testid={`button-save-kv-${entry.key}`}
                          >Save</Button>
                        </div>
                      ) : (
                        <p className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate">{entry.value}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                        onClick={() => { setEditingKey(entry.key); setEditValue(entry.value); }}
                        data-testid={`button-edit-kv-${entry.key}`}
                      ><Pencil className="w-3 h-3" /></button>
                      <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400"
                        onClick={() => deleteKvMutation.mutate(entry.key)}
                        data-testid={`button-delete-kv-${entry.key}`}
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="px-3 py-2 border-t border-[var(--ide-border)] mt-auto">
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">API Access</span>
              <div className="mt-1 text-[9px] text-[var(--ide-text-muted)] font-mono bg-[var(--ide-bg)] rounded px-2 py-1.5 break-all" data-testid="text-kv-api-info">
                GET /api/projects/{projectId}/storage/kv
              </div>
            </div>
          </div>
        )}

        {activeTab === "objects" && (
          <div>
            <div
              className={`mx-3 mt-2 mb-2 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${dragOver ? "border-[#7C65CB] bg-[#7C65CB]/5" : "border-[var(--ide-border)] hover:border-[#7C65CB]/50"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              data-testid="dropzone-upload"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />
              {uploadMutation.isPending ? (
                <Loader2 className="w-5 h-5 text-[#7C65CB] animate-spin mx-auto" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-[var(--ide-text-muted)] mx-auto mb-1" />
                  <p className="text-[10px] text-[var(--ide-text-muted)]">Drop file here or{" "}
                    <button className="text-[#7C65CB] hover:underline" onClick={() => fileInputRef.current?.click()} data-testid="button-browse-files">browse</button>
                  </p>
                  <p className="text-[9px] text-[var(--ide-text-muted)] opacity-60 mt-0.5">Max {formatBytes(UPLOAD_LIMITS.objectStorage)} per file</p>
                </>
              )}
            </div>

            {objectsQuery.isLoading && (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
            )}

            {objectsQuery.data && objectsQuery.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                <HardDrive className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                <p className="text-xs text-[var(--ide-text-muted)]">No files stored</p>
              </div>
            )}

            {objectsQuery.data && objectsQuery.data.length > 0 && (
              <div>
                {objectsQuery.data.map((obj) => (
                  <div key={obj.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30 group" data-testid={`object-entry-${obj.id}`}>
                    <FileIcon className="w-3 h-3 text-[#7C65CB] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[var(--ide-text)] font-mono truncate block">{obj.filename}</span>
                      <span className="text-[9px] text-[var(--ide-text-muted)]">{formatBytes(obj.sizeBytes)} · {obj.mimeType}</span>
                      <span className="text-[9px] text-[var(--ide-text-muted)] block">{new Date(obj.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/api/projects/${projectId}/storage/objects/${obj.id}/download`}
                        className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                        data-testid={`button-download-object-${obj.id}`}
                      ><Download className="w-3 h-3" /></a>
                      <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400"
                        onClick={() => deleteObjectMutation.mutate(obj.id)}
                        data-testid={`button-delete-object-${obj.id}`}
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="px-3 py-2 border-t border-[var(--ide-border)] mt-auto">
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">API Access</span>
              <div className="mt-1 text-[9px] text-[var(--ide-text-muted)] font-mono bg-[var(--ide-bg)] rounded px-2 py-1.5 break-all" data-testid="text-objects-api-info">
                GET /api/projects/{projectId}/storage/objects
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
