// @ts-nocheck
import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import {
  GitBranch,
  Star,
  GitFork,
  Clock,
  MapPin,
  Link as LinkIcon,
  Mail,
  Twitter,
  Github,
  Users,
  Code2,
  Zap,
  Trophy,
  Target,
  TrendingUp,
  Calendar as CalendarIcon,
  BarChart3,
  Activity,
  Crown,
  Shield,
  Award,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function Profile() {
  const [, navigate] = useLocation();
  const { username } = useParams() as { username?: string };
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const isOwnProfile = !username || username === currentUser?.username;
  
  // Fetch user profile
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['/api/users', username || currentUser?.username],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/users/username/${username || currentUser?.username}`);
      return response;
    },
    enabled: !!(username || currentUser?.username),
  });
  
  // Fetch user's projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/users', username || currentUser?.username, 'projects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/projects');
      // res is expected to be { projects: [...], pagination: {...} }
      return res;
    },
    enabled: !!(username || currentUser?.username),
  });

  const projects = Array.isArray(projectsData?.projects) ? projectsData.projects : [];

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'JavaScript': 'bg-yellow-500',
      'TypeScript': 'bg-blue-500',
      'Python': 'bg-green-500',
      'React': 'bg-cyan-500',
      'Java': 'bg-orange-500',
      'Go': 'bg-cyan-600',
      'Rust': 'bg-red-500',
    };
    return colors[language] || 'bg-gray-500';
  };

  // Fetch user activity data
  const { data: activityData = [], isLoading: activityLoading } = useQuery({
    queryKey: ['/api/users', username || currentUser?.username, 'activity'],
    queryFn: async () => {
      // Fallback for activity data
      return Array.from({ length: 52 }, (_, i) => ({
        week: i,
        contributions: Math.floor(Math.random() * 20),
      }));
    },
    enabled: !!(username || currentUser?.username),
  });

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="profile-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Profile not found
  if (!profile || profileError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="profile-not-found">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
          <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/')} className="mt-4" data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="profile-page">
      {/* Profile Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar and basic info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-24 w-24" data-testid="avatar-profile">
                <AvatarImage src={profile?.avatarUrl || undefined} />
                <AvatarFallback className="text-3xl">
                  {(profile?.displayName || profile?.username || 'U')?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold" data-testid="text-display-name">{profile?.displayName || profile?.username}</h1>
                  {(profile?.badges || []).map((badge: { id: string; icon: any; name: string; color: string }) => {
                    const Icon = badge?.icon;
                    if (!Icon) return null;
                    return (
                      <span key={badge?.id} title={badge?.name}>
                        <Icon
                          className={`h-5 w-5 ${badge?.color || ""}`}
                        />
                      </span>
                    );
                  })}
                </div>
                <p className="text-muted-foreground mb-3" data-testid="text-username">@{profile?.username || "unknown"}</p>
                <p className="mb-4" data-testid="text-bio">{profile?.bio || ""}</p>
                
                {/* Contact and social */}
                <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground mb-4">
                  {profile?.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.location}
                    </span>
                  )}
                  {profile?.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <LinkIcon className="h-4 w-4" />
                      {profile.website.replace('https://', '')}
                    </a>
                  )}
                  {profile?.twitter && (
                    <a
                      href={`https://twitter.com/${profile.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Twitter className="h-4 w-4" />
                      {profile.twitter}
                    </a>
                  )}
                  {profile?.github && (
                    <a
                      href={`https://github.com/${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Github className="h-4 w-4" />
                      {profile.github}
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isOwnProfile ? (
                    <Button onClick={() => navigate('/settings')} data-testid="button-edit-profile">
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button data-testid="button-follow">Follow</Button>
                      <Button variant="outline" data-testid="button-message">Message</Button>
                    </>
                  )}
                </div>
              </div>
            </div>

              {/* Stats */}
            <div className="flex gap-6 md:ml-auto" data-testid="profile-stats">
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="stat-repls">{profile?.stats?.repls || 0}</div>
                <div className="text-[13px] text-muted-foreground">Repls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="stat-followers">{profile?.stats?.followers || 0}</div>
                <div className="text-[13px] text-muted-foreground">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="stat-following">{profile?.stats?.following || 0}</div>
                <div className="text-[13px] text-muted-foreground">Following</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" data-testid="stat-stars">{profile?.stats?.stars || 0}</div>
                <div className="text-[13px] text-muted-foreground">Stars</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="profile-tabs">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="repls" data-testid="tab-repls">Repls</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Contribution graph */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contribution Activity</CardTitle>
                    <CardDescription>
                      {profile?.stats?.streak || 0} day streak 🔥
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-52 gap-1">
                      {(activityData || []).map((week: { week: number; contributions: number }) => (
                        <div
                          key={week.week}
                          className={`h-3 w-3 rounded-sm ${
                            week.contributions === 0
                              ? 'bg-muted'
                              : week.contributions < 5
                              ? 'bg-green-300'
                              : week.contributions < 10
                              ? 'bg-green-400'
                              : week.contributions < 15
                              ? 'bg-green-500'
                              : 'bg-green-600'
                          }`}
                          title={`Week ${week.week + 1}: ${week.contributions} contributions`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Last 52 weeks of activity
                    </p>
                  </CardContent>
                </Card>

                {/* Popular repls */}
                <Card>
                  <CardHeader>
                    <CardTitle>Popular Repls</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {projects.slice(0, 3).map((repl: any) => (
                        <div
                          key={repl.id}
                          className="flex items-start justify-between p-3 hover:bg-accent cursor-pointer"
                          onClick={() => navigate(`/ide/${repl.id}`)}
                        >
                          <div>
                            <h4 className="font-semibold">{repl.name || 'Untitled Project'}</h4>
                            <p className="text-[13px] text-muted-foreground">
                              {repl.description || ''}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {repl.stars || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="h-3 w-3" />
                                {repl.forks || 0}
                              </span>
                              <span>{repl.updatedAt ? new Date(repl.updatedAt).toLocaleDateString() : ''}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className={getLanguageColor(repl.language)}>
                            {repl.language || 'JavaScript'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Skills */}
                <Card>
                  <CardHeader>
                    <CardTitle>Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(profile?.skills || []).map((skill: string) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(profile?.recentActivity || []).map((activity: { type: string; repl: string; time: string }, index: number) => (
                        <div key={index} className="flex items-start gap-2 text-[13px]">
                          <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-muted-foreground">
                              {activity?.type} 
                            </span>{' '}
                            <span className="font-medium">{activity?.repl}</span>
                            <p className="text-[11px] text-muted-foreground">
                              {activity?.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Badges */}
                <Card>
                  <CardHeader>
                    <CardTitle>Badges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {(profile?.badges || []).map((badge: { id: string; icon: any; name: string; color: string }) => {
                        const Icon = badge?.icon;
                        if (!Icon) return null;
                        return (
                          <div
                            key={badge?.id}
                            className="flex flex-col items-center text-center"
                          >
                            <Icon className={`h-8 w-8 mb-1 ${badge?.color || ''}`} />
                            <span className="text-[11px]">{badge?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="repls" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((repl: any) => (
                <Card
                  key={repl.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/ide/${repl.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{repl.name || 'Untitled Project'}</CardTitle>
                        <CardDescription className="truncate">{repl.description || ''}</CardDescription>
                      </div>
                      {repl.visibility === 'private' && (
                        <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={getLanguageColor(repl.language)}>
                        {repl.language || 'JavaScript'}
                      </Badge>
                      <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repl.stars || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {repl.forks || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Full activity timeline coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(profile?.badges || []).map((badge: { id: string; icon: any; name: string; color: string }) => {
                const Icon = badge?.icon;
                if (!Icon) return null;
                return (
                  <Card key={badge?.id}>
                    <CardContent className="p-6 text-center">
                      <Icon className={`h-12 w-12 mx-auto mb-3 ${badge?.color || ''}`} />
                      <h3 className="font-semibold mb-1">{badge?.name}</h3>
                      <p className="text-[13px] text-muted-foreground">
                        Earned for exceptional contributions
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}