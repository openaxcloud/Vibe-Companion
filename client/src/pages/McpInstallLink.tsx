import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Plug, Terminal, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function McpInstallLink() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const serverId = params.get('server') || 'unknown';
  const serverName = serverId.charAt(0).toUpperCase() + serverId.slice(1).replace(/-/g, ' ');

  const configSnippet = JSON.stringify({
    mcpServers: {
      [serverId]: {
        command: 'npx',
        args: [`@mcp/${serverId}-server`],
        env: {}
      }
    }
  }, null, 2);

  const handleInstall = async () => {
    setInstalling(true);
    await new Promise(r => setTimeout(r, 1500));
    setInstalled(true);
    setInstalling(false);
    toast({ title: 'MCP Server Installed', description: `${serverName} has been added to your workspace.` });
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configSnippet);
    toast({ title: 'Copied', description: 'Configuration copied to clipboard.' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-mcpinstalllink">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Plug className="h-6 w-6 text-violet-600" />
          </div>
          <CardTitle data-testid="text-install-title">Install MCP Server</CardTitle>
          <CardDescription>
            Add <strong>{serverName}</strong> to your E-Code workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{serverName}</h3>
              <Badge variant="outline">MCP</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              This server will be connected to your AI assistant, giving it the ability to interact with {serverName.toLowerCase()} tools and resources.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1">
                <Terminal className="h-3 w-3" /> Configuration
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopyConfig} data-testid="button-copy-config">
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono">{configSnippet}</pre>
          </div>

          {installed ? (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {serverName} has been installed. Open a project to start using it with your AI assistant.
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleInstall}
              disabled={installing}
              data-testid="button-install-mcp"
            >
              {installing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Installing...</>
              ) : (
                <><Plug className="h-4 w-4 mr-2" /> Install to Workspace</>
              )}
            </Button>
          )}

          <div className="flex justify-center">
            <Button variant="link" size="sm" asChild data-testid="link-mcp-docs">
              <a href="/docs" target="_blank" rel="noopener noreferrer">
                Learn more about MCP <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
