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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Teams Sidebar */}
      <div className="w-64 border-r bg-background p-4">
        <div className="mb-4">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Teams</h3>
          {mockTeams.map((team) => (
            <Card
              key={team.id}
              className={`cursor-pointer transition-all ${
                selectedTeam?.id === team.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedTeam(team)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{team.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {team.members} members • {team.projects} projects
                    </p>
                  </div>
                  {getRoleBadge(team.role)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {selectedTeam ? (
          <div>
            {/* Team Header */}
            <div className="border-b p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedTeam.avatar || undefined} />
                    <AvatarFallback className="text-2xl">
                      {selectedTeam.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-bold">{selectedTeam.name}</h1>
                    <p className="text-muted-foreground">{selectedTeam.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {selectedTeam.members} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Code2 className="h-4 w-4" />
                        {selectedTeam.projects} projects
                      </span>
                      <span>Created {selectedTeam.created}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTeam.plan === 'pro' && (
                    <Badge variant="secondary" className="gap-1 bg-gradient-to-r from-purple-500 to-pink-500">
                      <Crown className="h-3 w-3" />
                      Pro Team
                    </Badge>
                  )}
                  {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Team Content */}
            <Tabs defaultValue="members" className="p-6">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4">
                {/* Invite Member Button */}
                {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Team Members</h3>
                    <Button onClick={() => setIsInviteOpen(true)} size="sm" className="gap-2">
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.avatar || undefined} />
                              <AvatarFallback>
                                {member.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{member.username}</h4>
                                {getRoleBadge(member.role)}
                              </div>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="text-right">
                              <p>{member.contributions} contributions</p>
                              <p>Active {member.lastActive}</p>
                            </div>
                            {selectedTeam.role === 'owner' && member.role !== 'owner' && (
                              <Button variant="ghost" size="icon">
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

              <TabsContent value="projects" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-base">Project {i}</CardTitle>
                        <CardDescription>A collaborative project</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
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

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Activity feed coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                {selectedTeam.role === 'owner' ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Team Name</Label>
                          <Input defaultValue={selectedTeam.name} />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea defaultValue={selectedTeam.description} />
                        </div>
                        <Button>Save Changes</Button>
                      </CardContent>
                    </Card>

                    <Card className="border-destructive">
                      <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button variant="destructive">Delete Team</Button>
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
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No team selected</h3>
              <p className="text-muted-foreground">
                Select a team from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
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
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="What's your team about?"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsCreateOpen(false)}>
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
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
              />
            </div>
            <div className="p-4 border bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Or share this invite link:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  readOnly
                  value={`https://replit.com/team/invite/${selectedTeam?.id}`}
                />
                <Button size="icon" variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsInviteOpen(false)}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}