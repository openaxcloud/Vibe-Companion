import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Copy,
  Check,
  MoreVertical,
  Loader2,
  Trash2,
  Shield,
  Eye,
  Edit3,
  Users,
  Activity,
  Clock,
  Send,
  Wifi,
  WifiOff,
  FileCode,
  UserPlus,
  UserMinus,
  MousePointer2,
  Circle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Collaborator {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'away';
  role: 'owner' | 'editor' | 'viewer';
  currentFile?: string;
  cursor?: { line: number; col: number; color?: string };
  lastSeen?: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'expired';
  invitedAt: string;
  inviteLink?: string;
}

interface ActivityEvent {
  id: string;
  type: 'join' | 'leave' | 'edit' | 'cursor' | 'file_open' | 'invite_sent';
  userId: string;
  username: string;
  color?: string;
  message: string;
  timestamp: Date;
  details?: {
    fileName?: string;
    line?: number;
    col?: number;
  };
}

interface CollaboratorsResponse {
  collaborators: Collaborator[];
  pendingInvites?: PendingInvite[];
}

interface InviteResponse {
  success: boolean;
  message: string;
  inviteLink?: string;
}

interface ReplitMultiplayersProps {
  projectId?: string;
  fileId?: number;
  collaborators?: Collaborator[];
  onInvite?: (email: string) => void;
  onCursorFollow?: (userId: string) => void;
  className?: string;
}

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export function ReplitMultiplayers({ 
  projectId, 
  fileId,
  collaborators: propCollaborators = [], 
  onInvite,
  onCursorFollow,
  className 
}: ReplitMultiplayersProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('collaborators');
  const [isConnected, setIsConnected] = useState(false);
  const [liveCollaborators, setLiveCollaborators] = useState<Collaborator[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const { data, isLoading, isError, refetch } = useQuery<CollaboratorsResponse>({
    queryKey: ['/api/collaboration', projectId, 'users'],
    queryFn: async () => {
      if (!projectId) return { collaborators: [], pendingInvites: [] };
      const response = await fetch(`/api/collaboration/${projectId}/users`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collaborators');
      }
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: isConnected ? false : 30000,
  });

  const connectWebSocket = useCallback(() => {
    if (!projectId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        ws.send(JSON.stringify({
          type: 'auth',
          projectId: parseInt(projectId, 10),
          fileId,
          userId: user?.id,
          username: user?.username,
          timestamp: Date.now()
        }));

        ws.send(JSON.stringify({
          type: 'join_project',
          projectId: parseInt(projectId, 10),
          timestamp: Date.now()
        }));

        addActivityEvent({
          type: 'join',
          userId: user?.id?.toString() || 'current-user',
          username: user?.username || 'You',
          message: 'You joined the session'
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse collaboration message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to collaboration server:', error);
    }
  }, [projectId, fileId, user]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'active_users':
      case 'collaborators_update':
        setLiveCollaborators(message.data.map((c: any) => ({
          id: c.userId?.toString() || c.id,
          username: c.username,
          displayName: c.displayName || c.username,
          avatarUrl: c.avatarUrl,
          status: c.isOnline ? 'online' : 'offline',
          role: c.role || 'editor',
          currentFile: c.currentFile,
          cursor: c.cursor ? {
            line: c.cursor.position?.line || c.cursor.line || 0,
            col: c.cursor.position?.column || c.cursor.col || 0,
            color: c.color || CURSOR_COLORS[parseInt(c.userId || '0', 10) % CURSOR_COLORS.length]
          } : undefined,
          lastSeen: c.lastSeen
        })));
        break;

      case 'collaborator_joined':
      case 'participant_joined':
        const joinedUser: Collaborator = {
          id: message.data.userId?.toString() || message.data.id,
          username: message.data.username,
          displayName: message.data.displayName || message.data.username,
          avatarUrl: message.data.avatarUrl,
          status: 'online',
          role: message.data.role || 'editor',
          cursor: { line: 0, col: 0, color: message.data.color || CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)] }
        };
        
        setLiveCollaborators(prev => {
          if (prev.find(c => c.id === joinedUser.id)) return prev;
          return [...prev, joinedUser];
        });

        addActivityEvent({
          type: 'join',
          userId: joinedUser.id,
          username: joinedUser.username,
          color: joinedUser.cursor?.color,
          message: `${joinedUser.username} joined the session`
        });

        toast({
          title: 'User joined',
          description: `${joinedUser.username} joined the session`,
        });
        break;

      case 'collaborator_left':
      case 'participant_leave':
        const leftUserId = message.data?.userId?.toString() || message.userId?.toString();
        const leftUser = liveCollaborators.find(c => c.id === leftUserId);
        
        setLiveCollaborators(prev => prev.filter(c => c.id !== leftUserId));

        if (leftUser) {
          addActivityEvent({
            type: 'leave',
            userId: leftUserId,
            username: leftUser.username,
            color: leftUser.cursor?.color,
            message: `${leftUser.username} left the session`
          });
        }

        if (followingUserId === leftUserId) {
          setFollowingUserId(null);
        }
        break;

      case 'cursor_update':
        setLiveCollaborators(prev => prev.map(c => 
          c.id === message.data.userId?.toString()
            ? { 
                ...c, 
                cursor: { 
                  line: message.data.position?.line || 0, 
                  col: message.data.position?.column || 0,
                  color: c.cursor?.color || CURSOR_COLORS[parseInt(message.data.userId || '0', 10) % CURSOR_COLORS.length]
                } 
              }
            : c
        ));
        break;

      case 'file_open':
        setLiveCollaborators(prev => prev.map(c => 
          c.id === message.data.userId?.toString()
            ? { ...c, currentFile: message.data.fileName }
            : c
        ));

        addActivityEvent({
          type: 'file_open',
          userId: message.data.userId?.toString(),
          username: message.data.username || 'Someone',
          message: `Opened ${message.data.fileName}`,
          details: { fileName: message.data.fileName }
        });
        break;

      case 'edit':
      case 'document_edit':
        addActivityEvent({
          type: 'edit',
          userId: message.data.userId?.toString(),
          username: message.data.username || 'Someone',
          message: `Edited ${message.data.fileName || 'a file'}`,
          details: { 
            fileName: message.data.fileName,
            line: message.data.line
          }
        });
        break;

      case 'status_change':
        setLiveCollaborators(prev => prev.map(c => 
          c.id === message.data.userId?.toString()
            ? { ...c, status: message.data.status }
            : c
        ));
        break;
    }
  }, [liveCollaborators, followingUserId, toast]);

  const addActivityEvent = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const newEvent: ActivityEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    setActivityFeed(prev => [newEvent, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (projectId) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId, connectWebSocket]);

  useEffect(() => {
    if (data?.pendingInvites) {
      setPendingInvites(data.pendingInvites);
    }
  }, [data]);

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!projectId) throw new Error('Project ID is required');
      return apiRequest<InviteResponse>('POST', `/api/collaboration/${projectId}/invite`, { 
        email, 
        role
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Invitation sent',
        description: data.message || 'User has been invited to collaborate',
      });
      
      const newInvite: PendingInvite = {
        id: `${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        inviteLink: data.inviteLink
      };
      setPendingInvites(prev => [newInvite, ...prev]);

      addActivityEvent({
        type: 'invite_sent',
        userId: user?.id?.toString() || 'current-user',
        username: user?.username || 'You',
        message: `Invited ${inviteEmail} as ${inviteRole}`
      });

      queryClient.invalidateQueries({ queryKey: ['/api/collaboration', projectId, 'users'] });
      setInviteEmail('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ collaboratorId, role }: { collaboratorId: string; role: string }) => {
      if (!projectId) throw new Error('Project ID is required');
      return apiRequest<{ success: boolean; message: string }>('PATCH', `/api/collaboration/${projectId}/users/${collaboratorId}`, { role });
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Role updated',
        description: data.message || 'Collaborator role has been updated',
      });
      
      setLiveCollaborators(prev => prev.map(c => 
        c.id === variables.collaboratorId 
          ? { ...c, role: variables.role as 'owner' | 'editor' | 'viewer' } 
          : c
      ));
      
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration', projectId, 'users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      if (!projectId) throw new Error('Project ID is required');
      return apiRequest<{ success: boolean; message: string }>('DELETE', `/api/collaboration/${projectId}/users/${collaboratorId}`);
    },
    onSuccess: (data, collaboratorId) => {
      toast({
        title: 'Collaborator removed',
        description: data.message || 'Collaborator has been removed from the project',
      });
      
      setLiveCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration', projectId, 'users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove collaborator',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInvite = () => {
    if (inviteEmail.trim()) {
      if (onInvite) {
        onInvite(inviteEmail.trim());
      }
      inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
    }
  };

  const handleCopyLink = async () => {
    const inviteLink = `${window.location.origin}/join/${projectId}`;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    toast({ title: 'Link copied', description: 'Invite link copied to clipboard' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFollowUser = (collaboratorId: string) => {
    if (followingUserId === collaboratorId) {
      setFollowingUserId(null);
      toast({ title: 'Stopped following', description: 'No longer following this user' });
    } else {
      setFollowingUserId(collaboratorId);
      onCursorFollow?.(collaboratorId);
      const collaborator = displayCollaborators.find(c => c.id === collaboratorId);
      toast({ 
        title: 'Following user', 
        description: `Now following ${collaborator?.username || 'user'}` 
      });
    }
  };

  const handleUpdateRole = (collaboratorId: string, role: string) => {
    updateRoleMutation.mutate({ collaboratorId, role });
  };

  const handleRemoveCollaborator = (collaboratorId: string) => {
    removeCollaboratorMutation.mutate(collaboratorId);
  };

  // Build current user as fallback collaborator
  const currentUserCollaborator: Collaborator | null = user ? {
    id: user.id?.toString() || 'current-user',
    username: user.username || 'You',
    displayName: user.displayName || user.username || 'You',
    email: user.email || undefined,
    avatarUrl: user.avatarUrl || undefined,
    status: 'online',
    role: 'owner',
    cursor: { line: 0, col: 0, color: CURSOR_COLORS[0] }
  } : null;

  const apiCollaborators = data?.collaborators || [];
  const displayCollaborators: Collaborator[] = 
    liveCollaborators.length > 0 
      ? liveCollaborators 
      : propCollaborators.length > 0 
        ? propCollaborators 
        : apiCollaborators.length > 0
          ? apiCollaborators
          : currentUserCollaborator
            ? [currentUserCollaborator]
            : [];

  const onlineCount = displayCollaborators.filter(c => c.status === 'online').length;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-3 w-3" />;
      case 'editor':
        return <Edit3 className="h-3 w-3" />;
      case 'viewer':
        return <Eye className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/20 text-amber-600';
      case 'editor':
        return 'bg-blue-500/20 text-blue-600';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-600';
      default:
        return 'bg-gray-500/20 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const isCurrentUser = (collaborator: Collaborator) => {
    return collaborator.id === 'current-user' || collaborator.email === user?.email || collaborator.username === user?.username;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'join':
        return <UserPlus className="h-3 w-3 text-green-500" />;
      case 'leave':
        return <UserMinus className="h-3 w-3 text-red-500" />;
      case 'edit':
        return <Edit3 className="h-3 w-3 text-blue-500" />;
      case 'cursor':
        return <MousePointer2 className="h-3 w-3 text-purple-500" />;
      case 'file_open':
        return <FileCode className="h-3 w-3 text-orange-500" />;
      case 'invite_sent':
        return <Send className="h-3 w-3 text-cyan-500" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)} data-testid="multiplayers-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Multiplayers</span>
        </div>
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Badge className="h-4 px-1 text-[9px] gap-0.5 bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)] rounded">
              <Wifi className="w-2.5 h-2.5" />
              Live
            </Badge>
          ) : (
            <Badge className="h-4 px-1 text-[9px] gap-0.5 bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] rounded">
              <WifiOff className="w-2.5 h-2.5" />
              Off
            </Badge>
          )}
          <Badge className="h-4 px-1 text-[9px] bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] rounded">
            {onlineCount}
          </Badge>
        </div>
      </div>
      
      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <p className="text-[10px] text-[var(--ecode-text-muted)] mb-1.5">
          Add by username or email
        </p>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Username or email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="flex-1 text-[13px] h-8 border-border"
              disabled={inviteMutation.isPending}
              data-testid="input-invite-email"
            />
            <Select value={inviteRole} onValueChange={(v: 'editor' | 'viewer') => setInviteRole(v)}>
              <SelectTrigger className="w-24 h-8 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px]"
              data-testid="button-invite"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid grid-cols-3">
          <TabsTrigger value="collaborators" className="text-[11px] gap-1">
            <Users className="h-3 w-3" />
            People
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-[11px] gap-1">
            <Activity className="h-3 w-3" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="invites" className="text-[11px] gap-1">
            <Clock className="h-3 w-3" />
            Pending
            {pendingInvites.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {pendingInvites.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="flex-1 m-0 mt-2">
          {isLoading && projectId && (
            <div className="flex items-center justify-center py-8" data-testid="loading-collaborators">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-[13px] text-muted-foreground">Loading collaborators...</span>
            </div>
          )}

          {!isLoading && !projectId && displayCollaborators.length <= 1 && (
            <div className="px-4 py-3 bg-muted border-b border-border">
              <p className="text-[13px] font-medium text-foreground" data-testid="text-no-collaborators">
                No one else is here
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Invite teammates to collaborate in real-time
              </p>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-2">
              {displayCollaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded hover:bg-muted group transition-colors",
                    followingUserId === collaborator.id && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                  data-testid={`collaborator-item-${collaborator.id}`}
                >
                  <div className="relative">
                    <Avatar 
                      className="h-8 w-8 ring-2 transition-all"
                      style={{ borderColor: collaborator.cursor?.color || 'transparent' }}
                    >
                      <AvatarImage src={collaborator.avatarUrl} />
                      <AvatarFallback 
                        className="text-[11px] font-medium"
                        style={{ backgroundColor: collaborator.cursor?.color ? `${collaborator.cursor.color}20` : undefined }}
                      >
                        {(collaborator.displayName || collaborator.username)?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                        getStatusColor(collaborator.status)
                      )}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate" data-testid={`text-username-${collaborator.id}`}>
                        {collaborator.displayName || collaborator.username}
                        {isCurrentUser(collaborator) && ' (You)'}
                      </span>
                      <Badge variant="secondary" className={cn("text-[10px] h-4 px-1", getRoleBadgeColor(collaborator.role))}>
                        {getRoleIcon(collaborator.role)}
                        <span className="ml-1">{collaborator.role}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {collaborator.currentFile && (
                        <span className="flex items-center gap-1 truncate">
                          <FileCode className="h-3 w-3" />
                          {collaborator.currentFile}
                        </span>
                      )}
                      {collaborator.cursor && collaborator.status === 'online' && (
                        <span 
                          className="flex items-center gap-1"
                          style={{ color: collaborator.cursor.color }}
                        >
                          <MousePointer2 className="h-3 w-3" />
                          L{collaborator.cursor.line}:{collaborator.cursor.col}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!isCurrentUser(collaborator) && collaborator.status === 'online' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                          followingUserId === collaborator.id && "opacity-100 bg-primary/20"
                        )}
                        onClick={() => handleFollowUser(collaborator.id)}
                        title={followingUserId === collaborator.id ? 'Stop following' : 'Follow cursor'}
                      >
                        <Eye className="h-3 w-3" style={{ color: collaborator.cursor?.color }} />
                      </Button>
                    )}
                    
                    {!isCurrentUser(collaborator) && collaborator.role !== 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-collaborator-menu-${collaborator.id}`}
                          >
                            <MoreVertical className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background">
                          <DropdownMenuItem onClick={() => handleFollowUser(collaborator.id)}>
                            <Eye className="h-3 w-3 mr-2" />
                            {followingUserId === collaborator.id ? 'Stop Following' : 'Follow Cursor'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleUpdateRole(collaborator.id, 'editor')}
                            disabled={updateRoleMutation.isPending || collaborator.role === 'editor'}
                            data-testid={`menu-item-make-editor-${collaborator.id}`}
                          >
                            <Edit3 className="h-3 w-3 mr-2" />
                            Make Editor
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleUpdateRole(collaborator.id, 'viewer')}
                            disabled={updateRoleMutation.isPending || collaborator.role === 'viewer'}
                            data-testid={`menu-item-make-viewer-${collaborator.id}`}
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            Make Viewer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleRemoveCollaborator(collaborator.id)}
                            disabled={removeCollaboratorMutation.isPending}
                            className="text-destructive focus:text-destructive"
                            data-testid={`menu-item-remove-${collaborator.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity" className="flex-1 m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {activityFeed.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No activity yet</p>
                  <p className="text-[11px]">Activity will appear here as people join and edit</p>
                </div>
              ) : (
                activityFeed.map((event) => (
                  <div 
                    key={event.id} 
                    className="flex items-start gap-2 p-2 rounded hover:bg-muted text-[11px]"
                  >
                    <div className="mt-0.5">
                      {getActivityIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span 
                        className="font-medium"
                        style={{ color: event.color }}
                      >
                        {event.username}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {event.message.replace(event.username, '').trim()}
                      </span>
                      {event.details?.fileName && (
                        <span className="block text-muted-foreground truncate">
                          {event.details.fileName}
                          {event.details.line && `:${event.details.line}`}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-[10px] shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="invites" className="flex-1 m-0 mt-2">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {pendingInvites.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-muted-foreground">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending invites</p>
                  <p className="text-[11px]">Invites you send will appear here</p>
                </div>
              ) : (
                pendingInvites.map((invite) => (
                  <div 
                    key={invite.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{invite.email}</span>
                        <Badge variant="secondary" className={cn("text-[10px]", getRoleBadgeColor(invite.role))}>
                          {invite.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px]",
                            invite.status === 'pending' && "border-yellow-500/50 text-yellow-600",
                            invite.status === 'accepted' && "border-green-500/50 text-green-600",
                            invite.status === 'expired' && "border-red-500/50 text-red-600"
                          )}
                        >
                          {invite.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(new Date(invite.invitedAt))}
                        </span>
                      </div>
                    </div>
                    {invite.inviteLink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={async () => {
                          await navigator.clipboard.writeText(invite.inviteLink!);
                          toast({ title: 'Copied', description: 'Invite link copied to clipboard' });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="p-4 border-t border-border bg-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-medium text-foreground">
            Share collaboration link
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="w-full h-8 text-[11px] border-primary/30 hover:bg-primary/10"
          data-testid="button-copy-invite-link"
        >
          {copiedLink ? (
            <>
              <Check className="h-3 w-3 mr-1 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy invite link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
