import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Calendar, Clock, User, Eye, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ECodeLoading } from "@/components/ECodeLoading";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReplitLayout } from "@/components/layout/ReplitLayout";

export default function BlogDetail() {
  const params = useParams() as { slug: string };
  const [, setLocation] = useLocation();
  
  const { data: post, isLoading, error } = useQuery({
    queryKey: [`/api/blog/posts/${params.slug}`],
    enabled: !!params.slug,
  });

  const { data: relatedPosts } = useQuery({
    queryKey: [`/api/blog/categories/${post?.category}`],
    enabled: !!post?.category,
  });

  if (isLoading) {
    return (
      <ReplitLayout>
        <div className="flex items-center justify-center min-h-screen">
          <ECodeLoading size="lg" />
        </div>
      </ReplitLayout>
    );
  }

  if (error || !post) {
    return (
      <ReplitLayout>
        <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">The blog post you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/blog")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Button>
        </div>
      </ReplitLayout>
    );
  }

  const filteredRelatedPosts = relatedPosts?.filter((p: any) => p.slug !== post.slug).slice(0, 3) || [];

  return (
    <ReplitLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/blog")}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </div>
        </div>

        {/* Article */}
        <article className="container max-w-4xl mx-auto px-4 py-8">
          {/* Hero Section */}
          {post.coverImage && (
            <div className="mb-8">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Title and Meta */}
          <div className="mb-8">
            <Badge variant="secondary" className="mb-4">
              {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
            </Badge>
            
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{post.author}</span>
                {post.authorRole && (
                  <span className="text-xs">• {post.authorRole}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{post.readTime} min read</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{post.views} views</span>
              </div>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.tags.map((tag: string, index: number) => (
                  <Link key={index} href={`/blog?tag=${tag}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary"
                    >
                      <Hash className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Separator className="mb-8" />

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none mb-16">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>

          <Separator className="mb-8" />

          {/* Author Box */}
          <Card className="p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-ecode-orange to-orange-600 flex items-center justify-center text-white font-bold text-xl">
                {post.author.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{post.author}</h3>
                {post.authorRole && (
                  <p className="text-sm text-muted-foreground mb-2">{post.authorRole}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Passionate about building great developer experiences and sharing knowledge with the community.
                </p>
              </div>
            </div>
          </Card>

          {/* Related Posts */}
          {filteredRelatedPosts.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {filteredRelatedPosts.map((relatedPost: any) => (
                  <Card
                    key={relatedPost.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/blog/${relatedPost.slug}`)}
                  >
                    {relatedPost.coverImage && (
                      <img
                        src={relatedPost.coverImage}
                        alt={relatedPost.title}
                        className="w-full h-40 object-cover rounded-t-lg"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2">{relatedPost.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{relatedPost.readTime} min</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </ReplitLayout>
  );
}