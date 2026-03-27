import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, ArrowLeft, ThumbsUp, MessageCircle, Clock,
  Plus, Send, User, ChevronDown, ChevronUp, Filter, TrendingUp,
  Flame, X, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Community() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const postsQuery = useQuery({
    queryKey: ["/api/community/posts", sortBy],
    queryFn: () => apiRequest("GET", `/api/community/posts?sort=${sortBy}`).then(r => r.json()),
  });

  const createPostMutation = useMutation({
    mutationFn: (data: { title: string; content: string; category: string }) =>
      apiRequest("POST", "/api/community/posts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setShowNewPost(false);
      setNewTitle("");
      setNewContent("");
      toast({ title: "Post created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (data: { postId: string; content: string }) =>
      apiRequest("POST", `/api/community/posts/${data.postId}/replies`, { content: data.content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setReplyContent("");
      toast({ title: "Reply posted" });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) =>
      apiRequest("POST", `/api/community/posts/${postId}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const posts = postsQuery.data?.posts || [];
  const categories = [
    { id: "general", label: "General", color: "text-blue-400 bg-blue-500/10" },
    { id: "showcase", label: "Showcase", color: "text-purple-400 bg-purple-500/10" },
    { id: "help", label: "Help", color: "text-yellow-400 bg-yellow-500/10" },
    { id: "feedback", label: "Feedback", color: "text-green-400 bg-green-500/10" },
    { id: "tutorials", label: "Tutorials", color: "text-orange-400 bg-orange-500/10" },
  ];

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="community-page">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[12px]">Dashboard</span>
        </button>
        <div className="w-px h-5 bg-[var(--ide-border)]" />
        <MessageSquare className="w-4 h-4 text-[#7C65CB]" />
        <h1 className="text-[14px] font-semibold">Community</h1>
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-8 text-[11px] gap-1.5 bg-[#7C65CB] hover:bg-[#6B54BA] text-white"
          onClick={() => setShowNewPost(true)}
          data-testid="button-new-post"
        >
          <Plus className="w-3.5 h-3.5" />
          New Post
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {showNewPost && (
            <div className="mb-6 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-4" data-testid="new-post-form">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold">New Post</h3>
                <button onClick={() => setShowNewPost(false)} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-9 px-3 text-[13px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]/50 mb-2"
                data-testid="input-post-title"
              />
              <textarea
                placeholder="Write your post..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-[12px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]/50 resize-none mb-2"
                data-testid="input-post-content"
              />
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                        newCategory === cat.id ? cat.color + " ring-1 ring-current" : "text-[var(--ide-text-muted)] bg-[var(--ide-surface)] hover:text-[var(--ide-text)]"
                      }`}
                      onClick={() => setNewCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <Button
                  size="sm"
                  className="h-8 text-[11px] gap-1.5 bg-[#7C65CB] hover:bg-[#6B54BA] text-white"
                  onClick={() => createPostMutation.mutate({ title: newTitle, content: newContent, category: newCategory })}
                  disabled={!newTitle.trim() || !newContent.trim() || createPostMutation.isPending}
                  data-testid="button-submit-post"
                >
                  <Send className="w-3 h-3" />
                  Post
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${sortBy === "recent" ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
              onClick={() => setSortBy("recent")}
              data-testid="sort-recent"
            >
              <Clock className="w-3.5 h-3.5" /> Recent
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${sortBy === "popular" ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
              onClick={() => setSortBy("popular")}
              data-testid="sort-popular"
            >
              <Flame className="w-3.5 h-3.5" /> Popular
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 text-[var(--ide-text-muted)] mx-auto mb-3" />
              <h3 className="text-[14px] font-semibold mb-1">No posts yet</h3>
              <p className="text-[12px] text-[var(--ide-text-muted)]">Be the first to start a discussion!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post: any) => {
                const isExpanded = expandedPost === post.id;
                const cat = categories.find(c => c.id === post.category);
                return (
                  <div key={post.id} className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl overflow-hidden" data-testid={`post-${post.id}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--ide-surface)] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-[var(--ide-text-muted)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-medium">{post.authorName || "Anonymous"}</span>
                            <span className="text-[10px] text-[var(--ide-text-muted)]">{formatTime(post.createdAt)}</span>
                            {cat && <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${cat.color}`}>{cat.label}</span>}
                          </div>
                          <h3 className="text-[13px] font-semibold mb-1">{post.title}</h3>
                          <p className="text-[12px] text-[var(--ide-text-secondary)] line-clamp-2">{post.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3 ml-11">
                        <button
                          className={`flex items-center gap-1 text-[11px] transition-colors ${post.liked ? "text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[#7C65CB]"}`}
                          onClick={() => likeMutation.mutate(post.id)}
                          data-testid={`button-like-${post.id}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {post.likes || 0}
                        </button>
                        <button
                          className="flex items-center gap-1 text-[11px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                          data-testid={`button-replies-${post.id}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {post.replyCount || 0} replies
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[var(--ide-border)] bg-[var(--ide-bg)]/50 p-4">
                        {(post.replies || []).map((reply: any) => (
                          <div key={reply.id} className="flex gap-2.5 mb-3 last:mb-0">
                            <div className="w-6 h-6 rounded-full bg-[var(--ide-surface)] flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-3 h-3 text-[var(--ide-text-muted)]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium">{reply.authorName || "Anonymous"}</span>
                                <span className="text-[10px] text-[var(--ide-text-muted)]">{formatTime(reply.createdAt)}</span>
                              </div>
                              <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--ide-border)]/50">
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={expandedPost === post.id ? replyContent : ""}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && replyContent.trim() && replyMutation.mutate({ postId: post.id, content: replyContent })}
                            className="flex-1 h-8 px-3 text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#7C65CB]/50"
                            data-testid={`input-reply-${post.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-8 text-[10px] bg-[#7C65CB] hover:bg-[#6B54BA] text-white"
                            onClick={() => replyContent.trim() && replyMutation.mutate({ postId: post.id, content: replyContent })}
                            disabled={!replyContent.trim() || replyMutation.isPending}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
