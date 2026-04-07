// @ts-nocheck
import { useQuery, useMutation } from '@tanstack/react-query';
import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Key, Copy, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  userId: number;
  userEmail?: string;
  scopes?: string[];
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export default function AdminApiKeys() {
  const { toast } = useToast();

  const { data: keys = [], isLoading, refetch } = useQuery<ApiKey[]>({
    queryKey: ['/api/admin/api-keys'],
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/admin/api-keys/${id}/revoke`),
    onSuccess: () => {
      toast({ title: 'API key revoked' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
    },
    onError: () => toast({ title: 'Failed to revoke key', variant: 'destructive' }),
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage developer API keys across all users</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" />All API Keys ({keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : keys.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No API keys found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map(k => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{k.keyPrefix}...</code>
                          <p className="text-xs text-muted-foreground">{k.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{k.userEmail || `User #${k.userId}`}</TableCell>
                      <TableCell>
                        <Badge variant={k.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {k.isActive ? 'Active' : 'Revoked'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.createdAt ? format(new Date(k.createdAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, HH:mm') : 'Never'}
                      </TableCell>
                      <TableCell>
                        {k.isActive && (
                          <Button
                            variant="destructive" size="sm" className="h-7 text-xs"
                            disabled={revokeMutation.isPending}
                            onClick={() => revokeMutation.mutate(k.id)}
                          >Revoke</Button>
                        )}
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
