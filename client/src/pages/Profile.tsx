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

// Mock user profile data
const mockProfile = {
  id: 1,
  username: 'demo',
  displayName: 'Demo User',
  email: 'demo@plot.local',
  bio: 'Full-stack developer passionate about building amazing web applications. Love open source and teaching others to code.',
  avatarUrl: null,
  location: 'San Francisco, CA',
  website: 'https://demo.dev',
  twitter: '@demo_dev',
  github: 'demo',
  joinedDate: '2024-01-15',
  stats: {
    repls: 45,
    followers: 234,
    following: 89,
    stars: 567,
    streak: 12,
  },
  badges: [
    { id: 1, name: 'Early Adopter', icon: Trophy, color: 'text-yellow-500' },
    { id: 2, name: '100 Day Streak', icon: Zap, color: 'text-orange-500' },
    { id: 3, name: 'Top Contributor', icon: Award, color: 'text-purple-500' },
  ],
  skills: ['JavaScript', 'React', 'Node.js', 'Python', 'TypeScript', 'PostgreSQL'],
  recentActivity: [
    { type: 'created', repl: 'AI Chat Bot', time: '2 hours ago' },
    { type: 'starred', repl: 'Game Engine', time: '5 hours ago' },
    { type: 'forked', repl: 'Data Visualizer', time: '1 day ago' },
  ],
};

// Mock repls data
const mockRepls = [
  {
    id: 1,
    name: 'AI Chat Assistant',
    description: 'GPT-powered chat with streaming responses',
    language: 'Python',
    stars: 234,
    forks: 45,
    lastUpdated: '2 days ago',
    visibility: 'public',
  },
  {
    id: 2,
    name: 'Real-time Collaboration',
    description: 'Multi-user document editing with WebRTC',
    language: 'TypeScript',
    stars: 189,
    forks: 32,
    lastUpdated: '1 week ago',
    visibility: 'public',
  },
  {
    id: 3,
    name: 'Data Dashboard',
    description: 'Beautiful analytics dashboard with charts',
    language: 'React',
    stars: 156,
    forks: 28,
    lastUpdated: '2 weeks ago',
    visibility: 'private',
  },
];

export default function Profile() {
  const [, navigate] = useLocation();
  const { username } = useParams() as { username?: string };
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // In real app, fetch profile based on username
  const isOwnProfile = !username || username === currentUser?.username;
  const profile = mockProfile;

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

  // Activity chart data (mock)
  const activityData = Array.from({ length: 52 }, (_, i) => ({
    week: i,
    contributions: Math.floor(Math.random() * 20),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar and basic info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatarUrl || undefined} />
                <AvatarFallback className="text-3xl">
                  {profile.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                  {profile.badges.slice(0, 2).map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <span key={badge.id} title={badge.name}>
                        <Icon
                          className={`h-5 w-5 ${badge.color}`}
                        />
                      </span>
                    );
                  })}
                </div>
                <p className="text-muted-foreground mb-3">@{profile.username}</p>
                <p className="mb-4">{profile.bio}</p>
                
                {/* Contact and social */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.location}
                    </span>
                  )}
                  {profile.website && (
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
                  {profile.twitter && (
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
                  {profile.github && (
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
                    <Button onClick={() => navigate('/settings')}>
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button>Follow</Button>
                      <Button variant="outline">Message</Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 md:ml-auto">
              <div className="text-center">
                <div className="text-2xl font-bold">{profile.stats.repls}</div>
                <div className="text-sm text-muted-foreground">Repls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{profile.stats.followers}</div>
                <div className="text-sm text-muted-foreground">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{profile.stats.following}</div>
                <div className="text-sm text-muted-foreground">Following</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{profile.stats.stars}</div>
                <div className="text-sm text-muted-foreground">Stars</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="repls">Repls</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
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
                      {profile.stats.streak} day streak 🔥
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-52 gap-1">
                      {activityData.map((week) => (
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
                    <p className="text-xs text-muted-foreground mt-2">
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
                      {mockRepls.slice(0, 3).map((repl) => (
                        <div
                          key={repl.id}
                          className="flex items-start justify-between p-3 hover:bg-accent cursor-pointer"
                          onClick={() => navigate(`/repl/${repl.id}`)}
                        >
                          <div>
                            <h4 className="font-semibold">{repl.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {repl.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {repl.stars}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="h-3 w-3" />
                                {repl.forks}
                              </span>
                              <span>{repl.lastUpdated}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className={getLanguageColor(repl.language)}>
                            {repl.language}
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
                      {profile.skills.map((skill) => (
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
                      {profile.recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-muted-foreground">
                              {activity.type} 
                            </span>{' '}
                            <span className="font-medium">{activity.repl}</span>
                            <p className="text-xs text-muted-foreground">
                              {activity.time}
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
                      {profile.badges.map((badge) => {
                        const Icon = badge.icon;
                        return (
                          <div
                            key={badge.id}
                            className="flex flex-col items-center text-center"
                          >
                            <Icon className={`h-8 w-8 mb-1 ${badge.color}`} />
                            <span className="text-xs">{badge.name}</span>
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
              {mockRepls.map((repl) => (
                <Card
                  key={repl.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/repl/${repl.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{repl.name}</CardTitle>
                        <CardDescription>{repl.description}</CardDescription>
                      </div>
                      {repl.visibility === 'private' && (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={getLanguageColor(repl.language)}>
                        {repl.language}
                      </Badge>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repl.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {repl.forks}
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
              {profile.badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Card key={badge.id}>
                    <CardContent className="p-6 text-center">
                      <Icon className={`h-12 w-12 mx-auto mb-3 ${badge.color}`} />
                      <h3 className="font-semibold mb-1">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">
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