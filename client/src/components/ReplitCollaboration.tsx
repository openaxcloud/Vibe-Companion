import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, UserPlus, Crown, Settings, MessageCircle, 
  Video, Mic, MicOff, VideoOff, Share2, Eye,
  Clock, Activity, Lock, Unlock, Copy, Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Collaborator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    color: string;
  };
}

interface ReplitCollaborationProps {
  projectId: number;
  isOwner: boolean;
}

export function ReplitCollaboration({ projectId, isOwner }: ReplitCollaborationProps) {
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetchCollaborators();
    generateShareLink();
  }, [projectId]);

  const fetchCollaborators = async () => {
    try {
      const response = await fetch(`/api/collaboration/${projectId}/users`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data.collaborators || []);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  };

  const generateShareLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/project/${projectId}?invite=true`;
    setShareLink(link);
  };

  const inviteCollaborator = async () => {
    if (!inviteEmail.trim()) return;

    try {
      const response = await apiRequest('POST', `/api/collaboration/${projectId}/invite`, { 
        email: inviteEmail,
        role: 'editor' 
      });

      if (response.ok) {
        toast({
          title: "Invitation Sent",
          description: `Invited ${inviteEmail} to collaborate`
        });
        setInviteEmail('');
        fetchCollaborators();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      });
    }
  };

  const updateCollaboratorRole = async (collaboratorId: string, role: string) => {
    try {
      const response = await apiRequest('PATCH', `/api/collaboration/${projectId}/users/${collaboratorId}`, { role });

      if (response.ok) {
        fetchCollaborators();
        toast({
          title: "Role Updated",
          description: `Collaborator role changed to ${role}`
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive"
      });
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/collaboration/${projectId}/users/${collaboratorId}`);

      if (response.ok) {
        fetchCollaborators();
        toast({
          title: "Collaborator Removed",
          description: "Collaborator has been removed from the project"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove collaborator",
        variant: "destructive"
      });
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard"
    });
  };

  const toggleVoiceChat = () => {
    setIsVoiceConnected(!isVoiceConnected);
    toast({
      title: isVoiceConnected ? "Voice Chat Disconnected" : "Voice Chat Connected",
      description: isVoiceConnected ? "Left voice channel" : "Joined voice channel"
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'editor': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'viewer': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="collaborators" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="voice">Voice & Video</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="space-y-4">
          {/* Invite Section */}
          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Collaborators
                </CardTitle>
                <CardDescription>
                  Invite team members to collaborate on this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && inviteCollaborator()}
                  />
                  <Button onClick={inviteCollaborator} disabled={!inviteEmail.trim()}>
                    Invite
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Collaborators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Collaborators ({collaborators.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {collaborators.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground text-center py-4">
                    No collaborators yet. Invite team members to get started!
                  </p>
                ) : (
                  collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={collaborator.avatarUrl} />
                            <AvatarFallback>
                              {collaborator.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(collaborator.status)}`} />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{collaborator.displayName}</span>
                            {collaborator.role === 'owner' && (
                              <Crown className="h-3 w-3 text-yellow-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>@{collaborator.username}</span>
                            <span>•</span>
                            <span className="capitalize">{collaborator.status}</span>
                            {collaborator.status !== 'online' && (
                              <>
                                <span>•</span>
                                <span>Last seen {new Date(collaborator.lastSeen).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={`${getRoleColor(collaborator.role)} border text-[11px]`}>
                          {collaborator.role}
                        </Badge>
                        
                        {isOwner && collaborator.role !== 'owner' && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCollaboratorRole(collaborator.id, 
                                collaborator.role === 'editor' ? 'viewer' : 'editor'
                              )}
                            >
                              {collaborator.role === 'editor' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeCollaborator(collaborator.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          {/* Voice & Video Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" />
                Voice & Video Chat
              </CardTitle>
              <CardDescription>
                Communicate with your team in real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Voice Chat</p>
                  <p className="text-[13px] text-muted-foreground">
                    {isVoiceConnected ? 'Connected to voice channel' : 'Join voice channel to talk with collaborators'}
                  </p>
                </div>
                <Button
                  variant={isVoiceConnected ? "destructive" : "default"}
                  onClick={toggleVoiceChat}
                >
                  {isVoiceConnected ? 'Leave' : 'Join'} Voice
                </Button>
              </div>

              {isVoiceConnected && (
                <div className="flex gap-2 p-3 bg-muted rounded-lg">
                  <Button
                    variant={isMicEnabled ? "default" : "destructive"}
                    size="sm"
                    onClick={() => setIsMicEnabled(!isMicEnabled)}
                  >
                    {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant={isVideoEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  >
                    {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Voice Participants */}
          {isVoiceConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voice Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {collaborators.filter(c => c.status === 'online').map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center gap-3 p-2 border rounded">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={collaborator.avatarUrl} />
                        <AvatarFallback className="text-[11px]">
                          {collaborator.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px]">{collaborator.displayName}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <Activity className="h-3 w-3 text-green-500" />
                        <span className="text-[11px] text-muted-foreground">Speaking</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sharing" className="space-y-4">
          {/* Share Link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share Project
              </CardTitle>
              <CardDescription>
                Share this project with others using a direct link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="font-mono text-[13px]"
                />
                <Button onClick={copyShareLink} variant="outline">
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-[13px] font-medium text-blue-800">Public Access</span>
                </div>
                <p className="text-[13px] text-blue-700">
                  Anyone with this link can view the project. Only invited collaborators can edit.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Project Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Public Visibility</p>
                  <p className="text-[13px] text-muted-foreground">Anyone can view this project</p>
                </div>
                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                  Enabled
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Fork Protection</p>
                  <p className="text-[13px] text-muted-foreground">Prevent others from forking this project</p>
                </div>
                <Badge variant="outline" className="text-gray-600 bg-gray-50 border-gray-200">
                  Disabled
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Download Protection</p>
                  <p className="text-[13px] text-muted-foreground">Prevent others from downloading project files</p>
                </div>
                <Badge variant="outline" className="text-gray-600 bg-gray-50 border-gray-200">
                  Disabled
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}