import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Trophy, TrendingUp, Upload, MessageSquare, 
  BookOpen, Award, Star, GitBranch, Heart, Eye,
  Calendar, ChevronRight, Plus, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface Developer {
  id: number;
  name: string;
  avatar: string | null;
  templates: number;
  downloads: number;
  rating: number;
  badge?: string;
}

interface Collection {
  id: number;
  name: string;
  description: string;
  templates: number;
  iconName: string;
  color: string;
}

interface Activity {
  user: string;
  action: string;
  template: string;
  time: string;
}

interface CommunityStats {
  totalTemplates: number;
  totalDevelopers: number;
  totalDownloads: number;
  monthlyActive: number;
}

const COLLECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  award: Award,
  sparkles: Sparkles,
};

export function CommunityHub() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Real API calls - no mock data
  const { data: topDevelopers = [], isLoading: developersLoading, error: developersError } = useQuery<Developer[]>({
    queryKey: ['/api/community/top-developers'],
  });

  const { data: collections = [], isLoading: collectionsLoading, error: collectionsError } = useQuery<Collection[]>({
    queryKey: ['/api/community/collections'],
  });

  const { data: recentActivity = [], isLoading: activityLoading, error: activityError } = useQuery<Activity[]>({
    queryKey: ['/api/community/activity'],
  });

  const { data: communityStats, isLoading: statsLoading, error: statsError } = useQuery<CommunityStats>({
    queryKey: ['/api/community/stats'],
  });

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case 'gold':
        return 'bg-yellow-500';
      case 'silver':
        return 'bg-gray-400';
      case 'bronze':
        return 'bg-orange-600';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Community Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500" />
            Community Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center p-3 bg-muted rounded-lg animate-pulse h-16" />
              ))}
            </div>
          ) : statsError ? (
            <p className="text-[13px] text-destructive">Failed to load community stats</p>
          ) : communityStats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-orange-500">
                  {(communityStats.totalTemplates ?? 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">Templates</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-blue-500">
                  {communityStats.totalDevelopers}
                </p>
                <p className="text-[11px] text-muted-foreground">Developers</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-green-500">
                  {(communityStats.totalDownloads / 1000).toFixed(0)}K
                </p>
                <p className="text-[11px] text-muted-foreground">Downloads</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-purple-500">
                  {communityStats.monthlyActive}
                </p>
                <p className="text-[11px] text-muted-foreground">Active/mo</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Submit Template CTA */}
      {user && (
        <Card className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[13px]">Share Your Template</h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Join the community and showcase your work
                </p>
              </div>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => navigate('/templates/submit')}
              >
                <Upload className="h-3 w-3 mr-1" />
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="developers">Developers</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Featured Collections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Featured Collections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {collectionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : collectionsError ? (
                <p className="text-[13px] text-destructive">Failed to load collections</p>
              ) : collections.map((collection) => {
                const Icon = COLLECTION_ICONS[collection.iconName] || Sparkles;
                return (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted", collection.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{collection.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {collection.description}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{collection.templates}</Badge>
                  </div>
                );
              })}
              <Button variant="outline" className="w-full mt-2" size="sm">
                View All Collections
              </Button>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/docs/templates">
                <a className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                  <span className="text-[13px] flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Template Guidelines
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Link>
              <Link href="/community/forum">
                <a className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                  <span className="text-[13px] flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Community Forum
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Link>
              <Link href="/tutorials">
                <a className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                  <span className="text-[13px] flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Tutorials
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developers" className="space-y-4 mt-4">
          {/* Top Developers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {developersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                        <div className="h-3 bg-muted rounded animate-pulse w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : developersError ? (
                <p className="text-[13px] text-destructive">Failed to load top developers</p>
              ) : topDevelopers.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-8">No developers yet</p>
              ) : (
                <div className="space-y-3">
                  {topDevelopers.map((dev, index) => (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={dev.avatar || undefined} />
                            <AvatarFallback>
                              {dev.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {dev.badge && (
                            <div className={cn(
                              "absolute -bottom-1 -right-1 h-4 w-4 rounded-full",
                              getBadgeColor(dev.badge)
                            )} />
                          )}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">{dev.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {dev.templates} templates • {(dev.downloads / 1000).toFixed(0)}k downloads
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                        <span className="text-[11px] font-medium">{dev.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full mt-3" size="sm">
                View All Developers
              </Button>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-500">First Template</Badge>
                  <Progress value={100} className="flex-1 h-2" />
                  <span className="text-[11px] text-muted-foreground">Unlocked</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">10 Downloads</Badge>
                  <Progress value={60} className="flex-1 h-2" />
                  <span className="text-[11px] text-muted-foreground">6/10</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">5-Star Rating</Badge>
                  <Progress value={20} className="flex-1 h-2" />
                  <span className="text-[11px] text-muted-foreground">1/5</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3 h-[400px]">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b">
                      <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityError ? (
                <div className="h-[400px] flex items-center justify-center text-destructive">
                  Failed to load recent activity
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {recentActivity.map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 pb-3 border-b last:border-0"
                      >
                        <Avatar className="h-6 w-6 mt-0.5">
                          <AvatarFallback>
                            {activity.user.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-[13px]">
                            <span className="font-medium">{activity.user}</span>
                            {' '}
                            <span className="text-muted-foreground">{activity.action}</span>
                            {' '}
                            <span className="font-medium">{activity.template}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Join Discussion */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <h3 className="font-semibold text-[13px] mb-1">Join the Discussion</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                Connect with other developers and share ideas
              </p>
              <Button size="sm" variant="outline">
                Visit Forum
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}