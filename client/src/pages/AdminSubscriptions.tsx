import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { CreditCard, Users, DollarSign, TrendingUp, Search, Loader2 } from 'lucide-react';

interface UserSub {
  id: number;
  username: string;
  email: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  createdAt: string;
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  core: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  teams: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-orange-100 text-orange-700',
};

const TIER_PRICES: Record<string, number> = {
  free: 0, core: 9.99, pro: 9.99, teams: 29.99, enterprise: 99.99,
};

export default function AdminSubscriptions() {
  const [search, setSearch] = useState('');

  const { data: usersData, isLoading } = useQuery<{ users: UserSub[]; total: number } | UserSub[]>({
    queryKey: ['/api/admin/users'],
  });
  const users: UserSub[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users ?? [];

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.subscriptionTier?.toLowerCase().includes(search.toLowerCase())
  );

  const paid = users.filter(u => u.subscriptionTier && u.subscriptionTier !== 'free');
  const totalRevenue = paid.reduce((s, u) => s + (TIER_PRICES[u.subscriptionTier] || 0), 0);
  const tierCounts = users.reduce((acc: Record<string, number>, u) => {
    const t = u.subscriptionTier || 'free';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage user subscription plans and billing</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Paid Users</p>
                  <p className="text-xl font-bold">{paid.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Est. MRR</p>
                  <p className="text-xl font-bold">${totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Free Users</p>
                  <p className="text-xl font-bold">{tierCounts['free'] || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <Badge key={tier} variant="outline" className={`${TIER_COLORS[tier] || ''} gap-1`}>
              {tier}: {count}
            </Badge>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">All Subscribers</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{u.username || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${TIER_COLORS[u.subscriptionTier] || 'bg-muted text-muted-foreground'}`}>
                          {u.subscriptionTier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">${(TIER_PRICES[u.subscriptionTier] || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
