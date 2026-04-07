import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EnvironmentVariableType {
  id: number;
  key: string;
  value: string | null;
  isSecret: boolean;
  projectId: number;
}

interface EnvironmentVariablesProps {
  projectId: number;
}

export function EnvironmentVariables({ projectId }: EnvironmentVariablesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Fetch environment variables
  const { data: variables = [], isLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'environment'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/environment`);
      return res.json();
    },
  });

  // Create environment variable
  const createVariableMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; isSecret: boolean }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/environment`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'environment'] });
      setNewKey('');
      setNewValue('');
      setNewIsSecret(false);
      toast({
        title: 'Environment variable created',
        description: 'Your new environment variable has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create variable',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update environment variable
  const updateVariableMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; key?: string; value?: string; isSecret?: boolean }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/environment/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'environment'] });
      toast({
        title: 'Environment variable updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update variable',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete environment variable
  const deleteVariableMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/environment/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'environment'] });
      toast({
        title: 'Environment variable deleted',
        description: 'The variable has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete variable',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!newKey.trim()) {
      toast({
        title: 'Invalid key',
        description: 'Environment variable key cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    createVariableMutation.mutate({ key: newKey, value: newValue, isSecret: newIsSecret });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              Manage your project's environment variables and secrets
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecrets(!showSecrets)}
            className="gap-2"
          >
            {showSecrets ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide secrets
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Show secrets
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Add new variable form */}
        <div className="mb-6 space-y-4 rounded-lg border bg-muted/10 p-4">
          <h3 className="text-sm font-medium">Add new variable</h3>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-key">Key</Label>
                <Input
                  id="new-key"
                  placeholder="API_KEY"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-value">Value</Label>
                <Input
                  id="new-value"
                  type={newIsSecret && !showSecrets ? 'password' : 'text'}
                  placeholder="Enter value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="new-secret"
                  checked={newIsSecret}
                  onCheckedChange={setNewIsSecret}
                />
                <Label htmlFor="new-secret" className="cursor-pointer">
                  Mark as secret
                </Label>
              </div>
              <Button
                onClick={handleCreate}
                disabled={createVariableMutation.isPending}
                size="sm"
                className="gap-2"
              >
                {createVariableMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add variable
              </Button>
            </div>
          </div>
        </div>

        {/* Variables list */}
        <div className="space-y-2">
          {variables.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No environment variables yet. Add one above to get started.
            </p>
          ) : (
            variables.map((variable: EnvironmentVariableType) => (
              <div
                key={variable.id}
                className="flex items-center gap-4 rounded-lg border bg-background p-4"
              >
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <Input
                    value={variable.key}
                    onChange={(e) =>
                      updateVariableMutation.mutate({ id: variable.id, key: e.target.value })
                    }
                    className="font-mono"
                  />
                  <Input
                    type={variable.isSecret && !showSecrets ? 'password' : 'text'}
                    value={variable.value || ''}
                    placeholder={variable.isSecret ? '••••••••' : 'Enter value'}
                    onChange={(e) =>
                      updateVariableMutation.mutate({ id: variable.id, value: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={variable.isSecret}
                    onCheckedChange={(checked) =>
                      updateVariableMutation.mutate({ id: variable.id, isSecret: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteVariableMutation.mutate(variable.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}