import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  MessageSquare,
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  Copy,
  Check,
  X,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  UserPlus,
  Circle,
  Eye,
  Edit3,
  MousePointer,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getCursorColor, getCursorStyle, CURSOR_COLORS } from '@/lib/cursor-colors';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { yCollab } from 'y-codemirror.next';
import { EditorView } from '@codemirror/view';

interface Collaborator {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  color: string;
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
  isActive: boolean;
  permissions: 'read' | 'write' | 'admin';
  status: 'online' | 'away' | 'offline';
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'code' | 'file';
  fileUrl?: string;
  codeLanguage?: string;
}

interface RealTimeCollaborationProps {
  projectId: number;
  fileId?: number;
  editor?: EditorView;
  onCollaboratorJoin?: (collaborator: Collaborator) => void;
  onCollaboratorLeave?: (collaboratorId: string) => void;
}

// Generate a consistent color for collaborators based on user ID
const generateCollaboratorColor = (userId?: string | number) => {
  if (!userId) return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)].bg;
  return getCursorColor(userId).bg;
};

// Get full cursor style with background and text colors
const getCollaboratorCursorStyle = (userId?: string | number) => {
  if (!userId) return getCursorStyle('default');
  return getCursorStyle(userId);
};

export function RealTimeCollaboration({
  projectId,
  fileId,
  editor,
  onCollaboratorJoin,
  onCollaboratorLeave,
}: RealTimeCollaborationProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'chat' | 'call'>('users');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // CRDT and WebRTC refs
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | WebsocketProvider | null>(null);
  const awarenessRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // 8.1 FIX: WebSocket reconnection with exponential backoff
  const connectWithRetry = useCallback((
    ydoc: Y.Doc,
    roomName: string,
    attempts: number = 0
  ): WebsocketProvider => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collaboration`;
    
    const wsProvider = new WebsocketProvider(wsUrl, roomName, ydoc, {
      params: {
        auth: String(user?.id || 'anonymous'),
        username: user?.username || 'Anonymous',
      },
      connect: true,
      resyncInterval: 10000,
      maxBackoffTime: 30000,
    });

    wsProvider.on('status', ({ status }: { status: string }) => {
      if (status === 'disconnected' && attempts < 10) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000);
        setTimeout(() => {
          if (providerRef.current === wsProvider) {
            wsProvider.connect();
          }
        }, backoffMs);
      }
    });

    wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
      }
    });

    return wsProvider;
  }, [user]);

  // Initialize CRDT collaboration
  useEffect(() => {
    if (!editor || !fileId) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 8.1 FIX: Create WebSocket provider with retry logic
    const roomName = `project-${projectId}-file-${fileId}`;
    const wsProvider = connectWithRetry(ydoc, roomName, 0);
    providerRef.current = wsProvider;

    // Set up awareness for cursor positions
    const awareness = wsProvider.awareness;
    awarenessRef.current = awareness;

    // Set local user info with yCollab compatible format
    // Use user ID for consistent color assignment across sessions
    const cursorColor = getCursorColor(user?.id || 'anonymous');
    awareness.setLocalStateField('user', {
      name: user?.username || 'Anonymous',
      color: cursorColor.bg,
      colorLight: cursorColor.bg + '33',
      colorName: cursorColor.name,
    });

    // Listen for awareness changes
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().entries());
      const collaboratorList: Collaborator[] = states
        .filter(([clientId]) => clientId !== awareness.clientID)
        .map(([clientId, state]) => ({
          id: clientId.toString(),
          username: state.user?.name || state.user?.username || 'Anonymous',
          color: state.user?.color || '#000000',
          cursor: state.cursor,
          selection: state.selection,
          isActive: true,
          permissions: 'write',
          status: 'online',
        }));
      
      setCollaborators(collaboratorList);
    });

    // yCollab extension handles text syncing and cursor display
    // The extension should be added to the EditorView during creation
    // Here we just set up the awareness for collaboration tracking
    const ytext = ydoc.getText('content');
    
    // 8.3 FIX: Create UndoManager that only tracks local edits (not remote changes)
    const undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set([ydoc.clientID]), // Only track own edits for undo/redo
      captureTimeout: 500, // Group changes within 500ms
    });
    const collabExtension = yCollab(ytext, awareness, { undoManager });
    
    // Dispatch the extension to the existing editor
    editor.dispatch({
      effects: (editor.state as any).reconfigure?.([
        ...(editor.state as any).facet?.((editor.state as any).configuration) || [],
        collabExtension,
      ]),
    });

    return () => {
      undoManager.destroy();
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [editor, fileId, projectId, user]);

  // yCollab handles cursor and selection rendering internally
  // This effect adds additional styling for yCollab's cursor elements
  useEffect(() => {
    if (!editor) return;

    // Add custom CSS for yCollab cursor styling enhancements
    const styleElement = document.createElement('style');
    styleElement.id = 'ycollab-custom-styles';
    styleElement.textContent = `
      .cm-ySelectionInfo {
        position: absolute;
        top: -1.05em;
        left: -1px;
        font-size: 0.75em;
        font-family: sans-serif;
        font-weight: 600;
        line-height: normal;
        user-select: none;
        padding: 0 4px;
        border-radius: 3px 3px 3px 0;
        z-index: 101;
        white-space: nowrap;
        pointer-events: none;
      }
      .cm-ySelection {
        mix-blend-mode: multiply;
      }
      .cm-yCursor {
        position: relative;
        border-left: 2px solid;
        border-right: none;
        margin-left: -1px;
        margin-right: -1px;
        pointer-events: none;
      }
    `;
    
    const existingStyle = document.getElementById('ycollab-custom-styles');
    if (!existingStyle) {
      document.head.appendChild(styleElement);
    }

    return () => {
      const styleToRemove = document.getElementById('ycollab-custom-styles');
      if (styleToRemove) {
        document.head.removeChild(styleToRemove);
      }
    };
  }, [editor]);

  // 8.8 FIX: Load persisted chat messages on mount
  useEffect(() => {
    const loadPersistedMessages = async () => {
      try {
        const response = await fetch(`/api/collaboration/${projectId}/messages?limit=100`, {
          credentials: 'include',
        });
        if (response.ok) {
          const messages = await response.json();
          const formattedMessages: ChatMessage[] = messages.map((msg: any) => ({
            id: msg.id,
            userId: String(msg.userId),
            username: msg.username,
            message: msg.content,
            timestamp: new Date(msg.createdAt),
            type: msg.type || 'text',
          }));
          setChatMessages(formattedMessages);
        }
      } catch (error) {
      }
    };

    if (projectId) {
      loadPersistedMessages();
    }
  }, [projectId]);

  // 8.8 FIX: Handle chat message sending with persistence
  const sendMessage = async () => {
    if (!messageInput.trim()) return;

    const messageContent = messageInput.trim();
    setMessageInput(''); // Clear immediately for UX

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: String(user?.id || 'anonymous'),
      username: user?.username || 'Anonymous',
      message: messageContent,
      timestamp: new Date(),
      type: 'text',
    };

    // Optimistically add to UI
    setChatMessages(prev => [...prev, tempMessage]);

    try {
      // 8.8 FIX: Persist message via API
      const response = await fetch(`/api/collaboration/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: messageContent,
          type: 'text',
        }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        // Update temp message with real ID
        setChatMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, id: savedMessage.id }
            : msg
        ));
      } else {
      }
    } catch (error) {
    }

    // Also send via awareness for real-time sync (backup)
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('chat', tempMessage);
    }
  };

  // Listen for chat messages (both awareness and WebSocket-delivered)
  useEffect(() => {
    if (!awarenessRef.current) return;

    const handleChatMessage = () => {
      const states = Array.from(awarenessRef.current.getStates().entries()) as [number, any][];
      states.forEach(([clientId, state]) => {
        if (state.chat && clientId !== awarenessRef.current.clientID) {
          setChatMessages(prev => {
            // 8.8 FIX: Deduplicate by ID (handles both temp and real IDs)
            const exists = prev.some(msg => 
              msg.id === state.chat.id || 
              (msg.message === state.chat.message && 
               msg.userId === state.chat.userId &&
               Math.abs(new Date(msg.timestamp).getTime() - new Date(state.chat.timestamp).getTime()) < 5000)
            );
            if (!exists) {
              return [...prev, state.chat];
            }
            return prev;
          });
        }
      });
    };

    awarenessRef.current.on('change', handleChatMessage);
    return () => {
      awarenessRef.current?.off('change', handleChatMessage);
    };
  }, []);

  // Generate invite link
  const generateInviteLink = () => {
    const link = `${window.location.origin}/projects/${projectId}?invite=${Date.now()}`;
    setInviteLink(link);
    setInviteDialogOpen(true);
  };

  // Copy invite link
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Link Copied',
      description: 'Invite link has been copied to clipboard',
    });
  };

  // Start video call
  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setIsInCall(true);
      
      // Notify others about the call
      if (awarenessRef.current) {
        awarenessRef.current.setLocalStateField('call', {
          isInCall: true,
          userId: user?.id,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to access camera and microphone',
        variant: 'destructive',
      });
    }
  };

  // End video call
  const endVideoCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    setIsInCall(false);
    
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('call', {
        isInCall: false,
        userId: user?.id,
      });
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold">Collaboration</h3>
            <Badge variant="secondary" className="ml-2">
              {collaborators.length + 1} active
            </Badge>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={generateInviteLink}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="text-[11px]">
              <Users className="h-3.5 w-3.5 mr-1" />
              Users ({collaborators.length + 1})
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-[11px]">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="call" className="text-[11px]">
              <Phone className="h-3.5 w-3.5 mr-1" />
              Call
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="flex-1 p-4">
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {/* Current User */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.avatarUrl ?? undefined} />
                          <AvatarFallback>
                            {user?.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[13px] font-medium">{user?.username} (You)</p>
                          <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                            <span>Online</span>
                          </div>
                        </div>
                      </div>
                      <Badge>Admin</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Collaborators */}
                {collaborators.map((collaborator) => (
                  <Card key={collaborator.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={collaborator.avatarUrl} />
                            <AvatarFallback style={{ backgroundColor: collaborator.color }}>
                              {collaborator.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[13px] font-medium">{collaborator.username}</p>
                            <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                              {collaborator.cursor && (
                                <span className="flex items-center">
                                  <MousePointer className="h-3 w-3 mr-1" />
                                  Line {collaborator.cursor.line}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {collaborator.permissions === 'write' ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.userId === String(user?.id) ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.userId === String(user?.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-[11px] font-medium mb-1">{message.username}</p>
                      <p className="text-[13px]">{message.message}</p>
                      <p className="text-[11px] opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button size="icon" onClick={sendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Call Tab */}
          <TabsContent value="call" className="flex-1 p-4">
            <div className="h-full flex flex-col items-center justify-center">
              {!isInCall ? (
                <div className="text-center space-y-4">
                  <div className="text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4" />
                    <p>Start a voice or video call with collaborators</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={startVideoCall}>
                      <Video className="h-4 w-4 mr-2" />
                      Start Video Call
                    </Button>
                    <Button variant="outline" onClick={startVideoCall}>
                      <Phone className="h-4 w-4 mr-2" />
                      Voice Only
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
                    <p className="text-white">Video call in progress...</p>
                  </div>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant={isMuted ? "destructive" : "outline"}
                      size="icon"
                      onClick={toggleMute}
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant={isVideoOff ? "destructive" : "outline"}
                      size="icon"
                      onClick={toggleVideo}
                    >
                      {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={endVideoCall}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      End Call
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Invite Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Collaborators</DialogTitle>
              <DialogDescription>
                Share this link with others to invite them to collaborate
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input value={inviteLink} readOnly />
                <Button onClick={copyInviteLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-[13px] text-muted-foreground">
                This link will expire in 24 hours for security reasons.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}