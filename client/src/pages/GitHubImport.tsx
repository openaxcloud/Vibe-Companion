import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { 
  GitBranch, 
  Github, 

  Check,
  AlertCircle,
  Info,
  Search,
  Code,
  Users,
  Star,
  GitFork,
  Clock,
  FolderGit,
  File,
  Lock,
  Globe,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { ECodeSpinner } from '@/components/ECodeLoading';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  stars: number;
  forks: number;
  language: string;
  updated_at: string;
  default_branch: string;
  size: number;
}

export default function GitHubImport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [importMethod, setImportMethod] = useState<'url' | 'search' | 'account'>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branch, setBranch] = useState('main');
  const [projectName, setProjectName] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [includeHistory, setIncludeHistory] = useState(true);
  const [includeLFS, setIncludeLFS] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [myRepos, setMyRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Mock search results for demonstration
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setSearchResults([
        {
          id: 1,
          name: 'awesome-project',
          full_name: 'user/awesome-project',
          description: 'An awesome project built with React and TypeScript',
          private: false,
          stars: 1234,
          forks: 567,
          language: 'TypeScript',
          updated_at: new Date().toISOString(),
          default_branch: 'main',
          size: 45678
        },
        {
          id: 2,
          name: 'react-components',
          full_name: 'org/react-components',
          description: 'A collection of reusable React components',
          private: false,
          stars: 890,
          forks: 234,
          language: 'JavaScript',
          updated_at: new Date().toISOString(),
          default_branch: 'master',
          size: 23456
        }
      ]);
      setIsSearching(false);
    }, 1000);
  };

  // Mock loading user repos
  const loadMyRepos = () => {
    setIsLoadingRepos(true);
    setTimeout(() => {
      setMyRepos([
        {
          id: 3,
          name: 'my-portfolio',
          full_name: 'myusername/my-portfolio',
          description: 'Personal portfolio website',
          private: false,
          stars: 12,
          forks: 3,
          language: 'HTML',
          updated_at: new Date().toISOString(),
          default_branch: 'main',
          size: 12345
        },
        {
          id: 4,
          name: 'private-project',
          full_name: 'myusername/private-project',
          description: 'A private project',
          private: true,
          stars: 0,
          forks: 0,
          language: 'Python',
          updated_at: new Date().toISOString(),
          default_branch: 'main',
          size: 34567
        }
      ]);
      setIsLoadingRepos(false);
    }, 1000);
  };

  const handleImport = async () => {
    if (!selectedRepo && !repoUrl) {
      toast({
        title: "No repository selected",
        description: "Please select a repository or enter a URL",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    // Simulate import progress
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    // Simulate API call
    setTimeout(() => {
      clearInterval(interval);
      setImportProgress(100);
      
      toast({
        title: "Import successful!",
        description: "Your repository has been imported successfully",
      });

      // Navigate to the new project
      setTimeout(() => {
        navigate('/~');
      }, 1000);
    }, 3000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="py-responsive bg-gradient-subtle">
        <div className="container-responsive">
          <div className="flex items-center gap-2 mb-4">
            <Github className="h-5 w-5" />
            <Badge variant="secondary">GitHub Integration</Badge>
          </div>
          
          <h1 className="text-responsive-2xl font-bold tracking-tight mb-4">
            Import from GitHub
          </h1>
          
          <p className="text-responsive-base text-muted-foreground max-w-3xl">
            Import any GitHub repository to E-Code instantly. Keep your Git history, 
            branches, and continue development seamlessly in the browser.
          </p>
        </div>
      </section>

      {/* Import Options */}
      <section className="py-responsive">
        <div className="container-responsive max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Choose Import Method</CardTitle>
              <CardDescription>
                Select how you want to import your GitHub repository
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={importMethod} onValueChange={(value: any) => setImportMethod(value)}>
                <div className="space-y-4">
                  <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="url" className="mt-1" />
                    <div className="flex-1">
                      <div className="font-medium mb-1">Import from URL</div>
                      <div className="text-sm text-muted-foreground">
                        Paste a GitHub repository URL to import it directly
                      </div>
                    </div>
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="search" className="mt-1" />
                    <div className="flex-1">
                      <div className="font-medium mb-1">Search Public Repositories</div>
                      <div className="text-sm text-muted-foreground">
                        Find and import any public repository on GitHub
                      </div>
                    </div>
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="account" className="mt-1" />
                    <div className="flex-1">
                      <div className="font-medium mb-1">Import from Your Account</div>
                      <div className="text-sm text-muted-foreground">
                        Connect your GitHub account to import private repositories
                      </div>
                    </div>
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Import Method Content */}
          <div className="mt-6">
            {importMethod === 'url' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enter Repository URL</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="repo-url">GitHub Repository URL</Label>
                    <Input
                      id="repo-url"
                      type="url"
                      placeholder="https://github.com/username/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Works with both public and private repositories (requires authentication for private)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {importMethod === 'search' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Search GitHub</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? (
                        <ECodeSpinner size={16} />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((repo) => (
                        <div
                          key={repo.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedRepo?.id === repo.id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{repo.full_name}</h4>
                                {repo.private && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Private
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {repo.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {repo.language && (
                                  <span className="flex items-center gap-1">
                                    <Code className="h-3 w-3" />
                                    {repo.language}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  {repo.stars}
                                </span>
                                <span className="flex items-center gap-1">
                                  <GitFork className="h-3 w-3" />
                                  {repo.forks}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(repo.updated_at)}
                                </span>
                              </div>
                            </div>
                            {selectedRepo?.id === repo.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {importMethod === 'account' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your GitHub Repositories</CardTitle>
                  <CardDescription>
                    Connect your GitHub account to see your repositories
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myRepos.length === 0 ? (
                    <div className="text-center py-8">
                      <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Connect your GitHub account to import your repositories
                      </p>
                      <Button onClick={loadMyRepos} disabled={isLoadingRepos}>
                        {isLoadingRepos ? (
                          <>
                            <ECodeSpinner className="mr-2" size={16} />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Github className="h-4 w-4 mr-2" />
                            Connect GitHub Account
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedRepo?.id === repo.id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{repo.name}</h4>
                                {repo.private && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Private
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {repo.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {repo.language && (
                                  <span className="flex items-center gap-1">
                                    <Code className="h-3 w-3" />
                                    {repo.language}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(repo.updated_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <File className="h-3 w-3" />
                                  {formatFileSize(repo.size * 1024)}
                                </span>
                              </div>
                            </div>
                            {selectedRepo?.id === repo.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Import Settings */}
          {(selectedRepo || repoUrl) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Import Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder={selectedRepo?.name || "my-project"}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger id="branch" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">main</SelectItem>
                      <SelectItem value="master">master</SelectItem>
                      <SelectItem value="develop">develop</SelectItem>
                      <SelectItem value="custom">Other branch...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Visibility</Label>
                  <RadioGroup value={visibility} onValueChange={setVisibility} className="mt-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="private" id="private" />
                      <Label htmlFor="private" className="font-normal cursor-pointer">
                        Private - Only you can see this project
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="public" id="public" />
                      <Label htmlFor="public" className="font-normal cursor-pointer">
                        Public - Anyone can see this project
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="include-history" 
                      checked={includeHistory}
                      onCheckedChange={(checked) => setIncludeHistory(checked as boolean)}
                    />
                    <div>
                      <Label htmlFor="include-history" className="cursor-pointer">
                        Include Git history
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Import all commits, branches, and tags
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="include-lfs" 
                      checked={includeLFS}
                      onCheckedChange={(checked) => setIncludeLFS(checked as boolean)}
                    />
                    <div>
                      <Label htmlFor="include-lfs" className="cursor-pointer">
                        Include Git LFS files
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Download large files tracked by Git LFS
                      </p>
                    </div>
                  </div>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Importing repository...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} />
                  </div>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Large repositories may take a few minutes to import. You'll be redirected 
                    to your project once the import is complete.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleImport} 
                    disabled={isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <ECodeSpinner className="mr-2" size={16} />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FolderGit className="h-4 w-4 mr-2" />
                        Import Repository
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-responsive bg-muted/30">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Why Import to E-Code?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Instant Development</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Skip the setup. Your repository is ready to run with all 
                  dependencies installed automatically.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <GitBranch className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Full Git Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Keep your Git history, branches, and continue pushing to 
                  GitHub seamlessly.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">AI Assistance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get intelligent code completion and debugging help for 
                  your imported project.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}