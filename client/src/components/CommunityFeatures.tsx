import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Heart, 
  Reply, 
  Star, 
  Trophy,
  Users,
  TrendingUp,
  Eye,
  Code,
  Play,
  Share,
  Bookmark,
  Flag,
  Award,
  Crown,
  Filter,
  Search,
  Plus,
  Image,
  FileText,
  Calendar,
  MapPin,
  Globe,
  Github,
  Twitter,
  ExternalLink,
  Clock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  authorUsername: string;
  category: string;
  tags: string[];
  likes: number;
  replies: number;
  views: number;
  isPinned: boolean;
  createdAt: string;
  codeSnippet?: string;
}

interface CommunityReply {
  id: string;
  content: string;
  authorUsername: string;
  likes: number;
  isAccepted: boolean;
  createdAt: string;
}

interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  githubUsername: string;
  twitterUsername: string;
  profileImage: string;
  badges: string[];
  reputation: number;
  specialties: string[];
  joinedAt: string;
  isVerified: boolean;
  isExpert: boolean;
}

interface CodeShowcase {
  id: string;
  title: string;
  description: string;
  authorUsername: string;
  language: string;
  tags: string[];
  likes: number;
  views: number;
  forks: number;
  featured: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: string;
  thumbnailUrl?: string;
}

export function CommunityFeatures() {
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch community data
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['/api/community/posts', { category: selectedCategory, tag: selectedTag, search: searchQuery, pageSize: 6 }],
    staleTime: 30000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedTag) params.set('tag', selectedTag);
      if (searchQuery) params.set('search', searchQuery);
      params.set('pageSize', '6');
      const res = await fetch(`/api/community/posts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch community posts');
      }
      return res.json();
    }
  });

  const { data: showcasesData, isLoading: showcasesLoading } = useQuery({
    queryKey: ['/api/community/showcases'],
    staleTime: 30000
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/community/stats'],
    staleTime: 60000
  });

  // Fetch leaderboard data
  interface LeaderboardEntry {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    score: number;
    rank: number;
    badges: string[];
    streakDays: number;
  }

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/community/leaderboard'],
    staleTime: 60000
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: any) => {
      const response = await apiRequest('POST', '/api/community/posts', postData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setShowCreatePost(false);
      toast({
        title: "Post Created",
        description: "Your post has been published to the community.",
      });
    }
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest('POST', `/api/community/posts/${postId}/like`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
    }
  });

  const posts = postsData?.posts || [];
  const showcases = showcasesData?.showcases || [];
  const stats = statsData?.stats || {
    totalPosts: 0,
    totalReplies: 0,
    totalUsers: 0,
    totalShowcases: 0
  };

  const categories = ['all', 'help', 'tutorial', 'discussion', 'showcase', 'feedback'];
  const popularTags = ['javascript', 'python', 'react', 'nodejs', 'ai', 'web-dev', 'mobile', 'game-dev'];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'help': return <MessageSquare className="h-4 w-4" />;
      case 'tutorial': return <FileText className="h-4 w-4" />;
      case 'discussion': return <Users className="h-4 w-4" />;
      case 'showcase': return <Star className="h-4 w-4" />;
      case 'feedback': return <Flag className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const CreatePostForm = () => {
    const [formData, setFormData] = useState({
      title: '',
      content: '',
      category: 'discussion',
      tags: '',
      codeSnippet: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createPostMutation.mutate({
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Community Post</CardTitle>
          <CardDescription>
            Share knowledge, ask questions, or showcase your projects with the community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="What's your post about?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="help">Help & Support</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="discussion">Discussion</SelectItem>
                    <SelectItem value="showcase">Showcase</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="javascript, react, tutorial"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Share your thoughts, ask your question, or describe your project..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                required
              />
            </div>

            <div>
              <Label htmlFor="codeSnippet">Code Snippet (optional)</Label>
              <Textarea
                id="codeSnippet"
                placeholder="Paste your code here..."
                value={formData.codeSnippet}
                onChange={(e) => setFormData({ ...formData, codeSnippet: e.target.value })}
                rows={8}
                className="font-mono text-[13px]"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePost(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
              >
                {createPostMutation.isPending ? 'Publishing...' : 'Publish Post'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Community Hub</h1>
            <p className="text-muted-foreground">
              Connect, learn, and share with developers worldwide
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreatePost(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Community Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts}</div>
            <p className="text-[11px] text-muted-foreground">
              {stats.totalReplies} total replies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-[11px] text-muted-foreground">
              Growing developer community
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Code Showcases</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShowcases}</div>
            <p className="text-[11px] text-muted-foreground">
              Featured projects and demos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-[11px] text-muted-foreground">
              Active participation rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Post Form */}
      {showCreatePost && <CreatePostForm />}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Community Posts</TabsTrigger>
          <TabsTrigger value="showcases">Code Showcases</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* Community Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post: CommunityPost) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {post.isPinned && (
                            <Badge variant="secondary">
                              <Crown className="h-3 w-3 mr-1" />
                              Pinned
                            </Badge>
                          )}
                          <Badge variant="outline" className="flex items-center">
                            {getCategoryIcon(post.category)}
                            <span className="ml-1">{post.category}</span>
                          </Badge>
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[11px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <h3 className="text-[15px] font-semibold mb-2 hover:text-primary cursor-pointer">
                          {post.title}
                        </h3>
                        
                        <p className="text-muted-foreground mb-3 line-clamp-2">
                          {post.content}
                        </p>

                        {post.codeSnippet && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <pre className="text-[13px] overflow-x-auto">
                              <code>{post.codeSnippet.substring(0, 200)}...</code>
                            </pre>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-[13px] text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorUsername}`} />
                                <AvatarFallback>{post.authorUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span>{post.authorUsername}</span>
                            </div>
                            <span>•</span>
                            <span>{formatTimeAgo(post.createdAt)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => likePostMutation.mutate(post.id)}
                              className="text-muted-foreground hover:text-red-500"
                            >
                              <Heart className="h-4 w-4 mr-1" />
                              {post.likes}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Reply className="h-4 w-4 mr-1" />
                              {post.replies}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Eye className="h-4 w-4 mr-1" />
                              {post.views}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Share className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Code Showcases Tab */}
        <TabsContent value="showcases" className="space-y-4">
          {showcasesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {showcases.map((showcase: CodeShowcase) => (
                <Card key={showcase.id} className="hover:shadow-md transition-shadow">
                  {showcase.thumbnailUrl && (
                    <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                      <img
                        src={showcase.thumbnailUrl}
                        alt={showcase.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getDifficultyColor(showcase.difficulty)}>
                        {showcase.difficulty}
                      </Badge>
                      {showcase.featured && (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-semibold mb-2">{showcase.title}</h3>
                    <p className="text-[13px] text-muted-foreground mb-3 line-clamp-2">
                      {showcase.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {showcase.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center space-x-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${showcase.authorUsername}`} />
                          <AvatarFallback>{showcase.authorUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground">{showcase.authorUsername}</span>
                      </div>
                      
                      <div className="flex items-center space-x-3 text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Heart className="h-3 w-3" />
                          <span>{showcase.likes}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Eye className="h-3 w-3" />
                          <span>{showcase.views}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Code className="h-3 w-3" />
                          <span>{showcase.forks}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Play className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Code className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Bookmark className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Contributors */}
            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>
                  Most active community members this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaderboardLoading ? (
                    <div className="text-center text-muted-foreground py-4">Loading leaderboard...</div>
                  ) : leaderboardData && leaderboardData.length > 0 ? (
                    leaderboardData.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                            user.rank === 1 ? 'bg-yellow-500' :
                            user.rank === 2 ? 'bg-gray-400' :
                            user.rank === 3 ? 'bg-orange-600' : 'bg-gray-300'
                          }`}>
                            {user.rank}
                          </div>
                          <Avatar>
                            <AvatarImage src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
                            <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.displayName || user.username}</div>
                            {user.badges && user.badges[0] && (
                              <Badge variant="outline" className="text-[11px]">{user.badges[0]}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{user.score}</div>
                          <div className="text-[11px] text-muted-foreground">score</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">No leaderboard data yet</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Achievement Showcase */}
            <Card>
              <CardHeader>
                <CardTitle>Community Achievements</CardTitle>
                <CardDescription>
                  Badges and milestones earned by members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: 'First Post', icon: '🎯', count: 1234 },
                    { name: 'Helpful', icon: '🤝', count: 456 },
                    { name: 'Expert', icon: '🎓', count: 89 },
                    { name: 'Mentor', icon: '👨‍🏫', count: 34 },
                    { name: 'Code Master', icon: '💻', count: 67 },
                    { name: 'Rising Star', icon: '⭐', count: 23 }
                  ].map((achievement) => (
                    <div key={achievement.name} className="text-center p-4 border rounded-lg">
                      <div className="text-2xl mb-2">{achievement.icon}</div>
                      <div className="font-medium text-[13px]">{achievement.name}</div>
                      <div className="text-[11px] text-muted-foreground">{achievement.count} earned</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Events */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Community Events</CardTitle>
                  <CardDescription>
                    Join live coding sessions, workshops, and community meetups
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        title: 'React Best Practices Workshop',
                        date: '2025-08-10',
                        time: '2:00 PM UTC',
                        type: 'Workshop',
                        attendees: 45,
                        isOnline: true
                      },
                      {
                        title: 'AI & Machine Learning Showcase',
                        date: '2025-08-15',
                        time: '6:00 PM UTC',
                        type: 'Showcase',
                        attendees: 89,
                        isOnline: true
                      },
                      {
                        title: 'Monthly Code Review Session',
                        date: '2025-08-20',
                        time: '4:00 PM UTC',
                        type: 'Review',
                        attendees: 23,
                        isOnline: true
                      }
                    ].map((event, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold mb-2">{event.title}</h3>
                              <div className="flex items-center space-x-4 text-[13px] text-muted-foreground mb-2">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(event.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{event.time}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Globe className="h-4 w-4" />
                                  <span>Online</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{event.type}</Badge>
                                <span className="text-[13px] text-muted-foreground">
                                  {event.attendees} attending
                                </span>
                              </div>
                            </div>
                            <Button size="sm">Join Event</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Event Calendar & Quick Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Host an Event
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Calendar
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    Join Study Group
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Community Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[13px]">Active This Week</span>
                    <span className="font-medium">2,341 users</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px]">New Members</span>
                    <span className="font-medium">156 this month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px]">Projects Shared</span>
                    <span className="font-medium">89 this week</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px]">Helpful Answers</span>
                    <span className="font-medium">234 today</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}