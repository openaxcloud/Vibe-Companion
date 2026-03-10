import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Code, Cpu, Zap, BarChart3, Shield, Trash2, ChevronDown, Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-[#1C2333] border border-[#2B3245] rounded-xl p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-[#676D7E] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#F5F9FC]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const statsQuery = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/stats"); return r.json(); },
  });

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users", page],
    queryFn: async () => { const r = await apiRequest("GET", `/api/admin/users?limit=20&offset=${page * 20}`); return r.json(); },
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

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1525] text-[#F5F9FC]">
        <div className="text-center" data-testid="text-admin-denied">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
          <p className="text-sm text-[#9DA2B0] mb-4">You don't have permission to access this page.</p>
          <Button onClick={() => setLocation("/dashboard")} className="bg-[#0079F2] rounded-xl">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data || {};
  const filteredUsers = (usersQuery.data?.users || []).filter((u: any) =>
    !search || u.email.includes(search) || (u.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0E1525] text-[#F5F9FC]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg hover:bg-[#1C2333]" data-testid="link-back-dashboard">
            <ArrowLeft className="w-5 h-5 text-[#9DA2B0]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-[#9DA2B0]">Platform management and analytics</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.totalUsers || 0} icon={Users} color="#0079F2" />
          <StatCard label="Total Projects" value={stats.totalProjects || 0} icon={Code} color="#0CCE6B" />
          <StatCard label="Executions" value={stats.totalExecutions || 0} icon={Cpu} color="#F59E0B" />
          <StatCard label="AI Calls" value={stats.totalAiCalls || 0} icon={Zap} color="#7C65CB" />
          <StatCard label="Active Today" value={stats.activeToday || 0} icon={BarChart3} color="#06B6D4" />
        </div>

        <div className="bg-[#1C2333] border border-[#2B3245] rounded-xl">
          <div className="p-4 border-b border-[#2B3245] flex items-center gap-4">
            <h3 className="text-sm font-semibold flex-1">Users ({usersQuery.data?.total || 0})</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#676D7E]" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                className="pl-9 bg-[#0E1525] border-[#2B3245] text-[#F5F9FC] w-64 h-9 text-sm" data-testid="input-search-users" />
            </div>
          </div>
          <div className="divide-y divide-[#2B3245]">
            <div className="grid grid-cols-[1fr_1fr_100px_80px_60px] gap-4 px-4 py-2 text-xs font-medium text-[#676D7E] uppercase tracking-wider">
              <span>User</span><span>Email</span><span>Plan</span><span>Verified</span><span></span>
            </div>
            {usersQuery.isLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#676D7E]" /></div>
            ) : filteredUsers.map((u: any) => (
              <div key={u.id} className="grid grid-cols-[1fr_1fr_100px_80px_60px] gap-4 px-4 py-3 items-center hover:bg-[#0E1525]/30" data-testid={`user-row-${u.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {(u.displayName || u.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-[#F5F9FC] truncate">{u.displayName || "—"}</span>
                  {u.isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] font-medium shrink-0">Admin</span>}
                </div>
                <span className="text-sm text-[#9DA2B0] truncate">{u.email}</span>
                <select value="free" onChange={(e) => changePlan.mutate({ userId: u.id, plan: e.target.value })}
                  className="bg-[#0E1525] border border-[#2B3245] rounded px-2 py-1 text-xs text-[#F5F9FC]" data-testid={`select-plan-${u.id}`}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                </select>
                <span className={`text-xs ${u.emailVerified ? 'text-[#0CCE6B]' : 'text-[#676D7E]'}`}>{u.emailVerified ? "Yes" : "No"}</span>
                <button onClick={() => { if (confirm(`Delete user ${u.email}?`)) deleteUserMut.mutate(u.id); }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-[#676D7E] hover:text-red-400 transition-colors" data-testid={`delete-user-${u.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {(usersQuery.data?.total || 0) > 20 && (
            <div className="p-4 border-t border-[#2B3245] flex items-center justify-center gap-2">
              <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="outline"
                className="bg-transparent border-[#2B3245] text-[#9DA2B0] text-xs h-8 rounded-lg" data-testid="button-prev-page">Previous</Button>
              <span className="text-xs text-[#676D7E]">Page {page + 1}</span>
              <Button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 20 >= (usersQuery.data?.total || 0)} variant="outline"
                className="bg-transparent border-[#2B3245] text-[#9DA2B0] text-xs h-8 rounded-lg" data-testid="button-next-page">Next</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
