import { useState, useEffect } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Github, 
  GitBranch, 
  Import,
  Loader2,
  CheckCircle,
  AlertCircle,
  Folder,
  File,
  Star,
  GitFork,
  Clock,
  Users,
  Code,
  Lock,
  Unlock,
  Search,
  Link2,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { Link } from 'wouter';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  language?: string;
  updated_at: string;
  html_url: string;
  default_branch: string;
}

const languageColors: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#ffac45',
  Kotlin: '#F18E33',
  Rust: '#dea584',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#4fc08d',
  React: '#61dafb'
};

export default function GitHubImport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [importMethod, setImportMethod] = useState<'url' | 'oauth'>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [userRepos, setUserRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleUrlImport = async () => {
    if (!repoUrl) {
      toast({
        title: "Error",
        description: "Please enter a GitHub repository URL",
        variant: "destructive"
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to import repositories",
        variant: "destructive"
      });
      setLocation('/login');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    // Simulate import progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const response = await apiRequest('POST', '/api/git/clone', { url: repoUrl });

      clearInterval(progressInterval);
      setImportProgress(100);

      toast({
        title: "Import Successful",
        description: "Repository imported successfully!"
      });

      // Navigate to the new project
      const result = await response.json();
      setTimeout(() => {
        setLocation(`/project/${result.projectId}`);
      }, 1000);
    } catch (error) {
      clearInterval(progressInterval);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import repository",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleOAuthConnect = () => {
    // Redirect to GitHub OAuth flow
    window.location.href = '/api/auth/github';
  };

  const fetchUserRepos = async () => {
    setIsLoading(true);
    try {
      const repos = await apiRequest('GET', '/api/github/repos');
      setUserRepos(repos);
    } catch (error) {
      toast({
        title: "Failed to fetch repositories",
        description: error instanceof Error ? error.message : "Could not load your GitHub repositories",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has GitHub connected and fetch repos
  useEffect(() => {
    const checkGitHubConnection = async () => {
      try {
        const status = await apiRequest('GET', '/api/github/status');
        if (status.connected) {
          fetchUserRepos();
        }
      } catch (error) {
        // User hasn't connected GitHub yet
      }
    };

    if (isAuthenticated && importMethod === 'oauth') {
      checkGitHubConnection();
    }
  }, [isAuthenticated, importMethod]);

  const handleRepoSelect = async (repo: Repository) => {
    setSelectedRepo(repo);
    setIsImporting(true);
    setImportProgress(0);

    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const response = await apiRequest('POST', '/api/git/clone', { 
        url: repo.html_url,
        branch: repo.default_branch
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      toast({
        title: "Import Successful",
        description: `${repo.name} imported successfully!`
      });

      const result = await response.json();
      setTimeout(() => {
        setLocation(`/project/${result.projectId}`);
      }, 1000);
    } catch (error) {
      clearInterval(progressInterval);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import repository",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const filteredRepos = userRepos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-muted/30 to-background">
        <div className="container-responsive py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="default" className="mb-4">
              <Sparkles className="h-4 w-4 mr-1" />
              SEAMLESS INTEGRATION
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Import from GitHub
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Bring your existing projects to E-Code in seconds. Keep your commit history, 
              branches, and collaborate with the power of AI.
            </p>
          </div>
        </div>
      </section>

      {/* Import Methods */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="max-w-4xl mx-auto">
            <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Import by URL</TabsTrigger>
                <TabsTrigger value="oauth">Connect GitHub Account</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Import Repository by URL</CardTitle>
                    <CardDescription>
                      Paste any public GitHub repository URL to import it instantly
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-url">Repository URL</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Github className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="repo-url"
                            placeholder="https://github.com/username/repository"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="pl-10"
                            disabled={isImporting}
                          />
                        </div>
                        <Button 
                          onClick={handleUrlImport}
                          disabled={isImporting || !repoUrl}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Import className="mr-2 h-4 w-4" />
                              Import
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {isImporting && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[13px]">
                          <span>Importing repository...</span>
                          <span>{importProgress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${importProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You can import any public repository. For private repositories, 
                        connect your GitHub account in the next tab.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="oauth" className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Connect Your GitHub Account</CardTitle>
                    <CardDescription>
                      Access all your repositories, including private ones
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {userRepos.length === 0 ? (
                      <div className="text-center py-12">
                        <Github className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-[15px] font-semibold mb-2">Connect to GitHub</h3>
                        <p className="text-muted-foreground mb-6">
                          Link your GitHub account to import repositories with one click
                        </p>
                        <Button size="lg" onClick={handleOAuthConnect}>
                          <Github className="mr-2 h-5 w-5" />
                          Connect GitHub Account
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="font-medium">GitHub Connected</span>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search repositories..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 w-64"
                            />
                          </div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {isLoading ? (
                            <div className="text-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                              <p className="text-muted-foreground">Loading repositories...</p>
                            </div>
                          ) : filteredRepos.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground">No repositories found</p>
                            </div>
                          ) : (
                            filteredRepos.map((repo) => (
                              <Card 
                                key={repo.id} 
                                className="cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleRepoSelect(repo)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold">{repo.name}</h4>
                                        {repo.private ? (
                                          <Lock className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <Unlock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        {repo.language && (
                                          <Badge variant="secondary" className="text-[11px]">
                                            <span 
                                              className="w-2 h-2 rounded-full mr-1"
                                              style={{ backgroundColor: languageColors[repo.language] || '#ccc' }}
                                            />
                                            {repo.language}
                                          </Badge>
                                        )}
                                      </div>
                                      {repo.description && (
                                        <p className="text-[13px] text-muted-foreground mb-2">
                                          {repo.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Star className="h-3 w-3" />
                                          {repo.stargazers_count}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <GitFork className="h-3 w-3" />
                                          {repo.forks_count}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          Updated {new Date(repo.updated_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost">
                                      <Import className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Import to E-Code?
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-2xl mx-auto">
              Enhance your existing projects with AI-powered development
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI Enhancement</CardTitle>
                <CardDescription>
                  Add AI capabilities to your existing code. Get intelligent suggestions, 
                  automated refactoring, and bug detection.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Real-time Collaboration</CardTitle>
                <CardDescription>
                  Work together with your team in real-time. See live cursors, 
                  share terminals, and code together seamlessly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <GitBranch className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Git Integration</CardTitle>
                <CardDescription>
                  Keep your Git history intact. Continue using branches, commits, 
                  and pull requests with enhanced E-Code features.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Import Steps */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Import your GitHub repository in three simple steps
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Choose Repository</h3>
                <p className="text-[13px] text-muted-foreground">
                  Paste a URL or connect your GitHub account to select a repository
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Import & Setup</h3>
                <p className="text-[13px] text-muted-foreground">
                  E-Code clones your repository and sets up the development environment
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Start Coding</h3>
                <p className="text-[13px] text-muted-foreground">
                  Begin coding with AI assistance, real-time collaboration, and instant preview
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="container-responsive">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Enhance Your Projects?
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8">
              Import your GitHub repositories and experience the power of AI-assisted development
            </p>
            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/docs/github-import">
                    View Documentation
                  </Link>
                </Button>
              </div>
            ) : (
              <Button 
                size="lg" 
                onClick={() => setImportMethod('oauth')}
                className="animate-pulse"
              >
                <Github className="mr-2 h-5 w-5" />
                Import Your First Repository
              </Button>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}