// @ts-nocheck
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  ThumbsUp, 
  MessageSquare, 
  Bookmark, 
  Share2, 
  Eye,
  Code2,
  Send,
  MoreVertical
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ECodeLoading } from "@/components/ECodeLoading";

interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  reputation: number;
}

interface Comment {
  id: string;
  author: Author;
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: Author;
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
  commentsData?: Comment[];
}

export default function CommunityPost() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  // Fetch post data
  const { data: post, isLoading } = useQuery<Post>({
    queryKey: [`/api/community/posts/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/community/posts/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Post not found');
        }
        throw new Error('Failed to fetch post');
      }
      return response.json();
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/community/posts/${id}/like`);
      if (!res.ok) throw new Error('Failed to like post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts/${id}`] });
    },
  });

  // Bookmark post mutation
  const bookmarkPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/community/posts/${id}/bookmark`);
      if (!res.ok) throw new Error('Failed to bookmark post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts/${id}`] });
      toast({
        title: "Post bookmarked",
        description: "Added to your bookmarks",
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', `/api/community/posts/${id}/comments`, { content });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/community/posts/${id}`] });
      setCommentText("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      });
    },
  });

  const handleAddComment = () => {
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      showcase: 'bg-blue-500/10 text-blue-500',
      tutorials: 'bg-green-500/10 text-green-500',
      help: 'bg-yellow-500/10 text-yellow-500',
      discussion: 'bg-purple-500/10 text-purple-500',
      challenges: 'bg-red-500/10 text-red-500',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative h-full min-h-[calc(100vh-100px)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <ECodeLoading size="lg" text="Loading post..." />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Code2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Post not found</h2>
            <p className="text-muted-foreground mb-6">
              This post may have been removed or doesn't exist.
            </p>
            <Button onClick={() => navigate('/community')}>
              Back to Community
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/community')}
          className="mb-6"
          data-testid="button-back-to-community"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Community
        </Button>

        {/* Main post */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={post.author.avatarUrl} />
                  <AvatarFallback>
                    {(post.author?.displayName || post.author?.username || "??").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{post.author?.displayName || post.author?.username || 'Unknown'}</h3>
                  <p className="text-[13px] text-muted-foreground">
                    @{post.author?.username || 'unknown'} • {post.createdAt}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-post-options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              <Badge className={getCategoryColor(post.category)}>
                {post.category}
              </Badge>
            </div>

            {post.imageUrl && (
              <img 
                src={post.imageUrl} 
                alt={post.title}
                className="w-full rounded-lg border"
              />
            )}

            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{post.content}</p>
            </div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {post.projectUrl && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(post.projectUrl!)}
              >
                <Code2 className="h-4 w-4 mr-2" />
                View Project
              </Button>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant={post.isLiked ? "default" : "ghost"}
                  size="sm"
                  onClick={() => likePostMutation.mutate()}
                  disabled={likePostMutation.isPending}
                  data-testid="button-like-post"
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  {post.likes}
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  {post.comments}
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  <Eye className="h-4 w-4 mr-1" />
                  {post.views}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={post.isBookmarked ? "default" : "ghost"}
                  size="icon"
                  onClick={() => bookmarkPostMutation.mutate()}
                  disabled={bookmarkPostMutation.isPending}
                  data-testid="button-bookmark-post"
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" data-testid="button-share-post">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments section */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Comments ({post.comments})</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add comment form */}
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>ME</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  data-testid="textarea-comment"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    data-testid="button-submit-comment"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Comment
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Comments list */}
            {post.commentsData && post.commentsData.length > 0 ? (
              <div className="space-y-4">
                {post.commentsData.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.author?.avatarUrl} />
                      <AvatarFallback>
                        {(comment.author?.displayName || comment.author?.username || "??").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{comment.author?.displayName || comment.author?.username || 'Unknown'}</h4>
                        <span className="text-[13px] text-muted-foreground">
                          • {comment.createdAt}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mb-2">
                        {comment.content}
                      </p>
                      <Button
                        variant={comment.isLiked ? "default" : "ghost"}
                        size="sm"
                        disabled
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        {comment.likes}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Be the first to comment on this post!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}