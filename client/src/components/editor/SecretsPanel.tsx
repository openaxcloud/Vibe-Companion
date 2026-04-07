import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  Lock,
  Key,
  AlertCircle,
  Check,
  Search,
  RefreshCw,
  Loader2,
  Save,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Secret {
  id: string;
  projectId: number;
  key: string;
  value: string;
  environment: string;
  isSecret: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SecretsResponse {
  secrets: Secret[];
}

interface SecretsPanelProps {
  projectId: string | number;
  className?: string;
}

type Environment = 'all' | 'development' | 'staging' | 'production';

const ENVIRONMENTS: { value: Environment; label: string }[] = [
  { value: 'all', label: 'All Environments' },
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

const ENV_COLORS: Record<string, string> = {
  development: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  staging: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
  production: 'bg-green-500/20 text-green-500 border-green-500/50',
};

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse",
        className
      )}
    />
  );
}

export function SecretsPanel({ projectId, className }: SecretsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newEnvironment, setNewEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [isSecretToggle, setIsSecretToggle] = useState(true);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const queryKey = ['/api/projects', projectId, 'secrets', selectedEnvironment];

  const { data: secretsData, isLoading, error, refetch } = useQuery<SecretsResponse>({
    queryKey,
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const url = selectedEnvironment === 'all'
        ? `/api/projects/${projectId}/secrets`
        : `/api/projects/${projectId}/secrets?environment=${selectedEnvironment}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch secrets');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; environment: string; isSecret: boolean }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiRequest('POST', `/api/projects/${projectId}/secrets`, data);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Secret created' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'secrets'] });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create secret',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value, environment, isSecret }: { id: string; value?: string; environment?: string; isSecret?: boolean }) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/secrets/${id}`, {
        ...(value !== undefined && { value }),
        ...(environment !== undefined && { environment }),
        ...(isSecret !== undefined && { isSecret })
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Secret updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'secrets'] });
      resetForm();
      setEditingSecret(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update secret',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/secrets/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Secret deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'secrets'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete secret',
        variant: 'destructive'
      });
    }
  });

  const revealMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/secrets/${id}/reveal`);
    },
    onSuccess: (data: { value: string }, id: string) => {
      setRevealedSecrets(prev => ({ ...prev, [id]: data.value }));
      setTimeout(() => {
        setRevealedSecrets(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }, 60000);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reveal secret',
        variant: 'destructive'
      });
    }
  });

  const resetForm = useCallback(() => {
    setNewKey('');
    setNewValue('');
    setNewEnvironment('development');
    setIsSecretToggle(true);
  }, []);

  const handleCopyValue = useCallback((secret: Secret) => {
    const valueToCopy = revealedSecrets[secret.id] || secret.value;
    if (valueToCopy === '********') {
      toast({
        title: 'Cannot copy',
        description: 'Reveal the secret first to copy its value',
        variant: 'destructive'
      });
      return;
    }
    navigator.clipboard.writeText(valueToCopy);
    setCopiedId(secret.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied', description: 'Value copied to clipboard' });
  }, [revealedSecrets, toast]);

  const handleToggleReveal = useCallback((secret: Secret) => {
    if (revealedSecrets[secret.id]) {
      setRevealedSecrets(prev => {
        const newState = { ...prev };
        delete newState[secret.id];
        return newState;
      });
    } else if (secret.isSecret) {
      revealMutation.mutate(secret.id);
    }
  }, [revealedSecrets, revealMutation]);

  const secrets = secretsData?.secrets || [];
  const filteredSecrets = secrets.filter(s =>
    s.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!projectId) {
    return (
      <div 
        className={cn("h-full flex flex-col items-center justify-center p-3 bg-background", className)}
        data-testid="secrets-panel-no-project"
      >
        <Lock className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
        <p className="text-[13px] text-muted-foreground">Select a project to manage secrets</p>
      </div>
    );
  }

  return (
    <div 
      className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}
      data-testid="secrets-panel"
    >
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]" data-testid="text-secrets-title">Secrets</span>
          <Badge className="h-4 px-1 text-[9px] bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] rounded" data-testid="text-secrets-count">
            {secrets.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-secrets"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,42%)]/10"
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-secret"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ecode-text-muted)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-7 h-7 text-xs bg-[var(--ecode-sidebar-hover)] border-[var(--ecode-border)]"
              data-testid="input-search-secrets"
            />
          </div>
          <Select
            value={selectedEnvironment}
            onValueChange={(v) => setSelectedEnvironment(v as Environment)}
          >
            <SelectTrigger className="w-24 h-7 text-xs bg-[var(--ecode-sidebar-hover)] border-[var(--ecode-border)]" data-testid="select-environment-filter">
              <SelectValue placeholder="Env" />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENTS.map(env => (
                <SelectItem key={env.value} value={env.value}>
                  {env.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <ShimmerSkeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-12 h-12 mb-3 text-destructive opacity-40" />
              <p className="text-[13px] text-muted-foreground">Failed to load secrets</p>
              <Button variant="link" className="mt-2" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : filteredSecrets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Lock className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
              <h4 className="text-base font-medium mb-2">
                {searchQuery ? 'No matching secrets' : 'No secrets configured'}
              </h4>
              <p className="text-[13px] text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search query' 
                  : 'Store sensitive data like API keys and tokens securely'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add your first secret
                </Button>
              )}
            </div>
          ) : (
            filteredSecrets.map((secret) => (
              <div
                key={secret.id}
                className="p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50"
                data-testid={`secret-item-${secret.key}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {secret.isSecret ? (
                        <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                      ) : (
                        <Key className="w-4 h-4 shrink-0 text-muted-foreground" />
                      )}
                      <span 
                        className="font-mono text-[13px] font-medium truncate"
                        data-testid={`text-secret-key-${secret.key}`}
                      >
                        {secret.key}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] uppercase", ENV_COLORS[secret.environment])}
                        data-testid={`badge-env-${secret.key}`}
                      >
                        {secret.environment}
                      </Badge>
                      {secret.isSecret && (
                        <Badge variant="outline" className="text-[10px] uppercase text-amber-500 border-amber-500/50">
                          encrypted
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-[11px] font-mono px-2 py-1 rounded bg-muted max-w-[200px] sm:max-w-[300px] truncate">
                        {revealedSecrets[secret.id] || secret.value}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {secret.isSecret && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleReveal(secret)}
                        disabled={revealMutation.isPending}
                        data-testid={`button-reveal-${secret.key}`}
                      >
                        {revealMutation.isPending && revealMutation.variables === secret.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : revealedSecrets[secret.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyValue(secret)}
                      data-testid={`button-copy-${secret.key}`}
                    >
                      {copiedId === secret.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingSecret(secret);
                        setNewKey(secret.key);
                        setNewValue('');
                        setNewEnvironment(secret.environment as 'development' | 'staging' | 'production');
                        setIsSecretToggle(secret.isSecret);
                      }}
                      data-testid={`button-edit-${secret.key}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(secret.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${secret.key}`}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === secret.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Secret</DialogTitle>
            <DialogDescription>
              Add a new secret or environment variable to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder="MY_SECRET_KEY"
                className="font-mono"
                data-testid="input-new-key"
              />
              <p className="text-[11px] text-muted-foreground">Uppercase with underscores only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
                type={isSecretToggle ? 'password' : 'text'}
                data-testid="input-new-value"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={newEnvironment} onValueChange={(v) => setNewEnvironment(v as any)}>
                <SelectTrigger data-testid="select-new-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isSecret">Encrypt as secret</Label>
              <Switch
                id="isSecret"
                checked={isSecretToggle}
                onCheckedChange={setIsSecretToggle}
                data-testid="switch-is-secret"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button 
              variant="outline"
              onClick={() => { setShowAddDialog(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ 
                key: newKey, 
                value: newValue, 
                environment: newEnvironment,
                isSecret: isSecretToggle 
              })}
              disabled={!newKey || !newValue || createMutation.isPending}
              data-testid="button-save-secret"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-1" /> Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSecret} onOpenChange={(open) => { if (!open) { setEditingSecret(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
            <DialogDescription>Update the value for {editingSecret?.key}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <div className="font-mono text-[13px] px-3 py-2 rounded-md bg-muted">
                {editingSecret?.key}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editValue">New Value</Label>
              <Input
                id="editValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter new value..."
                type={isSecretToggle ? 'password' : 'text'}
                data-testid="input-edit-value"
              />
              <p className="text-[11px] text-muted-foreground">Leave empty to keep current value</p>
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={newEnvironment} onValueChange={(v) => setNewEnvironment(v as any)}>
                <SelectTrigger data-testid="select-edit-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="editIsSecret">Encrypt as secret</Label>
              <Switch
                id="editIsSecret"
                checked={isSecretToggle}
                onCheckedChange={setIsSecretToggle}
                data-testid="switch-edit-is-secret"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button 
              variant="outline"
              onClick={() => { setEditingSecret(null); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingSecret) return;
                updateMutation.mutate({
                  id: editingSecret.id,
                  ...(newValue && { value: newValue }),
                  environment: newEnvironment,
                  isSecret: isSecretToggle
                });
              }}
              disabled={updateMutation.isPending}
              data-testid="button-update-secret"
            >
              {updateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Updating...</>
              ) : (
                <><Save className="w-4 h-4 mr-1" /> Update</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SecretsPanel;
