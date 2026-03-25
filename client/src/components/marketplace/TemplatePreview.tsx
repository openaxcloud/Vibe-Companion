// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  X, ExternalLink, GitBranch, Download, Star, Heart, 
  Code2, Package, Calendar, Users, Shield, Globe, 
  Zap, Clock, Tag, ChevronRight, Play, Eye, Share2,
  MessageSquare, Award, TrendingUp, DollarSign, Copy, Check
} from 'lucide-react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TemplatePreviewProps {
  template: any;
  isOpen: boolean;
  onClose: () => void;
  onDeploy: () => void;
  onFork: () => void;
  onSelectTemplate?: (template: any) => void;
}

export function TemplatePreview({
  template,
  isOpen,
  onClose,
  onDeploy,
  onFork,
  onSelectTemplate,
}: TemplatePreviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch template reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: [`/api/marketplace/template/${template?.id}/reviews`],
    enabled: !!template?.id && isOpen,
  });

  // Fetch similar templates
  const { data: similarTemplates } = useQuery({
    queryKey: [`/api/marketplace/template/${template?.id}/similar`],
    enabled: !!template?.id && isOpen,
  });

  // Submit rating mutation
  const submitRating = useMutation({
    mutationFn: async ({ rating, review }: { rating: number; review: string }) => {
      return apiRequest('POST', `/api/marketplace/rate/${template.id}`, { rating, review });
    },
    onSuccess: () => {
      toast({
        title: 'Review Submitted',
        description: 'Thank you for your feedback!',
      });
      setRating(0);
      setReview('');
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/template', template.id, 'reviews'] });
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit review. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/templates/${template.slug || template.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Link Copied',
      description: 'Template link has been copied to clipboard',
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: template.name,
          text: template.description,
          url: `${window.location.origin}/templates/${template.slug || template.id}`,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSubmitReview = () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit a review',
        variant: 'destructive',
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating',
        variant: 'destructive',
      });
      return;
    }

    submitRating.mutate({ rating, review });
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                {template.name}
                {template.featured && (
                  <Badge className="bg-orange-500">Featured</Badge>
                )}
                {template.official && (
                  <Badge variant="secondary">Official</Badge>
                )}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{template.description}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-full">
          {/* Left Column - Preview */}
          <div className="flex-1 border-r">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid grid-cols-5 m-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="preview">Live Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="docs">Documentation</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-4 pb-4">
                <TabsContent value="overview" className="mt-0">
                  {/* Screenshot Gallery */}
                  <div className="space-y-4">
                    <div className="aspect-video bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10 rounded-lg overflow-hidden">
                      {template.thumbnail ? (
                        <img
                          src={template.thumbnail}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Code2 className="h-16 w-16 text-orange-500/50" />
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Key Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {template.features?.map((feature: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 text-orange-500 mt-0.5" />
                              <span className="text-[13px]">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Tech Stack */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Technology Stack</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {template.technologies?.map((tech: string) => (
                            <Badge key={tech} variant="secondary">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Similar Templates */}
                    {similarTemplates && similarTemplates.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Similar Templates</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3">
                            {similarTemplates.slice(0, 4).map((similar: any) => (
                              <div
                                key={similar.id}
                                className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                data-testid={`similar-template-${similar.id}`}
                                onClick={() => {
                                  if (onSelectTemplate) {
                                    onSelectTemplate(similar);
                                  }
                                }}
                              >
                                <h4 className="font-medium text-[13px] line-clamp-1">
                                  {similar.name}
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                  {similar.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-[11px]">
                                    {similar.category}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    {similar.stats?.rating?.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Live Demo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Play className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-[13px] text-muted-foreground">
                            Live preview would be embedded here
                          </p>
                          <Button
                            size="sm"
                            className="mt-4"
                            onClick={() => window.open(template.demoUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in New Tab
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="code" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Code Structure</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                        <code className="text-[13px]">
{`├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── index.tsx
│   │   ├── about.tsx
│   │   └── ...
│   ├── styles/
│   │   └── globals.css
│   └── utils/
│       └── ...
├── public/
│   └── ...
├── package.json
├── tsconfig.json
└── README.md`}
                        </code>
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reviews" className="mt-0 space-y-4">
                  {/* Write Review */}
                  {user && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Write a Review</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-[13px] mb-2 block">Your Rating</Label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Button
                                key={star}
                                variant="ghost"
                                size="sm"
                                className="p-0 h-8 w-8"
                                onClick={() => setRating(star)}
                              >
                                <Star
                                  className={cn(
                                    "h-5 w-5",
                                    star <= rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                                  )}
                                />
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[13px] mb-2 block">Your Review (Optional)</Label>
                          <Textarea
                            placeholder="Share your experience with this template..."
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <Button
                          onClick={handleSubmitReview}
                          disabled={submitRating.isPending}
                          className="bg-orange-500 hover:bg-orange-600"
                        >
                          Submit Review
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reviews List */}
                  {reviewsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-3 w-full mb-1" />
                            <Skeleton className="h-3 w-3/4" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews?.reviews?.map((review: any) => (
                        <Card key={review.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={review.user?.avatar} />
                                  <AvatarFallback>
                                    {review.user?.name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-[13px] font-medium">{review.user?.name}</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "h-3 w-3",
                                          i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                              </span>
                            </div>
                            {review.review && (
                              <p className="text-[13px] text-muted-foreground">
                                {review.review}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="docs" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Documentation</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm max-w-none">
                      <h3>Getting Started</h3>
                      <p>This template provides a starting point for building modern web applications.</p>
                      
                      <h4>Prerequisites</h4>
                      <ul>
                        <li>Node.js 18+ installed</li>
                        <li>npm or yarn package manager</li>
                        <li>Git for version control</li>
                      </ul>

                      <h4>Installation</h4>
                      <pre className="bg-muted p-3 rounded-lg">
                        <code>npm install</code>
                      </pre>

                      <h4>Development</h4>
                      <pre className="bg-muted p-3 rounded-lg">
                        <code>npm run dev</code>
                      </pre>

                      <h4>Build</h4>
                      <pre className="bg-muted p-3 rounded-lg">
                        <code>npm run build</code>
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Column - Details */}
          <div className="w-80 p-4 space-y-4">
            {/* Actions */}
            <div className="space-y-2">
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={onDeploy}>
                <Zap className="h-4 w-4 mr-2" />
                Deploy Now
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onFork}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Fork
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart className={cn("h-4 w-4 mr-2", isFavorite && "fill-current text-red-500")} />
                {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Button>
            </div>

            <Separator />

            {/* Stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Rating
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{template.stats?.rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-[13px] text-muted-foreground">
                    ({template.stats?.reviewCount || 0})
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Forks
                </span>
                <span className="font-medium">{template.stats?.forks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Downloads
                </span>
                <span className="font-medium">{template.stats?.downloads || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Views
                </span>
                <span className="font-medium">{template.stats?.views || 0}</span>
              </div>
            </div>

            <Separator />

            {/* Author */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px]">Created By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={template.author?.avatar} />
                    <AvatarFallback>
                      {(typeof template.author === 'object' ? (template.author?.name ?? 'U') : (template.author || 'U')).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-[13px]">{typeof template.author === 'object' ? template.author?.name : (template.author ?? 'Anonymous')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {template.author?.bio || 'Template developer'}
                    </p>
                  </div>
                </div>
                {template.author?.verified && (
                  <Badge variant="secondary" className="mt-3">
                    <Award className="h-3 w-3 mr-1" />
                    Verified Developer
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px]">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">License</span>
                  <span>{template.license || 'MIT'}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Version</span>
                  <span>{template.version || '1.0.0'}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Price */}
            {template.price && (
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-[13px] text-muted-foreground">Price</span>
                  <span className="text-2xl font-bold text-orange-500">
                    ${template.price}
                  </span>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}