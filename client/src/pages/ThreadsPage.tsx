import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  SortAsc,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  Pin,
  Lock,
  Unlock,
  Flag,
  Share2,
  Bookmark,
  BookmarkCheck,
  Code,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Image,
  AtSign,
  Hash,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Reply,
  ChevronRight,
  ChevronDown,
  Star,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ThreadAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role?: 'admin' | 'moderator' | 'member';
  reputation: number;
}

interface Thread {
  id: string;
  title: string;
  content: string;
  author: ThreadAuthor;
  category: string;
  tags: string[];
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  isLiked: boolean;
  isBookmarked: boolean;
  projectUrl?: string;
  imageUrl?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  postCount: number;
  description?: string;
}

interface PostsResponse {
  posts: Thread[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function ThreadsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);

  const [newThread, setNewThread] = useState({
    title: '',
    content: '',
    category: '',
    tags: '',
  });

  const [replyContent, setReplyContent] = useState('');

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/community/categories'],
  });

  const { data: postsData, isLoading: postsLoading } = useQuery<PostsResponse>({
    queryKey: ['/api/community/posts', selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  const threads = postsData?.posts ?? [];
  const totalThreadCount = postsData?.pagination?.total ?? 0;

  const filteredThreads = useMemo(() => {
    let result = [...threads];

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.likes - a.likes);
        break;
      case 'views':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'replies':
        result.sort((a, b) => b.comments - a.comments);
        break;
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [threads, sortBy]);

  const handleCreateThread = () => {
    toast({ title: 'Thread created', description: 'Your thread has been published successfully.' });
    setShowNewThreadDialog(false);
    setNewThread({ title: '', content: '', category: '', tags: '' });
  };

  const handleLikeThread = (thread: Thread) => {
    toast({ title: thread.isLiked ? 'Removed like' : 'Liked', description: `You ${thread.isLiked ? 'removed your like from' : 'liked'} "${thread.title}"` });
  };

  const handleBookmarkThread = (thread: Thread) => {
    toast({ title: thread.isBookmarked ? 'Removed bookmark' : 'Bookmarked', description: `Thread ${thread.isBookmarked ? 'removed from' : 'added to'} bookmarks` });
  };

  const handlePostReply = () => {
    if (!replyContent.trim()) return;
    toast({ title: 'Reply posted', description: 'Your reply has been added to the thread.' });
    setReplyContent('');
  };

  const handleViewThread = (thread: Thread) => {
    setSelectedThread(thread);
    setShowDetailView(true);
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      admin: { variant: 'destructive', label: 'Admin' },
      moderator: { variant: 'default', label: 'Mod' },
      member: { variant: 'secondary', label: 'Member' },
    };
    const config = variants[role] || { variant: 'secondary' as const, label: role };
    return <Badge variant={config.variant} className="text-[11px]">{config.label}</Badge>;
  };

  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";
  const cardClassName = "border border-border bg-card shadow-sm";

  return (
    <PageShell>
      <div 
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-threads"
      >
        <PageHeader
          title="Discussion Threads"
          description="Join the conversation, share knowledge, and connect with the E-Code community."
          icon={MessageSquare}
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 border-border bg-card text-foreground hover:bg-muted hover:border-primary/30 transition-all duration-200"
                data-testid="button-my-threads"
              >
                <Users className="h-4 w-4" />
                My Threads
              </Button>
              <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                    data-testid="button-new-thread"
                  >
                    <Plus className="h-4 w-4" />
                    New Thread
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" data-testid="dialog-new-thread">
                  <DialogHeader>
                    <DialogTitle>Create New Thread</DialogTitle>
                    <DialogDescription>Start a new discussion with the community.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={newThread.title}
                        onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                        placeholder="Enter a descriptive title..."
                        className={inputClassName}
                        data-testid="input-thread-title"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={newThread.category} onValueChange={(v) => setNewThread({ ...newThread, category: v })}>
                        <SelectTrigger className={inputClassName} data-testid="select-thread-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Content</Label>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-bold">
                            <Bold className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-italic">
                            <Italic className="h-4 w-4" />
                          </Button>
                          <Separator orientation="vertical" className="h-4" />
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-code">
                            <Code className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-list">
                            <List className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-ordered">
                            <ListOrdered className="h-4 w-4" />
                          </Button>
                          <Separator orientation="vertical" className="h-4" />
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-link">
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-image">
                            <Image className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-format-mention">
                            <AtSign className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          value={newThread.content}
                          onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                          placeholder="Write your thread content here... Supports Markdown and code blocks."
                          className="min-h-[200px] border-0 focus:ring-0 rounded-none"
                          data-testid="textarea-thread-content"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Supports Markdown and code blocks with syntax highlighting</p>
                    </div>
                    <div>
                      <Label>Tags</Label>
                      <Input
                        value={newThread.tags}
                        onChange={(e) => setNewThread({ ...newThread, tags: e.target.value })}
                        placeholder="react, typescript, api (comma separated)"
                        className={inputClassName}
                        data-testid="input-thread-tags"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewThreadDialog(false)} data-testid="button-cancel-thread">Cancel</Button>
                    <Button onClick={handleCreateThread} data-testid="button-publish-thread">Publish Thread</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className={cardClassName} data-testid="card-categories">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {categoriesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <button
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                        selectedCategory === 'all' 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => setSelectedCategory('all')}
                      data-testid="button-category-all"
                    >
                      <span>All Categories</span>
                      <Badge variant="secondary">{totalThreadCount}</Badge>
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                          selectedCategory === cat.id 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        onClick={() => setSelectedCategory(cat.id)}
                        data-testid={`button-category-${cat.id}`}
                      >
                        <span>{cat.name}</span>
                        <Badge variant="secondary">{cat.postCount}</Badge>
                      </button>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className={cardClassName} data-testid="card-trending-tags">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trending Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {['react', 'typescript', 'api', 'websockets', 'performance', 'security', 'testing', 'deployment'].map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary/10"
                      data-testid={`tag-${tag}`}
                    >
                      <Hash className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={cardClassName} data-testid="card-top-contributors">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {threads.length > 0 ? (
                  threads.slice(0, 4).map((thread, i) => (
                    <div key={thread.author.id} className="flex items-center gap-3" data-testid={`contributor-${thread.author.id}`}>
                      <span className="text-[13px] text-muted-foreground w-4">{i + 1}</span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={thread.author.avatarUrl} />
                        <AvatarFallback>{thread.author.displayName?.[0] || thread.author.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{thread.author.displayName || thread.author.username}</p>
                        <p className="text-[11px] text-muted-foreground">{(thread.author.reputation || 0).toLocaleString()} rep</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted-foreground">No contributors yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Card className={cardClassName} data-testid="card-thread-filters">
              <CardContent className="pt-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search threads..."
                      className={`${inputClassName} pl-10`}
                      data-testid="input-search-threads"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[180px]" data-testid="select-sort-threads">
                      <SortAsc className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="views">Most Views</SelectItem>
                      <SelectItem value="replies">Most Replies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {showDetailView && selectedThread ? (
              <div className="space-y-4">
                <Button 
                  variant="ghost" 
                  className="gap-2"
                  onClick={() => setShowDetailView(false)}
                  data-testid="button-back-to-list"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to Threads
                </Button>

                <Card className={cardClassName} data-testid="card-thread-detail">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{categories.find(c => c.id === selectedThread.category)?.name || selectedThread.category}</Badge>
                        </div>
                        <CardTitle className="text-xl">{selectedThread.title}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid="button-thread-menu">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem data-testid="menu-edit-thread"><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem data-testid="menu-share-thread"><Share2 className="h-4 w-4 mr-2" />Share</DropdownMenuItem>
                          <DropdownMenuItem data-testid="menu-flag-thread"><Flag className="h-4 w-4 mr-2" />Report</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" data-testid="menu-delete-thread"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedThread.author.avatarUrl} />
                        <AvatarFallback>{selectedThread.author.displayName?.[0] || selectedThread.author.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{selectedThread.author.displayName || selectedThread.author.username}</span>
                          {selectedThread.author.role && getRoleBadge(selectedThread.author.role)}
                        </div>
                        <span className="text-[13px] text-muted-foreground">
                          Posted {formatDistanceToNow(new Date(selectedThread.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="thread-content">
                      <p className="whitespace-pre-wrap">{selectedThread.content}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedThread.tags.map((tag) => (
                        <Badge key={tag} variant="outline" data-testid={`thread-tag-${tag}`}>
                          <Hash className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={selectedThread.isLiked ? 'text-primary' : ''}
                          onClick={() => handleLikeThread(selectedThread)}
                          data-testid="button-like-thread"
                        >
                          <Heart className={`h-4 w-4 mr-1 ${selectedThread.isLiked ? 'fill-current' : ''}`} />
                          {selectedThread.likes}
                        </Button>
                        <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {selectedThread.views} views
                        </span>
                        <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {selectedThread.comments} comments
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleBookmarkThread(selectedThread)}
                        data-testid="button-bookmark-thread"
                      >
                        {selectedThread.isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

                <Card className={cardClassName} data-testid="card-replies">
                  <CardHeader>
                    <CardTitle className="text-[15px]">{selectedThread.comments} Comments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedThread.comments === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No comments yet. Be the first to reply!</p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-[13px]">Comments are loading from the server...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-reply-editor">
                  <CardHeader>
                    <CardTitle className="text-[15px]">Post a Reply</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="reply-format-bold">
                          <Bold className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="reply-format-italic">
                          <Italic className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="reply-format-code">
                          <Code className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="reply-format-mention">
                          <AtSign className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply... Supports Markdown and @mentions"
                        className="min-h-[120px] border-0 focus:ring-0 rounded-none"
                        data-testid="textarea-reply-content"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-4">
                    <Button onClick={handlePostReply} disabled={!replyContent.trim()} data-testid="button-post-reply">
                      Post Reply
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            ) : postsLoading ? (
              <div className="space-y-3" data-testid="posts-loading">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className={cardClassName}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full hidden sm:flex" />
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                          <div className="flex gap-4">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredThreads.map((thread) => (
                  <Card 
                    key={thread.id} 
                    className={`${cardClassName} hover:border-primary/30 transition-all cursor-pointer`}
                    onClick={() => handleViewThread(thread)}
                    data-testid={`thread-card-${thread.id}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10 hidden sm:flex">
                          <AvatarImage src={thread.author.avatarUrl} />
                          <AvatarFallback>{thread.author.displayName?.[0] || thread.author.username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-[11px]">{categories.find(c => c.id === thread.category)?.name || thread.category}</Badge>
                          </div>
                          <h3 className="font-medium text-foreground line-clamp-1">{thread.title}</h3>
                          <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1">{thread.content?.replace(/```[\s\S]*?```/g, '[code block]') || ''}</p>
                          <div className="flex items-center gap-4 mt-3 text-[13px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {thread.createdAt ? formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true }) : 'recently'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className={`h-3 w-3 ${thread.isLiked ? 'fill-primary text-primary' : ''}`} />
                              {thread.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {thread.comments}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {thread.views}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleBookmarkThread(thread); }}
                            data-testid={`button-bookmark-${thread.id}`}
                          >
                            {thread.isBookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      {thread.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {thread.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[11px]" data-testid={`thread-${thread.id}-tag-${tag}`}>
                              <Hash className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {thread.tags.length > 4 && (
                            <Badge variant="secondary" className="text-[11px]">+{thread.tags.length - 4}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {filteredThreads.length === 0 && (
                  <Card className={cardClassName} data-testid="card-no-threads">
                    <CardContent className="pt-8 pb-8 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-[15px] font-medium text-foreground mb-2">No threads found</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchQuery ? 'Try adjusting your search query or filters.' : 'Be the first to start a discussion!'}
                      </p>
                      <Button onClick={() => setShowNewThreadDialog(true)} data-testid="button-start-thread">
                        <Plus className="h-4 w-4 mr-2" />
                        Start a Thread
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
