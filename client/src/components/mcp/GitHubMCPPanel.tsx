// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Github, 
  GitBranch, 
  GitPullRequest, 
  GitCommit,
  Plus,
  Loader2,
  ExternalLink,
  Star,
  Eye,
  GitFork,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Repository {
  id: string;
  name: string;
  description: string;
  url: string;
  private: boolean;
  stars: number;
  forks: number;
  language: string;
  updatedAt: string;
}

export function GitHubMCPPanel({ projectId }: { projectId?: number }) {
  const [activeTab, setActiveTab] = useState('repositories');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Query for repositories
  const { data: repos, isLoading: reposLoading, refetch: refetchRepos } = useQuery<Repository[]>({
    queryKey: ['/api/mcp/github/repositories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/mcp/github/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      return response.json();
    },
    retry: false,
    onSuccess: (data) => {
      if (data && data.length > 0 && !newPR.repo) {
        setNewPR(prev => ({
          ...prev,
          repo: data[0].name
        }));
      }
    }
  });

  // Create repository mutation
  const createRepoMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isPrivate: boolean }) => {
      const response = await apiRequest('POST', '/api/mcp/github/repositories', data);
      if (!response.ok) throw new Error('Failed to create repository');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Repository Created',
        description: `Successfully created ${data.name}`
      });
      refetchRepos();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Create issue mutation
  const createIssueMutation = useMutation({
    mutationFn: async (data: { repo: string; title: string; body: string; labels: string[] }) => {
      const response = await apiRequest('POST', '/api/mcp/github/issues', data);
      if (!response.ok) throw new Error('Failed to create issue');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Issue Created',
        description: `Issue #${data.number} created successfully`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Create pull request mutation
  const createPRMutation = useMutation({
    mutationFn: async (data: { repo: string; title: string; body: string; head: string; base: string }) => {
      const response = await apiRequest('POST', '/api/mcp/github/pull-requests', data);
      if (!response.ok) throw new Error('Failed to create pull request');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Pull Request Created',
        description: `PR #${data.number} created successfully`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const [newRepo, setNewRepo] = useState({
    name: '',
    description: '',
    isPrivate: false
  });

  const [newIssue, setNewIssue] = useState({
    repo: '',
    title: '',
    body: '',
    labels: ''
  });

  const [newPR, setNewPR] = useState({
    repo: '',
    title: 'Merge changes to main',
    body: 'This PR merges the latest changes into the main branch.',
    head: 'develop',
    base: 'main'
  });

  // Auto-fill repo when repos load
  useEffect(() => {
    if (repos && repos.length > 0 && !newPR.repo) {
      setNewPR(prev => ({
        ...prev,
        repo: repos[0].name
      }));
    }
  }, [repos, newPR.repo]);

  const filteredRepos = repos?.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="h-full bg-[var(--ecode-bg)] border-[var(--ecode-border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-[var(--ecode-accent)]" />
            <CardTitle className="text-[var(--ecode-text)]">GitHub Integration</CardTitle>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        </div>
        <CardDescription className="text-[var(--ecode-muted)]">
          Manage repositories, issues, and pull requests directly from E-Code
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-[var(--ecode-sidebar)]">
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="create-repo">New Repo</TabsTrigger>
            <TabsTrigger value="create-issue">New Issue</TabsTrigger>
            <TabsTrigger value="create-pr">New PR</TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="space-y-4">
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
            />

            <ScrollArea className="h-[400px]">
              {reposLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--ecode-muted)]" />
                </div>
              ) : filteredRepos?.length === 0 ? (
                <div className="text-center py-8 text-[var(--ecode-muted)]">
                  <Github className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No repositories found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRepos?.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-3 rounded-lg bg-[var(--ecode-sidebar)] hover:bg-[var(--ecode-sidebar-hover)] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-[var(--ecode-text)]">{repo.name}</h4>
                            {repo.private && (
                              <Badge variant="outline" className="text-[11px]">Private</Badge>
                            )}
                          </div>
                          <p className="text-[13px] text-[var(--ecode-muted)] mb-2">{repo.description}</p>
                          <div className="flex items-center gap-4 text-[11px] text-[var(--ecode-muted)]">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {repo.stars}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="w-3 h-3" />
                              {repo.forks}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(repo.url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create-repo" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="repo-name">Repository Name</Label>
                <Input
                  id="repo-name"
                  placeholder="my-awesome-project"
                  value={newRepo.name}
                  onChange={(e) => setNewRepo({ ...newRepo, name: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="repo-desc">Description</Label>
                <Textarea
                  id="repo-desc"
                  placeholder="A brief description of your repository"
                  value={newRepo.description}
                  onChange={(e) => setNewRepo({ ...newRepo, description: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="repo-private"
                  checked={newRepo.isPrivate}
                  onChange={(e) => setNewRepo({ ...newRepo, isPrivate: e.target.checked })}
                />
                <Label htmlFor="repo-private">Make repository private</Label>
              </div>
              <Button
                onClick={() => createRepoMutation.mutate(newRepo)}
                disabled={!newRepo.name || createRepoMutation.isPending}
                className="w-full"
              >
                {createRepoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Repository
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="create-issue" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="issue-repo">Repository</Label>
                <Input
                  id="issue-repo"
                  placeholder="owner/repository"
                  value={newIssue.repo}
                  onChange={(e) => setNewIssue({ ...newIssue, repo: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="issue-title">Issue Title</Label>
                <Input
                  id="issue-title"
                  placeholder="Bug: Something is broken"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="issue-body">Description</Label>
                <Textarea
                  id="issue-body"
                  placeholder="Describe the issue in detail..."
                  value={newIssue.body}
                  onChange={(e) => setNewIssue({ ...newIssue, body: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] min-h-[100px]"
                />
              </div>
              <div>
                <Label htmlFor="issue-labels">Labels (comma-separated)</Label>
                <Input
                  id="issue-labels"
                  placeholder="bug, enhancement, help wanted"
                  value={newIssue.labels}
                  onChange={(e) => setNewIssue({ ...newIssue, labels: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <Button
                onClick={() => createIssueMutation.mutate({
                  ...newIssue,
                  labels: newIssue.labels.split(',').map(l => l.trim()).filter(Boolean)
                })}
                disabled={!newIssue.repo || !newIssue.title || createIssueMutation.isPending}
                className="w-full"
              >
                {createIssueMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2" />
                )}
                Create Issue
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="create-pr" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="pr-repo">Repository</Label>
                <Input
                  id="pr-repo"
                  placeholder="owner/repository"
                  value={newPR.repo}
                  onChange={(e) => setNewPR({ ...newPR, repo: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="pr-title">Pull Request Title</Label>
                <Input
                  id="pr-title"
                  placeholder="Feature: Add new functionality"
                  value={newPR.title}
                  onChange={(e) => setNewPR({ ...newPR, title: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                />
              </div>
              <div>
                <Label htmlFor="pr-body">Description</Label>
                <Textarea
                  id="pr-body"
                  placeholder="Describe your changes..."
                  value={newPR.body}
                  onChange={(e) => setNewPR({ ...newPR, body: e.target.value })}
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pr-head">Head Branch</Label>
                  <Input
                    id="pr-head"
                    placeholder="feature-branch"
                    value={newPR.head}
                    onChange={(e) => setNewPR({ ...newPR, head: e.target.value })}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                  />
                </div>
                <div>
                  <Label htmlFor="pr-base">Base Branch</Label>
                  <Input
                    id="pr-base"
                    placeholder="main"
                    value={newPR.base}
                    onChange={(e) => setNewPR({ ...newPR, base: e.target.value })}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)]"
                  />
                </div>
              </div>
              <Button
                onClick={() => createPRMutation.mutate(newPR)}
                disabled={!newPR.repo || !newPR.title || !newPR.head || createPRMutation.isPending}
                className="w-full"
              >
                {createPRMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <GitPullRequest className="w-4 h-4 mr-2" />
                )}
                Create Pull Request
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}