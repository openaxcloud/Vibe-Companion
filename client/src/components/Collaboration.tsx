import React, { useEffect, useState, useRef } from 'react';
import { User } from '@shared/schema';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, MessageSquare, Users } from 'lucide-react';
import { cn, getInitials, getRandomColor } from '@/lib/utils';

// Types for collaboration
export type CollaboratorInfo = {
  userId: number;
  username: string;
  color: string;
  position?: {
    lineNumber: number;
    column: number;
  };
  lastActivity?: Date;
};

export type ChatMessage = {
  userId: number;
  username: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
};

// Component props
interface CollaborationProps {
  projectId: number;
  fileId: number | null;
  currentUser: User;
  onToggle?: () => void;
  isCollapsed?: boolean;
}

// Main component
export default function Collaboration({
  projectId,
  fileId,
  currentUser,
  onToggle,
  isCollapsed = false
}: CollaborationProps) {
  // State variables
  const [activeTab, setActiveTab] = useState<'collaborators' | 'chat'>('collaborators');
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [userColor] = useState(() => getRandomColor());
  const webSocketRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket server
  useEffect(() => {
    if (!projectId || !currentUser) return;

    // Determine the WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    webSocketRef.current = ws;
    
    // Connection opened
    ws.addEventListener('open', () => {
      console.log('Connected to collaboration server');
      setIsConnected(true);
      
      // Send join message
      ws.send(JSON.stringify({
        type: 'user_joined',
        userId: currentUser.id,
        username: currentUser.username || currentUser.displayName || `User ${currentUser.id}`,
        projectId,
        fileId,
        timestamp: Date.now(),
        data: {
          color: userColor
        }
      }));
    });
    
    // Listen for messages
    ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'user_joined':
            // Add new collaborator
            setCollaborators(prev => {
              // Don't add if already in the list
              if (prev.some(col => col.userId === message.userId)) {
                return prev;
              }
              return [...prev, {
                userId: message.userId,
                username: message.username,
                color: message.data.color
              }];
            });
            
            // Add system message to chat
            setChatMessages(prev => [...prev, {
              userId: 0,
              username: 'System',
              content: `${message.username} joined the project`,
              timestamp: message.timestamp,
              isSystem: true
            }]);
            break;
            
          case 'user_left':
            // Remove collaborator
            setCollaborators(prev => prev.filter(col => col.userId !== message.userId));
            
            // Add system message to chat
            setChatMessages(prev => [...prev, {
              userId: 0,
              username: 'System',
              content: `${message.username} left the project`,
              timestamp: message.timestamp,
              isSystem: true
            }]);
            break;
            
          case 'cursor_move':
            // Update collaborator position
            setCollaborators(prev => 
              prev.map(col => 
                col.userId === message.userId 
                  ? { ...col, position: message.data.position, lastActivity: new Date() } 
                  : col
              )
            );
            break;
            
          case 'chat_message':
            // Add new chat message
            setChatMessages(prev => [...prev, {
              userId: message.userId,
              username: message.username,
              content: message.data.content,
              timestamp: message.data.timestamp
            }]);
            break;
            
          case 'current_collaborators':
            // Set initial collaborators list
            setCollaborators(message.data.collaborators);
            break;
            
          case 'ping':
            // Respond to ping with pong
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle connection close
    ws.addEventListener('close', () => {
      console.log('Disconnected from collaboration server');
      setIsConnected(false);
    });
    
    // Handle errors
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    });
    
    // Cleanup on unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [projectId, currentUser, fileId, userColor]);
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Handle sending chat messages
  const sendChatMessage = () => {
    if (!newMessage.trim() || !webSocketRef.current || !isConnected) return;
    
    const message = {
      type: 'chat_message',
      userId: currentUser.id,
      username: currentUser.username || currentUser.displayName || `User ${currentUser.id}`,
      projectId,
      fileId,
      timestamp: Date.now(),
      data: {
        content: newMessage.trim(),
        timestamp: Date.now()
      }
    };
    
    webSocketRef.current.send(JSON.stringify(message));
    
    // Add message to local state immediately
    setChatMessages(prev => [...prev, {
      userId: currentUser.id,
      username: currentUser.username || currentUser.displayName || `User ${currentUser.id}`,
      content: newMessage.trim(),
      timestamp: Date.now()
    }]);
    
    // Clear input
    setNewMessage('');
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium">Collaboration</h3>
          {isConnected ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              Disconnected
            </Badge>
          )}
        </div>
        {onToggle && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="collaborators" value={activeTab} onValueChange={(value) => setActiveTab(value as 'collaborators' | 'chat')}>
        <TabsList className="h-10 w-full flex bg-transparent justify-start px-4 pt-2 border-b border-border">
          <TabsTrigger 
            value="collaborators" 
            className={`data-[state=active]:bg-background ${activeTab === 'collaborators' ? 'border-b-2 border-primary rounded-none' : ''}`}
          >
            <Users className="h-4 w-4 mr-2" />
            Collaborators
          </TabsTrigger>
          <TabsTrigger 
            value="chat" 
            className={`data-[state=active]:bg-background ${activeTab === 'chat' ? 'border-b-2 border-primary rounded-none' : ''}`}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
        </TabsList>
        
        {/* Collaborators List */}
        <TabsContent value="collaborators" className="flex-1 overflow-auto p-4">
          <Card className="p-0 border-0 shadow-none">
            <div className="space-y-2">
              {/* Current user */}
              <div className="flex items-center space-x-3 p-2 bg-muted/30 rounded-md">
                <Avatar className="h-8 w-8 border-2" style={{ borderColor: userColor }}>
                  <AvatarFallback style={{ backgroundColor: 'transparent' }}>
                    {getInitials(currentUser.username || currentUser.displayName || `User ${currentUser.id}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center">
                    {currentUser.username || currentUser.displayName || `User ${currentUser.id}`}
                    <Badge className="ml-2 text-xs" variant="secondary">You</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Active now</div>
                </div>
              </div>
              
              {/* Other collaborators */}
              {collaborators.filter(c => c.userId !== currentUser.id).map((collaborator) => (
                <div key={collaborator.userId} className="flex items-center space-x-3 p-2 hover:bg-muted/30 rounded-md">
                  <Avatar className="h-8 w-8 border-2" style={{ borderColor: collaborator.color }}>
                    <AvatarFallback style={{ backgroundColor: 'transparent' }}>
                      {getInitials(collaborator.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{collaborator.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {collaborator.lastActivity
                        ? `Active ${Math.round((Date.now() - collaborator.lastActivity.getTime()) / 1000)}s ago`
                        : 'Joined recently'}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Empty state */}
              {collaborators.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No other collaborators yet</p>
                  <p className="text-xs mt-1">Share your project to invite others</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        
        {/* Chat */}
        <TabsContent value="chat" className="flex-1 flex flex-col h-full p-0">
          {/* Messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center p-4 text-muted-foreground h-full flex flex-col justify-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            )}
            
            {chatMessages.map((message, index) => (
              <div 
                key={index} 
                className={cn(
                  "flex flex-col max-w-[85%] space-y-1",
                  message.userId === currentUser.id ? "ml-auto items-end" : "",
                  message.isSystem ? "mx-auto items-center" : ""
                )}
              >
                {message.isSystem ? (
                  <div className="bg-muted/30 text-muted-foreground text-xs py-1 px-3 rounded-full">
                    {message.content}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium">{message.username}</span>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div 
                      className={cn(
                        "py-2 px-3 rounded-lg text-sm",
                        message.userId === currentUser.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted"
                      )}
                    >
                      {message.content}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Message input */}
          <div className="p-3 border-t border-border">
            <form 
              className="flex space-x-2" 
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage();
              }}
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                disabled={!isConnected}
              />
              <Button 
                type="submit" 
                size="sm"
                disabled={!isConnected || !newMessage.trim()}
              >
                Send
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}