import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, RefreshCw, Loader2, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface SupportTicket {
  id: number;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-muted text-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function AdminSupport() {
  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ['/api/admin/support/tickets'],
  });

  const open = tickets.filter(t => t.status === 'open').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage user support requests</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-red-500" />
            <div><p className="text-xs text-muted-foreground">Open</p><p className="text-xl font-bold">{open}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-500" />
            <div><p className="text-xs text-muted-foreground">In Progress</p><p className="text-xl font-bold">{inProgress}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div><p className="text-xs text-muted-foreground">Resolved</p><p className="text-xl font-bold">{resolved}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4" />All Tickets ({tickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No support tickets found
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <div key={t.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.userEmail} · {format(new Date(t.createdAt), 'MMM d, HH:mm')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge className={`text-[10px] ${PRIORITY_COLORS[t.priority] || ''}`}>{t.priority}</Badge>
                      <Badge className={`text-[10px] ${STATUS_COLORS[t.status] || ''}`}>{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
