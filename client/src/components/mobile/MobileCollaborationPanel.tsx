/**
 * MobileCollaborationPanel - Touch-optimized real-time collaboration for mobile
 * 
 * Features:
 * - Full-screen modal for mobile
 * - Touch-friendly collaborator list
 * - Swipeable chat interface
 * - Large touch targets (44px+)
 * - Smooth animations
 * - Haptic feedback
 */

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence, type PanInfo } from '@/lib/motion';
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  Send, 
  X, 
  Copy, 
  Check,
  Phone,
  Video,
  Circle,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useRealTimeCollaboration, Collaborator, ChatMessage } from '@/hooks/useRealTimeCollaboration';
import { format } from 'date-fns';

interface MobileCollaborationPanelProps {
  projectId: number;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const MobileCollaboratorItem = memo(({ 
  collaborator, 
  isFollowing,
  onFollow 
}: { 
  collaborator: Collaborator;
  isFollowing: boolean;
  onFollow: () => void;
}) => {
  return (
    <LazyMotionButton
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 w-full rounded-xl transition-colors min-h-[56px]",
        isFollowing ? "bg-muted border border-border" : "bg-muted/50 active:bg-muted"
      )}
      onClick={onFollow}
      data-testid={`mobile-collaborator-${collaborator.odUserId}`}
    >
      <div className="relative">
        <Avatar 
          className="h-11 w-11 border-2"
          style={{ borderColor: collaborator.color }}
        >
          <AvatarImage src={collaborator.avatar} />
          <AvatarFallback 
            className="text-[13px] font-bold text-white"
            style={{ backgroundColor: collaborator.color }}
          >
            {collaborator.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
            collaborator.status === 'active' ? 'bg-green-500' :
            collaborator.status === 'idle' ? 'bg-yellow-500' : 'bg-muted-foreground'
          )}
        />
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{collaborator.username}</span>
          {isFollowing && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Following</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {collaborator.activity || 'Online'}
          {collaborator.currentFile && ` · ${collaborator.currentFile}`}
        </p>
      </div>
      
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </LazyMotionButton>
  );
});

MobileCollaboratorItem.displayName = 'MobileCollaboratorItem';

const MobileChatBubble = memo(({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) => {
  if (message.type === 'system' || message.type === 'file-change') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }
  
  return (
    <LazyMotionDiv 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2 my-3", isOwn && "flex-row-reverse")}
    >
      <div 
        className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ backgroundColor: message.senderColor }}
      >
        {message.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className={cn("max-w-[75%]", isOwn && "text-right")}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[11px] font-medium">{message.senderName}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.timestamp), 'HH:mm')}
          </span>
        </div>
        <div 
          className={cn(
            "text-[13px] px-4 py-2.5 rounded-2xl",
            isOwn 
              ? "bg-primary text-primary-foreground rounded-br-md" 
              : "bg-muted rounded-bl-md"
          )}
        >
          {message.content}
        </div>
      </div>
    </LazyMotionDiv>
  );
});

MobileChatBubble.displayName = 'MobileChatBubble';

export function MobileCollaborationPanel({
  projectId,
  projectName,
  isOpen,
  onClose
}: MobileCollaborationPanelProps) {
  const { toast } = useToast();
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
  } = useRealTimeCollaboration({ projectId });
  
  const [activeView, setActiveView] = useState<'people' | 'chat'>('people');
  const [chatInput, setChatInput] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const shareLink = `${window.location.origin}/ide/${projectId}?join=true`;
  
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      
      if ('vibrate' in navigator) navigator.vibrate(10);
      toast({ description: 'Link copied!' });
    } catch {
      toast({ description: 'Failed to copy', variant: 'destructive' });
    }
  }, [shareLink, toast]);
  
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChatMessage(chatInput);
      setChatInput('');
      setTyping(false);
      if ('vibrate' in navigator) navigator.vibrate(10);
    }
  }, [chatInput, sendChatMessage, setTyping]);
  
  const handleFollowUser = useCallback((userId: string) => {
    const newFollowing = followingUserId === userId ? null : userId;
    followUser(newFollowing);
    if ('vibrate' in navigator) navigator.vibrate(10);
  }, [followingUserId, followUser]);
  
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  }, [onClose]);
  
  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          
          <LazyMotionDiv
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl max-h-[90vh] flex flex-col"
            data-testid="mobile-collab-panel"
          >
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="flex items-center justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted-foreground/50 rounded-full" />
              </div>
              
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <h2 className="text-[15px] font-semibold">Collaboration</h2>
                  <Badge variant="secondary">{totalCount}</Badge>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-10 w-10"
                    onClick={() => setShowShareSheet(true)}
                    data-testid="mobile-invite-button"
                  >
                    <UserPlus className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-10 w-10"
                    onClick={onClose}
                    data-testid="mobile-close-collab"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-1 p-2 border-b border-border bg-muted">
                <Button
                  variant={activeView === 'people' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-10"
                  onClick={() => setActiveView('people')}
                  data-testid="mobile-tab-people"
                >
                  <Users className="h-4 w-4 mr-2" />
                  People ({totalCount})
                </Button>
                <Button
                  variant={activeView === 'chat' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 h-10 relative"
                  onClick={() => setActiveView('chat')}
                  data-testid="mobile-tab-chat"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                  {chatMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </Button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                {activeView === 'people' ? (
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-3">
                      {collaborators.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-[13px]">No collaborators yet</p>
                          <p className="text-[13px] mt-1">Invite someone to collaborate!</p>
                          <Button
                            className="mt-4"
                            onClick={() => setShowShareSheet(true)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invite
                          </Button>
                        </div>
                      ) : (
                        collaborators.map((collab) => (
                          <MobileCollaboratorItem
                            key={collab.id}
                            collaborator={collab}
                            isFollowing={followingUserId === collab.odUserId.toString()}
                            onFollow={() => handleFollowUser(collab.odUserId.toString())}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col h-full">
                    <ScrollArea className="flex-1 px-4" ref={chatScrollRef}>
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-[13px]">No messages yet</p>
                          <p className="text-[13px] mt-1">Start the conversation!</p>
                        </div>
                      ) : (
                        <div className="pb-4">
                          {chatMessages.map((msg) => (
                            <MobileChatBubble 
                              key={msg.id} 
                              message={msg} 
                              isOwn={false}
                            />
                          ))}
                          {typingUsers.length > 0 && (
                            <div className="text-[11px] text-muted-foreground italic px-2 py-1">
                              {typingUsers.map(u => u.username).join(', ')} typing...
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                    
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-background safe-area-bottom">
                      <div className="flex gap-2">
                        <Input
                          value={chatInput}
                          onChange={(e) => {
                            setChatInput(e.target.value);
                            setTyping(e.target.value.length > 0);
                          }}
                          placeholder="Type a message..."
                          className="flex-1 h-11 text-[13px] rounded-xl"
                          data-testid="mobile-chat-input"
                        />
                        <Button 
                          type="submit" 
                          size="icon" 
                          className="h-11 w-11 rounded-xl shrink-0"
                          disabled={!chatInput.trim()}
                          data-testid="mobile-send-button"
                        >
                          <Send className="h-5 w-5" />
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
            
            <LazyAnimatePresence>
              {showShareSheet && (
                <LazyMotionDiv
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute inset-0 bg-background rounded-t-3xl p-4 z-10"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[15px] font-semibold">Share Project</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10"
                      onClick={() => setShowShareSheet(false)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-[11px] text-muted-foreground mb-2">Share Link</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-mono truncate flex-1">{shareLink}</p>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 shrink-0"
                          onClick={handleCopyLink}
                        >
                          {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full h-12"
                      onClick={handleCopyLink}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                  </div>
                </LazyMotionDiv>
              )}
            </LazyAnimatePresence>
          </LazyMotionDiv>
        </>
      )}
    </LazyAnimatePresence>
  );
}

export default MobileCollaborationPanel;
