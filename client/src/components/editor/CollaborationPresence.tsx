import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface Collaborator {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline: boolean;
  cursor?: {
    file?: string;
    line?: number;
    column?: number;
  };
  color: string;
}

interface CollaborationPresenceProps {
  projectId: number;
  currentUserId: number;
  className?: string;
  compact?: boolean;
}

const COLLABORATOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#48DBFB', '#00D2D3', '#1DD1A1'
];

export function CollaborationPresence({ 
  projectId, 
  currentUserId, 
  className,
  compact = false 
}: CollaborationPresenceProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Fetch active collaborators
  const { data: activeCollaborators } = useQuery<Collaborator[]>({
    queryKey: [`/api/projects/${projectId}/collaborators/active`],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // WebSocket connection for real-time presence
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/projects/${projectId}/collaboration`);
    
    ws.onopen = () => {
      // Send initial presence
      ws.send(JSON.stringify({
        type: 'presence',
        userId: currentUserId,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'collaborator-joined') {
        setCollaborators(prev => {
          const exists = prev.some(c => c.id === data.collaborator.id);
          if (exists) return prev;
          return [...prev, {
            ...data.collaborator,
            color: COLLABORATOR_COLORS[prev.length % COLLABORATOR_COLORS.length]
          }];
        });
      } else if (data.type === 'collaborator-left') {
        setCollaborators(prev => prev.filter(c => c.id !== data.userId));
      } else if (data.type === 'cursor-update') {
        setCollaborators(prev => prev.map(c => 
          c.id === data.userId 
            ? { ...c, cursor: data.cursor }
            : c
        ));
      }
    };

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
  }, [projectId, currentUserId]);

  // Initialize with fetched data
  useEffect(() => {
    if (activeCollaborators) {
      setCollaborators(activeCollaborators.map((c, i) => ({
        ...c,
        color: COLLABORATOR_COLORS[i % COLLABORATOR_COLORS.length]
      })));
    }
  }, [activeCollaborators]);

  const onlineCollaborators = collaborators.filter(c => c.isOnline && c.id !== currentUserId);

  if (compact) {
    return (
      <div className={cn("flex items-center", className)}>
        <div className="flex -space-x-2">
          {onlineCollaborators.slice(0, 3).map((collaborator) => (
            <TooltipProvider key={collaborator.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar 
                    className="h-6 w-6 border-2 border-[var(--ecode-background)]"
                    style={{ borderColor: collaborator.color }}
                  >
                    <AvatarImage src={collaborator.avatarUrl} />
                    <AvatarFallback style={{ backgroundColor: collaborator.color }}>
                      {collaborator.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{collaborator.displayName || collaborator.username}</p>
                  {collaborator.cursor?.file && (
                    <p className="text-xs text-[var(--ecode-text-muted)]">
                      Editing: {collaborator.cursor.file}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        {onlineCollaborators.length > 3 && (
          <span className="ml-2 text-xs text-[var(--ecode-text-muted)]">
            +{onlineCollaborators.length - 3}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium">Active Collaborators</h3>
      <div className="space-y-2">
        {onlineCollaborators.length === 0 ? (
          <p className="text-sm text-[var(--ecode-text-muted)]">
            No one else is currently editing
          </p>
        ) : (
          onlineCollaborators.map((collaborator) => (
            <div key={collaborator.id} className="flex items-center gap-2">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={collaborator.avatarUrl} />
                  <AvatarFallback style={{ backgroundColor: collaborator.color }}>
                    {collaborator.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--ecode-background)]"
                  style={{ backgroundColor: collaborator.color }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {collaborator.displayName || collaborator.username}
                </p>
                {collaborator.cursor?.file && (
                  <p className="text-xs text-[var(--ecode-text-muted)]">
                    {collaborator.cursor.file}
                    {collaborator.cursor.line && ` • Line ${collaborator.cursor.line}`}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}