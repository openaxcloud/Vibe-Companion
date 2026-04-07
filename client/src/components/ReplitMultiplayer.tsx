// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, MousePointer, Eye, Edit3, Code, 
  Cursor, Activity, Clock, Zap
} from 'lucide-react';
import { ResilientWebSocket } from '@/lib/websocket-resilience';

interface UserCursor {
  id: string;
  username: string;
  color: string;
  x: number;
  y: number;
  file?: string;
  line?: number;
  selection?: {
    start: number;
    end: number;
  };
}

interface RealtimeUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  color: string;
  status: 'coding' | 'viewing' | 'idle';
  currentFile?: string;
  lastActivity: Date;
  cursor?: UserCursor;
}

interface ReplitMultiplayerProps {
  projectId: number;
}

export function ReplitMultiplayer({ projectId }: ReplitMultiplayerProps) {
  const [users, setUsers] = useState<RealtimeUser[]>([]);
  const [cursors, setCursors] = useState<UserCursor[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const wsRef = useRef<ResilientWebSocket | null>(null);

  const handleMultiplayerEvent = useCallback((data: any) => {
    switch (data.type) {
      case 'user-joined':
        setUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user]);
        break;
      
      case 'user-left':
        setUsers(prev => prev.filter(u => u.id !== data.userId));
        setCursors(prev => prev.filter(c => c.id !== data.userId));
        break;
      
      case 'cursor-move':
        setCursors(prev => [
          ...prev.filter(c => c.id !== data.cursor.id),
          data.cursor
        ]);
        break;
      
      case 'user-activity':
        setUsers(prev => prev.map(user => 
          user.id === data.userId 
            ? { ...user, status: data.status, currentFile: data.file, lastActivity: new Date() }
            : user
        ));
        break;
      
      case 'users-list':
        setUsers(data.users);
        break;
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?projectId=${projectId}`;
    
    const resilientWs = new ResilientWebSocket({
      url,
      maxReconnectAttempts: 15,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.25,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 45000,
    });

    resilientWs.onStateChange((event) => {
      setConnectionState(event.state);
      setIsConnected(event.state === 'connected');
    });

    resilientWs.onMessage((event) => {
      try {
        const data = JSON.parse(event.data);
        handleMultiplayerEvent(data);
      } catch {
        // Ignore non-JSON messages (e.g., heartbeat responses)
      }
    });

    resilientWs.connect();
    wsRef.current = resilientWs;

    return () => {
      resilientWs.destroy();
    };
  }, [projectId, handleMultiplayerEvent]);

  const sendCursorPosition = (x: number, y: number, file?: string, line?: number) => {
    if (wsRef.current && wsRef.current.getState() === 'connected') {
      wsRef.current.send(JSON.stringify({
        type: 'cursor-move',
        cursor: { x, y, file, line }
      }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'coding': return 'text-green-600 bg-green-50 border-green-200';
      case 'viewing': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'idle': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'coding': return <Edit3 className="h-3 w-3" />;
      case 'viewing': return <Eye className="h-3 w-3" />;
      case 'idle': return <Clock className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 
          connectionState === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 
          connectionState === 'failed' || connectionState === 'circuit_open' ? 'bg-red-500' : 
          'bg-gray-400'
        }`} />
        <span className="text-[13px]">
          {isConnected ? 'Connected to multiplayer session' : 
           connectionState === 'reconnecting' ? 'Reconnecting...' :
           connectionState === 'failed' ? 'Connection failed - will retry' :
           connectionState === 'circuit_open' ? 'Too many failures - paused' :
           'Connecting...'}
        </span>
        {isConnected && users.length > 0 && (
          <Badge variant="outline" className="ml-auto">
            {users.length} online
          </Badge>
        )}
      </div>

      {/* Live Cursors Overlay */}
      <div className="relative">
        {cursors.map((cursor) => (
          <div
            key={cursor.id}
            className="absolute pointer-events-none z-50"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="flex items-center gap-1">
              <MousePointer 
                className="h-4 w-4" 
                style={{ color: cursor.color }}
              />
              <span 
                className="text-[11px] bg-black text-white px-1 py-0.5 rounded"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.username}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Live Collaboration ({users.length} active)
          </CardTitle>
          <CardDescription>
            See who's working on the project in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-[13px] text-muted-foreground">
                No other users online right now
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback style={{ backgroundColor: user.color + '20', color: user.color }}>
                          {user.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                        style={{ backgroundColor: user.color }}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.displayName}</span>
                        <Badge className={`${getStatusColor(user.status)} border text-[11px]`}>
                          {getStatusIcon(user.status)}
                          <span className="ml-1 capitalize">{user.status}</span>
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {user.currentFile ? (
                          <div className="flex items-center gap-1">
                            <Code className="h-3 w-3" />
                            Editing {user.currentFile}
                          </div>
                        ) : (
                          <span>@{user.username}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {new Date(user.lastActivity).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collaboration Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Real-time Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Cursor className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-[13px] font-medium">Live Cursors</p>
              <p className="text-[11px] text-muted-foreground">See where others are editing in real-time</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-[13px] font-medium">Live Editing</p>
              <p className="text-[11px] text-muted-foreground">Collaborative editing with conflict resolution</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-[13px] font-medium">Instant Sync</p>
              <p className="text-[11px] text-muted-foreground">Changes sync instantly across all users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multiplayer Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collaboration Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Show Cursors</p>
              <p className="text-[11px] text-muted-foreground">Display other users' cursors</p>
            </div>
            <Button variant="outline" size="sm">
              Enabled
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Follow Mode</p>
              <p className="text-[11px] text-muted-foreground">Follow another user's cursor</p>
            </div>
            <Button variant="outline" size="sm" disabled={users.length === 0}>
              {users.length > 0 ? 'Follow User' : 'No users to follow'}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Broadcast Mode</p>
              <p className="text-[11px] text-muted-foreground">Share your screen with others</p>
            </div>
            <Button variant="outline" size="sm">
              Start Broadcast
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}