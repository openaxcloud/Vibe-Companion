import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Eye, EyeOff, Download, Lock, Edit, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';

interface EnvVar {
  id: string;  // UUID string from backend
  projectId: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnvVarsManagerProps {
  projectId: string;
}

export function EnvVarsManager({ projectId }: EnvVarsManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newVar, setNewVar] = useState({
    key: '',
    value: '',
    isSecret: false
  });
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/env-vars', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/env-vars/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch environment variables');
      return response.json() as Promise<{ variables: EnvVar[] }>;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newVar & { projectId: string }) =>
      apiRequest('POST', '/api/env-vars', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      setIsAddDialogOpen(false);
      setNewVar({ key: '', value: '', isSecret: false });
      toast({ title: "Environment variable created" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create variable",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; value?: string; isSecret?: boolean }) =>
      apiRequest('PATCH', `/api/env-vars/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      setEditingId(null);
      toast({ title: "Environment variable updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update variable",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest('DELETE', `/api/env-vars/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      toast({ title: "Environment variable deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete variable",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const revealSecret = async (id: string) => {
    try {
      const response = await apiRequest<{ value: string; expiresIn: number; warning: string }>(
        'POST',
        `/api/env-vars/${id}/reveal`
      );
      
      // Copy to clipboard for security
      await navigator.clipboard.writeText(response.value);
      
      toast({
        title: "Secret copied to clipboard",
        description: `${response.warning} Value: ${response.value}`,
        duration: 10000
      });

      // Temporarily show masked value with reveal indicator
      setRevealedSecrets(prev => new Set([...prev, id]));

      // Auto-hide after expiry time
      setTimeout(() => {
        setRevealedSecrets(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, response.expiresIn * 1000);
    } catch (error: any) {
      toast({
        title: "Failed to reveal secret",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/env-vars/${projectId}/export`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Environment variables exported" });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const variables = data?.variables || [];

  return (
    <div className="flex flex-col h-full bg-[var(--ecode-surface)]" data-testid="env-vars-manager">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)]">Environment Variables</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-6 px-2 text-[10px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-export-env"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-6 px-2 text-[10px]" data-testid="button-add-env-var">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Variable</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    name="key"
                    placeholder="API_KEY"
                    value={newVar.key}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      setNewVar(prev => ({ ...prev, key: value }));
                    }}
                    data-testid="input-env-key"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use UPPERCASE with underscores (e.g., API_KEY)
                  </p>
                </div>
                <div>
                  <Label htmlFor="value">Value</Label>
                  <Textarea
                    id="value"
                    name="value"
                    placeholder="your-value-here"
                    value={newVar.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewVar(prev => ({ ...prev, value }));
                    }}
                    data-testid="input-env-value"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={newVar.isSecret}
                    onCheckedChange={(checked) => setNewVar({ ...newVar, isSecret: !!checked })}
                    data-testid="checkbox-is-secret"
                  />
                  <Lock className="h-4 w-4" />
                  <span className="text-[13px]">Mark as secret (encrypted)</span>
                </label>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate({ ...newVar, projectId })}
                  disabled={!newVar.key || !newVar.value || createMutation.isPending}
                  data-testid="button-create-env-var"
                >
                  Create Variable
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-auto space-y-2">
        {variables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Lock className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-[13px]">No environment variables</p>
            <p className="text-[11px]">Add one to get started</p>
          </div>
        ) : (
          variables.map((envVar) => (
            <Card key={envVar.id} className="p-4" data-testid={`env-var-${envVar.key}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="font-mono font-semibold">{envVar.key}</code>
                    {envVar.isSecret && (
                      <Badge variant="secondary" className="text-[11px]">
                        <Lock className="h-3 w-3 mr-1" />
                        Secret
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[13px] bg-muted px-2 py-1 rounded font-mono">
                      {revealedSecrets.has(envVar.id) ? envVar.value : envVar.value}
                    </code>
                    {envVar.isSecret && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revealSecret(envVar.id)}
                        data-testid={`button-reveal-${envVar.key}`}
                      >
                        {revealedSecrets.has(envVar.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Updated: {new Date(envVar.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(envVar.id)}
                    data-testid={`button-delete-${envVar.key}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
