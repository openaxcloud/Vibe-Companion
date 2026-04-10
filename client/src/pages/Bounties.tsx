import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, Trophy, Code, Clock, Users, 
  ChevronRight, Filter, Search, Star, TrendingUp,
  Calendar, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { ECodeLoading } from '@/components/ECodeLoading';

export default function Bounties() {
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('browse');
  
  // Form state for creating bounty
  const [bountyForm, setBountyForm] = useState({
    title: '',
    description: '',
    reward: 100,
    difficulty: 'intermediate',
    deadline: '',
    tags: ''
  });

  // Fetch all bounties
  const { data: bounties = [], isLoading: loadingBounties } = useQuery({
    queryKey: ['/api/bounties'],
  });
  
  // Fetch user's bounties
  const { data: userBounties = [] } = useQuery({
    queryKey: ['/api/user/bounties'],
  });
  
  // Fetch user's submissions
  const { data: userSubmissions = [] } = useQuery({
    queryKey: ['/api/user/submissions'],
  });
  
  // Fetch user stats
  const { data: userStats } = useQuery({
    queryKey: ['/api/user/bounty-stats'],
  });
  
  // Count submissions for each bounty
  const bountiesWithCounts = (bounties as any[]).map((bounty: any) => {
    const submissionsCount = (userSubmissions as any[]).filter((sub: any) => sub.bountyId === bounty.id).length;
    return { ...bounty, submissions: submissionsCount };
  });
  
  // Filter and sort bounties
  const filteredBounties = bountiesWithCounts.filter((bounty: any) => {
    if (filter !== 'all' && bounty.status !== filter) return false;
    if (searchQuery && !bounty.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  const sortedBounties = [...filteredBounties].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'reward-high':
        return b.reward - a.reward;
      case 'reward-low':
        return a.reward - b.reward;
      case 'deadline':
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      default:
        return 0;
    }
  });
  
  // Create bounty mutation
  const createBountyMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/bounties', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bounties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/bounties'] });
      toast({
        title: "Bounty created!",
        description: "Your bounty has been posted successfully."
      });
      setSelectedTab('browse');
      setBountyForm({
        title: '',
        description: '',
        reward: 100,
        difficulty: 'intermediate',
        deadline: '',
        tags: ''
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create bounty. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Submit to bounty mutation
  const submitToBountyMutation = useMutation({
    mutationFn: async ({ bountyId, data }: { bountyId: number; data: any }) => {
      return apiRequest('POST', `/api/bounties/${bountyId}/submit`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/submissions'] });
      toast({
        title: "Submitted!",
        description: "Your submission has been sent to the bounty creator."
      });
    }
  });

  const handleApplyToBounty = (bountyId: number) => {
    const submissionUrl = prompt('Enter your submission URL (GitHub, demo link, etc.):');
    if (!submissionUrl) return;
    
    submitToBountyMutation.mutate({
      bountyId,
      data: {
        submissionUrl,
        feedback: 'Submission pending review'
      }
    });
  };

  const handleCreateBounty = (e: React.FormEvent) => {
    e.preventDefault();
    
    const tags = bountyForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    createBountyMutation.mutate({
      ...bountyForm,
      tags,
      deadline: new Date(bountyForm.deadline).toISOString()
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'advanced': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'submitted': return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3 text-[var(--ecode-text)]">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Bounties
        </h1>
        <p className="text-[var(--ecode-text-secondary)] mt-2 text-base">
          Solve problems, build projects, and earn rewards
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">${userStats?.totalEarned || 0}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{userStats?.completedCount || 0}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{userStats?.inProgressCount || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{userStats?.successRate || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse">Browse Bounties</TabsTrigger>
          <TabsTrigger value="my-bounties">My Bounties</TabsTrigger>
          <TabsTrigger value="create">Create Bounty</TabsTrigger>
        </TabsList>

        {/* Browse Bounties Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search bounties..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bounties</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="reward-high">Highest Reward</SelectItem>
                    <SelectItem value="reward-low">Lowest Reward</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bounty List */}
          <div className="space-y-4">
            {loadingBounties ? (
              <div className="flex items-center justify-center py-12">
                <ECodeLoading size="lg" text="Loading bounties..." />
              </div>
            ) : sortedBounties.length === 0 ? (
              <p className="text-center text-muted-foreground">No bounties found</p>
            ) : (
              sortedBounties.map((bounty) => (
              <Card key={bounty.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(bounty.status)}
                        <h3 className="text-lg font-semibold">{bounty.title}</h3>
                        <Badge className={getDifficultyColor(bounty.difficulty)}>
                          {bounty.difficulty}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-4">
                        {bounty.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {bounty.tags && Array.isArray(bounty.tags) && bounty.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Due {new Date(bounty.deadline).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{bounty.submissions || 0} submissions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{bounty.authorAvatar || '👤'}</span>
                            <span>{bounty.authorName}</span>
                            {bounty.authorVerified && (
                              <Badge variant="secondary" className="h-5">
                                <CheckCircle className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-green-600">${bounty.reward}</p>
                      <p className="text-sm text-muted-foreground mb-2">reward</p>
                      {bounty.status === 'open' ? (
                        <Button 
                          size="sm"
                          onClick={() => handleApplyToBounty(bounty.id)}
                        >
                          Apply
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      ) : bounty.status === 'completed' && bounty.winnerName ? (
                        <Badge variant="secondary">
                          Won by {bounty.winnerName}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {bounty.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )))}
          </div>
        </TabsContent>

        {/* My Bounties Tab */}
        <TabsContent value="my-bounties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Created Bounties</CardTitle>
              <CardDescription>
                Manage the bounties you've created
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(userBounties as any[]).length === 0 ? (
                <p className="text-center text-muted-foreground">You haven't created any bounties yet</p>
              ) : (
                (userBounties as any[]).map((bounty: any) => (
                <Card key={bounty.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(bounty.status)}
                          <h4 className="font-semibold">{bounty.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {bounty.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Created {new Date(bounty.createdAt).toLocaleDateString()}
                          </span>
                          <Badge variant="secondary">
                            {bounty.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">${bounty.reward}</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => window.location.href = `/bounties/${bounty.id}/manage`}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Your Submissions</CardTitle>
              <CardDescription>
                Track the status of your bounty submissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(userSubmissions as any[]).length === 0 ? (
                <p className="text-center text-muted-foreground">You haven't submitted to any bounties yet</p>
              ) : (
                (userSubmissions as any[]).map((submission: any) => (
                <Card key={submission.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(submission.status)}
                          <h4 className="font-semibold">Bounty #{submission.bountyId}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Submission: <a href={submission.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {submission.submissionUrl}
                          </a>
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                          </span>
                          <Badge variant={submission.status === 'accepted' ? 'default' : 'secondary'}>
                            {submission.status}
                          </Badge>
                        </div>
                        {submission.feedback && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            Feedback: {submission.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Bounty Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Bounty</CardTitle>
              <CardDescription>
                Post a bounty to get help from the community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBounty} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Bounty Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Build a REST API with Node.js"
                    value={bountyForm.title}
                    onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    className="min-h-[150px]"
                    placeholder="Describe what you need built, including requirements and deliverables..."
                    value={bountyForm.description}
                    onChange={(e) => setBountyForm({ ...bountyForm, description: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reward">Reward ($)</Label>
                    <Input
                      id="reward"
                      type="number"
                      placeholder="500"
                      min="10"
                      value={bountyForm.reward}
                      onChange={(e) => setBountyForm({ ...bountyForm, reward: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select 
                      value={bountyForm.difficulty} 
                      onValueChange={(value) => setBountyForm({ ...bountyForm, difficulty: value })}
                    >
                      <SelectTrigger id="difficulty">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={bountyForm.deadline}
                      onChange={(e) => setBountyForm({ ...bountyForm, deadline: e.target.value })}
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    placeholder="React, TypeScript, API, Frontend"
                    value={bountyForm.tags}
                    onChange={(e) => setBountyForm({ ...bountyForm, tags: e.target.value })}
                  />
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">Bounty Preview</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Reward:</strong> ${bountyForm.reward}</p>
                    <p><strong>Platform Fee (10%):</strong> ${Math.round(bountyForm.reward * 0.1)}</p>
                    <p><strong>You'll Pay:</strong> ${Math.round(bountyForm.reward * 1.1)}</p>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createBountyMutation.isPending}
                >
                  {createBountyMutation.isPending ? 'Creating...' : 'Create Bounty'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}