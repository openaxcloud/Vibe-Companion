// @ts-nocheck
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Share2, 
  Link, 
  Copy, 
  Mail,
  Users,
  Globe,
  Lock,
  Eye,
  Edit3,
  UserPlus,
  X,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

interface ProjectSharingProps {
  projectId: number;
  projectName: string;
  className?: string;
}

interface Collaborator {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'pending';
}

type SharePermission = 'private' | 'unlisted' | 'public';

export function ProjectSharing({ projectId, projectName, className }: ProjectSharingProps) {
  const [, navigate] = useLocation();
  const [sharePermission, setSharePermission] = useState<SharePermission>('private');
  const [shareLink, setShareLink] = useState(`https://e-code.ai/u/user/${projectName}`);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const { toast } = useToast();

  const { data: collaboratorsData, isLoading: isLoadingCollaborators } = useQuery<{ collaborators: Collaborator[] }>({
    queryKey: ['/api/projects', projectId, 'collaborators'],
  });
  const collaborators = collaboratorsData?.collaborators || [];

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: 'editor' | 'viewer' }) => {
      return apiRequest('POST', '/api/teams/invite', { email, role, projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'collaborators'] });
      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${inviteEmail}`,
      });
      setInviteEmail('');
    },
    onError: (error: any) => {
      toast({
        title: 'Invitation Failed',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    },
  });

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({
        title: 'Link Copied',
        description: 'Share link copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleInvite = async () => {
    const validationResult = emailSchema.safeParse(inviteEmail);
    if (!validationResult.success) {
      toast({
        title: 'Invalid Email',
        description: validationResult.error.errors[0]?.message || 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const removeCollaborator = (id: string) => {
    toast({
      title: 'Team Management',
      description: 'To remove collaborators, please manage team members through the Teams page.',
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigate('/teams');
          }}
        >
          Go to Teams
        </Button>
      ),
    });
  };

  const updateCollaboratorRole = (id: string, role: 'editor' | 'viewer') => {
    setCollaborators(prev => prev.map(c => 
      c.id === id ? { ...c, role } : c
    ));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Lock className="h-3 w-3" />;
      case 'editor': return <Edit3 className="h-3 w-3" />;
      case 'viewer': return <Eye className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Project
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Share Permissions */}
        <div className="space-y-3">
          <Label>Project Visibility</Label>
          <RadioGroup 
            value={sharePermission} 
            onValueChange={(value) => setSharePermission(value as SharePermission)}
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="private" id="private" />
              <div className="flex-1">
                <Label htmlFor="private" className="flex items-center gap-2 cursor-pointer">
                  <Lock className="h-4 w-4" />
                  Private
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Only you and invited collaborators can access
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="unlisted" id="unlisted" />
              <div className="flex-1">
                <Label htmlFor="unlisted" className="flex items-center gap-2 cursor-pointer">
                  <Link className="h-4 w-4" />
                  Unlisted
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Anyone with the link can view
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="public" id="public" />
              <div className="flex-1">
                <Label htmlFor="public" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  Public
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Anyone can find and view this project
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Share Link */}
        {sharePermission !== 'private' && (
          <>
            <div className="space-y-3">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="font-mono text-[13px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyShareLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Invite Collaborators */}
        <div className="space-y-3">
          <Label>Invite Collaborators</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className="px-3 py-2 border rounded-md text-[13px]"
              aria-label="Select collaborator permission level"
            >
              <option value="editor">Can Edit</option>
              <option value="viewer">Can View</option>
            </select>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviteMutation.isPending || !inviteEmail}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
            </Button>
          </div>
        </div>

        {/* Collaborators List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Collaborators</Label>
            <Badge variant="secondary">{collaborators.length} members</Badge>
          </div>
          
          <ScrollArea className="h-[200px]">
            {isLoadingCollaborators ? (
              <div className="flex items-center justify-center h-full py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : collaborators.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-[13px] font-medium text-muted-foreground">No collaborators yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">Invite team members to collaborate on this project</p>
              </div>
            ) : (
            <div className="space-y-2">
              {collaborators.map(collaborator => (
                <div
                  key={collaborator.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={collaborator.avatar} />
                      <AvatarFallback>
                        {collaborator.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[13px] font-medium">{collaborator.username}</p>
                      <p className="text-[11px] text-muted-foreground">{collaborator.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {collaborator.status === 'pending' && (
                      <Badge variant="secondary" className="text-[11px]">
                        Pending
                      </Badge>
                    )}
                    
                    {collaborator.role === 'owner' ? (
                      <Badge variant="default" className="text-[11px]">
                        {getRoleIcon(collaborator.role)}
                        <span className="ml-1">Owner</span>
                      </Badge>
                    ) : (
                      <>
                        <select
                          value={collaborator.role}
                          onChange={(e) => updateCollaboratorRole(
                            collaborator.id, 
                            e.target.value as 'editor' | 'viewer'
                          )}
                          className="text-[11px] border rounded px-2 py-1"
                          aria-label={`Change ${collaborator.username}'s permission level`}
                        >
                          <option value="editor">Can Edit</option>
                          <option value="viewer">Can View</option>
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => removeCollaborator(collaborator.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}