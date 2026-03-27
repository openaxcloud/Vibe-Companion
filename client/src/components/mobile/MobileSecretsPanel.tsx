// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Lock,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  Key,
  Check,
  Search,
  Loader2
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

interface EnvVariable {
  id: string;
  projectId: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Secret extends EnvVariable {
  isRevealed?: boolean;
}

interface MobileSecretsPanelProps {
  projectId: string;
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-muted rounded-lg animate-opacity-pulse", className)} />
  );
}

export function MobileSecretsPanel({ projectId, className }: MobileSecretsPanelProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<{ variables: EnvVariable[] }>({
    queryKey: ['/api/projects', projectId, 'env-vars'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/env-vars`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch secrets');
      return response.json();
    },
    enabled: !!projectId
  });

  const secrets: Secret[] = (data?.variables || []).map(v => ({
    ...v,
    isRevealed: revealedSecrets.has(v.id)
  }));

  const filteredSecrets = secrets.filter(secret =>
    secret.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/env-vars`, {
        key: data.key.toUpperCase().replace(/\s+/g, '_'),
        value: data.value,
        isSecret: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'env-vars'] });
      toast({ title: 'Secret added successfully' });
      setNewSecretKey('');
      setNewSecretValue('');
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add secret',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; value: string }) => {
      return apiRequest('PATCH', `/api/projects/${projectId}/env-vars/${data.id}`, {
        value: data.value
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'env-vars'] });
      toast({ title: 'Secret updated successfully' });
      setEditingSecret(null);
      setNewSecretKey('');
      setNewSecretValue('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update secret',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/env-vars/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'env-vars'] });
      toast({ title: 'Secret deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete secret',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleToggleReveal = (secret: Secret) => {
    setRevealedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secret.id)) {
        newSet.delete(secret.id);
      } else {
        newSet.add(secret.id);
      }
      return newSet;
    });
  };

  const handleAddSecret = () => {
    if (newSecretKey && newSecretValue) {
      createMutation.mutate({ key: newSecretKey, value: newSecretValue });
    }
  };

  const handleUpdateSecret = () => {
    if (editingSecret && newSecretValue) {
      updateMutation.mutate({ id: editingSecret.id, value: newSecretValue });
    }
  };

  const handleDeleteSecret = (secretId: string) => {
    if (confirm('Are you sure you want to delete this secret?')) {
      deleteMutation.mutate(secretId);
    }
  };

  const handleCopyValue = (secret: Secret) => {
    navigator.clipboard.writeText(secret.value);
    setCopiedId(secret.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className={cn("h-full flex flex-col bg-background", className)}>
      <div className="p-4 border-b border-border bg-card min-h-[56px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-[18px] h-[18px] text-primary" />
            <h3 className="text-[17px] font-medium leading-tight text-foreground" data-testid="header-secrets">Secrets</h3>
          </div>
          <Badge 
            variant="secondary" 
            className="text-[11px] uppercase tracking-wider bg-muted text-muted-foreground border-none" 
            data-testid="badge-secret-count"
          >
            {secrets.length} secrets
          </Badge>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
          <Input
            placeholder="Search secrets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-lg bg-muted border-border text-[15px] leading-[20px] text-foreground placeholder:text-muted-foreground"
            data-testid="input-search-secrets"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 pb-[88px]">
        <div className="p-4 space-y-3">
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <ShimmerSkeleton className="h-5 w-32" />
                    <div className="flex gap-2">
                      <ShimmerSkeleton className="w-11 h-11 rounded-lg" />
                      <ShimmerSkeleton className="w-11 h-11 rounded-lg" />
                    </div>
                  </div>
                  <ShimmerSkeleton className="h-10 w-full mb-2 rounded-lg" />
                  <ShimmerSkeleton className="h-4 w-24" />
                </div>
              ))}
            </>
          )}

          {error && (
            <div className="text-center py-16">
              <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-[17px] font-medium leading-tight text-foreground mb-2">Failed to load secrets</p>
              <p className="text-[13px] text-muted-foreground">{(error as Error).message}</p>
            </div>
          )}

          {!isLoading && !error && filteredSecrets.map((secret) => (
            <div 
              key={secret.id}
              className="border border-border rounded-lg p-4 bg-card"
              data-testid={`secret-${secret.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-[18px] h-[18px] text-primary" />
                  <span className="font-mono text-[15px] leading-[20px] font-medium text-foreground">{secret.key}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-lg hover:bg-muted"
                    onClick={() => handleToggleReveal(secret)}
                    data-testid={`button-toggle-${secret.key}`}
                  >
                    {secret.isRevealed ? (
                      <EyeOff className="w-[18px] h-[18px] text-muted-foreground" />
                    ) : (
                      <Eye className="w-[18px] h-[18px] text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-lg hover:bg-muted"
                    onClick={() => handleCopyValue(secret)}
                    data-testid={`button-copy-${secret.key}`}
                  >
                    {copiedId === secret.id ? (
                      <Check className="w-[18px] h-[18px] text-primary" />
                    ) : (
                      <Copy className="w-[18px] h-[18px] text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-lg hover:bg-muted"
                    onClick={() => {
                      setEditingSecret(secret);
                      setNewSecretKey(secret.key);
                      setNewSecretValue(secret.value);
                    }}
                    data-testid={`button-edit-${secret.key}`}
                  >
                    <Edit className="w-[18px] h-[18px] text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-lg hover:bg-muted"
                    onClick={() => handleDeleteSecret(secret.id)}
                    data-testid={`button-delete-${secret.key}`}
                  >
                    <Trash2 className="w-[18px] h-[18px] text-muted-foreground" />
                  </Button>
                </div>
              </div>
              
              <div className="font-mono text-[13px] p-3 bg-muted rounded-lg border border-border overflow-x-auto text-foreground">
                {secret.isRevealed ? secret.value : '•'.repeat(32)}
              </div>
              
              <div className="mt-2 text-[13px] text-muted-foreground">
                Modified {formatDate(secret.updatedAt)}
              </div>
            </div>
          ))}

          {!isLoading && !error && filteredSecrets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Lock className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
              <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No secrets configured</h4>
              <p className="text-[15px] leading-[20px] text-muted-foreground text-center mb-6">
                Add environment variables and API keys to use in your project
              </p>
              <Button 
                className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] font-medium"
                onClick={() => setShowAddDialog(true)}
                data-testid="button-add-secret-empty"
              >
                <Plus className="w-[18px] h-[18px] mr-2" />
                Add Secret
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-card pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button 
          className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] font-medium"
          onClick={() => setShowAddDialog(true)}
          data-testid="button-add-secret"
        >
          <Plus className="w-[18px] h-[18px] mr-2" />
          Add Secret
        </Button>
      </div>

      <Dialog 
        open={showAddDialog || !!editingSecret} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingSecret(null);
            setNewSecretKey('');
            setNewSecretValue('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-medium leading-tight text-foreground">
              {editingSecret ? 'Edit' : 'Add'} Secret
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-[20px] text-muted-foreground">
              {editingSecret ? 'Update' : 'Create'} an environment variable for your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Key</label>
              <Input
                placeholder="DATABASE_URL"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                className="h-11 rounded-lg font-mono bg-muted border-border text-[15px] text-foreground placeholder:text-muted-foreground"
                disabled={!!editingSecret}
                data-testid="input-secret-key"
              />
              {!!editingSecret && (
                <p className="text-[13px] text-muted-foreground">Key cannot be changed</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Value</label>
              <Input
                type="password"
                placeholder="your-secret-value"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                className="h-11 rounded-lg font-mono bg-muted border-border text-[15px] text-foreground placeholder:text-muted-foreground"
                data-testid="input-secret-value"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-border bg-transparent text-foreground hover:bg-muted text-[15px]"
              onClick={() => {
                setShowAddDialog(false);
                setEditingSecret(null);
                setNewSecretKey('');
                setNewSecretValue('');
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] font-medium"
              onClick={editingSecret ? handleUpdateSecret : handleAddSecret}
              disabled={
                (!newSecretKey || !newSecretValue) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              data-testid="button-save-secret"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-[18px] h-[18px] mr-2 animate-spin" />
              )}
              {editingSecret ? 'Update' : 'Add'} Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
