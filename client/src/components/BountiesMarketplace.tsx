// @ts-nocheck
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Trophy, DollarSign, Clock, Users, Star, Filter, Search, 
  CheckCircle, AlertCircle, Loader2, Eye, Send, Crown, Shield
} from 'lucide-react';
import type { Bounty } from '@shared/schema';

const applyFormSchema = z.object({
  proposal: z.string().min(10, 'Proposal must be at least 10 characters'),
  estimatedTime: z.string().optional(),
});

const rateFormSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1 star').max(5, 'Rating cannot exceed 5 stars'),
  comment: z.string().optional(),
});

interface BountyFilters {
  status: string;
  minAmount: string;
  maxAmount: string;
  skills: string;
  difficulty: string;
  featured: string;
  sortBy: string;
  sortOrder: string;
  page: number;
  limit: number;
}

interface BountyListResponse {
  bounties: Bounty[];
  total: number;
  page: number;
  limit: number;
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  disputed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const payoutStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
};

function RatingStars({ rating, count }: { rating: number | null; count?: number }) {
  const displayRating = rating || 0;
  return (
    <div className="flex items-center gap-1" data-testid="rating-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= displayRating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          }`}
        />
      ))}
      {rating !== null && (
        <span className="text-[13px] text-muted-foreground ml-1">
          {displayRating.toFixed(1)}
          {count !== undefined && ` (${count})`}
        </span>
      )}
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  
  const colorClass = payoutStatusColors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <Badge className={colorClass} data-testid={`payout-status-${status}`}>
      {status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
      {status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
      {status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
      Payout: {status}
    </Badge>
  );
}

function InteractiveRatingStars({ 
  rating, 
  onRatingChange, 
  disabled = false 
}: { 
  rating: number; 
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  
  return (
    <div className="flex items-center gap-1" data-testid="interactive-rating-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={`p-1 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}`}
          onMouseEnter={() => !disabled && setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => !disabled && onRatingChange(star)}
          data-testid={`rating-star-${star}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= (hoverRating || rating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      {rating > 0 && (
        <span className="text-[13px] text-muted-foreground ml-2">
          {rating} star{rating !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function BountyCard({ bounty, onApply }: { bounty: Bounty; onApply: (id: number) => void }) {
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [proposal, setProposal] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const { toast } = useToast();

  const applyMutation = useMutation({
    mutationFn: async (data: { proposal: string; estimatedTime?: string }) => {
      const validation = applyFormSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(validation.error.errors[0]?.message || 'Invalid form data');
      }
      return apiRequest('POST', `/api/bounties/${bounty.id}/apply`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Application submitted!',
        description: `Your application for "${bounty.title}" has been sent to the bounty poster.`,
      });
      setShowApplyDialog(false);
      setProposal('');
      setEstimatedTime('');
      queryClient.invalidateQueries({ queryKey: ['/api/bounties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bounties', 'featured'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Application failed',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      });
    },
  });

  const rateMutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      const validation = rateFormSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(validation.error.errors[0]?.message || 'Invalid rating data');
      }
      return apiRequest('POST', `/api/bounties/${bounty.id}/rate`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Rating submitted!',
        description: `Thank you for rating "${bounty.title}".`,
      });
      setShowRateDialog(false);
      setRatingValue(0);
      setRatingComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/bounties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bounties', 'featured'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Rating failed',
        description: error.message || 'Failed to submit rating',
        variant: 'destructive',
      });
    },
  });

  const handleApply = () => {
    const validation = applyFormSchema.safeParse({ 
      proposal: proposal.trim(), 
      estimatedTime: estimatedTime || undefined 
    });
    
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0]?.message || 'Please check your input',
        variant: 'destructive',
      });
      return;
    }
    applyMutation.mutate({ proposal: proposal.trim(), estimatedTime: estimatedTime || undefined });
  };

  const handleRate = () => {
    const validation = rateFormSchema.safeParse({ 
      rating: ratingValue, 
      comment: ratingComment || undefined 
    });
    
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0]?.message || 'Please select a rating between 1-5 stars',
        variant: 'destructive',
      });
      return;
    }
    rateMutation.mutate({ rating: ratingValue, comment: ratingComment || undefined });
  };

  const deadlineDate = bounty.deadline ? new Date(bounty.deadline) : null;
  const isExpired = deadlineDate && deadlineDate < new Date();
  
  return (
    <Card 
      className={`transition-all hover:shadow-lg ${bounty.featured ? 'border-yellow-400 border-2' : ''}`}
      data-testid={`bounty-card-${bounty.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {bounty.featured && (
                <Badge variant="default" className="bg-yellow-500" data-testid="badge-featured">
                  <Crown className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
              <Badge className={statusColors[bounty.status || 'open']} data-testid={`status-${bounty.status || 'open'}`}>
                {(bounty.status || 'open').replace('_', ' ')}
              </Badge>
              {bounty.difficulty && (
                <Badge className={difficultyColors[bounty.difficulty]} data-testid={`difficulty-${bounty.difficulty}`}>
                  {bounty.difficulty}
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl" data-testid={`text-bounty-title-${bounty.id}`}>{bounty.title}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2" data-testid="bounty-description">
              {bounty.description}
            </CardDescription>
          </div>
          <div className="text-right ml-4">
            <div className="text-2xl font-bold text-green-600" data-testid={`text-bounty-amount-${bounty.id}`}>
              ${(Number(bounty.amount) / 100).toFixed(2)}
            </div>
            {bounty.payoutStatus && (
              <PayoutStatusBadge status={bounty.payoutStatus} />
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {bounty.skills && bounty.skills.map((skill, index) => (
            <Badge key={index} variant="outline" data-testid={`skill-${skill}`}>
              {skill}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="bounty-views">
            <Eye className="h-4 w-4" />
            <span>{bounty.viewsCount || 0} views</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="bounty-applications">
            <Users className="h-4 w-4" />
            <span>{bounty.applicationsCount || 0} applications</span>
          </div>
          {deadlineDate && (
            <div 
              className={`flex items-center gap-2 ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}
              data-testid="bounty-deadline"
            >
              <Clock className="h-4 w-4" />
              <span>{isExpired ? 'Expired' : deadlineDate.toLocaleDateString()}</span>
            </div>
          )}
          {bounty.hunterRating && (
            <div className="flex items-center gap-2" data-testid="hunter-rating-display">
              <Shield className="h-4 w-4 text-blue-500" />
              <span>Hunter: </span>
              <RatingStars rating={Number(bounty.hunterRating)} />
            </div>
          )}
        </div>

        {bounty.posterRating && (
          <div className="flex items-center gap-2 text-[13px]" data-testid="poster-rating-display">
            <span className="text-muted-foreground">Poster Rating:</span>
            <RatingStars rating={Number(bounty.posterRating)} />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={() => navigate(`/bounties/${bounty.id}`)}
          data-testid={`view-bounty-${bounty.id}`}
        >
          View Details
        </Button>
        
        <div className="flex gap-2">
          {bounty.status === 'completed' && (
            <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid={`button-open-rating-dialog-${bounty.id}`}>
                  <Star className="h-4 w-4 mr-2" />
                  Rate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Rate: {bounty.title}</DialogTitle>
                  <DialogDescription>
                    Share your experience working on this bounty.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Your Rating</Label>
                    <InteractiveRatingStars
                      rating={ratingValue}
                      onRatingChange={setRatingValue}
                      disabled={rateMutation.isPending}
                    />
                    {ratingValue === 0 && (
                      <p className="text-[13px] text-muted-foreground">
                        Click to select a rating (1-5 stars required)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ratingComment">Comment (optional)</Label>
                    <Textarea
                      id="ratingComment"
                      placeholder="Share your experience..."
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      rows={3}
                      data-testid="input-rating-comment"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleRate} 
                    disabled={rateMutation.isPending || ratingValue === 0}
                    data-testid="button-submit-rating"
                  >
                    {rateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Rating'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {bounty.status === 'open' && !isExpired && (
            <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
              <DialogTrigger asChild>
                <Button data-testid={`button-apply-${bounty.id}`}>
                  <Send className="h-4 w-4 mr-2" />
                  Apply Now
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Apply to: {bounty.title}</DialogTitle>
                  <DialogDescription>
                    Submit your proposal for this bounty. The poster will review your application.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="proposal">Your Proposal (min 10 characters)</Label>
                    <Textarea
                      id="proposal"
                      placeholder="Describe how you would complete this bounty..."
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      rows={5}
                      data-testid="input-proposal"
                    />
                    {proposal.length > 0 && proposal.length < 10 && (
                      <p className="text-[13px] text-destructive">
                        {10 - proposal.length} more characters needed
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedTime">Estimated Time (optional)</Label>
                    <Input
                      id="estimatedTime"
                      placeholder="e.g., 2 days, 1 week"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      data-testid="input-estimated-time"
                    />
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-[13px]">
                    <div className="flex justify-between items-center">
                      <span>Bounty Amount:</span>
                      <span className="font-bold text-green-600">${(Number(bounty.amount) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowApplyDialog(false)} data-testid="button-close-apply-dialog">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleApply} 
                    disabled={applyMutation.isPending}
                    data-testid="button-submit-application"
                  >
                    {applyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function BountyCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28 ml-auto" />
      </CardFooter>
    </Card>
  );
}

export default function BountiesMarketplace() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BountyFilters>({
    status: 'open',
    minAmount: '',
    maxAmount: '',
    skills: '',
    difficulty: '',
    featured: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 12,
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        params.append(key, String(value));
      }
    });
    return params.toString();
  };

  const { data, isLoading, error } = useQuery<BountyListResponse>({
    queryKey: ['/api/bounties', filters],
    queryFn: async () => {
      const response = await fetch(`/api/bounties?${buildQueryString()}`);
      if (!response.ok) throw new Error('Failed to fetch bounties');
      return response.json();
    },
  });

  const { data: featuredData } = useQuery<{ bounties: Bounty[] }>({
    queryKey: ['/api/bounties', 'featured'],
    queryFn: async () => {
      const response = await fetch('/api/bounties/featured?limit=3');
      if (!response.ok) throw new Error('Failed to fetch featured bounties');
      return response.json();
    },
  });

  const handleApply = (bountyId: number) => {
    queryClient.invalidateQueries({ queryKey: ['/api/bounties'] });
  };

  const updateFilter = (key: keyof BountyFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key === 'page' ? value as number : 1 }));
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="bounties-marketplace">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="marketplace-title">
              <Trophy className="h-8 w-8 text-yellow-500" />
              Bounties Marketplace
            </h1>
            <p className="text-muted-foreground">
              Discover opportunities and earn rewards for your skills
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            data-testid="toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-6" data-testid="filters-panel">
          <CardHeader>
            <CardTitle className="text-[15px]">Filter Bounties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => updateFilter('status', value)}
                >
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select 
                  value={filters.difficulty} 
                  onValueChange={(value) => updateFilter('difficulty', value)}
                >
                  <SelectTrigger data-testid="filter-difficulty">
                    <SelectValue placeholder="Any difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Min Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={(e) => updateFilter('minAmount', e.target.value)}
                  data-testid="filter-min-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={filters.maxAmount}
                  onChange={(e) => updateFilter('maxAmount', e.target.value)}
                  data-testid="filter-max-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Skills (comma separated)</Label>
                <Input
                  placeholder="React, TypeScript, Node.js"
                  value={filters.skills}
                  onChange={(e) => updateFilter('skills', e.target.value)}
                  data-testid="filter-skills"
                />
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select 
                  value={filters.sortBy} 
                  onValueChange={(value) => updateFilter('sortBy', value)}
                >
                  <SelectTrigger data-testid="filter-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Posted</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="views">Most Viewed</SelectItem>
                    <SelectItem value="applications">Most Applied</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order</Label>
                <div className="flex gap-2">
                  <Select 
                    value={filters.sortOrder} 
                    onValueChange={(value) => updateFilter('sortOrder', value)}
                  >
                    <SelectTrigger data-testid="filter-sort-order">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    data-testid="button-toggle-sort-order"
                  >
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Featured Only</Label>
                <Select 
                  value={filters.featured} 
                  onValueChange={(value) => updateFilter('featured', value)}
                >
                  <SelectTrigger data-testid="filter-featured">
                    <SelectValue placeholder="All bounties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="true">Featured Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end mt-4 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  status: 'open',
                  minAmount: '',
                  maxAmount: '',
                  skills: '',
                  difficulty: '',
                  featured: '',
                  sortBy: 'createdAt',
                  sortOrder: 'desc',
                  page: 1,
                  limit: 12,
                })}
                data-testid="reset-filters"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {featuredData && featuredData.bounties.length > 0 && filters.status === 'open' && !filters.featured && (
        <div className="mb-8" data-testid="featured-section">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Featured Bounties
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredData.bounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} onApply={handleApply} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold" data-testid="bounties-list-title">
          {filters.featured === 'true' ? 'Featured Bounties' : 'All Bounties'}
          {data && <span className="text-muted-foreground font-normal ml-2">({data.total} results)</span>}
        </h2>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="loading-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <BountyCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center" data-testid="error-state">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-[15px] font-semibold mb-2">Failed to load bounties</h3>
          <p className="text-muted-foreground">Please try again later</p>
        </Card>
      ) : data && data.bounties.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="bounties-grid">
            {data.bounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} onApply={handleApply} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8" data-testid="pagination">
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => updateFilter('page', filters.page - 1)}
                data-testid="prev-page"
              >
                Previous
              </Button>
              <span className="px-4 text-[13px] text-muted-foreground">
                Page {filters.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={filters.page >= totalPages}
                onClick={() => updateFilter('page', filters.page + 1)}
                data-testid="next-page"
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="p-12 text-center" data-testid="empty-state">
          <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No bounties found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters or check back later for new opportunities
          </p>
          <Button 
            variant="outline"
            onClick={() => setFilters({
              status: 'open',
              minAmount: '',
              maxAmount: '',
              skills: '',
              difficulty: '',
              featured: '',
              sortBy: 'createdAt',
              sortOrder: 'desc',
              page: 1,
              limit: 12,
            })}
          >
            Clear Filters
          </Button>
        </Card>
      )}
    </div>
  );
}
