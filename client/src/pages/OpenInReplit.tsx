import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, FolderOpen, GitBranch, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function OpenInReplit() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const repoUrl = params.get('url') || params.get('repo') || '';
  const branch = params.get('branch') || 'main';

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleOpen = async () => {
    if (!user) {
      sessionStorage.setItem('pendingOpen', repoUrl);
      setLocation('/login?redirect=/open');
      return;
    }

    if (!repoUrl) {
      setError('No repository URL provided. Please include a ?url= parameter.');
      return;
    }

    setLocation(`/import?url=${encodeURIComponent(repoUrl)}&branch=${branch}`);
  };

  const repoName = repoUrl
    ? repoUrl.replace(/^https?:\/\/(github|gitlab)\.com\//, '').replace(/\.git$/, '')
    : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-openinreplit">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ecode-orange)]/10">
            <FolderOpen className="h-6 w-6 text-[var(--ecode-orange)]" />
          </div>
          <CardTitle data-testid="text-open-title">Open in E-Code</CardTitle>
          <CardDescription>
            Import and start coding in your browser instantly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {repoUrl ? (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{repoName || repoUrl}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{branch}</Badge>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No repository URL detected. You can paste a GitHub, GitLab, or Bitbucket URL to import a project.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleOpen}
                data-testid="button-open-project"
              >
                {user ? (
                  <><FolderOpen className="h-4 w-4 mr-2" /> {repoUrl ? 'Import & Open' : 'Go to Import'}</>
                ) : (
                  'Sign In to Continue'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                E-Code will clone the repository and set up a development environment automatically.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
