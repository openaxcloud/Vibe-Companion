import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Clock, Database, FileText, Settings, Save, RotateCcw, Trash2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Checkpoint {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'before_action' | 'error_recovery';
  createdAt: Date;
  createdBy: number;
  size: number;
  fileCount: number;
  databaseSnapshot: boolean;
  environmentVars: Record<string, string>;
  agentState?: any;
}

interface CheckpointManagerProps {
  projectId: number;
}

export function CheckpointManager({ projectId }: CheckpointManagerProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [autoCheckpointsEnabled, setAutoCheckpointsEnabled] = useState(false);
  const [checkpointForm, setCheckpointForm] = useState({
    name: '',
    description: '',
    includeDatabase: true,
    includeEnvironment: true
  });

  // Fetch checkpoints
  const { data: checkpoints, isLoading } = useQuery({
    queryKey: ['/api/checkpoints/project', projectId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/checkpoints/project/${projectId}?limit=20`);
        if (!res.ok) throw new Error('Failed to fetch checkpoints');
        return await res.json();
      } catch (error) {
        console.error('Error fetching checkpoints:', error);
        throw error;
      }
    }
  });

  // Create checkpoint mutation
  const createCheckpoint = useMutation({
    mutationFn: async (data: any) => {
      try {
        const res = await apiRequest('POST', '/api/checkpoints/create', data);
        if (!res.ok) throw new Error('Failed to create checkpoint');
        return await res.json();
      } catch (error) {
        console.error('Error creating checkpoint:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checkpoints/project', projectId] });
      toast({
        title: 'Checkpoint Created',
        description: 'Your checkpoint has been created successfully.',
      });
      setIsCreating(false);
      setCheckpointForm({
        name: '',
        description: '',
        includeDatabase: true,
        includeEnvironment: true
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create checkpoint',
        variant: 'destructive',
      });
    }
  });

  // Restore checkpoint mutation
  const restoreCheckpoint = useMutation({
    mutationFn: async (data: any) => {
      try {
        const res = await apiRequest('POST', '/api/checkpoints/restore', data);
        if (!res.ok) throw new Error('Failed to restore checkpoint');
        return await res.json();
      } catch (error) {
        console.error('Error restoring checkpoint:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Checkpoint Restored',
        description: 'Your project has been restored to the selected checkpoint.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to restore checkpoint',
        variant: 'destructive',
      });
    }
  });

  // Delete checkpoint mutation
  const deleteCheckpoint = useMutation({
    mutationFn: async (checkpointId: number) => {
      try {
        const res = await apiRequest('DELETE', `/api/checkpoints/${checkpointId}`);
        if (!res.ok) throw new Error('Failed to delete checkpoint');
        return await res.json();
      } catch (error) {
        console.error('Error deleting checkpoint:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checkpoints/project', projectId] });
      toast({
        title: 'Checkpoint Deleted',
        description: 'The checkpoint has been deleted.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete checkpoint',
        variant: 'destructive',
      });
    }
  });

  // Toggle auto-checkpoints mutation
  const toggleAutoCheckpoints = useMutation({
    mutationFn: (enable: boolean) => apiRequest('POST', '/api/checkpoints/auto-checkpoint', { projectId, enable }).then(res => res.json()),
    onSuccess: (_, enable) => {
      setAutoCheckpointsEnabled(enable);
      toast({
        title: enable ? 'Auto-checkpoints Enabled' : 'Auto-checkpoints Disabled',
        description: enable ? 'Your project will be automatically backed up every 5 minutes.' : 'Auto-checkpoints have been disabled.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle auto-checkpoints',
        variant: 'destructive',
      });
    }
  });

  const handleCreateCheckpoint = () => {
    if (!checkpointForm.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a checkpoint name',
        variant: 'destructive',
      });
      return;
    }

    createCheckpoint.mutate({
      projectId,
      ...checkpointForm,
      type: 'manual'
    });
  };

  const handleRestoreCheckpoint = (checkpoint: Checkpoint) => {
    restoreCheckpoint.mutate({
      checkpointId: checkpoint.id,
      restoreFiles: true,
      restoreDatabase: checkpoint.databaseSnapshot,
      restoreEnvironment: Object.keys(checkpoint.environmentVars).length > 0
    });
  };

  const getCheckpointIcon = (type: string) => {
    switch (type) {
      case 'automatic':
        return <Clock className="h-4 w-4" />;
      case 'before_action':
        return <Settings className="h-4 w-4" />;
      case 'error_recovery':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Save className="h-4 w-4" />;
    }
  };

  const getCheckpointBadgeVariant = (type: string) => {
    switch (type) {
      case 'automatic':
        return 'secondary';
      case 'before_action':
        return 'outline';
      case 'error_recovery':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Checkpoints</h2>
          <p className="text-muted-foreground">Create and manage project checkpoints</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-checkpoints"
              checked={autoCheckpointsEnabled}
              onCheckedChange={(checked) => toggleAutoCheckpoints.mutate(checked)}
            />
            <Label htmlFor="auto-checkpoints">Auto-checkpoints</Label>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Save className="mr-2 h-4 w-4" />
            Create Checkpoint
          </Button>
        </div>
      </div>

      {/* Create Checkpoint Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Checkpoint</CardTitle>
            <CardDescription>Save the current state of your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Checkpoint Name</Label>
              <Input
                id="name"
                placeholder="e.g., Before major refactor"
                value={checkpointForm.name}
                onChange={(e) => setCheckpointForm({ ...checkpointForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the state of your project..."
                value={checkpointForm.description}
                onChange={(e) => setCheckpointForm({ ...checkpointForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-database"
                  checked={checkpointForm.includeDatabase}
                  onCheckedChange={(checked) => setCheckpointForm({ ...checkpointForm, includeDatabase: checked })}
                />
                <Label htmlFor="include-database">Include Database</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-environment"
                  checked={checkpointForm.includeEnvironment}
                  onCheckedChange={(checked) => setCheckpointForm({ ...checkpointForm, includeEnvironment: checked })}
                />
                <Label htmlFor="include-environment">Include Environment Variables</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCheckpoint}
                disabled={createCheckpoint.isPending}
              >
                {createCheckpoint.isPending ? 'Creating...' : 'Create Checkpoint'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checkpoints List */}
      {isLoading ? (
        <div className="text-center py-8">Loading checkpoints...</div>
      ) : checkpoints?.checkpoints?.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No checkpoints yet. Create your first checkpoint to save your project state.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {checkpoints?.checkpoints?.map((checkpoint: Checkpoint) => (
            <Card key={checkpoint.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getCheckpointIcon(checkpoint.type)}
                      <h3 className="font-semibold">{checkpoint.name}</h3>
                      <Badge variant={getCheckpointBadgeVariant(checkpoint.type) as any}>
                        {checkpoint.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    {checkpoint.description && (
                      <p className="text-[13px] text-muted-foreground">{checkpoint.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                      <span>Created {formatDistanceToNow(new Date(checkpoint.createdAt), { addSuffix: true })}</span>
                      <span>•</span>
                      <span>{checkpoint.fileCount} files</span>
                      <span>•</span>
                      <span>{formatSize(checkpoint.size)}</span>
                      {checkpoint.databaseSnapshot && (
                        <>
                          <span>•</span>
                          <Database className="h-3 w-3 inline" />
                          <span>Database included</span>
                        </>
                      )}
                      {Object.keys(checkpoint.environmentVars).length > 0 && (
                        <>
                          <span>•</span>
                          <FileText className="h-3 w-3 inline" />
                          <span>Environment included</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreCheckpoint(checkpoint)}
                      disabled={restoreCheckpoint.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Checkpoint</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this checkpoint? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCheckpoint.mutate(checkpoint.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}