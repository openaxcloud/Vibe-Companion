import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  X, Copy, Check, Globe, Lock, Users, Mail, Trash2,
  Image, Code2, Share2, Calendar, Clock, Pencil, ExternalLink, Upload,
  Eye, GitFork, ChevronDown, UserPlus, Shield, UserCheck, Link2,
} from "lucide-react";
import type { Project, ProjectInvite } from "@shared/schema";

interface SpotlightData {
  project: Project;
  invites: ProjectInvite[];
  owner: { id: string; email: string; displayName: string | null; avatarUrl: string | null } | null;
  currentUserRole: "owner" | "editor" | "viewer" | null;
}

interface SpotlightOverlayProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onProjectUpdated?: (project: Project) => void;
}

export default function SpotlightOverlay({ projectId, open, onClose, onProjectUpdated }: SpotlightOverlayProps) {
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "sharing" | "collaborators">("overview");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<SpotlightData>({
    queryKey: ["/api/projects", projectId, "spotlight"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/spotlight`);
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (data?.project) {
      setNameValue(data.project.name);
      setDescValue(data.project.description || "");
    }
  }, [data?.project]);

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
      setEditingName(false);
      setEditingDesc(false);
      setShowEmbedCode(false);
    }
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<{ name: string; description: string; coverImageUrl: string | null; isPublic: boolean }>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/spotlight`, updates);
      return res.json();
    },
    onSuccess: (updated: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spotlight"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      onProjectUpdated?.(updated);
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const coverUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("cover", file);
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`/api/projects/${projectId}/spotlight/cover`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spotlight"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: "Cover image updated" });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/spotlight/invites`, {
        email: inviteIdentifier,
        role: inviteRole,
      });
      return res.json();
    },
    onSuccess: () => {
      setInviteIdentifier("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spotlight"] });
      toast({ title: "Invite sent successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  const updateInviteMutation = useMutation({
    mutationFn: async ({ inviteId, role }: { inviteId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/spotlight/invites/${inviteId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spotlight"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    },
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/spotlight/invites/${inviteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spotlight"] });
      toast({ title: "Collaborator removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveName = useCallback(() => {
    if (nameValue.trim() && nameValue !== data?.project.name) {
      updateMutation.mutate({ name: nameValue.trim() });
    }
    setEditingName(false);
  }, [nameValue, data?.project.name]);

  const handleSaveDesc = useCallback(() => {
    if (descValue !== (data?.project.description || "")) {
      updateMutation.mutate({ description: descValue });
    }
    setEditingDesc(false);
  }, [descValue, data?.project.description]);

  const isOwner = data?.currentUserRole === "owner";
  const canEdit = data?.currentUserRole === "owner" || data?.currentUserRole === "editor";

  const publicUrl = data?.project && (data.project.isPublished || data.project.isPublic)
    ? `${window.location.origin}/shared/${data.project.id}`
    : null;

  const embedCode = publicUrl
    ? `<iframe src="${publicUrl}" width="100%" height="600" style="border:0;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.15)" allow="clipboard-write"></iframe>`
    : null;

  const copyToClipboard = (text: string, type: "url" | "embed") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
    toast({ title: "Copied to clipboard" });
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateFull = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const getLangConfig = (lang: string) => {
    const configs: Record<string, { color: string; bg: string; border: string; icon: string }> = {
      javascript: { color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/25", icon: "JS" },
      typescript: { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/25", icon: "TS" },
      python: { color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/25", icon: "PY" },
      html: { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/25", icon: "HTML" },
      css: { color: "text-pink-400", bg: "bg-pink-500/15", border: "border-pink-500/25", icon: "CSS" },
      java: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/25", icon: "JAVA" },
      go: { color: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/25", icon: "GO" },
      rust: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25", icon: "RS" },
      cpp: { color: "text-blue-300", bg: "bg-blue-400/15", border: "border-blue-400/25", icon: "C++" },
      c: { color: "text-blue-300", bg: "bg-blue-400/15", border: "border-blue-400/25", icon: "C" },
      ruby: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/25", icon: "RB" },
      php: { color: "text-indigo-400", bg: "bg-indigo-500/15", border: "border-indigo-500/25", icon: "PHP" },
      swift: { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/25", icon: "SW" },
      kotlin: { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/25", icon: "KT" },
    };
    return configs[lang] || { color: "text-gray-400", bg: "bg-gray-500/15", border: "border-gray-500/25", icon: lang.slice(0, 2).toUpperCase() };
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Shield className="w-3 h-3" />;
      case "editor": return <Pencil className="w-3 h-3" />;
      case "viewer": return <Eye className="w-3 h-3" />;
      default: return null;
    }
  };

  const getInitial = (name: string | null | undefined, email: string) => {
    return (name || email || "?").charAt(0).toUpperCase();
  };

  if (!open) return null;

  const langConfig = data?.project ? getLangConfig(data.project.language) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" data-testid="spotlight-overlay">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="relative w-full max-w-[680px] mx-3 sm:mx-4 mt-8 sm:mt-12 mb-8 max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-6rem)] overflow-hidden bg-[#1C1C1C] border border-[#333] rounded-2xl shadow-2xl shadow-black/50 flex flex-col animate-in fade-in slide-in-from-top-4 duration-200"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-all backdrop-blur-sm"
          data-testid="button-close-spotlight"
        >
          <X className="w-4 h-4" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#0079F2] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#888]">Loading project details...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <X className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-sm text-red-400">Failed to load project details</span>
            <Button variant="ghost" size="sm" className="text-xs text-[#888] hover:text-white" onClick={onClose}>Close</Button>
          </div>
        ) : data?.project ? (
          <>
            <input
              type="file"
              ref={coverInputRef}
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Cover image must be under 5MB", variant: "destructive" });
                    return;
                  }
                  coverUploadMutation.mutate(file);
                }
                e.target.value = "";
              }}
              data-testid="input-cover-upload"
            />

            <div
              className={`relative h-36 sm:h-44 overflow-hidden flex items-center justify-center shrink-0 ${canEdit ? "cursor-pointer" : ""} group`}
              style={{
                background: data.project.coverImageUrl
                  ? `url(${data.project.coverImageUrl}?t=${Date.now()}) center/cover no-repeat`
                  : "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
              }}
              onClick={() => canEdit && coverInputRef.current?.click()}
              data-testid="cover-image-area"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-[#1C1C1C]/30 to-transparent" />

              {canEdit && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {coverUploadMutation.isPending ? (
                      <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[11px] text-white font-medium">
                          {data.project.coverImageUrl ? "Change cover" : "Add cover image"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!data.project.coverImageUrl && !canEdit && (
                <div className="relative z-[1] flex flex-col items-center gap-1 text-[#555]">
                  <Image className="w-8 h-8" />
                </div>
              )}

              {data.project.coverImageUrl && canEdit && (
                <button
                  className="absolute top-3 right-14 z-[2] w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500/80 transition-all opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateMutation.mutate({ coverImageUrl: null });
                  }}
                  data-testid="button-remove-cover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="absolute bottom-3 right-4 flex items-center gap-3 z-[2]">
                {(data.project.viewCount > 0 || data.project.forkCount > 0) && (
                  <div className="flex items-center gap-2.5">
                    {data.project.viewCount > 0 && (
                      <div className="flex items-center gap-1 text-white/50 text-[10px]" data-testid="stat-views">
                        <Eye className="w-3 h-3" />
                        <span>{data.project.viewCount.toLocaleString()}</span>
                      </div>
                    )}
                    {data.project.forkCount > 0 && (
                      <div className="flex items-center gap-1 text-white/50 text-[10px]" data-testid="stat-forks">
                        <GitFork className="w-3 h-3" />
                        <span>{data.project.forkCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="px-5 sm:px-6 -mt-8 relative z-[1]">
                <div className="flex items-start gap-3.5 mb-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2] to-[#00C2FF] flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-xl shadow-[#0079F2]/20 ring-2 ring-[#1C1C1C]">
                    {data.project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    {editingName && canEdit ? (
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveName();
                          if (e.key === "Escape") { setEditingName(false); setNameValue(data.project.name); }
                        }}
                        className="h-8 text-lg font-bold bg-[#252525] border-[#444] text-white focus:border-[#0079F2] rounded-lg"
                        maxLength={100}
                        autoFocus
                        data-testid="input-spotlight-name"
                      />
                    ) : (
                      <h2
                        className={`text-lg font-bold text-white flex items-center gap-2 leading-tight ${canEdit ? "cursor-pointer hover:text-[#0079F2] transition-colors group" : ""}`}
                        onClick={() => canEdit && setEditingName(true)}
                        data-testid="text-spotlight-project-name"
                      >
                        <span className="truncate">{data.project.name}</span>
                        {canEdit && <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />}
                      </h2>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {langConfig && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide ${langConfig.bg} ${langConfig.color} ${langConfig.border}`} data-testid="badge-language">
                          {langConfig.icon} {data.project.language}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${
                        data.project.isPublic || data.project.isPublished
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-[#333] text-[#888] border-[#444]"
                      }`} data-testid="badge-visibility">
                        {data.project.isPublic || data.project.isPublished ? (
                          <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> Public</span>
                        ) : (
                          <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Private</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 mb-4 text-[11px] text-[#777]">
                  <div className="flex items-center gap-1.5" title={formatDateFull(data.project.createdAt)} data-testid="date-created">
                    <Calendar className="w-3 h-3" />
                    <span>Created {formatDate(data.project.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title={formatDateFull(data.project.updatedAt)} data-testid="date-updated">
                    <Clock className="w-3 h-3" />
                    <span>Updated {formatDate(data.project.updatedAt)}</span>
                  </div>
                </div>

                <div className="mb-5">
                  {editingDesc && canEdit ? (
                    <div className="space-y-2">
                      <textarea
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        onBlur={handleSaveDesc}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { setEditingDesc(false); setDescValue(data.project.description || ""); }
                        }}
                        className="w-full min-h-[80px] px-3 py-2.5 text-sm bg-[#252525] border border-[#444] rounded-lg text-[#CCC] resize-none focus:outline-none focus:border-[#0079F2] transition-colors placeholder:text-[#555]"
                        placeholder="Tell others what this project is about..."
                        maxLength={2000}
                        autoFocus
                        data-testid="textarea-spotlight-description"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#555]">{descValue.length}/2000</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-[#888] hover:text-white" onClick={() => { setEditingDesc(false); setDescValue(data.project.description || ""); }}>
                            Cancel
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-[#0079F2] hover:bg-[#0068D6] text-white" onClick={handleSaveDesc} data-testid="button-save-description">
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`text-sm leading-relaxed rounded-lg ${canEdit ? "cursor-pointer group" : ""}`}
                      onClick={() => canEdit && setEditingDesc(true)}
                      data-testid="text-spotlight-description"
                    >
                      {data.project.description ? (
                        <p className={`text-[#AAA] ${canEdit ? "group-hover:text-[#CCC] transition-colors" : ""}`}>
                          {data.project.description}
                          {canEdit && <Pencil className="w-3 h-3 inline-block ml-1.5 opacity-0 group-hover:opacity-40 transition-opacity" />}
                        </p>
                      ) : (
                        canEdit ? (
                          <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-[#333] hover:border-[#555] transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-[#555]" />
                            <span className="text-[#555] text-sm">Add a description...</span>
                          </div>
                        ) : (
                          <span className="text-[#555] italic text-sm">No description</span>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center border-b border-[#333] mb-4 -mx-1">
                  {(["overview", "sharing", "collaborators"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`px-3 py-2 text-xs font-medium capitalize transition-colors relative ${
                        activeTab === tab
                          ? "text-white"
                          : "text-[#666] hover:text-[#AAA]"
                      }`}
                      onClick={() => setActiveTab(tab)}
                      data-testid={`tab-${tab}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {tab === "overview" && <Eye className="w-3 h-3" />}
                        {tab === "sharing" && <Share2 className="w-3 h-3" />}
                        {tab === "collaborators" && (
                          <>
                            <Users className="w-3 h-3" />
                            {(data.invites?.length || 0) > 0 && (
                              <span className="text-[9px] px-1 py-0 rounded-full bg-[#0079F2]/20 text-[#0079F2]">
                                {(data.invites?.length || 0) + 1}
                              </span>
                            )}
                          </>
                        )}
                        {tab}
                      </span>
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#0079F2] rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                {activeTab === "overview" && (
                  <div className="space-y-4 pb-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-[#252525] rounded-xl p-3 border border-[#333]">
                        <div className="flex items-center gap-1.5 text-[#666] text-[10px] mb-1">
                          <Eye className="w-3 h-3" /> Views
                        </div>
                        <span className="text-lg font-bold text-white" data-testid="stat-view-count">{(data.project.viewCount || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3 border border-[#333]">
                        <div className="flex items-center gap-1.5 text-[#666] text-[10px] mb-1">
                          <GitFork className="w-3 h-3" /> Forks
                        </div>
                        <span className="text-lg font-bold text-white" data-testid="stat-fork-count">{(data.project.forkCount || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3 border border-[#333]">
                        <div className="flex items-center gap-1.5 text-[#666] text-[10px] mb-1">
                          <Users className="w-3 h-3" /> Team
                        </div>
                        <span className="text-lg font-bold text-white" data-testid="stat-collab-count">{(data.invites?.filter(i => i.status === "accepted").length || 0) + 1}</span>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3 border border-[#333]">
                        <div className="flex items-center gap-1.5 text-[#666] text-[10px] mb-1">
                          {data.project.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />} Status
                        </div>
                        <span className={`text-sm font-semibold ${data.project.isPublic || data.project.isPublished ? "text-green-400" : "text-[#888]"}`}>
                          {data.project.isPublished ? "Published" : data.project.isPublic ? "Public" : "Private"}
                        </span>
                      </div>
                    </div>

                    {publicUrl && (
                      <div className="bg-[#252525] rounded-xl p-4 border border-[#333]">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Link2 className="w-3.5 h-3.5 text-[#0079F2]" />
                          <span className="text-xs font-medium text-white">Quick Share</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 bg-[#1C1C1C] rounded-lg text-xs text-[#888] font-mono truncate border border-[#333]" data-testid="text-quick-share-url">
                            {publicUrl}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[#888] hover:text-white bg-[#1C1C1C] hover:bg-[#333] border border-[#333] rounded-lg"
                            onClick={() => copyToClipboard(publicUrl, "url")}
                            data-testid="button-copy-quick-url"
                          >
                            {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {data.owner && (
                      <div className="bg-[#252525] rounded-xl p-4 border border-[#333]">
                        <div className="flex items-center gap-2 mb-2.5">
                          <UserCheck className="w-3.5 h-3.5 text-[#666]" />
                          <span className="text-xs font-medium text-white">Owner</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {data.owner.avatarUrl ? (
                            <img src={data.owner.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2] to-[#00C2FF] flex items-center justify-center text-white text-xs font-bold">
                              {getInitial(data.owner.displayName, data.owner.email)}
                            </div>
                          )}
                          <div>
                            <span className="text-sm text-white font-medium block">{data.owner.displayName || data.owner.email?.split("@")[0] || "User"}</span>
                            <span className="text-[11px] text-[#666]">{data.owner.email || ""}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "sharing" && (
                  <div className="space-y-4 pb-6">
                    <div className="bg-[#252525] rounded-xl border border-[#333] p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          {data.project.isPublic || data.project.isPublished ? (
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <Globe className="w-4 h-4 text-green-400" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-[#333] flex items-center justify-center">
                              <Lock className="w-4 h-4 text-[#888]" />
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-medium text-white block">
                              {data.project.isPublic || data.project.isPublished ? "Public access" : "Private project"}
                            </span>
                            <span className="text-[11px] text-[#666]">
                              {data.project.isPublic || data.project.isPublished
                                ? "Anyone with the link can view"
                                : "Only you and collaborators can access"}
                            </span>
                          </div>
                        </div>
                        {isOwner && (
                          <Switch
                            checked={data.project.isPublic}
                            onCheckedChange={(checked) => updateMutation.mutate({ isPublic: checked })}
                            data-testid="switch-public-toggle"
                          />
                        )}
                      </div>

                      {publicUrl && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 bg-[#1C1C1C] rounded-lg text-xs text-[#AAA] font-mono truncate border border-[#333]" data-testid="text-public-url">
                              {publicUrl}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-[#888] hover:text-white hover:bg-[#333] rounded-lg shrink-0"
                              onClick={() => copyToClipboard(publicUrl, "url")}
                              data-testid="button-copy-public-url"
                            >
                              {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-[#888] hover:text-white hover:bg-[#333] rounded-lg shrink-0"
                              onClick={() => window.open(publicUrl, "_blank")}
                              data-testid="button-open-public-url"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div>
                            <button
                              className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#AAA] transition-colors"
                              onClick={() => setShowEmbedCode(!showEmbedCode)}
                              data-testid="button-toggle-embed"
                            >
                              <Code2 className="w-3 h-3" />
                              <span>Embed code</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${showEmbedCode ? "rotate-180" : ""}`} />
                            </button>
                            {showEmbedCode && embedCode && (
                              <div className="mt-2 flex items-start gap-2">
                                <div className="flex-1 px-3 py-2 bg-[#1C1C1C] rounded-lg text-[10px] text-[#666] font-mono border border-[#333] break-all leading-relaxed" data-testid="text-embed-code">
                                  {embedCode}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2.5 text-[#888] hover:text-white hover:bg-[#333] rounded-lg shrink-0"
                                  onClick={() => copyToClipboard(embedCode, "embed")}
                                  data-testid="button-copy-embed-code"
                                >
                                  {copiedEmbed ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!publicUrl && (
                        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#1C1C1C] border border-[#333]">
                          <Lock className="w-3.5 h-3.5 text-[#555]" />
                          <span className="text-xs text-[#555]">
                            {isOwner ? "Enable public access to get a shareable link" : "This project is private"}
                          </span>
                        </div>
                      )}
                    </div>

                    {publicUrl && (
                      <div className="bg-[#252525] rounded-xl border border-[#333] p-4">
                        <span className="text-xs font-medium text-white mb-3 block">Share on social</span>
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition-colors text-xs font-medium"
                            onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(`Check out "${data.project.name}" on Vibe Companion!`)}`, "_blank")}
                            data-testid="button-share-twitter"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            Twitter/X
                          </button>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors text-xs font-medium"
                            onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, "_blank")}
                            data-testid="button-share-linkedin"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            LinkedIn
                          </button>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#333] text-[#AAA] hover:bg-[#444] transition-colors text-xs font-medium"
                            onClick={() => window.open(`mailto:?subject=${encodeURIComponent(data.project.name)}&body=${encodeURIComponent(`Check out this project on Vibe Companion: ${publicUrl}`)}`, "_blank")}
                            data-testid="button-share-email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "collaborators" && (
                  <div className="space-y-3 pb-6">
                    {data.owner && (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#252525] border border-[#333]" data-testid="collab-owner-row">
                        {data.owner.avatarUrl ? (
                          <img src={data.owner.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2] to-[#00C2FF] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {getInitial(data.owner.displayName, data.owner.email)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white font-medium truncate block">{data.owner.displayName || data.owner.email?.split("@")[0] || "User"}</span>
                          <span className="text-[11px] text-[#666] truncate block">{data.owner.email || ""}</span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#0079F2]/15 text-[#0079F2] font-semibold">
                          <Shield className="w-3 h-3" /> Owner
                        </span>
                      </div>
                    )}

                    {(data.invites || []).map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#252525] border border-[#333] hover:border-[#444] transition-colors group"
                        data-testid={`invite-row-${invite.id}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center text-[#888] text-xs font-bold shrink-0">
                          {(invite.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-[#CCC] truncate block">{invite.email || "Unknown"}</span>
                          <span className={`text-[10px] ${invite.status === "accepted" ? "text-green-400" : "text-yellow-400"}`}>
                            {invite.status === "accepted" ? "Active" : "Pending"}
                          </span>
                        </div>
                        {isOwner ? (
                          <select
                            value={invite.role}
                            onChange={(e) => updateInviteMutation.mutate({ inviteId: invite.id, role: e.target.value })}
                            className="text-[11px] px-2 py-1 rounded-md bg-[#333] text-[#AAA] border border-[#444] cursor-pointer focus:outline-none focus:border-[#0079F2] transition-colors appearance-none"
                            data-testid={`select-invite-role-${invite.id}`}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#333] text-[#888] capitalize">
                            {getRoleIcon(invite.role)} {invite.role}
                          </span>
                        )}
                        {isOwner && (
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-[#666] hover:text-red-400 transition-all"
                            onClick={() => removeInviteMutation.mutate(invite.id)}
                            data-testid={`button-remove-invite-${invite.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {(data.invites || []).length === 0 && (
                      <div className="text-center py-6 rounded-xl bg-[#252525] border border-[#333]">
                        <Users className="w-6 h-6 text-[#444] mx-auto mb-2" />
                        <p className="text-xs text-[#666]">No collaborators yet</p>
                        {isOwner && <p className="text-[10px] text-[#555] mt-1">Invite team members below</p>}
                      </div>
                    )}

                    {isOwner && (
                      <div className="bg-[#252525] rounded-xl border border-[#333] p-4 mt-2">
                        <div className="flex items-center gap-2 mb-3">
                          <UserPlus className="w-3.5 h-3.5 text-[#0079F2]" />
                          <span className="text-xs font-medium text-white">Invite people</span>
                        </div>
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (inviteIdentifier.trim()) inviteMutation.mutate();
                          }}
                        >
                          <Input
                            value={inviteIdentifier}
                            onChange={(e) => setInviteIdentifier(e.target.value)}
                            placeholder="Email or username"
                            type="text"
                            className="h-9 flex-1 text-xs bg-[#1C1C1C] border-[#444] text-white placeholder:text-[#555] focus:border-[#0079F2] rounded-lg"
                            data-testid="input-invite-identifier"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="h-9 px-2 text-xs bg-[#1C1C1C] border border-[#444] text-[#AAA] rounded-lg cursor-pointer focus:outline-none focus:border-[#0079F2] appearance-none"
                            data-testid="select-invite-role"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                            className="h-9 px-4 text-xs bg-[#0079F2] hover:bg-[#0068D6] text-white rounded-lg font-medium"
                            disabled={!inviteIdentifier.trim() || inviteMutation.isPending}
                            data-testid="button-send-invite"
                          >
                            {inviteMutation.isPending ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "Invite"
                            )}
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
