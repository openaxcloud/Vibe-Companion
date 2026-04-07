import React, { useState, useRef, useEffect } from 'react';
import { useCollaboration } from '@/lib/collaboration';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Users, 
  Send, 
  AlertCircle,
  Info,
  User,
  UserPlus
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from 'date-fns';

interface CollaborationPanelProps {
  projectId: number;
  fileId: number;
  visible: boolean;
  onInviteClick: () => void;
}

interface ChatMessage {
  id: string;
  userId: number;
  username: string;
  text: string;
  timestamp: number;
}

export function CollaborationPanel({ projectId, fileId, visible, onInviteClick }: CollaborationPanelProps) {
  const { user } = useAuth();
  const { collaborators, cursors } = useCollaboration(projectId, fileId);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleSendMessage = () => {
    if (!messageText.trim() || !user) return;
    
    // Create a new message
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      userId: user.id,
      username: user.username,
      text: messageText.trim(),
      timestamp: Date.now()
    };
    
    // Update local state
    setChatMessages(prev => [...prev, newMessage]);
    
    // Send message to WebSocket
    const socket = (window as any).collaborationSocket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        type: 'chat_message',
        data: {
          text: messageText.trim(),
          timestamp: Date.now()
        },
        userId: user.id,
        username: user.username,
        projectId,
        fileId,
        timestamp: Date.now()
      };
      
      socket.send(JSON.stringify(message));
    }
    
    setMessageText('');
    inputRef.current?.focus();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Auto-scroll to bottom when new messages come in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Initialize WebSocket connection for chat
  useEffect(() => {
    // This would be handled through the useCollaboration hook in a real implementation
    // We'd add a listener for 'chat_message' events
    
    // For demo purposes, let's add a welcome message when the component mounts
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          id: 'welcome',
          userId: 0,
          username: 'PLOT',
          text: 'Welcome to the project chat! Collaborate with your team in real-time.',
          timestamp: Date.now()
        }
      ]);
    }
    
    // Listen for incoming chat messages from the WebSocket connection
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message' && data.projectId === projectId) {
          // Add message to chat
          setChatMessages(prev => [
            ...prev,
            {
              id: `msg_${data.timestamp}`,
              userId: data.userId,
              username: data.username,
              text: data.data.text,
              timestamp: data.data.timestamp
            }
          ]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    // Access the WebSocket instance from the collaboration hook
    // This would typically be provided by the hook, but we're simulating it here
    if ((window as any).collaborationSocket) {
      (window as any).collaborationSocket.addEventListener('message', handleWebSocketMessage);
    }
    
    return () => {
      if ((window as any).collaborationSocket) {
        (window as any).collaborationSocket.removeEventListener('message', handleWebSocketMessage);
      }
    };
  }, [projectId, chatMessages.length]);
  
  if (!visible) return null;
  
  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  // Generate a consistent color based on username
  const getColorForUser = (username: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium">Multiplayer</h2>
        
        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={onInviteClick}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Invite collaborators</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-1 pt-2">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              <Users className="h-4 w-4 mr-2" />
              Users {collaborators.length > 0 && `(${collaborators.length + 1})`}
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0">
          <ScrollArea className="flex-1 p-3">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <Info className="h-8 w-8 mb-2" />
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((message) => (
                  <div key={message.id} className="flex items-start gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={getColorForUser(message.username)}>
                        {getInitials(message.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="text-xs font-medium">{message.username}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t border-border mt-auto">
            <div className="flex items-center space-x-2">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage}
                size="sm"
                disabled={!messageText.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="users" className="flex-1 p-3 m-0">
          {collaborators.length === 0 && !user ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No users connected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Current user */}
              {user && (
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : (
                      <AvatarFallback className={getColorForUser(user.username)}>
                        {getInitials(user.username)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.username} (you)</p>
                    <p className="text-xs text-muted-foreground">Active now</p>
                  </div>
                </div>
              )}
              
              {/* Other collaborators */}
              {collaborators.length > 0 && (
                <>
                  <Separator />
                  {collaborators.map((collab) => (
                    <div key={collab.userId} className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={getColorForUser(collab.username)}>
                          {getInitials(collab.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{collab.username}</p>
                        <p className="text-xs text-muted-foreground">Active now</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Invite button for empty state */}
              {collaborators.length === 0 && (
                <div className="mt-6">
                  <Button 
                    onClick={onInviteClick} 
                    variant="outline" 
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite collaborators
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}