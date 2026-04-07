import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Users,
  Settings,
  Crown,
  Shield,
  Mail,
  Link,
  Code2,
  GitBranch,
  Activity,
  UserPlus,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Mock data for teams
const mockTeams = [
  {
    id: 1,
    name: 'Web Dev Squad',
    description: 'Building amazing web applications together',
    members: 5,
    projects: 12,
    role: 'owner',
    plan: 'pro',
    avatar: null,
    created: '2024-01-15',
  },
  {
    id: 2,
    name: 'ML Research Team',
    description: 'Exploring the frontiers of machine learning',
    members: 8,
    projects: 23,
    role: 'admin',
    plan: 'pro',
    avatar: null,
    created: '2024-03-20',
  },
  {
    id: 3,
    name: 'Open Source Contributors',
    description: 'Contributing to open source projects',
    members: 15,
    projects: 45,
    role: 'member',
    plan: 'free',
    avatar: null,
    created: '2024-06-10',
  },
];

const teamMembers = [
  {
    id: 1,
    username: 'alex_dev',
    email: 'alex@example.com',
    role: 'owner',
    joinedAt: '2024-01-15',
    lastActive: '5 minutes ago',
    contributions: 234,
    avatar: null,
  },
  {
    id: 2,
    username: 'sarah_coder',
    email: 'sarah@example.com',
    role: 'admin',
    joinedAt: '2024-01-20',
    lastActive: '2 hours ago',
    contributions: 189,
    avatar: null,
  },
  {
    id: 3,
    username: 'mike_tech',
    email: 'mike@example.com',
    role: 'member',
    joinedAt: '2024-02-10',
    lastActive: '1 day ago',
    contributions: 67,
    avatar: null,
  },
  {
    id: 4,
    username: 'emma_design',
    email: 'emma@example.com',
    role: 'member',
    joinedAt: '2024-03-05',
    lastActive: '3 days ago',
    contributions: 45,
    avatar: null,
  },
];

export default function Teams() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedTeam, setSelectedTeam] = useState(mockTeams[0]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { icon: any; color: string }> = {
      owner: { icon: Crown, color: 'bg-yellow-500' },
      admin: { icon: Shield, color: 'bg-blue-500' },
      member: { icon: Users, color: 'bg-gray-500' },
    };
    const { icon: Icon, color } = variants[role] || variants.member;
    return (
      <Badge variant="secondary" className={`gap-1 ${color}`}>
        <Icon className="h-3 w-3" />
        {role}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Teams Sidebar */}
          <div className="w-full lg:w-80 xl:w-96 space-y-4">
            <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:gap-0">
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="w-full gap-2 lg:mb-4"
              >
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Your Teams</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {mockTeams.map((team) => (
                  <Card
                    key={team.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTeam?.id === team.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedTeam(team)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{team.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {team.members} members • {team.projects} projects
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {getRoleBadge(team.role)}
                            <Badge variant="outline" className="text-xs">
                              {team.plan}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 lg:min-w-0">
            {selectedTeam ? (
              <Card>
                <CardContent className="p-0">
                  {/* Team Header */}
                  <div className="border-b p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                          <AvatarImage src={selectedTeam.avatar || undefined} />
                          <AvatarFallback className="text-lg sm:text-2xl">
                            {selectedTeam.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h1 className="text-xl sm:text-2xl font-bold truncate">{selectedTeam.name}</h1>
                          <p className="text-muted-foreground text-sm sm:text-base mt-1">{selectedTeam.description}</p>
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {selectedTeam.members} members
                            </span>
                            <span className="flex items-center gap-1">
                              <Code2 className="h-4 w-4" />
                              {selectedTeam.projects} projects
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {selectedTeam.plan}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 self-start">
                        <Button
                          onClick={() => setIsInviteOpen(true)}
                          size="sm"
                          className="gap-2 flex-1 sm:flex-none"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span className="hidden sm:inline">Invite Member</span>
                          <span className="sm:hidden">Invite</span>
                        </Button>
                        <Button variant="outline" size="sm" className="px-3">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Team Content */}
                  <div className="p-4 sm:p-6">
                    <Tabs defaultValue="members">
                      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
                        <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
                        <TabsTrigger value="projects" className="text-xs sm:text-sm">Projects</TabsTrigger>
                        <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
                        <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
                      </TabsList>

                      <TabsContent value="members" className="space-y-4 mt-0">
                        {/* Invite Member Button */}
                        {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                            <h3 className="text-lg font-semibold">Team Members</h3>
                            <Button onClick={() => setIsInviteOpen(true)} size="sm" className="gap-2 w-full sm:w-auto">
                              <UserPlus className="h-4 w-4" />
                              Invite Member
                            </Button>
                          </div>
                        )}

                        {/* Members List */}
                        <div className="space-y-3">
                          {teamMembers.map((member) => (
                            <Card key={member.id}>
                              <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <Avatar className="flex-shrink-0">
                                      <AvatarImage src={member.avatar || undefined} />
                                      <AvatarFallback>
                                        {member.username[0].toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                        <h4 className="font-semibold truncate">{member.username}</h4>
                                        {getRoleBadge(member.role)}
                                      </div>
                                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                        <span>Joined {member.joinedAt}</span>
                                        <span>Active {member.lastActive}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Badge variant="outline" className="text-xs">
                                        {member.contributions} contributions
                                      </Badge>
                                    </div>
                                    {(selectedTeam.role === 'owner' || (selectedTeam.role === 'admin' && member.role !== 'owner')) && (
                                      <Button variant="ghost" size="sm" className="p-2">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="projects" className="space-y-4 mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Project {i}</CardTitle>
                                <CardDescription>A collaborative project</CardDescription>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <GitBranch className="h-3 w-3" />
                                    main
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    Updated 2h ago
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="activity" className="space-y-4 mt-0">
                        <Card>
                          <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-muted-foreground">Activity feed coming soon...</p>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="settings" className="space-y-4 mt-0">
                        {selectedTeam.role === 'owner' ? (
                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <CardTitle>Team Settings</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <Label>Team Name</Label>
                                    <Input defaultValue={selectedTeam.name} className="mt-1" />
                                  </div>
                                  <div>
                                    <Label>Description</Label>
                                    <Textarea defaultValue={selectedTeam.description} className="mt-1" />
                                  </div>
                                  <Button className="w-full sm:w-auto">Save Changes</Button>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-destructive">
                              <CardHeader>
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <Button variant="destructive" className="w-full sm:w-auto">Delete Team</Button>
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <Card>
                            <CardContent className="p-6">
                              <p className="text-muted-foreground">
                                Only team owners can access settings.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-64">
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No team selected</h3>
                    <p className="text-muted-foreground text-sm">
                      Select a team from above or create a new one
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create a New Team</DialogTitle>
            <DialogDescription>
              Teams allow you to collaborate with others on projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input
                placeholder="My Awesome Team"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="What's your team about?"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={() => setIsCreateOpen(false)} className="w-full sm:w-auto">
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to join {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="p-3 sm:p-4 border bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Or share this invite link:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                <Input
                  readOnly
                  value={`https://e-code.com/team/invite/${selectedTeam?.id}`}
                  className="text-xs sm:text-sm"
                />
                <Button size="sm" variant="outline" className="px-3">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={() => setIsInviteOpen(false)} className="w-full sm:w-auto">
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}