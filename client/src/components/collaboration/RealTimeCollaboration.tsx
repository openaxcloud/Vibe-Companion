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
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type * as monaco from 'monaco-editor';

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
  editor?: monaco.editor.IStandaloneCodeEditor;
  onCollaboratorJoin?: (collaborator: Collaborator) => void;
  onCollaboratorLeave?: (collaboratorId: string) => void;
}

// Generate a random color for collaborators
const generateCollaboratorColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
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
  const bindingRef = useRef<MonacoBinding | null>(null);
  const awarenessRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Initialize CRDT collaboration
  useEffect(() => {
    if (!editor || !fileId) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create WebSocket provider for reliability
    const wsProvider = new WebsocketProvider(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/collaboration`,
      `project-${projectId}-file-${fileId}`,
      ydoc,
      {
        params: {
          auth: user?.id,
          username: user?.username || 'Anonymous',
        }
      }
    );
    providerRef.current = wsProvider;

    // Set up awareness for cursor positions
    const awareness = wsProvider.awareness;
    awarenessRef.current = awareness;

    // Set local user info
    awareness.setLocalStateField('user', {
      id: user?.id || 'anonymous',
      username: user?.username || 'Anonymous',
      color: generateCollaboratorColor(),
    });

    // Listen for awareness changes
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().entries());
      const collaboratorList: Collaborator[] = states
        .filter(([clientId]) => clientId !== awareness.clientID)
        .map(([clientId, state]) => ({
          id: clientId.toString(),
          username: state.user?.username || 'Anonymous',
          color: state.user?.color || '#000000',
          cursor: state.cursor,
          selection: state.selection,
          isActive: true,
          permissions: 'write',
          status: 'online',
        }));
      
      setCollaborators(collaboratorList);
    });

    // Create Monaco binding
    const ytext = ydoc.getText('content');
    const binding = new MonacoBinding(
      ytext,
      editor.getModel()!,
      new Set([editor]),
      awareness
    );
    bindingRef.current = binding;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      awareness.setLocalStateField('cursor', {
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Track selection
    editor.onDidChangeCursorSelection((e) => {
      awareness.setLocalStateField('selection', {
        startLine: e.selection.startLineNumber,
        startColumn: e.selection.startColumn,
        endLine: e.selection.endLineNumber,
        endColumn: e.selection.endColumn,
      });
    });

    return () => {
      binding.destroy();
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [editor, fileId, projectId, user]);

  // Render collaborator cursors
  useEffect(() => {
    if (!editor) return;

    const decorations: string[] = [];
    
    collaborators.forEach((collaborator) => {
      if (collaborator.cursor) {
        // Add cursor decoration
        const cursorDecoration = editor.deltaDecorations([], [
          {
            range: new (window as any).monaco.Range(
              collaborator.cursor.line,
              collaborator.cursor.column,
              collaborator.cursor.line,
              collaborator.cursor.column
            ),
            options: {
              className: 'collaborator-cursor',
              hoverMessage: { value: collaborator.username },
              beforeContentClassName: 'collaborator-cursor-before',
              afterContentClassName: 'collaborator-cursor-after',
              // Use inline styles for dynamic colors
              inlineClassName: `collaborator-cursor-${collaborator.id}`,
            },
          },
        ]);
        decorations.push(...cursorDecoration);
      }

      if (collaborator.selection) {
        // Add selection decoration
        const selectionDecoration = editor.deltaDecorations([], [
          {
            range: new (window as any).monaco.Range(
              collaborator.selection.startLine,
              collaborator.selection.startColumn,
              collaborator.selection.endLine,
              collaborator.selection.endColumn
            ),
            options: {
              className: 'collaborator-selection',
              inlineClassName: `collaborator-selection-${collaborator.id}`,
              // Use inline styles for dynamic colors with transparency
              beforeContentClassName: `collaborator-selection-before-${collaborator.id}`,
            },
          },
        ]);
        decorations.push(...selectionDecoration);
      }
    });

    // Add dynamic styles for each collaborator
    const styleElement = document.createElement('style');
    styleElement.textContent = collaborators.map(collaborator => `
      .collaborator-cursor-${collaborator.id}::before {
        border-left: 2px solid ${collaborator.color};
        content: '';
        position: absolute;
      }
      .collaborator-cursor-${collaborator.id}::after {
        content: '${collaborator.username}';
        position: absolute;
        background: ${collaborator.color};
        color: white;
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 11px;
        top: -20px;
        left: -2px;
        white-space: nowrap;
      }
      .collaborator-selection-${collaborator.id} {
        background-color: ${collaborator.color}33;
      }
    `).join('\n');
    document.head.appendChild(styleElement);

    return () => {
      editor.deltaDecorations(decorations, []);
      document.head.removeChild(styleElement);
    };
  }, [editor, collaborators]);

  // Handle chat message sending
  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user?.id || 'anonymous',
      username: user?.username || 'Anonymous',
      message: messageInput,
      timestamp: new Date(),
      type: 'text',
    };

    // Send via awareness
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('chat', message);
    }

    setChatMessages(prev => [...prev, message]);
    setMessageInput('');
  };

  // Listen for chat messages
  useEffect(() => {
    if (!awarenessRef.current) return;

    const handleChatMessage = () => {
      const states = Array.from(awarenessRef.current.getStates().entries());
      states.forEach(([clientId, state]) => {
        if (state.chat && clientId !== awarenessRef.current.clientID) {
          setChatMessages(prev => {
            const exists = prev.some(msg => msg.id === state.chat.id);
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
            <TabsTrigger value="users" className="text-xs">
              <Users className="h-3.5 w-3.5 mr-1" />
              Users ({collaborators.length + 1})
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="call" className="text-xs">
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
                          <AvatarImage src={user?.avatarUrl} />
                          <AvatarFallback>
                            {user?.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user?.username} (You)</p>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
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
                            <p className="text-sm font-medium">{collaborator.username}</p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
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
                    className={`flex ${message.userId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.userId === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">{message.username}</p>
                      <p className="text-sm">{message.message}</p>
                      <p className="text-xs opacity-70 mt-1">
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
              <div className="text-sm text-muted-foreground">
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