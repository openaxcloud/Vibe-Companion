import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2, HardDrive, X, Plus, Trash2, Pencil, Upload, Download,
  File as FileIcon, Key, Database, Activity, FolderOpen, ChevronRight,
  Copy, Settings, FolderPlus, Image, Video, FileText, FileCode,
  Archive, ChevronDown, ExternalLink, Link
} from "lucide-react";
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

interface StorageBucket {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

interface StorageObj {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  folderPath: string;
  bucketId: string | null;
  createdAt: string;
}

interface BucketAccessEntry {
  id: string;
  bucketId: string;
  projectId: string;
  grantedAt: string;
}

interface StorageUsage {
  kvCount: number;
  kvSizeBytes: number;
  objectCount: number;
  objectSizeBytes: number;
  totalBytes: number;
  planLimit: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/x-directory") return <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />;
  if (mimeType.startsWith("image/")) return <Image className="w-3.5 h-3.5 text-green-500" />;
  if (mimeType.startsWith("video/")) return <Video className="w-3.5 h-3.5 text-blue-500" />;
  if (mimeType.startsWith("text/") || mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("css") || mimeType.includes("html")) return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.includes("spreadsheet")) return <FileText className="w-3.5 h-3.5 text-red-400" />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("archive") || mimeType.includes("compressed")) return <Archive className="w-3.5 h-3.5 text-purple-400" />;
  return <FileIcon className="w-3.5 h-3.5 text-[#7C65CB]" />;
}

export default function AppStoragePanel({ projectId, onClose }: AppStoragePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"kv" | "objects" | "settings">("kv");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [bucketDropdownOpen, setBucketDropdownOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("");
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [showAddExistingBucket, setShowAddExistingBucket] = useState(false);
  const [existingBucketId, setExistingBucketId] = useState("");
  const [selectedExistingBucketId, setSelectedExistingBucketId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingBucketName, setEditingBucketName] = useState(false);
  const [editBucketNameValue, setEditBucketNameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteBucket, setConfirmDeleteBucket] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);

  const bucketsQuery = useQuery<StorageBucket[]>({
    queryKey: ["/api/projects", projectId, "storage/buckets"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/buckets`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const ownedBucketsQuery = useQuery<StorageBucket[]>({
    queryKey: ["/api/projects", projectId, "storage/buckets/owned"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/buckets/owned`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showAddExistingBucket,
  });

  const activeBucket = bucketsQuery.data?.find(b => b.id === selectedBucketId) || bucketsQuery.data?.[0];
  const activeBucketId = activeBucket?.id;

  const objectsQuery = useQuery<StorageObj[]>({
    queryKey: ["/api/projects", projectId, "storage/buckets", activeBucketId, "objects", currentFolder],
    queryFn: async () => {
      if (!activeBucketId) return [];
      const params = new URLSearchParams();
      params.set("folder_path", currentFolder);
      const res = await fetch(`/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeBucketId,
  });

  const kvQuery = useQuery<KvEntry[]>({
    queryKey: ["/api/projects", projectId, "storage/kv"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/kv`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const usageQuery = useQuery<StorageUsage>({
    queryKey: ["/api/projects", projectId, "storage/usage"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/usage`, { credentials: "include" });
      if (!res.ok) return { kvCount: 0, kvSizeBytes: 0, objectCount: 0, objectSizeBytes: 0, totalBytes: 0, planLimit: 50 * 1024 * 1024 };
      return res.json();
    },
  });

  const bandwidthQuery = useQuery<{ bytesDownloaded: number; downloadCount: number; periodStart: string; periodEnd: string }>({
    queryKey: ["/api/projects", projectId, "storage/bandwidth"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/storage/bandwidth`, { credentials: "include" });
      if (!res.ok) return { bytesDownloaded: 0, downloadCount: 0, periodStart: "", periodEnd: "" };
      return res.json();
    },
  });

  const bucketAccessQuery = useQuery<{ accessList: Array<{ id: string; bucketId: string; projectId: string }> }>({
    queryKey: ["/api/projects", projectId, "storage/buckets", activeBucketId, "details"],
    queryFn: async () => {
      if (!activeBucketId) return { accessList: [] };
      const res = await fetch(`/api/projects/${projectId}/storage/buckets/${activeBucketId}`, { credentials: "include" });
      if (!res.ok) return { accessList: [] };
      return res.json();
    },
    enabled: !!activeBucketId && activeTab === "settings",
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && key[0] === "/api/projects" && key[1] === projectId && typeof key[2] === "string" && key[2].startsWith("storage");
    }});
  };

  const setKvMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/storage/kv`, { key, value });
      return res.json();
    },
    onSuccess: () => { invalidateAll(); setNewKey(""); setNewValue(""); setEditingKey(null); },
    onError: (err: Error) => { toast({ title: "Failed to save", description: err.message, variant: "destructive" }); },
  });

  const deleteKvMutation = useMutation({
    mutationFn: async (key: string) => { await apiRequest("DELETE", `/api/projects/${projectId}/storage/kv/${encodeURIComponent(key)}`); },
    onSuccess: () => invalidateAll(),
  });

  const createBucketMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/storage/buckets`, { name });
      return res.json();
    },
    onSuccess: (bucket: StorageBucket) => {
      invalidateAll();
      setSelectedBucketId(bucket.id);
      setShowCreateBucket(false);
      setNewBucketName("");
      toast({ title: "Bucket created" });
    },
    onError: (err: Error) => { toast({ title: "Failed to create bucket", description: err.message, variant: "destructive" }); },
  });

  const addExistingBucketMutation = useMutation({
    mutationFn: async (bucketId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/storage/buckets/add-existing`, { bucketId });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setShowAddExistingBucket(false);
      setExistingBucketId("");
      toast({ title: "Bucket linked to project" });
    },
    onError: (err: Error) => { toast({ title: "Failed to add bucket", description: err.message, variant: "destructive" }); },
  });

  const deleteBucketMutation = useMutation({
    mutationFn: async (bucketId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/storage/buckets/${bucketId}`);
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedBucketId(null);
      setConfirmDeleteBucket(false);
      setActiveTab("objects");
      toast({ title: "Bucket deleted" });
    },
    onError: (err: Error) => { toast({ title: "Failed to delete bucket", description: err.message, variant: "destructive" }); },
  });

  const renameBucketMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/storage/buckets/${id}`, { name });
      return res.json();
    },
    onSuccess: () => { invalidateAll(); setEditingBucketName(false); toast({ title: "Bucket renamed" }); },
    onError: (err: Error) => { toast({ title: "Failed to rename", description: err.message, variant: "destructive" }); },
  });

  const revokeBucketAccessMutation = useMutation({
    mutationFn: async (bucketId: string) => {
      await apiRequest("POST", `/api/projects/${projectId}/storage/buckets/${bucketId}/revoke`, { projectId });
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedBucketId(null);
      setActiveTab("objects");
      toast({ title: "Bucket removed from project" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/storage/buckets/${activeBucketId}/folders`, { folderPath });
      return res.json();
    },
    onSuccess: () => { invalidateAll(); setShowCreateFolder(false); setNewFolderName(""); },
    onError: (err: Error) => { toast({ title: "Failed to create folder", description: err.message, variant: "destructive" }); },
  });

  const deleteObjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/${id}`);
    },
    onSuccess: () => { invalidateAll(); setConfirmDelete(null); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/storage/buckets/${activeBucketId}/folders/${encodeURIComponent(folderPath)}`);
    },
    onSuccess: () => { invalidateAll(); setConfirmDelete(null); },
  });

  const moveObjectMutation = useMutation({
    mutationFn: async ({ objId, destFolderPath }: { objId: string; destFolderPath: string }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/${objId}/move`, { destFolderPath });
      return res.json();
    },
    onSuccess: () => invalidateAll(),
  });

  const uploadFiles = useCallback(async (files: globalThis.File[], folderPath?: string) => {
    if (!activeBucketId || files.length === 0) return;
    const fp = folderPath ?? currentFolder;
    const names = files.map(f => f.name);
    setUploadProgress(names);
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("folderPath", fp);
    const headers: Record<string, string> = {};
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    try {
      const res = await fetch(`/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/upload`, {
        method: "POST", credentials: "include", headers, body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || err.message || "Upload failed");
      }
      invalidateAll();
      toast({ title: `${files.length} file(s) uploaded` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploadProgress([]);
    }
  }, [activeBucketId, currentFolder, projectId]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) uploadFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) uploadFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0 || !activeBucketId) return;
    const formData = new FormData();
    selected.forEach(f => {
      formData.append("files", f);
      formData.append("relativePaths", (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    });
    const headers: Record<string, string> = {};
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    try {
      const res = await fetch(`/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/upload-folder`, {
        method: "POST", credentials: "include", headers, body: formData,
      });
      if (!res.ok) throw new Error("Folder upload failed");
      invalidateAll();
      toast({ title: "Folder uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const navigateToFolder = (folderPath: string) => {
    setCurrentFolder(folderPath);
  };

  const breadcrumbParts = currentFolder ? currentFolder.split("/") : [];

  const folders = (objectsQuery.data || []).filter(o => o.mimeType === "application/x-directory");
  const filesInFolder = (objectsQuery.data || []).filter(o => o.mimeType !== "application/x-directory");

  const usage = usageQuery.data;
  const planLimitBytes = usage?.planLimit || (50 * 1024 * 1024);
  const planLimitMb = Math.round(planLimitBytes / 1024 / 1024);
  const planName = planLimitMb >= 50000 ? "Team" : planLimitMb >= 5000 ? "Pro" : "Free";

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
            <div className="h-full bg-[#7C65CB] rounded-full transition-all" style={{ width: `${Math.min(100, (usage.totalBytes / planLimitBytes) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-[var(--ide-text-muted)]">{usage.kvCount} keys · {usage.objectCount} files</span>
            <span className="text-[9px] text-[var(--ide-text-muted)]">{planLimitMb} MB limit ({planName})</span>
          </div>

          {bandwidthQuery.data && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Bandwidth
                </span>
                <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-bandwidth-total">{formatBytes(bandwidthQuery.data.bytesDownloaded)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-[var(--ide-text-muted)]">{bandwidthQuery.data.downloadCount} downloads this period</span>
              </div>
            </div>
          )}
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
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors ${activeTab === "settings" ? "text-[var(--ide-text)] border-b-2 border-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("settings")}
          data-testid="tab-settings"
        >
          <Settings className="w-3 h-3" /> Settings
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
          </div>
        )}

        {activeTab === "objects" && (
          <div>
            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <div className="relative">
                <button
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded hover:border-[#7C65CB] text-[var(--ide-text)]"
                  onClick={() => setBucketDropdownOpen(!bucketDropdownOpen)}
                  data-testid="dropdown-bucket-selector"
                >
                  <Database className="w-3 h-3 text-[#7C65CB]" />
                  <span className="flex-1 text-left truncate">{activeBucket?.name || "Select bucket"}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {bucketDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded shadow-lg max-h-40 overflow-y-auto">
                    {bucketsQuery.data?.map(b => (
                      <button
                        key={b.id}
                        className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--ide-bg)] ${b.id === activeBucketId ? "text-[#7C65CB] font-medium" : "text-[var(--ide-text)]"}`}
                        onClick={() => { setSelectedBucketId(b.id); setBucketDropdownOpen(false); setCurrentFolder(""); }}
                        data-testid={`bucket-option-${b.id}`}
                      >{b.name}</button>
                    ))}
                    <button
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[#7C65CB] hover:bg-[var(--ide-bg)] border-t border-[var(--ide-border)] flex items-center gap-1"
                      onClick={() => { setBucketDropdownOpen(false); setShowCreateBucket(true); }}
                      data-testid="button-create-new-bucket"
                    >
                      <Plus className="w-3 h-3" /> Create new bucket
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-bg)] flex items-center gap-1"
                      onClick={() => { setBucketDropdownOpen(false); setShowAddExistingBucket(true); }}
                      data-testid="button-add-existing-bucket"
                    >
                      <Link className="w-3 h-3" /> Add existing bucket
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showCreateBucket && (
              <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    placeholder="Bucket name"
                    className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]"
                    onKeyDown={(e) => { if (e.key === "Enter" && newBucketName.trim()) createBucketMutation.mutate(newBucketName.trim()); }}
                    autoFocus
                    data-testid="input-new-bucket-name"
                  />
                  <Button size="sm" className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white"
                    onClick={() => createBucketMutation.mutate(newBucketName.trim())}
                    disabled={!newBucketName.trim() || createBucketMutation.isPending}
                    data-testid="button-confirm-create-bucket"
                  >{createBucketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowCreateBucket(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {showAddExistingBucket && (
              <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50">
                <p className="text-[10px] text-[var(--ide-text-muted)] mb-1.5">Select a bucket to link to this project:</p>
                {ownedBucketsQuery.isLoading ? (
                  <div className="flex items-center gap-1.5 py-2">
                    <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />
                    <span className="text-[10px] text-[var(--ide-text-muted)]">Loading buckets...</span>
                  </div>
                ) : (ownedBucketsQuery.data?.length ?? 0) === 0 ? (
                  <div className="py-2">
                    <p className="text-[10px] text-[var(--ide-text-muted)]">No other buckets available to link.</p>
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={existingBucketId}
                        onChange={(e) => setExistingBucketId(e.target.value)}
                        placeholder="Or enter Bucket ID manually"
                        className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB] font-mono"
                        onKeyDown={(e) => { if (e.key === "Enter" && existingBucketId.trim()) addExistingBucketMutation.mutate(existingBucketId.trim()); }}
                        data-testid="input-existing-bucket-id"
                      />
                      <Button size="sm" className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white"
                        onClick={() => addExistingBucketMutation.mutate(existingBucketId.trim())}
                        disabled={!existingBucketId.trim() || addExistingBucketMutation.isPending}
                        data-testid="button-confirm-add-existing-bucket"
                      >{addExistingBucketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {ownedBucketsQuery.data!.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px] transition-colors ${selectedExistingBucketId === b.id ? "bg-[#7C65CB]/20 border border-[#7C65CB]" : "hover:bg-[var(--ide-surface)] border border-transparent"}`}
                        onClick={() => setSelectedExistingBucketId(b.id)}
                        data-testid={`bucket-picker-item-${b.id}`}
                      >
                        <Database className="w-3 h-3 text-[#7C65CB]" />
                        <span className="text-[var(--ide-text)] font-medium">{b.name}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)] ml-auto font-mono">{b.id.slice(0, 8)}...</span>
                      </div>
                    ))}
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={existingBucketId}
                        onChange={(e) => { setExistingBucketId(e.target.value); setSelectedExistingBucketId(null); }}
                        placeholder="Or enter Bucket ID manually"
                        className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB] font-mono"
                        onKeyDown={(e) => { if (e.key === "Enter" && existingBucketId.trim()) addExistingBucketMutation.mutate(existingBucketId.trim()); }}
                        data-testid="input-existing-bucket-id"
                      />
                    </div>
                    <div className="flex gap-1.5 mt-1.5 pt-1.5 border-t border-[var(--ide-border)]">
                      <Button size="sm" className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white flex-1"
                        onClick={() => { const id = selectedExistingBucketId || existingBucketId.trim(); if (id) addExistingBucketMutation.mutate(id); }}
                        disabled={(!selectedExistingBucketId && !existingBucketId.trim()) || addExistingBucketMutation.isPending}
                        data-testid="button-confirm-add-existing-bucket"
                      >{addExistingBucketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Link Bucket"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => { setShowAddExistingBucket(false); setSelectedExistingBucketId(null); setExistingBucketId(""); }}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeBucketId && (
              <>
                {(currentFolder || breadcrumbParts.length > 0) && (
                  <div className="px-3 py-1.5 border-b border-[var(--ide-border)] flex items-center gap-1 text-[10px] flex-wrap">
                    <button
                      className="text-[#7C65CB] hover:underline font-medium"
                      onClick={() => setCurrentFolder("")}
                      data-testid="breadcrumb-root"
                    >/</button>
                    {breadcrumbParts.map((part, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                        <button
                          className="text-[#7C65CB] hover:underline"
                          onClick={() => setCurrentFolder(breadcrumbParts.slice(0, i + 1).join("/"))}
                          data-testid={`breadcrumb-${part}`}
                        >{part}</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="px-3 py-1.5 border-b border-[var(--ide-border)] flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => setShowCreateFolder(true)} data-testid="button-create-folder">
                    <FolderPlus className="w-3 h-3 mr-1" /> Folder
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => fileInputRef.current?.click()} data-testid="button-upload-files">
                    <Upload className="w-3 h-3 mr-1" /> Files
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => folderInputRef.current?.click()} data-testid="button-upload-folder">
                    <FolderOpen className="w-3 h-3 mr-1" /> Folder Upload
                  </Button>
                </div>

                {showCreateFolder && (
                  <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newFolderName.trim()) {
                            const fullPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim();
                            createFolderMutation.mutate(fullPath);
                          }
                        }}
                        autoFocus
                        data-testid="input-new-folder-name"
                      />
                      <Button size="sm" className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white"
                        onClick={() => {
                          const fullPath = currentFolder ? `${currentFolder}/${newFolderName.trim()}` : newFolderName.trim();
                          createFolderMutation.mutate(fullPath);
                        }}
                        disabled={!newFolderName.trim()}
                        data-testid="button-confirm-create-folder"
                      >Create</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowCreateFolder(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div
                  className={`mx-3 mt-2 mb-2 border-2 border-dashed rounded-lg p-3 text-center transition-colors ${dragOver ? "border-[#7C65CB] bg-[#7C65CB]/5" : "border-[var(--ide-border)] hover:border-[#7C65CB]/50"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  data-testid="dropzone-upload"
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple data-testid="input-file-upload" />
                  <input type="file" ref={folderInputRef} onChange={handleFolderSelect} className="hidden" {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} data-testid="input-folder-upload" />
                  {uploadProgress.length > 0 ? (
                    <div>
                      <Loader2 className="w-4 h-4 text-[#7C65CB] animate-spin mx-auto mb-1" />
                      <p className="text-[10px] text-[var(--ide-text-muted)]">Uploading {uploadProgress.length} file(s)...</p>
                      {uploadProgress.slice(0, 3).map((name, i) => (
                        <p key={i} className="text-[9px] text-[var(--ide-text-muted)] truncate">{name}</p>
                      ))}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-[var(--ide-text-muted)] mx-auto mb-1" />
                      <p className="text-[10px] text-[var(--ide-text-muted)]">Drop files here or use buttons above</p>
                      <p className="text-[9px] text-[var(--ide-text-muted)] opacity-60 mt-0.5">Max {formatBytes(UPLOAD_LIMITS.objectStorage)} per file</p>
                    </>
                  )}
                </div>

                {objectsQuery.isLoading && (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
                )}

                {folders.map((folder) => {
                  const folderFullPath = currentFolder ? `${currentFolder}/${folder.filename}` : folder.filename;
                  return (
                    <div key={folder.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30 group cursor-pointer"
                      onClick={() => navigateToFolder(folderFullPath)}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-[#7C65CB]/10"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove("bg-[#7C65CB]/10"); }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("bg-[#7C65CB]/10"); const objId = e.dataTransfer.getData("text/plain"); if (objId) moveObjectMutation.mutate({ objId, destFolderPath: folderFullPath }); }}
                      data-testid={`folder-entry-${folder.filename}`}
                    >
                      {getFileIcon(folder.mimeType)}
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[var(--ide-text)] font-mono font-medium">{folder.filename}/</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {confirmDelete === `folder:${folderFullPath}` ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-red-400">Delete all?</span>
                            <Button size="sm" className="h-5 px-1.5 text-[9px] bg-red-500 hover:bg-red-600 text-white rounded"
                              onClick={() => deleteFolderMutation.mutate(folderFullPath)}
                              data-testid={`button-confirm-delete-folder-${folder.filename}`}
                            >Yes</Button>
                            <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]"
                              onClick={() => setConfirmDelete(null)}>No</Button>
                          </div>
                        ) : (
                          <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400"
                            onClick={() => setConfirmDelete(`folder:${folderFullPath}`)}
                            data-testid={`button-delete-folder-${folder.filename}`}
                          ><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filesInFolder.map((obj) => (
                  <div key={obj.id}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30 group"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", obj.id); }}
                    data-testid={`object-entry-${obj.id}`}
                  >
                    {obj.mimeType.startsWith("image/") ? (
                      <img
                        src={`/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/${obj.id}/download`}
                        alt={obj.filename}
                        className="w-8 h-8 rounded object-cover border border-[var(--ide-border)] flex-shrink-0"
                        loading="lazy"
                        data-testid={`thumbnail-${obj.id}`}
                      />
                    ) : getFileIcon(obj.mimeType)}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[var(--ide-text)] font-mono truncate block">{obj.filename}</span>
                      <span className="text-[9px] text-[var(--ide-text-muted)]">{formatBytes(obj.sizeBytes)} · {obj.mimeType}</span>
                      <span className="text-[9px] text-[var(--ide-text-muted)] block">{new Date(obj.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/api/projects/${projectId}/storage/buckets/${activeBucketId}/objects/${obj.id}/download`}
                        className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                        data-testid={`button-download-object-${obj.id}`}
                      ><Download className="w-3 h-3" /></a>
                      {confirmDelete === obj.id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" className="h-5 px-1.5 text-[9px] bg-red-500 hover:bg-red-600 text-white rounded"
                            onClick={() => deleteObjectMutation.mutate(obj.id)}
                            data-testid={`button-confirm-delete-object-${obj.id}`}
                          >Delete</Button>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]"
                            onClick={() => setConfirmDelete(null)}>No</Button>
                        </div>
                      ) : (
                        <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400"
                          onClick={() => setConfirmDelete(obj.id)}
                          data-testid={`button-delete-object-${obj.id}`}
                        ><Trash2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  </div>
                ))}

                {!objectsQuery.isLoading && folders.length === 0 && filesInFolder.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                    <HardDrive className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                    <p className="text-xs text-[var(--ide-text-muted)]">{currentFolder ? "Empty folder" : "No files stored"}</p>
                  </div>
                )}
              </>
            )}

            {!activeBucketId && !bucketsQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Database className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                <p className="text-xs text-[var(--ide-text-muted)]">No buckets yet</p>
                <Button size="sm" className="mt-2 h-7 px-3 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white"
                  onClick={() => setShowCreateBucket(true)} data-testid="button-create-first-bucket">
                  <Plus className="w-3 h-3 mr-1" /> Create Bucket
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && activeBucket && (
          <div className="px-3 py-3 space-y-4">
            <div>
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold block mb-1">Bucket ID</span>
              <div className="flex items-center gap-1.5">
                <code className="text-[10px] text-[var(--ide-text)] font-mono bg-[var(--ide-bg)] rounded px-2 py-1 flex-1 break-all" data-testid="text-bucket-id">{activeBucket.id}</code>
                <button className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  onClick={() => { navigator.clipboard.writeText(activeBucket.id); toast({ title: "Copied" }); }}
                  data-testid="button-copy-bucket-id"
                ><Copy className="w-3 h-3" /></button>
              </div>
            </div>

            <div>
              <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold block mb-1">Bucket Name</span>
              {editingBucketName ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editBucketNameValue}
                    onChange={(e) => setEditBucketNameValue(e.target.value)}
                    className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] outline-none focus:border-[#7C65CB]"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") renameBucketMutation.mutate({ id: activeBucket.id, name: editBucketNameValue }); }}
                    data-testid="input-rename-bucket"
                  />
                  <Button size="sm" className="h-7 px-2 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white"
                    onClick={() => renameBucketMutation.mutate({ id: activeBucket.id, name: editBucketNameValue })}
                    data-testid="button-confirm-rename-bucket"
                  >Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setEditingBucketName(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--ide-text)] flex-1">{activeBucket.name}</span>
                  <button className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => { setEditingBucketName(true); setEditBucketNameValue(activeBucket.name); }}
                    data-testid="button-edit-bucket-name"
                  ><Pencil className="w-3 h-3" /></button>
                </div>
              )}
            </div>

            {bucketAccessQuery.data && (
              <div>
                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold block mb-1">Projects with Access</span>
                {(bucketAccessQuery.data.accessList as any)?.map((access: BucketAccessEntry) => (
                  <div key={access.id} className="flex items-center justify-between py-1 text-[10px]">
                    <span className="text-[var(--ide-text)] font-mono truncate">{access.projectId}</span>
                    {access.projectId !== projectId && (
                      <button className="text-red-400 hover:text-red-300 text-[9px]"
                        onClick={() => {
                          apiRequest("POST", `/api/projects/${projectId}/storage/buckets/${activeBucket.id}/revoke`, { projectId: access.projectId }).then(() => invalidateAll());
                        }}
                      >Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[var(--ide-border)] space-y-2">
              <Button size="sm" variant="outline" className="w-full h-7 text-[10px] text-[var(--ide-text-muted)]"
                onClick={() => revokeBucketAccessMutation.mutate(activeBucket.id)}
                data-testid="button-remove-bucket-from-project"
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Remove Bucket from Project
              </Button>

              {confirmDeleteBucket ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <p className="text-[10px] text-red-400 mb-2">This will permanently delete the bucket and all its files. This cannot be undone.</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-6 px-2 text-[9px] bg-red-500 hover:bg-red-600 text-white flex-1"
                      onClick={() => deleteBucketMutation.mutate(activeBucket.id)}
                      disabled={deleteBucketMutation.isPending}
                      data-testid="button-confirm-delete-bucket"
                    >{deleteBucketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete Forever"}</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px]" onClick={() => setConfirmDeleteBucket(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="destructive" className="w-full h-7 text-[10px]"
                  onClick={() => setConfirmDeleteBucket(true)}
                  data-testid="button-delete-bucket"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete Bucket
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && !activeBucket && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Settings className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">Select a bucket to view settings</p>
          </div>
        )}
      </div>
    </div>
  );
}
