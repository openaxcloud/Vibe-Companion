import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, Star, MessageSquare, Users, Code, Heart,
  Share2, Bookmark, Calendar, Award,
  ChevronRight, Zap, Trophy, Target, Plus,
  Rocket, Briefcase, Building, Globe
} from 'lucide-react';
import { Link } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ECodeLoading } from '@/components/ECodeLoading';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    reputation: number;
  };
  category: string;
  tags: string[];
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
  projectUrl?: string;
  imageUrl?: string;
}

interface CommunityPostsResponse {
  posts: CommunityPost[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  participants: number;
  submissions: number;
  prize?: string;
  deadline: string;
  status: 'active' | 'upcoming' | 'ended';
}

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  rank: number;
  badges: string[];
  streakDays: number;
}

// Icon mapping for categories
const iconMap: Record<string, any> = {
  TrendingUp,
  Star,
  MessageSquare,
  Code,
  Trophy,
  Users
};

interface Category {
  id: string;
  name: string;
  icon: string;
  postCount: number;
}

const communityInsights = [
  {
    id: 'global-impact',
    title: 'Global Innovation Impact',
    description: 'Fortune 500 builders and emerging startups collaborate on mission-critical solutions every day.',
    icon: Globe,
    metric: '184 countries',
  },
  {
    id: 'enterprise-grade',
    title: 'Enterprise-Grade Playbooks',
    description: 'Access proven implementation guides that power automation at scale with compliance built-in.',
    icon: Briefcase,
    metric: '340+ guides',
  },
  {
    id: 'launchpad',
    title: 'Launchpad for Visionary Teams',
    description: 'Join elite innovation hubs, get curated partner matches, and co-create the future of software.',
    icon: Rocket,
    metric: '1,200 partner matches',
  },
];

const enterpriseHighlights = [
  {
    id: 'innovation-council',
    title: 'Innovation Council Briefings',
    description: 'Monthly executive sessions with CTOs, CIOs, and product leaders exploring the next wave of AI-native companies.',
  },
  {
    id: 'center-excellence',
    title: 'Center of Excellence Templates',
    description: 'Reusable governance frameworks to scale community-driven development with Fortune 500 rigor.',
  },
  {
    id: 'talent-network',
    title: 'Global Talent Network',
    description: 'Tap into Replit creators, mentors, and solution architects for high-priority launches.',
  },
];

const upcomingEvents = [
  {
    id: 'executive-roundtable',
    title: 'Enterprise AI Builders Roundtable',
    description: 'Live strategy session with Fortune 500 program leaders on scaling internal developer platforms.',
    date: 'Jan 15, 2025',
  },
  {
    id: 'launch-week',
    title: 'Community Launch Week',
    description: 'A five-day showcase of flagship community products, customer spotlights, and lightning talks.',
    date: 'Feb 10, 2025',
  },
  {
    id: 'global-demo-day',
    title: 'Global Demo Day',
    description: 'Team up with cross-industry innovators to present breakthrough solutions in front of partners and investors.',
    date: 'Mar 21, 2025',
  },
];

const spotlightStories = [
  {
    id: 'enterprise-sre',
    company: 'Northwind Logistics',
    quote: '“The community accelerated our SRE automation roadmap by 18 months and unlocked new revenue streams.”',
    role: 'VP of Platform Engineering',
  },
  {
    id: 'healthcare-ai',
    company: 'Atlas Health Systems',
    quote: '“From prototype to production, the Replit community guided us through every compliance milestone.”',
    role: 'Chief Innovation Officer',
  },
];

export default function Community() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/community/categories']
  });

  const postsQueryKey = ['/api/community/posts', { category: activeCategory, search: searchQuery }];

  const {
    data: postsPages,
    isLoading: postsInitialLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CommunityPostsResponse>({
    queryKey: postsQueryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', page.toString());
      params.set('pageSize', '20');
      const res = await fetch(`/api/community/posts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch community posts (${res.status})`);
      }
      return res.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const posts = postsPages?.pages?.flatMap((page) => page.posts ?? []) ?? [];
  const postsLoading = postsInitialLoading && !postsPages;

  // Fetch challenges
  const { data: challenges = [] } = useQuery<Challenge[]>({
    queryKey: ['/api/community/challenges']
  });

  // Fetch leaderboard
  const { data: leaderboard = [] } = useQuery<LeaderboardUser[]>({
    queryKey: ['/api/community/leaderboard']
  });

  const totalPosts = useMemo(
    () => categories.reduce((sum, category) => sum + (category.postCount ?? 0), 0),
    [categories],
  );

  const categoriesWithAll = useMemo(() => {
    const mapped = [...categories];
    if (!mapped.some((category) => category.id === 'all')) {
      mapped.unshift({
        id: 'all',
        name: 'All Initiatives',
        icon: 'TrendingUp',
        postCount: totalPosts,
      });
    }

    return mapped.sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      return 0;
    });
  }, [categories, totalPosts]);

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest('POST', `/api/community/posts/${postId}/like`);
      if (!res.ok) throw new Error('Failed to like post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
    },
  });

  // Bookmark post mutation
  const bookmarkPostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest('POST', `/api/community/posts/${postId}/bookmark`);
      if (!res.ok) throw new Error('Failed to bookmark post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      toast({
        title: "Post bookmarked",
        description: "Added to your bookmarks",
      });
    },
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'hard': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return '';
    }
  };

  const getBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'top-contributor': return <Trophy className="h-4 w-4" />;
      case 'challenge-winner': return <Award className="h-4 w-4" />;
      case 'mentor': return <Users className="h-4 w-4" />;
      case 'helpful': return <Heart className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-auto">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
        <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-background via-background to-primary/5">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <CardContent className="relative p-6 sm:p-8 lg:p-12">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4 sm:space-y-6">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Global Community Hub</Badge>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Build with the creators powering Fortune 500 innovation
                </h1>
                <p className="text-muted-foreground text-[13px] sm:text-base lg:text-[15px] max-w-2xl">
                  Discover flagship launches, enterprise-grade playbooks, and partner with the Replit community to ship
                  resilient software faster. Join executives, founders, and builders reimagining how world-class teams deliver.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/community/challenges">
                    <Button size="lg" className="shadow-md">Explore challenges</Button>
                  </Link>
                  <Link href="/community/new">
                    <Button size="lg" variant="outline" className="backdrop-blur border-primary/40">
                      Partner with creators
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {communityInsights.map((insight) => (
                  <Card key={insight.id} className="bg-background/80 border-primary/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="inline-flex items-center gap-2 text-primary">
                        <insight.icon className="h-5 w-5" />
                        <span className="text-[11px] uppercase tracking-wide">{insight.metric}</span>
                      </div>
                      <h3 className="font-semibold text-[13px] sm:text-base">{insight.title}</h3>
                      <p className="text-[11px] sm:text-[13px] text-muted-foreground leading-relaxed">{insight.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] sm:text-xl">Enterprise Community Highlights</CardTitle>
              <CardDescription>
                Curated programs and resources designed for global scale teams.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {enterpriseHighlights.map((item) => (
                <div key={item.id} className="space-y-2">
                  <h4 className="font-semibold text-[13px] sm:text-base flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    {item.title}
                  </h4>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px] sm:text-xl">Upcoming Flagship Events</CardTitle>
              <CardDescription>Connect live with global builders and program leaders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-primary/10 p-3">
                  <div className="flex items-center justify-between text-[11px] text-primary font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{event.date}</span>
                  </div>
                  <h4 className="mt-2 font-semibold text-[13px]">{event.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{event.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardContent className="p-4 sm:p-6 lg:p-8 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold">Community Spotlight</h2>
              <p className="text-[13px] sm:text-base text-muted-foreground">
                Stories from leaders accelerating their digital transformation with Replit experts, partner studios, and
                community mentors.
              </p>
            </div>
            <div className="grid gap-4">
              {spotlightStories.map((story) => (
                <div key={story.id} className="rounded-lg bg-background p-4 border border-border/60 shadow-sm">
                  <p className="text-[13px] italic leading-relaxed">{story.quote}</p>
                  <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {story.company} • {story.role}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex flex-col space-y-3 sm:space-y-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Community</h1>
            <p className="text-muted-foreground text-[11px] sm:text-[13px] md:text-base">
              Share your projects, get help, and connect with other creators
            </p>
          </div>
          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:gap-3">
            <Input
              placeholder="Search community..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-[240px] md:w-[280px] lg:w-[320px]"
              data-testid="input-search-community"
            />
            <Link href="/community/new">
              <Button className="w-full sm:w-auto whitespace-nowrap" data-testid="button-new-post">
                <Plus className="h-4 w-4 mr-2" />
                <span className="sm:inline">New Post</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-6">
          {/* Posts Section */}
          <div className="xl:col-span-3 space-y-4 sm:space-y-6">
            {/* Category Tabs */}
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <ScrollArea className="w-full max-w-full overflow-x-auto">
                <TabsList className="inline-flex h-auto p-1 bg-muted rounded-lg">
                  <div className="flex space-x-1">
                    {categoriesWithAll.map(category => {
                      const IconComponent = iconMap[category.icon] || TrendingUp;
                      return (
                        <TabsTrigger
                          key={category.id}
                          value={category.id}
                          className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-md whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-[11px] sm:text-[13px]"
                        >
                          <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>{category.name}</span>
                          {category.postCount > 0 && (
                            <span className="text-[11px] text-muted-foreground ml-1">
                              ({category.postCount})
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </div>
                </TabsList>
              </ScrollArea>
              
              <TabsContent value={activeCategory} className="mt-6 space-y-4">
                {postsLoading ? (
                  <ECodeLoading centered size="lg" text="Loading community posts..." />
                ) : posts.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-[15px] font-semibold mb-2">No posts yet</h3>
                      <p className="text-muted-foreground">
                        Be the first to share something with the community!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {posts.map((post: CommunityPost) => (
                      <Card key={post.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 sm:gap-3 mb-3">
                              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                                <AvatarImage src={post.author.avatarUrl} />
                                <AvatarFallback className="text-[11px] sm:text-[13px]">
                                  {(post.author?.displayName || post.author?.username || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link href={`/user/${post.author?.username || ''}`}>
                                    <span className="font-semibold hover:underline text-[13px] sm:text-base truncate block">
                                      {post.author?.displayName || post.author?.username || 'Unknown'}
                                    </span>
                                  </Link>
                                  <Badge variant="secondary" className="text-[11px] shrink-0">
                                    {post.author?.reputation ?? 0} rep
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {post.createdAt}
                                </p>
                              </div>
                            </div>

                            <Link href={`/community/post/${post.id}`}>
                              <h3 className="text-base sm:text-[15px] lg:text-xl font-semibold mb-2 hover:text-primary line-clamp-2">
                                {post.title}
                              </h3>
                            </Link>

                            <p className="text-muted-foreground mb-3 sm:mb-4 line-clamp-2 text-[13px] sm:text-base">
                              {post.content}
                            </p>

                            {post.imageUrl && (
                              <div className="mb-3 sm:mb-4 rounded-lg overflow-hidden bg-muted aspect-video">
                                <img 
                                  src={post.imageUrl} 
                                  alt={post.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 sm:gap-2 mb-3 flex-wrap">
                              {post.tags.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-[11px] px-2 py-0.5">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex items-center gap-0.5 sm:gap-1 -ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "gap-1 sm:gap-1.5 px-2 sm:px-3 h-8 sm:h-9",
                                    post.isLiked && "text-red-500"
                                  )}
                                  onClick={() => likePostMutation.mutate(post.id)}
                                >
                                  <Heart className={cn(
                                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                                    post.isLiked && "fill-current"
                                  )} />
                                  <span className="text-[11px] sm:text-[13px]">{post.likes}</span>
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1 sm:gap-1.5 px-2 sm:px-3 h-8 sm:h-9">
                                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="text-[11px] sm:text-[13px]">{post.comments}</span>
                                </Button>
                                <Button variant="ghost" size="sm" className="px-2 sm:px-3 h-8 sm:h-9">
                                  <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "px-2 sm:px-3 h-8 sm:h-9",
                                    post.isBookmarked && "text-blue-500"
                                  )}
                                  onClick={() => bookmarkPostMutation.mutate(post.id)}
                                >
                                  <Bookmark className={cn(
                                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                                    post.isBookmarked && "fill-current"
                                  )} />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] sm:text-[13px] text-muted-foreground">
                                <span>{post.views} views</span>
                                {post.projectUrl && (
                                  <>
                                    <span>•</span>
                                    <Link href={post.projectUrl}>
                                      <Button variant="link" size="sm" className="h-auto p-0 text-[11px] sm:text-[13px]">
                                        View Project
                                        <ChevronRight className="h-3 w-3 ml-1" />
                                      </Button>
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    ))}
                    {hasNextPage && (
                      <div className="flex justify-center pt-2">
                        <Button
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          variant="outline"
                          className="min-w-[160px]"
                        >
                          {isFetchingNextPage ? 'Loading more...' : 'Load more posts'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:space-y-6">
            {/* Active Challenges */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-[15px]">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                  Active Challenges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                {challenges.filter((c: Challenge) => c.status === 'active').slice(0, 3).map((challenge: Challenge) => (
                  <div key={challenge.id} className="space-y-1.5 sm:space-y-2">
                    <Link href={`/community/challenge/${challenge.id}`}>
                      <h4 className="font-semibold hover:text-primary text-[13px] sm:text-base line-clamp-2">
                        {challenge.title}
                      </h4>
                    </Link>
                    <p className="text-[11px] sm:text-[13px] text-muted-foreground line-clamp-2">
                      {challenge.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant="outline" 
                        className={cn("text-[11px] px-2 py-0.5", getDifficultyColor(challenge.difficulty))}
                      >
                        {challenge.difficulty}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {challenge.participants} participants
                      </span>
                    </div>
                    {challenge.prize && (
                      <div className="flex items-center gap-1 text-[11px] text-primary">
                        <Zap className="h-3 w-3" />
                        {challenge.prize}
                      </div>
                    )}
                  </div>
                ))}
                <Separator />
                <Link href="/community/challenges">
                  <Button variant="ghost" className="w-full" size="sm">
                    View all challenges
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-[15px]">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
                {leaderboard.map((user: LeaderboardUser, index: number) => (
                  <div key={user.id} className="flex items-center gap-2 sm:gap-3">
                    <div className={cn(
                      "w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-[13px] font-bold shrink-0",
                      index === 0 && "bg-yellow-500/20 text-yellow-500",
                      index === 1 && "bg-gray-500/20 text-gray-500",
                      index === 2 && "bg-orange-500/20 text-orange-500",
                      index > 2 && "bg-muted text-muted-foreground"
                    )}>
                      {user.rank}
                    </div>
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="text-[11px] sm:text-[13px]">
                        {(user.displayName || "??").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link href={`/user/${user.username}`}>
                        <p className="font-medium text-[11px] sm:text-[13px] hover:underline truncate">
                          {user.displayName}
                        </p>
                      </Link>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {user.score.toLocaleString()} pts
                        </span>
                        {user.streakDays > 0 && (
                          <Badge variant="secondary" className="text-[11px] h-4 sm:h-5 px-1.5 sm:px-2">
                            <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            {user.streakDays}d
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5 sm:gap-1 shrink-0">
                      {user.badges.slice(0, 2).map((badge: string) => (
                        <div
                          key={badge}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center"
                          title={badge}
                        >
                          {getBadgeIcon(badge)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Separator />
                <Link href="/community/leaderboard">
                  <Button variant="ghost" className="w-full" size="sm">
                    View full leaderboard
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Community Stats */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-[15px]">Community Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold">12.5K</p>
                    <p className="text-[11px] sm:text-[13px] text-muted-foreground">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold">3.2K</p>
                    <p className="text-[11px] sm:text-[13px] text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold">892</p>
                    <p className="text-[11px] sm:text-[13px] text-muted-foreground">Active Now</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold">45</p>
                    <p className="text-[11px] sm:text-[13px] text-muted-foreground">Challenges</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}