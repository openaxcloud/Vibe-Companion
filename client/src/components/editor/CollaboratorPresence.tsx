import React, { useState, useEffect } from 'react';
import { useCollaboration } from './CollaborativeProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Eye, 
  UserCheck, 
  MoreVertical,
  Circle,
  Share2,
  Copy,
  Check,
  Wifi,
  WifiOff,
  MousePointer2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CollaboratorPresenceProps {
  className?: string;
  showFullList?: boolean;
  maxVisible?: number;
}

interface Collaborator {
  user: {
    id: string;
    username: string;
    color: string;
  };
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  isFollowing?: boolean;
}

export function CollaboratorPresence({ 
  className,
  showFullList = false,
  maxVisible = 5
}: CollaboratorPresenceProps) {
  const { 
    isConnected, 
    participants, 
    userColor, 
    shareLink,
    generateShareLink,
    followUser 
  } = useCollaboration();
  
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const { toast } = useToast();

  // Auto-follow logic when following a user
  useEffect(() => {
    if (followingUserId) {
      const interval = setInterval(() => {
        followUser(followingUserId);
      }, 1000); // Update position every second

      return () => clearInterval(interval);
    }
  }, [followingUserId, followUser]);

  const handleFollowUser = (userId: string) => {
    if (followingUserId === userId) {
      setFollowingUserId(null);
      toast({
        title: 'Stopped following',
        description: 'You are no longer following this user.',
      });
    } else {
      setFollowingUserId(userId);
      followUser(userId);
      const user = participants.find(p => p.user.id === userId);
      toast({
        title: 'Following user',
        description: `You are now following ${user?.user.username}`,
      });
    }
  };

  const handleGenerateShareLink = async () => {
    setIsGeneratingLink(true);
    try {
      const link = await generateShareLink();
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Share link copied',
        description: 'The collaboration link has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Failed to generate link',
        description: 'Could not generate share link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copied',
        description: 'The collaboration link has been copied to your clipboard.',
      });
    }
  };

  const getInitials = (username: string) => {
    const parts = username.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-status-success' : 'bg-muted';
  };

  const visibleParticipants = showFullList ? participants : participants.slice(0, maxVisible);
  const hiddenCount = participants.length - visibleParticipants.length;

  if (!showFullList) {
    // Compact view for integration in editor
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Connection Status */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-status-success" />
                ) : (
                  <WifiOff className="h-4 w-4 text-status-critical" />
                )}
                <span className="text-[11px] text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isConnected ? 'Real-time collaboration active' : 'Reconnecting...'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Collaborator Avatars */}
        <div className="flex -space-x-2">
          {visibleParticipants.map((participant) => (
            <TooltipProvider key={participant.user.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleFollowUser(participant.user.id)}
                    className={cn(
                      "relative inline-block ring-2 ring-background rounded-full transition-transform hover:z-10 hover:scale-110",
                      followingUserId === participant.user.id && "ring-status-info z-10"
                    )}
                  >
                    <Avatar className="h-8 w-8 border-2" style={{ borderColor: participant.user.color }}>
                      <AvatarFallback style={{ backgroundColor: participant.user.color + '20' }}>
                        {getInitials(participant.user.username)}
                      </AvatarFallback>
                    </Avatar>
                    {followingUserId === participant.user.id && (
                      <Eye className="absolute -bottom-1 -right-1 h-3 w-3 text-status-info" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{participant.user.username}</span>
                    {participant.cursor && (
                      <span className="text-[11px] text-muted-foreground">
                        Line {participant.cursor.line}, Col {participant.cursor.column}
                      </span>
                    )}
                    <span className="text-[11px]">Click to follow</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {hiddenCount > 0 && (
            <div className="relative inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted ring-2 ring-background">
              <span className="text-[11px]">+{hiddenCount}</span>
            </div>
          )}
        </div>

        {/* Share Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={shareLink ? handleCopyShareLink : handleGenerateShareLink}
                disabled={isGeneratingLink}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-status-success" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{shareLink ? 'Copy share link' : 'Generate share link'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {participants.length}
        </Badge>
      </div>
    );
  }

  // Full list view
  return (
    <Card className={cn("w-80 backdrop-blur-sm bg-background/95", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Collaborators
          </CardTitle>
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
            <Circle className={cn("h-2 w-2 fill-current", isConnected ? "text-status-success" : "text-status-critical")} />
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
        </div>
        <CardDescription className="text-[11px]">
          {participants.length} {participants.length === 1 ? 'person' : 'people'} editing
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="h-64 pr-4">
          <div className="space-y-2">
            {participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-[13px]">
                No active collaborators
              </div>
            ) : (
              participants.map((participant) => (
                <div
                  key={participant.user.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg transition-colors",
                    "hover:bg-muted/50",
                    followingUserId === participant.user.id && "bg-status-info/10 ring-1 ring-status-info"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2" style={{ borderColor: participant.user.color }}>
                        <AvatarFallback style={{ backgroundColor: participant.user.color + '20' }}>
                          {getInitials(participant.user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-background",
                        getStatusColor(true)
                      )} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium flex items-center gap-2">
                        {participant.user.username}
                        {userColor === participant.user.color && (
                          <Badge variant="outline" className="text-[11px] px-1 py-0">
                            You
                          </Badge>
                        )}
                      </span>
                      {participant.cursor && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MousePointer2 className="h-3 w-3" />
                          L{participant.cursor.line}:C{participant.cursor.column}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {userColor !== participant.user.color && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleFollowUser(participant.user.id)}>
                          {followingUserId === participant.user.id ? (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Stop Following
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Follow Cursor
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Share Section */}
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={shareLink ? handleCopyShareLink : handleGenerateShareLink}
            disabled={isGeneratingLink}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-status-success" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                {shareLink ? 'Copy Share Link' : 'Generate Share Link'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}