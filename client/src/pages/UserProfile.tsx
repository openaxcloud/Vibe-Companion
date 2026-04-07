import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  User, Shield, Code, Clock, Star, GitBranch, 
  Package, Trophy, Users, Eye, Settings, Edit,
  Calendar, MapPin, Link as LinkIcon, Twitter,
  Github, Globe, MessageSquare, Heart, Share2,
  ChevronRight, TrendingUp, Activity, Zap, Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';
import { ECodeLoading } from '@/components/ECodeLoading';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  twitter?: string;
  github?: string;
  joinedAt: string;
  stats: {
    projects: number;
    stars: number;
    followers: number;
    following: number;
    contributions: number;
    deployments: number;
  };
  badges: {
    id: string;
    name: string;
    icon: string;
    earnedAt: string;
  }[];
  recentActivity: {
    id: string;
    type: 'project' | 'comment' | 'star' | 'follow' | 'deployment';
    description: string;
    timestamp: string;
    projectId?: number;
    projectName?: string;
  }[];
  topProjects: {
    id: number;
    name: string;
    description: string;
    language: string;
    stars: number;
    forks: number;
    updatedAt: string;
  }[];
}

export default function UserProfile() {
  const { username } = useParams();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading, error} = useQuery<UserProfile>({
    queryKey: ['/api/users', username],
    queryFn: async () => {
      return await apiRequest('GET', `/api/users/username/${username}`);
    },
    enabled: !!username
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async (action: 'follow' | 'unfollow') => {
      // apiRequest already returns parsed JSON and throws on !ok
      return await apiRequest('POST', `/api/users/${username}/${action}`);
    },
    onSuccess: (_, action) => {
      setIsFollowing(action === 'follow');
      queryClient.invalidateQueries({ queryKey: ['/api/users', username] });
      toast({
        title: action === 'follow' ? 'Following' : 'Unfollowed',
        description: `You ${action === 'follow' ? 'are now following' : 'unfollowed'} ${profile?.displayName || username}`
      });
    }
  });

  const isOwnProfile = currentUser?.username === username;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">E-Code Clone</Link>
            <div className="flex items-center gap-4">
              <Link href="/projects" className="text-[13px]">Projects</Link>
              <Link href="/settings" className="text-[13px]">Settings</Link>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <ECodeLoading centered size="lg" text="Loading user profile..." />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">E-Code Clone</Link>
            <div className="flex items-center gap-4">
              <Link href="/projects" className="text-[13px]">Projects</Link>
              <Link href="/settings" className="text-[13px]">Settings</Link>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">User not found</h2>
              <p className="text-muted-foreground mb-4">
                The user @{username} could not be found.
              </p>
              <Button onClick={() => navigate('/')} data-testid="button-go-home">
                Go to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container-responsive py-4 flex items-center justify-between">
          <Link href="/" className="text-responsive-lg font-bold">E-Code</Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/projects" className="text-responsive-xs">Projects</Link>
            <Link href="/settings" className="text-responsive-xs">Settings</Link>
          </div>
        </div>
      </header>
      <div className="container-responsive py-responsive max-w-7xl mb-16 md:mb-0">
        {/* Profile Header */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:space-x-6 mb-4 md:mb-0">
                <Avatar className="h-32 w-32" data-testid="avatar-user-profile">
                  <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                  <AvatarFallback className="text-3xl">
                    {profile.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold mb-1">{profile.displayName}</h1>
                  <p className="text-xl text-muted-foreground mb-3">@{profile.username}</p>
                  {profile.bio && (
                    <p className="text-muted-foreground mb-4 max-w-2xl">{profile.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground">
                    {profile.location && (
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {profile.location}
                      </span>
                    )}
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" 
                         className="flex items-center hover:text-primary">
                        <Globe className="h-4 w-4 mr-1" />
                        Website
                      </a>
                    )}
                    {profile.github && (
                      <a href={`https://github.com/${profile.github}`} target="_blank" 
                         rel="noopener noreferrer" className="flex items-center hover:text-primary">
                        <Github className="h-4 w-4 mr-1" />
                        {profile.github}
                      </a>
                    )}
                    {profile.twitter && (
                      <a href={`https://twitter.com/${profile.twitter}`} target="_blank" 
                         rel="noopener noreferrer" className="flex items-center hover:text-primary">
                        <Twitter className="h-4 w-4 mr-1" />
                        {profile.twitter}
                      </a>
                    )}
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Joined {new Date(profile.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {isOwnProfile ? (
                  <Button onClick={() => navigate('/settings')} data-testid="button-edit-profile">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant={isFollowing ? 'outline' : 'default'}
                      onClick={() => followMutation.mutate(isFollowing ? 'unfollow' : 'follow')}
                      data-testid="button-follow"
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" data-testid="button-share-menu">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem data-testid="menu-item-copy-link">
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Copy profile link
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid="menu-item-send-message">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>

            {/* Stats - Responsive Grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.projects}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Projects</div>
              </div>
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.stars}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Stars</div>
              </div>
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.followers}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Followers</div>
              </div>
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.following}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Following</div>
              </div>
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.contributions}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Contrib.</div>
              </div>
              <div className="text-center p-2 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-[15px] sm:text-2xl font-bold">{profile.stats.deployments}</div>
                <div className="text-[11px] sm:text-[13px] text-muted-foreground">Deploys</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-user-profile">
          {/* Scrollable tabs on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 mb-4 sm:mb-6">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="overview" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="projects" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-projects">Projects</TabsTrigger>
              <TabsTrigger value="activity" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-activity">Activity</TabsTrigger>
              <TabsTrigger value="achievements" className="flex-shrink-0 px-4 sm:px-3 text-[13px] whitespace-nowrap" data-testid="tab-achievements">Achievements</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Projects */}
              <Card>
                <CardHeader>
                  <CardTitle>Popular Projects</CardTitle>
                  <CardDescription>Most starred repositories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.topProjects.map(project => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/ide/${project.id}`)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-[13px] text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-[13px] text-muted-foreground">
                          <span className="flex items-center">
                            <Code className="h-3 w-3 mr-1" />
                            {project.language}
                          </span>
                          <span className="flex items-center">
                            <Star className="h-3 w-3 mr-1" />
                            {project.stars}
                          </span>
                          <span className="flex items-center">
                            <GitBranch className="h-3 w-3 mr-1" />
                            {project.forks}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest actions and contributions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {profile.recentActivity.map(activity => (
                        <div key={activity.id} className="flex items-start space-x-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            {activity.type === 'project' && <Package className="h-4 w-4" />}
                            {activity.type === 'star' && <Star className="h-4 w-4" />}
                            {activity.type === 'comment' && <MessageSquare className="h-4 w-4" />}
                            {activity.type === 'follow' && <Users className="h-4 w-4" />}
                            {activity.type === 'deployment' && <Rocket className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-[13px]">{activity.description}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Contribution Graph */}
            <Card>
              <CardHeader>
                <CardTitle>Contribution Activity</CardTitle>
                <CardDescription>Code contributions over the last year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded flex items-center justify-center">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Contribution graph coming soon</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Browse all public projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {profile.topProjects.map(project => (
                    <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => navigate(`/ide/${project.id}`)}>
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-2">{project.name}</h3>
                        <p className="text-[13px] text-muted-foreground mb-3 line-clamp-2">
                          {project.description}
                        </p>
                        <div className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center">
                              <Code className="h-3 w-3 mr-1" />
                              {project.language}
                            </span>
                            <span className="flex items-center">
                              <Star className="h-3 w-3 mr-1" />
                              {project.stars}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            Updated {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Detailed activity history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {profile.recentActivity.map((activity, index) => (
                    <div key={activity.id} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          {activity.type === 'project' && <Package className="h-5 w-5" />}
                          {activity.type === 'star' && <Star className="h-5 w-5" />}
                          {activity.type === 'comment' && <MessageSquare className="h-5 w-5" />}
                          {activity.type === 'follow' && <Users className="h-5 w-5" />}
                          {activity.type === 'deployment' && <Rocket className="h-5 w-5" />}
                        </div>
                        {index < profile.recentActivity.length - 1 && (
                          <div className="w-px h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <p className="font-medium mb-1">{activity.description}</p>
                        {activity.projectName && (
                          <Button 
                            variant="link" 
                            className="p-0 h-auto text-[13px]"
                            onClick={() => navigate(`/ide/${activity.projectId}`)}
                          >
                            {activity.projectName}
                          </Button>
                        )}
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Achievements & Badges</CardTitle>
                <CardDescription>Recognition for contributions and milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {profile.badges.map(badge => (
                    <Card key={badge.id} className="text-center p-4">
                      <div className="text-4xl mb-2">{badge.icon}</div>
                      <h4 className="font-medium text-[13px]">{badge.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(badge.earnedAt).toLocaleDateString()}
                      </p>
                    </Card>
                  ))}
                </div>
                
                {profile.badges.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No achievements yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}