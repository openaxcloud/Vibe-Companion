import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from './admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';
import { Activity, Search, Loader2, User, FolderOpen, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'user' | 'project' | 'system';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  user: <User className="w-3.5 h-3.5" />,
  project: <FolderOpen className="w-3.5 h-3.5" />,
  system: <Server className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  user: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  project: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  system: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function AdminActivityLogs() {
  const [search, setSearch] = useState('');

  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/admin/activity'],
    refetchInterval: 30000,
  });

  const filtered = activities.filter(a =>
    !search || a.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Recent platform activity — users, projects, system events</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search activity..." className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Activity className="w-3 h-3" />{activities.length} events
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No activity found</div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {filtered.map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${TYPE_COLOR[item.type] || 'bg-muted'}`}>
                        {TYPE_ICON[item.type] || <Activity className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{item.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : 'unknown'}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLOR[item.type] || ''}`}>
                        {item.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
