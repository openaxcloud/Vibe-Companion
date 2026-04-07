import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Search, 
  Crown, 
  UserPlus, 
  Settings,
  MoreHorizontal,
  Shield,
  Eye,
  Lock,
  Globe,
  Calendar,
  Mail,
  ExternalLink
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { PageHeader, PageShell } from '@/components/layout/PageShell';

interface Team {
  id: number;
  name: string;
  description: string;
  avatar: string;
  memberCount: number;
  projectCount: number;
  visibility: 'public' | 'private';
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created: string;
  plan: 'free' | 'pro' | 'enterprise';
}

interface TeamInvitation {
  id: number;
  teamName: string;
  inviterName: string;
  role: string;
  sent: string;
}

export default function Teams() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamVisibility, setNewTeamVisibility] = useState<'public' | 'private'>('private');

  // Fetch user's teams
  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  // Fetch team invitations
  const { data: invitations = [] } = useQuery<TeamInvitation[]>({
    queryKey: ['/api/teams/invitations'],
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({
        title: "Team created!",
        description: "Your new team has been created successfully.",
      });
      setShowCreateDialog(false);
      setNewTeamName('');
      setNewTeamDescription('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Join team mutation
  const joinTeamMutation = useMutation({
    mutationFn: async (invitation: TeamInvitation) => {
      // For now, use invitation ID as token - in production, this should be a secure token
      return apiRequest('POST', `/api/teams/invitations/${invitation.id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams/invitations'] });
      toast({
        title: "Team joined!",
        description: "You've successfully joined the team.",
      });
    }
  });

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    
    createTeamMutation.mutate({
      name: newTeamName,
      description: newTeamDescription,
      visibility: newTeamVisibility
    });
  };

  const handleJoinTeam = (invitation: TeamInvitation) => {
    joinTeamMutation.mutate(invitation);
  };

  // Decline invitation mutation
  const declineInvitationMutation = useMutation({
    mutationFn: async (invitation: TeamInvitation) => {
      return apiRequest('POST', `/api/teams/invitations/${invitation.id}/decline`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/invitations'] });
      toast({
        title: "Invitation declined",
        description: "You've declined the team invitation.",
      });
    }
  });

  const handleDeclineInvitation = (invitation: TeamInvitation) => {
    declineInvitationMutation.mutate(invitation);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    return visibility === 'public' ? 
      <Globe className="h-4 w-4 text-green-500" /> : 
      <Lock className="h-4 w-4 text-gray-500" />;
  };

  const getPlanBadge = (plan: string) => {
    const colors = {
      free: 'bg-gray-500',
      pro: 'bg-blue-500', 
      enterprise: 'bg-purple-500'
    };
    return <Badge className={`${colors[plan as keyof typeof colors]} text-white`}>{plan.toUpperCase()}</Badge>;
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Teams"
          description="Collaborate with teammates and manage shared workspaces."
          icon={Users}
        />
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-muted"></div>
          <div className="h-4 w-1/2 rounded bg-muted"></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-48 rounded-lg bg-muted"></div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        description="Collaborate with your team on projects and share resources."
        icon={Users}
        actions={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-2" onClick={() => setShowCreateDialog(true)} data-testid="button-create-team">
              <Plus className="h-4 w-4" />
              Create team
            </Button>
            <Button className="gap-2" onClick={() => navigate('/teams/new')} data-testid="button-invite-members">
              <UserPlus className="h-4 w-4" />
              Invite members
            </Button>
          </div>
        )}
      />

      {/* Invitations */}
      {invitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Team Invitations ({invitations.length})
            </CardTitle>
            <CardDescription>
              You have pending team invitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{invitation.teamName}</div>
                  <div className="text-[13px] text-muted-foreground">
                    Invited by {invitation.inviterName} as {invitation.role}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(invitation.sent).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleJoinTeam(invitation)}
                    disabled={joinTeamMutation.isPending}
                    data-testid={`button-accept-invitation-${invitation.id}`}
                  >
                    Accept
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDeclineInvitation(invitation)}
                    disabled={declineInvitationMutation.isPending}
                    data-testid={`button-decline-invitation-${invitation.id}`}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-teams"
          />
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-testid="button-create-team-dialog">
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a team to collaborate with others on projects
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="My Awesome Team"
                  data-testid="input-new-team-name"
                />
              </div>
              <div>
                <Label htmlFor="team-description">Description (Optional)</Label>
                <Input
                  id="team-description"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="What does your team work on?"
                  data-testid="input-new-team-description"
                />
              </div>
              <div>
                <Label>Visibility</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={newTeamVisibility === 'private' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewTeamVisibility('private')}
                    className="flex items-center gap-2"
                    data-testid="button-visibility-private"
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </Button>
                  <Button
                    variant={newTeamVisibility === 'public' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewTeamVisibility('public')}
                    className="flex items-center gap-2"
                    data-testid="button-visibility-public"
                  >
                    <Globe className="h-4 w-4" />
                    Public
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                  data-testid="button-cancel-create-team"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim() || createTeamMutation.isPending}
                  data-testid="button-submit-create-team"
                >
                  {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-[15px] font-medium mb-2">No teams found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No teams match your search.' : 'Create your first team to get started.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-team">
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-team-${team.id}`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={team.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                        {team.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-[15px]">{team.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {getRoleIcon(team.role)}
                        <span className="text-[11px] text-muted-foreground capitalize">{team.role}</span>
                        {getVisibilityIcon(team.visibility)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPlanBadge(team.plan)}
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="line-clamp-2">
                  {team.description || 'No description provided'}
                </CardDescription>
                
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {team.memberCount} members
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-4 rounded bg-blue-500"></div>
                      {team.projectCount} projects
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Created {new Date(team.created).toLocaleDateString()}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => window.location.href = `/teams/${team.id}`}
                    data-testid={`button-open-team-${team.id}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                  {(team.role === 'owner' || team.role === 'admin') && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.location.href = `/teams/${team.id}/settings`}
                      data-testid={`button-settings-team-${team.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}