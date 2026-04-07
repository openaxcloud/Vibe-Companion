import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Lock, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy,
  Trash2,
  Key,
  Shield,
  Info,
  Search,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ECodeLoading } from '@/components/ECodeLoading';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Secret {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  projectId?: number;
}

export default function Secrets() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteSecretId, setDeleteSecretId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState('user');
  
  const [newSecret, setNewSecret] = useState({
    key: '',
    value: '',
    description: ''
  });

  // Fetch user secrets
  const { data: secrets = [], isLoading: secretsLoading } = useQuery<Secret[]>({
    queryKey: ['/api/secrets'],
    enabled: !!user,
  });

  // Create secret mutation
  const createSecretMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description?: string }) => {
      const res = await apiRequest('POST', '/api/secrets', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      setCreateDialogOpen(false);
      setNewSecret({ key: '', value: '', description: '' });
      toast({
        title: 'Secret created',
        description: 'Your secret has been securely stored.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create secret',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update secret mutation
  const updateSecretMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; value?: string; description?: string }) => {
      const res = await apiRequest('PATCH', `/api/secrets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      toast({
        title: 'Secret updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update secret',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete secret mutation
  const deleteSecretMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/secrets/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      setDeleteSecretId(null);
      toast({
        title: 'Secret deleted',
        description: 'The secret has been permanently removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete secret',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateSecret = () => {
    if (!newSecret.key.trim() || !newSecret.value.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Key and value are required.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!/^[A-Z0-9_]+$/.test(newSecret.key)) {
      toast({
        title: 'Invalid key format',
        description: 'Key must contain only uppercase letters, numbers, and underscores.',
        variant: 'destructive',
      });
      return;
    }
    
    createSecretMutation.mutate(newSecret);
  };

  const toggleShowValue = (id: number) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied to clipboard',
        description: `Secret ${key} has been copied.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const filteredSecrets = secrets.filter((secret: Secret) => 
    secret.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (secret.description && secret.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading || secretsLoading) {
    return <ECodeLoading fullScreen />;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to manage your secrets.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="secrets-page">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-secrets-title">Secrets</h1>
                <p className="text-[13px] sm:text-base text-muted-foreground">Manage your secure environment variables</p>
              </div>
            </div>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0"
              data-testid="button-new-secret"
            >
              <Plus className="h-4 w-4" />
              New Secret
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and filters */}
            <Card data-testid="card-search">
              <CardContent className="p-3 sm:p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search secrets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 min-h-[44px] sm:min-h-0"
                    data-testid="input-search-secrets"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Secrets list */}
            <Card data-testid="card-secrets-list">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your Secrets</CardTitle>
                  <Badge variant="secondary" data-testid="badge-secrets-count">{filteredSecrets.length} secrets</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSecrets.length === 0 ? (
                  <div className="text-center py-12" data-testid="empty-secrets">
                    <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-[15px] font-semibold mb-2">No secrets yet</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? 'No secrets match your search.' : 'Create your first secret to get started.'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setCreateDialogOpen(true)} variant="outline" data-testid="button-create-first-secret">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Secret
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSecrets.map((secret: Secret) => (
                      <div
                        key={secret.id}
                        className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                        data-testid={`secret-item-${secret.id}`}
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <code className="text-[11px] sm:text-[13px] font-mono font-semibold break-all" data-testid={`secret-key-${secret.id}`}>{secret.key}</code>
                              <Badge variant="outline" className="text-[11px] hidden sm:inline-flex">
                                Secure
                              </Badge>
                            </div>
                            {secret.description && (
                              <p className="text-[11px] sm:text-[13px] text-muted-foreground">{secret.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 self-end sm:self-start">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                              onClick={() => toggleShowValue(secret.id)}
                              data-testid={`button-toggle-value-${secret.id}`}
                            >
                              {showValues[secret.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                              onClick={() => copyToClipboard(secret.value, secret.key)}
                              data-testid={`button-copy-secret-${secret.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-destructive"
                              onClick={() => setDeleteSecretId(secret.id)}
                              data-testid={`button-delete-secret-${secret.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Input
                            type={showValues[secret.id] ? 'text' : 'password'}
                            value={secret.value}
                            readOnly
                            className="font-mono text-[13px]"
                            data-testid={`input-secret-value-${secret.id}`}
                          />
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Last updated: {new Date(secret.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  About Secrets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-[13px]">
                  <p className="text-muted-foreground">
                    Secrets are encrypted environment variables that keep your sensitive data safe.
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Values are encrypted at rest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Never exposed in logs or UI</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Available as environment variables</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Scoped to your account</span>
                    </li>
                  </ul>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-[13px] font-medium">Usage Example</h4>
                  <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                    <code>{`// Node.js
const apiKey = process.env.API_KEY;

// Python
import os
api_key = os.environ.get('API_KEY')`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Best practices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-[13px] text-muted-foreground">
                  <li>• Use uppercase letters with underscores</li>
                  <li>• Never commit secrets to version control</li>
                  <li>• Rotate secrets regularly</li>
                  <li>• Use descriptive names</li>
                  <li>• Limit access to production secrets</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Secret Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:w-full" data-testid="dialog-create-secret">
          <DialogHeader>
            <DialogTitle className="text-[15px] sm:text-xl">Create New Secret</DialogTitle>
            <DialogDescription className="text-[13px]">
              Add a new secret that will be available as an environment variable in your projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key" className="text-[13px] sm:text-base">Key</Label>
              <Input
                id="key"
                placeholder="API_KEY"
                value={newSecret.key}
                onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value.toUpperCase() })}
                className="font-mono min-h-[44px] sm:min-h-0"
                data-testid="input-secret-key"
              />
              <p className="text-[11px] text-muted-foreground">
                Use UPPER_CASE with underscores
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value" className="text-[13px] sm:text-base">Value</Label>
              <Input
                id="value"
                type="password"
                placeholder="your-secret-value"
                value={newSecret.value}
                onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                className="font-mono min-h-[44px] sm:min-h-0"
                data-testid="input-secret-value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[13px] sm:text-base">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What is this secret used for?"
                value={newSecret.description}
                onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                className="min-h-[44px] sm:min-h-0"
                data-testid="input-secret-description"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0" data-testid="button-cancel-create-secret">
              Cancel
            </Button>
            <Button onClick={handleCreateSecret} disabled={createSecretMutation.isPending} className="w-full sm:w-auto min-h-[44px] sm:min-h-0" data-testid="button-confirm-create-secret">
              {createSecretMutation.isPending ? 'Creating...' : 'Create Secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSecretId} onOpenChange={(open) => !open && setDeleteSecretId(null)}>
        <AlertDialogContent className="w-[95vw] max-w-lg sm:w-full" data-testid="dialog-delete-secret">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] sm:text-xl">Delete Secret</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Are you sure you want to delete this secret? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto min-h-[44px] sm:min-h-0" data-testid="button-cancel-delete-secret">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSecretId && deleteSecretMutation.mutate(deleteSecretId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto min-h-[44px] sm:min-h-0"
              data-testid="button-confirm-delete-secret"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}