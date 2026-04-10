// @ts-nocheck
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Folder, 
  Users, 
  Settings, 
  Plus, 
  Mail, 
  Calendar,
  Activity,
  Code,
  Globe,
  Lock,
  UserPlus,
  UserMinus,
  Crown,
  Shield,
  User,
  Eye,
  ExternalLink,
  Trash2,
  Download,
  Upload,
  GitBranch,
  Package,
  Zap
} from 'lucide-react';

interface TeamMember {
  id: number;
  userId: number;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

interface TeamProject {
  id: number;
  name: string;
  description: string;
  language: string;
  visibility: 'public' | 'private';
  lastUpdated: string;
}

interface TeamWorkspace {
  id: number;
  name: string;
  description: string;
  projectCount: number;
  createdAt: string;
}

interface Team {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: 'public' | 'private';
  plan: 'free' | 'pro' | 'enterprise';
  memberCount: number;
  projectCount: number;
  workspaceCount: number;
  createdAt: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export default function TeamPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');

  // Fetch team details
  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: [`/api/teams/${id}`],
    enabled: !!id
  });

  // Fetch team members
  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: [`/api/teams/${id}/members`],
    enabled: !!id
  });

  // Fetch team projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<TeamProject[]>({
    queryKey: [`/api/teams/${id}/projects`],
    enabled: !!id
  });

  // Fetch team workspaces
  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery<TeamWorkspace[]>({
    queryKey: [`/api/teams/${id}/workspaces`],
    enabled: !!id
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/teams/${id}/invitations`, {
        email: inviteEmail,
        role: inviteRole
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${id}/members`] });
      toast({
        title: "Invitation sent!",
        description: `Invitation sent to ${inviteEmail}`,
      });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('member');
    },
    onError: (error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('DELETE', `/api/teams/${id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${id}/members`] });
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully.",
      });
    }
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return apiRequest('PATCH', `/api/teams/${id}/members/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${id}/members`] });
      toast({
        title: "Role updated",
        description: "Team member role has been updated.",
      });
    }
  });

  // Create workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/teams/${id}/workspaces`, {
        name: workspaceName,
        description: workspaceDescription
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${id}/workspaces`] });
      toast({
        title: "Workspace created!",
        description: "Your new workspace has been created.",
      });
      setShowCreateWorkspaceDialog(false);
      setWorkspaceName('');
      setWorkspaceDescription('');
    }
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <User className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'member': return 'outline';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  };

  const canManageTeam = team?.role === 'owner' || team?.role === 'admin';

  if (teamLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Team not found</p>
            <Button 
              className="mt-4"
              onClick={() => setLocation('/teams')}
            >
              Back to Teams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {/* Team Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
            <p className="text-muted-foreground mb-4">{team.description}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={team.visibility === 'public' ? 'default' : 'secondary'}>
                {team.visibility === 'public' ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                {team.visibility}
              </Badge>
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {team.memberCount} members
              </Badge>
              <Badge variant="outline">
                <Folder className="h-3 w-3 mr-1" />
                {team.projectCount} projects
              </Badge>
              <Badge variant="outline">
                <Package className="h-3 w-3 mr-1" />
                {team.workspaceCount} workspaces
              </Badge>
              <Badge variant={team.plan === 'enterprise' ? 'default' : team.plan === 'pro' ? 'secondary' : 'outline'}>
                <Zap className="h-3 w-3 mr-1" />
                {team.plan} plan
              </Badge>
            </div>
          </div>
          {canManageTeam && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/teams/${id}/settings`)}
              data-testid="button-team-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid" data-testid="tabs-team">
          <TabsTrigger value="projects" data-testid="tab-projects">Projects</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
          <TabsTrigger value="workspaces" data-testid="tab-workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Team Projects</h2>
            {canManageTeam && (
              <Button size="sm" data-testid="button-create-project">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            )}
          </div>
          
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects yet</p>
                {canManageTeam && (
                  <Button className="mt-4" size="sm">
                    Create your first project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-[15px]">{project.name}</CardTitle>
                      <Badge variant={project.visibility === 'public' ? 'default' : 'secondary'}>
                        {project.visibility}
                      </Badge>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {project.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Team Members</h2>
            {canManageTeam && (
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-invite-member">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your team
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        data-testid="input-invite-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => inviteMemberMutation.mutate()}
                      disabled={!inviteEmail || inviteMemberMutation.isPending}
                      data-testid="button-send-invitation"
                    >
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {membersLoading ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-muted rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-1/3"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {members.map((member) => (
                      <div key={member.id} className="p-4 hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`} />
                              <AvatarFallback>{member.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{member.username}</p>
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  {getRoleIcon(member.role)}
                                  {member.role}
                                </Badge>
                              </div>
                              <p className="text-[13px] text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canManageTeam && member.role !== 'owner' && (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(value) => updateRoleMutation.mutate({ userId: member.userId, role: value })}
                                  disabled={updateRoleMutation.isPending}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Workspaces Tab */}
        <TabsContent value="workspaces" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Workspaces</h2>
            {canManageTeam && (
              <Dialog open={showCreateWorkspaceDialog} onOpenChange={setShowCreateWorkspaceDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create-workspace">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                    <DialogDescription>
                      Create a new workspace to organize your team's projects
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workspace-name">Name</Label>
                      <Input
                        id="workspace-name"
                        placeholder="Frontend Projects"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        data-testid="input-workspace-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workspace-description">Description</Label>
                      <Input
                        id="workspace-description"
                        placeholder="All frontend related projects"
                        value={workspaceDescription}
                        onChange={(e) => setWorkspaceDescription(e.target.value)}
                        data-testid="input-workspace-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createWorkspaceMutation.mutate()}
                      disabled={!workspaceName || createWorkspaceMutation.isPending}
                      data-testid="button-submit-workspace"
                    >
                      Create Workspace
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {workspacesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No workspaces yet</p>
                {canManageTeam && (
                  <Button 
                    className="mt-4" 
                    size="sm"
                    onClick={() => setShowCreateWorkspaceDialog(true)}
                  >
                    Create your first workspace
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <Card key={workspace.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-[15px]">{workspace.name}</CardTitle>
                    <CardDescription>{workspace.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Folder className="h-3 w-3" />
                        {workspace.projectCount} projects
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(workspace.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-8 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Activity tracking coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}