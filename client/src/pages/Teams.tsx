import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Users, Crown, Shield, User, Mail, Loader2, Trash2, Settings, Copy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Teams() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");

  const teamsQuery = useQuery({ queryKey: ["/api/teams"], queryFn: async () => { const r = await apiRequest("GET", "/api/teams"); return r.json(); } });
  const teamDetailQuery = useQuery({
    queryKey: ["/api/teams", selectedTeam],
    queryFn: async () => { if (!selectedTeam) return null; const r = await apiRequest("GET", `/api/teams/${selectedTeam}`); return r.json(); },
    enabled: !!selectedTeam,
  });

  const createTeam = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/teams", { name, slug }); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setShowCreate(false); setName(""); setSlug(""); toast({ title: "Team created" }); },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const invite = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", `/api/teams/${selectedTeam}/invite`, { email: inviteEmail, role: inviteRole }); return r.json(); },
    onSuccess: () => { setInviteEmail(""); toast({ title: "Invite sent" }); },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => { await apiRequest("DELETE", `/api/teams/${selectedTeam}/members/${userId}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeam] }); toast({ title: "Member removed" }); },
  });

  const deleteTeam = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/teams/${selectedTeam}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setSelectedTeam(null); toast({ title: "Team deleted" }); },
  });

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />;
    if (role === "admin") return <Shield className="w-3.5 h-3.5 text-[#0079F2]" />;
    return <User className="w-3.5 h-3.5 text-[#676D7E]" />;
  };

  return (
    <div className="min-h-screen bg-[#0E1525] text-[#F5F9FC]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg hover:bg-[#1C2333] transition-colors" data-testid="link-back-dashboard">
            <ArrowLeft className="w-5 h-5 text-[#9DA2B0]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Teams</h1>
            <p className="text-sm text-[#9DA2B0]">Collaborate on projects with your team</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="ml-auto bg-[#0079F2] hover:bg-[#0066CC] rounded-xl gap-2" data-testid="button-create-team">
            <Plus className="w-4 h-4" /> New Team
          </Button>
        </div>

        {showCreate && (
          <div className="bg-[#1C2333] border border-[#2B3245] rounded-xl p-6 mb-6" data-testid="form-create-team">
            <h3 className="text-lg font-semibold mb-4">Create a team</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-xs text-[#9DA2B0]">Team name</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }}
                  className="bg-[#0E1525] border-[#2B3245] text-[#F5F9FC]" placeholder="Acme Inc" data-testid="input-team-name" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#9DA2B0]">Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)}
                  className="bg-[#0E1525] border-[#2B3245] text-[#F5F9FC]" placeholder="acme-inc" data-testid="input-team-slug" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createTeam.mutate()} disabled={createTeam.isPending || !name || !slug}
                className="bg-[#0CCE6B] hover:bg-[#0CCE6B]/90 text-[#0E1525] rounded-xl" data-testid="button-submit-team">
                {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
              <Button onClick={() => setShowCreate(false)} variant="outline" className="bg-transparent border-[#2B3245] text-[#9DA2B0] rounded-xl" data-testid="button-cancel-create">Cancel</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-[#676D7E] uppercase tracking-wider mb-3">Your Teams</h3>
            {teamsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#676D7E]" /></div>
            ) : (teamsQuery.data || []).length === 0 ? (
              <div className="text-center py-8 text-[#676D7E] text-sm" data-testid="text-no-teams">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No teams yet
              </div>
            ) : (teamsQuery.data || []).map((team: any) => (
              <button key={team.id} onClick={() => setSelectedTeam(team.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedTeam === team.id ? 'bg-[#0079F2]/10 border-[#0079F2]/40' : 'bg-[#1C2333] border-[#2B3245] hover:border-[#2B3245]/80'}`}
                data-testid={`team-card-${team.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center text-sm font-bold text-white">
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#F5F9FC]">{team.name}</p>
                    <p className="text-xs text-[#676D7E]">{team.role}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-2">
            {selectedTeam && teamDetailQuery.data ? (
              <div className="bg-[#1C2333] border border-[#2B3245] rounded-xl p-6" data-testid="team-detail">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">{teamDetailQuery.data.name}</h3>
                    <p className="text-xs text-[#676D7E]">/{teamDetailQuery.data.slug}</p>
                  </div>
                  {teamDetailQuery.data.ownerId === user?.id && (
                    <Button onClick={() => { if (confirm("Delete this team?")) deleteTeam.mutate(); }}
                      variant="outline" className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl gap-2" data-testid="button-delete-team">
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-[#9DA2B0] mb-3">Members ({teamDetailQuery.data.members?.length || 0})</h4>
                  <div className="space-y-2">
                    {(teamDetailQuery.data.members || []).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0E1525]/50" data-testid={`member-${m.userId}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center text-xs font-bold text-white">
                          {(m.user?.displayName || m.user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F5F9FC] truncate">{m.user?.displayName || m.user?.email}</p>
                          <p className="text-xs text-[#676D7E] truncate">{m.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#9DA2B0]">
                          {roleIcon(m.role)} {m.role}
                        </div>
                        {m.role !== "owner" && teamDetailQuery.data.ownerId === user?.id && (
                          <button onClick={() => removeMember.mutate(m.userId)}
                            className="p-1 rounded hover:bg-red-500/10 text-[#676D7E] hover:text-red-400 transition-colors" data-testid={`remove-member-${m.userId}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#2B3245] pt-4">
                  <h4 className="text-sm font-medium text-[#9DA2B0] mb-3">Invite member</h4>
                  <div className="flex gap-2">
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-[#0E1525] border-[#2B3245] text-[#F5F9FC] flex-1" placeholder="email@example.com" data-testid="input-invite-email" />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}
                      className="bg-[#0E1525] border border-[#2B3245] rounded-lg px-3 text-sm text-[#F5F9FC]" data-testid="select-invite-role">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button onClick={() => invite.mutate()} disabled={invite.isPending || !inviteEmail}
                      className="bg-[#0079F2] hover:bg-[#0066CC] rounded-xl gap-2" data-testid="button-send-invite">
                      {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Invite</>}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-[#676D7E]" data-testid="text-select-team">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Select a team to see details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
