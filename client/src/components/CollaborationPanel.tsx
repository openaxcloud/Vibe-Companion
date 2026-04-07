/**
 * E-Code Real-Time Collaboration Panel
 * Fortune 500 Quality Full-Featured Collaboration UI
 * 
 * Features:
 * - Collaborator list with status, activity, and cursor tracking
 * - In-IDE real-time chat
 * - Share/Invite system
 * - Follow mode
 * - Voice/Video call buttons
 * - Mobile-responsive design
 */

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Circle,
  Eye,
  Edit,
  MessageSquare,
  Video,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  Copy,
  Check,
  MousePointer,
  Activity,
  Send,
  Terminal,
  Code2,
  Phone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRealTimeCollaboration, Collaborator, ChatMessage } from '@/hooks/useRealTimeCollaboration';
import { formatDistanceToNow, format } from 'date-fns';

interface CollaborationPanelProps {
  projectId: number;
  projectName?: string;
  currentUser?: any;
  currentFile?: string;
  onFollowUser?: (userId: string) => void;
  onFollowCursor?: (cursor: { lineNumber: number; column: number } | null) => void;
  onStartCall?: () => void;
  className?: string;
}

const StatusIndicator = memo(({ status }: { status: 'active' | 'idle' | 'away' }) => {
  const config = {
    active: { color: 'bg-green-500', label: 'Active' },
    idle: { color: 'bg-yellow-500', label: 'Idle' },
    away: { color: 'bg-gray-400', label: 'Away' }
  };
  
  return (
    <div 
      className={cn(
        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
        config[status].color
      )}
      title={config[status].label}
    />
  );
});

StatusIndicator.displayName = 'StatusIndicator';

const ActivityIcon = memo(({ activity }: { activity?: string }) => {
  switch (activity?.toLowerCase()) {
    case 'editing': return <Code2 className="h-3 w-3 text-blue-500" />;
    case 'viewing': return <Eye className="h-3 w-3 text-green-500" />;
    case 'terminal': return <Terminal className="h-3 w-3 text-purple-500" />;
    default: return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
});

ActivityIcon.displayName = 'ActivityIcon';

const CollaboratorListItem = memo(({ 
  collaborator, 
  isFollowing,
  onFollow 
}: { 
  collaborator: Collaborator;
  isFollowing: boolean;
  onFollow: () => void;
}) => {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
        isFollowing ? "bg-muted border border-border" : "hover:bg-muted"
      )}
      onClick={onFollow}
      data-testid={`collaborator-${collaborator.odUserId}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar 
            className="h-8 w-8 border-2"
            style={{ borderColor: collaborator.color }}
          >
            <AvatarImage src={collaborator.avatar} />
            <AvatarFallback 
              className="text-[11px] font-medium text-white"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <StatusIndicator status={collaborator.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium truncate">{collaborator.username}</p>
            {isFollowing && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                Following
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ActivityIcon activity={collaborator.activity} />
            <span className="truncate">
              {collaborator.activity || 'Online'}
              {collaborator.currentFile && ` · ${collaborator.currentFile}`}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {collaborator.status === 'active' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isFollowing ? "secondary" : "ghost"}
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onFollow(); }}
                >
                  <MousePointer className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFollowing ? 'Stop following' : 'Follow cursor'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
});

CollaboratorListItem.displayName = 'CollaboratorListItem';

const ChatMessageBubble = memo(({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) => {
  if (message.type === 'system' || message.type === 'file-change') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }
  
  return (
    <div className={cn("flex gap-2 my-2", isOwn && "flex-row-reverse")}>
      <div 
        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white shrink-0"
        style={{ backgroundColor: message.senderColor }}
      >
        {message.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className={cn("max-w-[75%]", isOwn && "text-right")}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[11px] font-medium">{message.senderName}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.timestamp), 'HH:mm')}
          </span>
        </div>
        <div 
          className={cn(
            "text-[13px] px-3 py-1.5 rounded-lg",
            isOwn 
              ? "bg-primary text-primary-foreground rounded-br-sm" 
              : "bg-muted rounded-bl-sm"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
});

ChatMessageBubble.displayName = 'ChatMessageBubble';

const InviteDialog = memo(({ 
  projectId, 
  projectName,
  open,
  onOpenChange 
}: { 
  projectId: number;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const shareLink = `${window.location.origin}/ide/${projectId}?join=true`;
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ description: 'Link copied to clipboard!' });
    } catch {
      toast({ description: 'Failed to copy link', variant: 'destructive' });
    }
  };
  
  const handleInvite = async () => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/collaboration/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email: email.trim(), role })
      });
      
      if (!response.ok) throw new Error('Failed to send invitation');
      
      toast({ description: `Invitation sent to ${email}` });
      setEmail('');
    } catch {
      toast({ description: 'Failed to send invitation', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Collaborators
          </DialogTitle>
          <DialogDescription>
            Share {projectName || 'this project'} with others to collaborate in real-time.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Share Link</Label>
            <div className="flex gap-2">
              <Input 
                value={shareLink} 
                readOnly 
                className="text-[11px] font-mono"
                data-testid="share-link-input"
              />
              <Button 
                size="icon" 
                variant="outline" 
                onClick={handleCopyLink}
                data-testid="copy-link-button"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label>Invite by Email</Label>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="invite-email-input"
              />
              <Select value={role} onValueChange={(v: 'editor' | 'viewer') => setRole(v)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={handleInvite} 
            disabled={!email.trim() || isLoading}
            data-testid="send-invite-button"
          >
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

InviteDialog.displayName = 'InviteDialog';

export function CollaborationPanel({
  projectId,
  projectName,
  currentUser,
  currentFile,
  onFollowUser,
  onFollowCursor,
  onStartCall,
  className,
}: CollaborationPanelProps) {
  const { toast } = useToast();
  const {
    isConnected,
    collaborators,
    chatMessages,
    typingUsers,
    followingUserId,
    activeCount,
    totalCount,
    error,
    sendChatMessage,
    setTyping,
    followUser,
    updateActivity,
    getCollaboratorCursor
  } = useRealTimeCollaboration({ projectId });
  
  const [activeTab, setActiveTab] = useState<'collaborators' | 'chat'>('collaborators');
  const [chatInput, setChatInput] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = btoa(`${projectId}-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substr(0, 9);
    setShareLink(`${window.location.origin}/ide/${projectId}?token=${token}`);
  }, [projectId]);

  useEffect(() => {
    if (currentFile) {
      updateActivity('viewing', currentFile);
    }
  }, [currentFile, updateActivity]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (followingUserId && onFollowCursor) {
      const cursor = getCollaboratorCursor(followingUserId);
      if (cursor) {
        onFollowCursor(cursor);
      }
    }
  }, [followingUserId, collaborators, onFollowCursor, getCollaboratorCursor]);

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    toast({
      title: "Link copied!",
      description: "Share this link to invite collaborators",
    });
    setTimeout(() => setLinkCopied(false), 2000);
  }, [shareLink, toast]);

  const handleFollowUser = useCallback((userId: string) => {
    const newFollowing = followingUserId === userId ? null : userId;
    followUser(newFollowing);
    
    if (newFollowing) {
      const user = collaborators.find(c => c.odUserId.toString() === userId);
      if (user) {
        toast({
          title: `Following ${user.username}`,
          description: `You're now following ${user.username}'s cursor`,
        });
        onFollowUser?.(userId);
        
        if (onFollowCursor) {
          const cursor = getCollaboratorCursor(userId);
          if (cursor) {
            onFollowCursor(cursor);
          }
        }
      }
    } else if (onFollowCursor) {
      onFollowCursor(null);
    }
  }, [followingUserId, followUser, collaborators, toast, onFollowUser, onFollowCursor, getCollaboratorCursor]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChatMessage(chatInput);
      setChatInput('');
      setTyping(false);
    }
  }, [chatInput, sendChatMessage, setTyping]);

  const handleChatInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    setTyping(e.target.value.length > 0);
  }, [setTyping]);

  const toggleCall = useCallback(() => {
    if (!isInCall) {
      setIsInCall(true);
      toast({
        title: "Call started",
        description: "Voice & video call is now active",
      });
      onStartCall?.();
    } else {
      setIsInCall(false);
      toast({
        title: "Call ended",
        description: "You've left the call",
      });
    }
  }, [isInCall, toast, onStartCall]);

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <Users className="h-4 w-4" />
            Collaboration
            <Badge variant="secondary" className="ml-1" data-testid="active-count">
              {activeCount} active
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            {isInCall && (
              <>
                <Button
                  size="icon"
                  variant={isMuted ? "destructive" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant={!isVideoOn ? "destructive" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                </Button>
              </>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isInCall ? "destructive" : "ghost"}
                    className="h-8 w-8"
                    onClick={toggleCall}
                    data-testid="call-button"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isInCall ? 'End call' : 'Start video call'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'collaborators' | 'chat')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-1" style={{ width: 'calc(100% - 32px)' }}>
            <TabsTrigger value="collaborators" className="text-[11px]" data-testid="tab-people">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              People ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-[11px] relative" data-testid="tab-chat">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Chat
              {chatMessages.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                  {chatMessages.length > 99 ? '99+' : chatMessages.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="collaborators" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Share2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-transparent text-[11px] text-muted-foreground outline-none min-w-0"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 shrink-0"
                    onClick={copyShareLink}
                    data-testid="copy-share-link"
                  >
                    {linkCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <Separator />

                {collaborators.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-[13px]">No other collaborators yet</p>
                    <p className="text-[11px] mt-1">Invite someone to collaborate!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {collaborators.map((collaborator) => (
                      <CollaboratorListItem
                        key={collaborator.id}
                        collaborator={collaborator}
                        isFollowing={followingUserId === collaborator.odUserId.toString()}
                        onFollow={() => handleFollowUser(collaborator.odUserId.toString())}
                      />
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => setInviteOpen(true)}
                  data-testid="invite-button"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Collaborator
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="chat" className="flex-1 mt-2 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-4" ref={chatScrollRef}>
              {chatMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-[13px]">No messages yet</p>
                  <p className="text-[11px] mt-1">Start the conversation!</p>
                </div>
              ) : (
                <div className="pb-2">
                  {chatMessages.map((msg) => (
                    <ChatMessageBubble 
                      key={msg.id} 
                      message={msg} 
                      isOwn={false}
                    />
                  ))}
                  {typingUsers.length > 0 && (
                    <div className="text-[11px] text-muted-foreground italic px-2 py-1">
                      {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            
            <form onSubmit={handleSendMessage} className="p-4 border-t mt-auto shrink-0">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={chatInput}
                  onChange={handleChatInputChange}
                  placeholder="Type a message..."
                  className="flex-1 h-9 text-[13px]"
                  data-testid="chat-input"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-9 w-9 shrink-0"
                  disabled={!chatInput.trim()}
                  data-testid="send-chat-button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
        
        {error && (
          <div className="p-3 border-t bg-destructive/10 text-destructive text-[11px] shrink-0">
            {error}
          </div>
        )}
        
        {isInCall && (
          <div className="p-4 bg-background border-t shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                In call with {activeCount} people
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={toggleCall}
                data-testid="end-call-button"
              >
                End Call
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      <InviteDialog
        projectId={projectId}
        projectName={projectName}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </Card>
  );
}
