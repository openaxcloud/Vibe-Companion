import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Code, Cpu, Zap, BarChart3, Shield, Trash2, ChevronDown, Loader2, Search, Ban, ShieldOff, Activity, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--ide-text)]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

interface LoginHistoryEntry {
  id: string;
  userId: string;
  timestamp: string;
  ip: string | null;
  provider: string;
  userAgent: string | null;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [banUserId, setBanUserId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [activityUserId, setActivityUserId] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/stats"); return r.json(); },
  });

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users", page],
    queryFn: async () => { const r = await apiRequest("GET", `/api/admin/users?limit=20&offset=${page * 20}`); return r.json(); },
  });

  const activityQuery = useQuery<LoginHistoryEntry[]>({
    queryKey: ["/api/admin/users", activityUserId, "activity"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/admin/users/${activityUserId}/activity?limit=20`);
      return r.json();
    },
    enabled: !!activityUserId,
  });

  const changePlan = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      await apiRequest("PUT", `/api/admin/users/${userId}/plan`, { plan });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Plan updated" }); },
    onError: (err: any) => { toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const deleteUserMut = useMutation({
    mutationFn: async (userId: string) => { await apiRequest("DELETE", `/api/admin/users/${userId}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "User deleted" }); },
  });

  const banUserMut = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/ban`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setBanUserId(null);
      setBanReason("");
      toast({ title: "User banned" });
    },
    onError: (err: any) => { toast({ title: "Failed to ban user", description: err.message, variant: "destructive" }); },
  });

  const unbanUserMut = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/users/${userId}/unban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User unbanned" });
    },
    onError: (err: any) => { toast({ title: "Failed to unban user", description: err.message, variant: "destructive" }); },
  });

  if (!(user as any)?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ide-bg)] text-[var(--ide-text)]">
        <div className="text-center" data-testid="text-admin-denied">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-4">You don't have permission to access this page.</p>
          <Button onClick={() => setLocation("/dashboard")} className="bg-[#0079F2] rounded-xl">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data || {};
  const filteredUsers = (usersQuery.data?.users || []).filter((u: any) =>
    !search || (u.email || "").includes(search) || (u.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg hover:bg-[var(--ide-panel)]" data-testid="link-back-dashboard">
            <ArrowLeft className="w-5 h-5 text-[var(--ide-text-secondary)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-[var(--ide-text-secondary)]">Platform management and analytics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.totalUsers || 0} icon={Users} color="#0079F2" />
          <StatCard label="Total Projects" value={stats.totalProjects || 0} icon={Code} color="#0CCE6B" />
          <StatCard label="Executions" value={stats.totalExecutions || 0} icon={Cpu} color="#F59E0B" />
          <StatCard label="AI Calls" value={stats.totalAiCalls || 0} icon={Zap} color="#7C65CB" />
          <StatCard label="Active Today" value={stats.activeToday || 0} icon={BarChart3} color="#06B6D4" />
        </div>

        <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl">
          <div className="p-4 border-b border-[var(--ide-border)] flex items-center gap-4">
            <h3 className="text-sm font-semibold flex-1">Users ({usersQuery.data?.total || 0})</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                className="pl-9 bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] w-64 h-9 text-sm" data-testid="input-search-users" />
            </div>
          </div>
          <div className="divide-y divide-[var(--ide-border)]">
            <div className="grid grid-cols-[1fr_1fr_100px_80px_120px] gap-4 px-4 py-2 text-xs font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">
              <span>User</span><span>Email</span><span>Plan</span><span>Status</span><span></span>
            </div>
            {usersQuery.isLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--ide-text-muted)]" /></div>
            ) : filteredUsers.map((u: any) => (
              <div key={u.id} data-testid={`user-row-${u.id}`}>
                <div className="grid grid-cols-[1fr_1fr_100px_80px_120px] gap-4 px-4 py-3 items-center hover:bg-[var(--ide-bg)]/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-[var(--ide-text)] truncate">{u.displayName || "—"}</span>
                    {u.isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] font-medium shrink-0">Admin</span>}
                  </div>
                  <span className="text-sm text-[var(--ide-text-secondary)] truncate">{u.email}</span>
                  <select value="free" onChange={(e) => changePlan.mutate({ userId: u.id, plan: e.target.value })}
                    className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)]" data-testid={`select-plan-${u.id}`}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="team">Team</option>
                  </select>
                  <div>
                    {u.isBanned ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium" data-testid={`status-banned-${u.id}`}>Banned</span>
                    ) : u.emailVerified ? (
                      <span className="text-xs text-[#0CCE6B]">Verified</span>
                    ) : (
                      <span className="text-xs text-[var(--ide-text-muted)]">Unverified</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActivityUserId(activityUserId === u.id ? null : u.id)}
                      className="p-1.5 rounded hover:bg-[#0079F2]/10 text-[var(--ide-text-muted)] hover:text-[#0079F2] transition-colors"
                      title="View login activity"
                      data-testid={`activity-user-${u.id}`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                    {u.isBanned ? (
                      <button
                        onClick={() => unbanUserMut.mutate(u.id)}
                        className="p-1.5 rounded hover:bg-[#0CCE6B]/10 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] transition-colors"
                        title="Unban user"
                        data-testid={`unban-user-${u.id}`}
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanUserId(banUserId === u.id ? null : u.id)}
                        className="p-1.5 rounded hover:bg-[#F59E0B]/10 text-[var(--ide-text-muted)] hover:text-[#F59E0B] transition-colors"
                        title="Ban user"
                        data-testid={`ban-user-${u.id}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Delete user ${u.email}?`)) deleteUserMut.mutate(u.id); }}
                      className="p-1.5 rounded hover:bg-red-500/10 text-[var(--ide-text-muted)] hover:text-red-400 transition-colors" data-testid={`delete-user-${u.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {banUserId === u.id && (
                  <div className="px-4 pb-3 flex items-center gap-2" data-testid={`ban-form-${u.id}`}>
                    <Input
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Reason for ban..."
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 text-sm text-[var(--ide-text)] flex-1"
                      data-testid={`input-ban-reason-${u.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-red-500 hover:bg-red-600 text-white text-xs"
                      disabled={!banReason.trim() || banUserMut.isPending}
                      onClick={() => banUserMut.mutate({ userId: u.id, reason: banReason })}
                      data-testid={`button-confirm-ban-${u.id}`}
                    >
                      {banUserMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ban"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-[var(--ide-text-muted)]"
                      onClick={() => { setBanUserId(null); setBanReason(""); }}
                      data-testid={`button-cancel-ban-${u.id}`}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {u.isBanned && u.banReason && (
                  <div className="px-4 pb-2">
                    <span className="text-[10px] text-red-400">Ban reason: {u.banReason}</span>
                  </div>
                )}

                {activityUserId === u.id && (
                  <div className="px-4 pb-3 bg-[var(--ide-bg)]/30" data-testid={`activity-panel-${u.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider">Login Activity</span>
                      <button onClick={() => setActivityUserId(null)} className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {activityQuery.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
                    ) : (activityQuery.data || []).length === 0 ? (
                      <p className="text-[11px] text-[var(--ide-text-muted)]">No login activity recorded</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(activityQuery.data || []).map((entry) => (
                          <div key={entry.id} className="flex items-center gap-3 text-[11px] py-1 border-b border-[var(--ide-border)]/50 last:border-0">
                            <span className="text-[var(--ide-text-secondary)] w-32 shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#0079F2]/10 text-[#0079F2] text-[9px] font-medium">{entry.provider}</span>
                            <span className="text-[var(--ide-text-muted)] truncate flex-1">{entry.ip || "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {(usersQuery.data?.total || 0) > 20 && (
            <div className="p-4 border-t border-[var(--ide-border)] flex items-center justify-center gap-2">
              <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="outline"
                className="bg-transparent border-[var(--ide-border)] text-[var(--ide-text-secondary)] text-xs h-8 rounded-lg" data-testid="button-prev-page">Previous</Button>
              <span className="text-xs text-[var(--ide-text-muted)]">Page {page + 1}</span>
              <Button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 20 >= (usersQuery.data?.total || 0)} variant="outline"
                className="bg-transparent border-[var(--ide-border)] text-[var(--ide-text-secondary)] text-xs h-8 rounded-lg" data-testid="button-next-page">Next</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
