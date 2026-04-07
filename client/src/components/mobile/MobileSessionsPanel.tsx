import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Tablet,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { SiApple, SiAndroid } from 'react-icons/si';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface MobileSession {
  id: number;
  deviceId: string;
  deviceName: string | null;
  platform: 'ios' | 'android';
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface MobileSessionsResponse {
  sessions: MobileSession[];
  total: number;
}

interface MobileSessionsPanelProps {
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-muted rounded-lg animate-pulse", className)} />
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function PlatformIcon({ platform }: { platform: 'ios' | 'android' }) {
  if (platform === 'ios') {
    return <SiApple className="h-4 w-4" data-testid="icon-platform-ios" />;
  }
  return <SiAndroid className="h-4 w-4 text-green-500" data-testid="icon-platform-android" />;
}

export function MobileSessionsPanel({ className }: MobileSessionsPanelProps) {
  const { toast } = useToast();
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MobileSession | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<MobileSessionsResponse>({
    queryKey: ['/api/mobile/sessions'],
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest('DELETE', `/api/mobile/sessions/${encodeURIComponent(deviceId)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/sessions'] });
      toast({ title: 'Session revoked', description: 'The device has been logged out.' });
      setRevokeDialogOpen(false);
      setSelectedSession(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revoke session',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleRevokeClick = (session: MobileSession) => {
    setSelectedSession(session);
    setRevokeDialogOpen(true);
  };

  const confirmRevoke = () => {
    if (selectedSession) {
      revokeMutation.mutate(selectedSession.deviceId);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4", className)} data-testid="panel-mobile-sessions-loading">
        <div className="flex items-center justify-between">
          <ShimmerSkeleton className="h-6 w-32" />
          <ShimmerSkeleton className="h-8 w-8 rounded-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <ShimmerSkeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4", className)} data-testid="panel-mobile-sessions-error">
        <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h3 className="font-semibold text-[15px]">Failed to load sessions</h3>
            <p className="text-muted-foreground text-[13px]">Please try again later</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-sessions">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions || [];

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="panel-mobile-sessions">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          <h2 className="font-semibold" data-testid="text-sessions-title">Mobile Sessions</h2>
          <Badge variant="secondary" data-testid="badge-sessions-count">
            {sessions.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-sessions"
        >
          <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="empty-state-sessions">
          <Tablet className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-[15px] mb-1">No active sessions</h3>
          <p className="text-muted-foreground text-[13px] max-w-xs">
            Your mobile app sessions will appear here when you log in from a mobile device.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {sessions.map((session) => (
              <div
                key={session.deviceId}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                data-testid={`session-card-${session.deviceId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                    <PlatformIcon platform={session.platform} />
                  </div>
                  <div>
                    <p className="font-medium" data-testid={`text-device-name-${session.deviceId}`}>
                      {session.deviceName || `${session.platform === 'ios' ? 'iPhone' : 'Android'} Device`}
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Badge variant="outline" className="text-[11px] capitalize" data-testid={`badge-platform-${session.deviceId}`}>
                        {session.platform}
                      </Badge>
                      <span className="flex items-center gap-1" data-testid={`text-last-active-${session.deviceId}`}>
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(session.lastActiveAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRevokeClick(session)}
                  disabled={revokeMutation.isPending}
                  data-testid={`button-revoke-${session.deviceId}`}
                >
                  {revokeMutation.isPending && selectedSession?.deviceId === session.deviceId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent data-testid="dialog-revoke-session">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out{' '}
              <strong>{selectedSession?.deviceName || 'this device'}</strong>?
              This will immediately end the session on that device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Session'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MobileSessionsPanel;
