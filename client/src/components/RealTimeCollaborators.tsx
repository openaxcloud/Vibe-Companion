/**
 * E-Code Real-Time Collaborators Component
 * Fortune 500 Quality Presence UI
 * 
 * Features:
 * - Live collaborator avatars with status indicators
 * - Cursor/selection tracking in editor
 * - In-IDE chat
 * - Follow mode
 * - Activity indicators
 * - Mobile-responsive design
 */

import { useState, useEffect, useRef, memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Users, 
  UserPlus, 
  MessageSquare,
  MousePointer,
  Eye,
  Code2,
  Terminal,
  Send,
  Circle,
  X,
  ChevronDown,
  Video,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealTimeCollaboration, Collaborator, ChatMessage } from '@/hooks/useRealTimeCollaboration';
import { formatDistanceToNow } from 'date-fns';

interface RealTimeCollaboratorsProps {
  projectId: number;
  currentFile?: string;
  className?: string;
  compact?: boolean;
  showChat?: boolean;
}

const StatusIndicator = memo(({ status }: { status: 'active' | 'idle' | 'away' }) => {
  const colors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    away: 'bg-gray-400'
  };
  
  return (
    <div className={cn(
      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
      colors[status]
    )} />
  );
});

StatusIndicator.displayName = 'StatusIndicator';

const ActivityIcon = memo(({ activity }: { activity?: string }) => {
  switch (activity?.toLowerCase()) {
    case 'editing': return <Code2 className="h-3 w-3" />;
    case 'viewing': return <Eye className="h-3 w-3" />;
    case 'terminal': return <Terminal className="h-3 w-3" />;
    default: return null;
  }
});

ActivityIcon.displayName = 'ActivityIcon';

const CollaboratorAvatar = memo(({ 
  collaborator, 
  size = 'md',
  showStatus = true,
  onClick
}: { 
  collaborator: Collaborator; 
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onClick?: () => void;
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="relative cursor-pointer" 
            onClick={onClick}
            data-testid={`collaborator-avatar-${collaborator.odUserId}`}
          >
            <Avatar 
              className={cn(sizeClasses[size], "border-2")}
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
            {showStatus && <StatusIndicator status={collaborator.status} />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-[13px]">
            <p className="font-medium">{collaborator.username}</p>
            {collaborator.currentFile && (
              <p className="text-[11px] text-muted-foreground">
                {collaborator.activity || 'Viewing'} {collaborator.currentFile}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

CollaboratorAvatar.displayName = 'CollaboratorAvatar';

const ChatMessageItem = memo(({ message }: { message: ChatMessage }) => {
  const isSystem = message.type === 'system' || message.type === 'file-change';
  
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex gap-2 py-2" data-testid={`chat-message-${message.id}`}>
      <div 
        className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium text-white shrink-0"
        style={{ backgroundColor: message.senderColor }}
      >
        {message.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{message.senderName}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </span>
        </div>
        <p className="text-[13px] break-words">{message.content}</p>
      </div>
    </div>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

const ChatPanel = memo(({ 
  messages, 
  typingUsers, 
  onSendMessage, 
  onTyping 
}: { 
  messages: ChatMessage[];
  typingUsers: { odUserId: string; username: string }[];
  onSendMessage: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
      onTyping(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onTyping(e.target.value.length > 0);
  };
  
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-1">
          {messages.map(msg => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}
        </div>
        {typingUsers.length > 0 && (
          <div className="text-[11px] text-muted-foreground italic py-2">
            {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1"
            data-testid="chat-input"
          />
          <Button type="submit" size="icon" disabled={!input.trim()} data-testid="chat-send-button">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';

export function RealTimeCollaborators({ 
  projectId, 
  currentFile,
  className,
  compact = false,
  showChat = true
}: RealTimeCollaboratorsProps) {
  const {
    isConnected,
    collaborators,
    chatMessages,
    typingUsers,
    followingUserId,
    activeCount,
    totalCount,
    sendChatMessage,
    setTyping,
    followUser,
    updateActivity
  } = useRealTimeCollaboration({ projectId });
  
  const [showDetails, setShowDetails] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  
  useEffect(() => {
    if (currentFile) {
      updateActivity('viewing', currentFile);
    }
  }, [currentFile, updateActivity]);
  
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
          <span className="text-[11px] text-muted-foreground">{activeCount} online</span>
        </div>
        <div className="flex -space-x-1.5">
          {collaborators.slice(0, 3).map(collab => (
            <CollaboratorAvatar 
              key={collab.id} 
              collaborator={collab} 
              size="sm"
              showStatus={false}
            />
          ))}
          {collaborators.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-[11px]">+{collaborators.length - 3}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-medium" data-testid="collaborator-count">
            {totalCount} {totalCount === 1 ? 'person' : 'people'}
          </span>
          <div className="flex -space-x-2 ml-2">
            {collaborators.slice(0, 4).map(collab => (
              <CollaboratorAvatar 
                key={collab.id} 
                collaborator={collab}
                size="sm"
                onClick={() => followUser(followingUserId === collab.odUserId.toString() ? null : collab.odUserId.toString())}
              />
            ))}
            {collaborators.length > 4 && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center cursor-pointer hover:bg-muted/80">
                    <span className="text-[11px]">+{collaborators.length - 4}</span>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  <div className="space-y-2">
                    {collaborators.slice(4).map(collab => (
                      <div 
                        key={collab.id}
                        className="flex items-center gap-2 p-1 rounded hover:bg-muted cursor-pointer"
                        onClick={() => followUser(collab.odUserId.toString())}
                      >
                        <CollaboratorAvatar collaborator={collab} size="sm" />
                        <span className="text-[13px] truncate">{collab.username}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 px-2"
            data-testid="invite-collaborator-button"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
          
          {showChat && (
            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 px-2 relative"
                  data-testid="open-chat-button"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {chatMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[11px] rounded-full flex items-center justify-center">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 sm:w-96 p-0">
                <SheetHeader className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)]">
                  <SheetTitle className="flex items-center gap-1.5 text-xs font-medium">
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
                    Team Chat
                  </SheetTitle>
                </SheetHeader>
                <div className="h-[calc(100vh-80px)]">
                  <ChatPanel
                    messages={chatMessages}
                    typingUsers={typingUsers}
                    onSendMessage={sendChatMessage}
                    onTyping={setTyping}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 px-2"
            onClick={() => setShowDetails(!showDetails)}
            data-testid="toggle-details-button"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
          </Button>
        </div>
      </div>
      
      {showDetails && collaborators.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-[13px]">Active Collaborators</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4 space-y-2">
            {collaborators.map(collab => (
              <div 
                key={collab.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors",
                  followingUserId === collab.odUserId.toString() && "bg-primary/10"
                )}
                data-testid={`collaborator-item-${collab.odUserId}`}
              >
                <div className="flex items-center gap-3">
                  <CollaboratorAvatar collaborator={collab} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{collab.username}</span>
                      {followingUserId === collab.odUserId.toString() && (
                        <Badge variant="secondary" className="text-[11px]">Following</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ActivityIcon activity={collab.activity} />
                      <span>{collab.activity || 'Online'}</span>
                      {collab.currentFile && (
                        <>
                          <span>•</span>
                          <span className="font-mono truncate max-w-[120px]">{collab.currentFile}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={followingUserId === collab.odUserId.toString() ? "secondary" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => followUser(followingUserId === collab.odUserId.toString() ? null : collab.odUserId.toString())}
                  data-testid={`follow-button-${collab.odUserId}`}
                >
                  <MousePointer className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RealTimeCollaborators;
