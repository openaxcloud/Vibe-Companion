import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Search,
  AlertCircle,
  Key,
  Loader2,
  Copy,
  RefreshCw
} from 'lucide-react';

interface SecretsPanelProps {
  projectId: string;
}

interface Secret {
  id: string;
  key: string;
  value: string;
  createdAt: string;
}

interface SecretsDataResponse {
  tableName: string;
  data: Secret[];
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function SecretsPanel({ projectId }: SecretsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch secrets from Project Data API using default fetcher
  const { data, isLoading, error, refetch } = useQuery<SecretsDataResponse>({
    queryKey: [`/api/projects/${projectId}/data/secrets/data`],
    staleTime: 30000
  });

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({
        title: "Copied!",
        description: `Secret key "${key}" copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Helper to render masked value placeholder
  const renderMaskedValue = () => {
    return '••••••••••••••••';
  };

  const secrets = data?.data || [];
  const filteredSecrets = secrets.filter(secret =>
    secret.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-[13px] text-muted-foreground">
            {(error as any).message || 'Failed to load secrets'}
          </p>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <h3 className="text-xs font-medium text-[var(--ecode-text-muted)]">Secrets</h3>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {secrets.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          onClick={() => refetch()}
          data-testid="button-refresh-secrets"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {/* Search and Controls */}
      <div className="p-2.5 border-b border-[var(--ecode-border)]">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search secrets..."
            className="pl-9 text-[13px]"
            data-testid="input-search-secrets"
          />
        </div>

        {/* Warning */}
        <div className="mt-3 p-2 bg-status-warning/10 border border-status-warning rounded flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-status-warning mt-0.5" />
          <div className="text-[11px] text-status-warning">
            <p className="font-medium">Secure read-only access</p>
            <p className="mt-0.5">Secret values are encrypted and never exposed. Only secret keys are visible. Use Environment Variables Manager to manage secrets.</p>
          </div>
        </div>
      </div>

      {/* Secrets List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSecrets.length > 0 ? (
          <div className="p-2">
            {filteredSecrets.map((secret) => (
              <div
                key={secret.id}
                className="mb-2 p-3 border border-border rounded hover:bg-muted"
                data-testid={`secret-item-${secret.key}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-[13px] font-medium text-foreground">
                        {secret.key}
                      </span>
                      <Badge variant="outline" className="text-[11px] px-1 py-0">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-muted rounded text-[11px] font-mono text-muted-foreground">
                        {renderMaskedValue()}
                      </code>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        ENCRYPTED
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopyKey(secret.key)}
                      data-testid={`button-copy-${secret.key}`}
                    >
                      {copiedKey === secret.key ? (
                        <span className="text-[11px] text-status-success">✓</span>
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-[13px] text-muted-foreground">
              {searchQuery ? 'No secrets match your search' : 'No secrets configured'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Use Environment Variables Manager to add secrets
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
