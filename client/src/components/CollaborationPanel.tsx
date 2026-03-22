import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Users, UserPlus, Mail, Shield, Eye, Pencil, Crown, Trash2,
  Copy, CheckCircle, Clock, XCircle, RefreshCw
} from "lucide-react";

interface CollaborationPanelProps {
  projectId: number;
  projectName?: string;
  currentUser?: any;
  currentFile?: string;
  className?: string;
}

type Role = "viewer" | "editor" | "admin";

const roleIcons: Record<Role, typeof Eye> = { viewer: Eye, editor: Pencil, admin: Shield };
const roleLabels: Record<Role, string> = { viewer: "Viewer", editor: "Editor", admin: "Admin" };
const roleColors: Record<Role, string> = {
  viewer: "text-blue-400",
  editor: "text-green-400",
  admin: "text-amber-400",
};

export function CollaborationPanel({ projectId, currentUser, className }: CollaborationPanelProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [copiedLink, setCopiedLink] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: guests = [], isLoading: loadingGuests } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "guests"],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/guests`).then(r => r.json()),
  });

  const { data: collaborators = [], isLoading: loadingCollabs } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "collaborators"],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/collaborators`).then(r => r.json()),
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const csrf = getCsrfToken();
      const res = await apiRequest("POST", `/api/projects/${projectId}/guests`, { email, role }, csrf);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "guests"] });
      setInviteEmail("");
      toast({ title: "Invite sent", description: data.message || `Invited ${inviteEmail}` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (guestId: string) => {
      const csrf = getCsrfToken();
      await apiRequest("DELETE", `/api/projects/${projectId}/guests/${guestId}`, undefined, csrf);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "guests"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "collaborators"] });
      toast({ title: "Removed" });
    },
  });

  const removeCollabMutation = useMutation({
    mutationFn: async (userId: string) => {
      const csrf = getCsrfToken();
      await apiRequest("DELETE", `/api/projects/${projectId}/collaborators/${userId}`, undefined, csrf);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "collaborators"] });
      toast({ title: "Collaborator removed" });
    },
  });

  const handleInvite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    inviteMutation.mutate({ email, role: inviteRole });
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/project/${projectId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const isOwner = currentUser?.id && collaborators.some((c: any) => c.userId === currentUser.id && c.role === "owner");
  const loading = loadingGuests || loadingCollabs;

  const pendingGuests = guests.filter((g: any) => !g.acceptedAt);
  const acceptedGuests = guests.filter((g: any) => g.acceptedAt);

  return (
    <div className={cn("h-full overflow-auto", className)}>
      <div className="p-3 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#7C65CB]" />
          <h2 className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-collaboration-title">Collaboration</h2>
          <span className="ml-auto text-[10px] text-[var(--ide-text-muted)]">{collaborators.length} member{collaborators.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 h-7 text-[11px] bg-[var(--ide-surface)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              data-testid="input-invite-email"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-7 px-2 text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md outline-none"
              data-testid="select-invite-role"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              className="flex-1 h-7 text-[11px] bg-[#7C65CB] hover:bg-[#6B56B8] text-white rounded-md"
              data-testid="button-send-invite"
            >
              <UserPlus className="w-3 h-3 mr-1" />
              {inviteMutation.isPending ? "Sending..." : "Invite"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyInviteLink}
              className="h-7 px-2 text-[11px] border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md"
              data-testid="button-copy-link"
            >
              {copiedLink ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Active Members</h3>
              <div className="space-y-1">
                {collaborators.map((c: any) => {
                  const role = (c.role || "editor") as Role;
                  const RoleIcon = roleIcons[role] || Eye;
                  return (
                    <div key={c.userId || c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--ide-surface)] group" data-testid={`row-collaborator-${c.userId || c.id}`}>
                      <div className="w-6 h-6 rounded-full bg-[#7C65CB]/20 flex items-center justify-center shrink-0">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <span className="text-[9px] font-bold text-[#7C65CB]">
                            {(c.displayName || c.email || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] truncate">{c.displayName || c.email}</p>
                        <div className="flex items-center gap-1">
                          <RoleIcon className={cn("w-2.5 h-2.5", roleColors[role])} />
                          <span className={cn("text-[9px]", roleColors[role])}>{role === "owner" ? "Owner" : roleLabels[role]}</span>
                        </div>
                      </div>
                      {role === "owner" && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                      {isOwner && role !== "owner" && (
                        <button
                          onClick={() => removeCollabMutation.mutate(c.userId)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                          data-testid={`button-remove-collab-${c.userId}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {collaborators.length === 0 && (
                  <p className="text-[10px] text-[var(--ide-text-muted)] py-2 text-center">No collaborators yet</p>
                )}
              </div>
            </div>

            {pendingGuests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Pending Invites</h3>
                <div className="space-y-1">
                  {pendingGuests.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--ide-surface)] group" data-testid={`row-pending-${g.id}`}>
                      <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Clock className="w-3 h-3 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] truncate">{g.email}</p>
                        <span className="text-[9px] text-amber-400">Pending</span>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => removeMutation.mutate(g.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                          data-testid={`button-revoke-${g.id}`}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {acceptedGuests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Accepted Invites</h3>
                <div className="space-y-1">
                  {acceptedGuests.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--ide-surface)] group" data-testid={`row-accepted-${g.id}`}>
                      <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] truncate">{g.email}</p>
                        <span className="text-[9px] text-green-400">{roleLabels[(g.role || "viewer") as Role]}</span>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => removeMutation.mutate(g.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                          data-testid={`button-remove-guest-${g.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
