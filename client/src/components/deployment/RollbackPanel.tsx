import { useState, useEffect } from 'react';
import {
  RotateCcw, History, Package, AlertTriangle,
  CheckCircle, XCircle, Clock, Eye, ChevronRight,
  GitBranch, Save, Loader2, Shield, FileText,
  Calendar, User, Tag, HardDrive, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface RollbackPanelProps {
  deploymentId: string;
  className?: string;
}

interface DeploymentSnapshot {
  id: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  createdAt: string;
  size: number;
  status: 'active' | 'archived' | 'failed';
  metadata: {
    commitHash?: string;
    branch?: string;
    author?: string;
    message?: string;
    deployedBy: string;
    tags?: string[];
  };
  config: {
    buildCommand?: string;
    startCommand?: string;
    environmentVars: Record<string, string>;
    dependencies: Record<string, string>;
    nodeVersion?: string;
  };
  fileManifest: {
    path: string;
    hash: string;
    size: number;
  }[];
  databaseSchema?: {
    tables: string[];
    migrations: string[];
    version: string;
  };
}

interface RollbackStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  steps: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message?: string;
    startedAt?: string;
    completedAt?: string;
  }[];
  fromVersion: string;
  toVersion: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface RollbackHistoryItem {
  id: string;
  fromVersion: string;
  toVersion: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  initiatedBy: string;
}

export function RollbackPanel({ deploymentId, className }: RollbackPanelProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DeploymentSnapshot | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [rollbackOptions, setRollbackOptions] = useState({
    skipFiles: false,
    skipDatabase: false,
    skipConfig: false,
    dryRun: false,
    reason: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: snapshotsData, isLoading: snapshotsLoading, refetch: refetchSnapshots } = useQuery<{ success: boolean; snapshots: DeploymentSnapshot[] }>({
    queryKey: ['/api/deployments', deploymentId, 'snapshots'],
  });

  const { data: rollbackStatusData, refetch: refetchStatus } = useQuery<{ success: boolean; status: RollbackStatus | null }>({
    queryKey: ['/api/deployments', deploymentId, 'rollback', 'status'],
    refetchInterval: (_data, _query) => {
      const data = _data;
      if (data?.status?.status === 'in_progress') {
        return 2000;
      }
      return false;
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ success: boolean; history: RollbackHistoryItem[] }>({
    queryKey: ['/api/deployments', deploymentId, 'rollback', 'history'],
  });

  const snapshots = snapshotsData?.snapshots || [];
  const activeRollback = rollbackStatusData?.status;
  const rollbackHistory = historyData?.history || [];

  useEffect(() => {
    if (activeRollback?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'snapshots'] });
      toast({
        title: 'Rollback Completed',
        description: `Successfully rolled back to version ${activeRollback.toVersion}`,
      });
    } else if (activeRollback?.status === 'failed') {
      toast({
        title: 'Rollback Failed',
        description: activeRollback.error || 'The rollback process encountered an error.',
        variant: 'destructive',
      });
    }
  }, [activeRollback?.status, activeRollback?.toVersion, activeRollback?.error, queryClient, deploymentId, toast]);

  const rollbackMutation = useMutation({
    mutationFn: async ({ version, options }: { version: string; options: typeof rollbackOptions }) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/rollback`, { version, ...options });
    },
    onSuccess: () => {
      setShowRollbackDialog(false);
      refetchStatus();
      toast({
        title: 'Rollback Initiated',
        description: 'The rollback process has started. This may take a few minutes.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Rollback Failed',
        description: error.message || 'Failed to initiate rollback. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (data: { reason?: string } = {}) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/snapshot`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'snapshots'] });
      toast({
        title: 'Snapshot Created',
        description: 'A new snapshot of the current deployment has been created.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Snapshot Failed',
        description: error.message || 'Failed to create snapshot. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-500/10 text-red-500';
      case 'staging': return 'bg-yellow-500/10 text-yellow-500';
      case 'development': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" data-testid="icon-status-completed" />;
      case 'running': return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" data-testid="icon-status-running" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" data-testid="icon-status-failed" />;
      case 'skipped': return <ChevronRight className="h-5 w-5 text-gray-400" data-testid="icon-status-skipped" />;
      default: return <Clock className="h-5 w-5 text-gray-400" data-testid="icon-status-pending" />;
    }
  };

  const handleRollback = (snapshot: DeploymentSnapshot) => {
    setSelectedSnapshot(snapshot);
    setRollbackOptions({ skipFiles: false, skipDatabase: false, skipConfig: false, dryRun: false, reason: '' });
    setShowRollbackDialog(true);
  };

  const handleViewDetails = (snapshot: DeploymentSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShowDetailsDialog(true);
  };

  const executeRollback = () => {
    if (selectedSnapshot) {
      rollbackMutation.mutate({
        version: selectedSnapshot.version,
        options: rollbackOptions,
      });
    }
  };

  const SnapshotCard = ({ snapshot, isActive }: { snapshot: DeploymentSnapshot; isActive?: boolean }) => (
    <Card 
      className={cn(
        'hover:shadow-lg transition-all duration-300',
        isActive && 'ring-2 ring-primary'
      )}
      data-testid={`snapshot-card-${snapshot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="font-semibold" data-testid={`snapshot-version-${snapshot.id}`}>
                Version {snapshot.version}
              </h4>
              <p className="text-[13px] text-muted-foreground" data-testid={`snapshot-date-${snapshot.id}`}>
                {formatDate(snapshot.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="default" className="bg-green-500" data-testid={`badge-active-${snapshot.id}`}>
                Active
              </Badge>
            )}
            <Badge variant="outline" className={getEnvironmentColor(snapshot.environment)} data-testid={`badge-env-${snapshot.id}`}>
              {snapshot.environment}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          {snapshot.metadata.commitHash && (
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Commit:</span>
              <span className="font-mono" data-testid={`snapshot-commit-${snapshot.id}`}>
                {snapshot.metadata.commitHash.slice(0, 7)}
              </span>
            </div>
          )}
          {snapshot.metadata.deployedBy && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">By:</span>
              <span data-testid={`snapshot-author-${snapshot.id}`}>{snapshot.metadata.deployedBy}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <HardDrive className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Size:</span>
            <span data-testid={`snapshot-size-${snapshot.id}`}>{formatSize(snapshot.size)}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Files:</span>
            <span data-testid={`snapshot-files-${snapshot.id}`}>{snapshot.fileManifest?.length || 0}</span>
          </div>
        </div>
        
        {snapshot.metadata.message && (
          <div className="text-[13px] text-muted-foreground p-2 bg-muted/50 rounded" data-testid={`snapshot-message-${snapshot.id}`}>
            {snapshot.metadata.message}
          </div>
        )}
        
        {snapshot.metadata.tags && snapshot.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {snapshot.metadata.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px]" data-testid={`snapshot-tag-${snapshot.id}-${tag}`}>
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleViewDetails(snapshot)}
            data-testid={`button-view-details-${snapshot.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            Details
          </Button>
          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-primary hover:text-primary/90 hover:bg-primary/10"
              onClick={() => handleRollback(snapshot)}
              disabled={activeRollback?.status === 'in_progress'}
              data-testid={`button-rollback-${snapshot.id}`}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Rollback
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const RollbackStep = ({ step, index }: { step: RollbackStatus['steps'][0]; index: number }) => (
    <div className="flex items-center gap-3" data-testid={`rollback-step-${index}`}>
      {getStatusIcon(step.status)}
      <div className="flex-1">
        <p className={cn(
          'font-medium',
          step.status === 'running' && 'text-blue-500',
          step.status === 'completed' && 'text-green-500',
          step.status === 'failed' && 'text-red-500',
          step.status === 'skipped' && 'text-gray-400'
        )}>
          {index + 1}. {step.name}
        </p>
        {step.message && (
          <p className="text-[13px] text-muted-foreground">{step.message}</p>
        )}
      </div>
    </div>
  );

  const SnapshotSkeleton = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <div>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={cn('space-y-6', className)} data-testid="rollback-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-panel-title">Deployment Rollback</h2>
          <p className="text-muted-foreground" data-testid="text-panel-description">
            Manage deployment versions and perform rollbacks
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetchSnapshots()}
            data-testid="button-refresh-snapshots"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => createSnapshotMutation.mutate({ reason: 'Manual snapshot' })}
            disabled={createSnapshotMutation.isPending}
            data-testid="button-create-snapshot"
          >
            <Save className="h-4 w-4 mr-2" />
            {createSnapshotMutation.isPending ? 'Creating...' : 'Create Snapshot'}
          </Button>
        </div>
      </div>

      {activeRollback && activeRollback.status === 'in_progress' && (
        <Alert className="border-blue-500/20 bg-blue-500/5" data-testid="alert-rollback-progress">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <AlertTitle>Rollback In Progress</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between text-[13px]">
                <span data-testid="text-rollback-versions">
                  Rolling back from {activeRollback.fromVersion} to {activeRollback.toVersion}
                </span>
                <span className="font-medium" data-testid="text-rollback-progress">
                  {activeRollback.progress}%
                </span>
              </div>
              <Progress value={activeRollback.progress} className="h-2" data-testid="progress-rollback" />
              <div className="space-y-2 mt-4">
                {activeRollback.steps.map((step, index) => (
                  <RollbackStep key={index} step={step} index={index} />
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="snapshots" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full" data-testid="tabs-container">
          <TabsTrigger value="snapshots" data-testid="tab-snapshots">
            <Package className="h-4 w-4 mr-2" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            Rollback History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-4" data-testid="tabcontent-snapshots">
          {snapshotsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <SnapshotSkeleton key={i} />
              ))}
            </div>
          ) : snapshots.length === 0 ? (
            <Card data-testid="card-no-snapshots">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No Snapshots Available</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No deployment snapshots have been created yet
                </p>
                <Button 
                  onClick={() => createSnapshotMutation.mutate({ reason: 'Initial snapshot' })}
                  data-testid="button-create-first-snapshot"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Create First Snapshot
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="grid-snapshots">
              {snapshots.map((snapshot: DeploymentSnapshot, index: number) => (
                <SnapshotCard 
                  key={snapshot.id} 
                  snapshot={snapshot} 
                  isActive={index === 0}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4" data-testid="tabcontent-history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Rollback Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rollbackHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-history">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No rollback history available</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3" data-testid="list-rollback-history">
                    {rollbackHistory.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                        data-testid={`history-item-${item.id}`}
                      >
                        {item.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : item.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">
                            Rollback to {item.toVersion} {item.status}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            From {item.fromVersion} • {formatDate(item.startedAt)}
                            {item.initiatedBy && ` • By ${item.initiatedBy}`}
                          </p>
                          {item.error && (
                            <p className="text-[13px] text-red-500 mt-1">{item.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-confirm-rollback">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              You are about to rollback to version {selectedSnapshot?.version}. This action may affect your live deployment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Rolling back will revert all changes made after this version. A backup snapshot will be created automatically before proceeding.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <h4 className="font-medium">Rollback Options</h4>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skip-files"
                    checked={rollbackOptions.skipFiles}
                    onCheckedChange={(checked) => 
                      setRollbackOptions({ ...rollbackOptions, skipFiles: !!checked })
                    }
                    data-testid="checkbox-skip-files"
                  />
                  <Label htmlFor="skip-files">Skip file restoration</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skip-database"
                    checked={rollbackOptions.skipDatabase}
                    onCheckedChange={(checked) => 
                      setRollbackOptions({ ...rollbackOptions, skipDatabase: !!checked })
                    }
                    data-testid="checkbox-skip-database"
                  />
                  <Label htmlFor="skip-database">Skip database restoration</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skip-config"
                    checked={rollbackOptions.skipConfig}
                    onCheckedChange={(checked) => 
                      setRollbackOptions({ ...rollbackOptions, skipConfig: !!checked })
                    }
                    data-testid="checkbox-skip-config"
                  />
                  <Label htmlFor="skip-config">Skip configuration restoration</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="dry-run"
                    checked={rollbackOptions.dryRun}
                    onCheckedChange={(checked) => 
                      setRollbackOptions({ ...rollbackOptions, dryRun: !!checked })
                    }
                    data-testid="checkbox-dry-run"
                  />
                  <Label htmlFor="dry-run">Dry run (preview changes only)</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="reason">Reason for rollback</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe why you're performing this rollback..."
                  value={rollbackOptions.reason}
                  onChange={(e) => setRollbackOptions({ ...rollbackOptions, reason: e.target.value })}
                  className="mt-1"
                  data-testid="input-rollback-reason"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRollbackDialog(false)}
              data-testid="button-cancel-rollback"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={executeRollback}
              disabled={rollbackMutation.isPending}
              data-testid="button-confirm-rollback"
            >
              {rollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirm Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-snapshot-details">
          <DialogHeader>
            <DialogTitle>Snapshot Details</DialogTitle>
            <DialogDescription>
              Version {selectedSnapshot?.version} - {selectedSnapshot?.environment}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSnapshot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Created At</Label>
                  <p className="font-medium" data-testid="text-detail-created">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    {new Date(selectedSnapshot.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Size</Label>
                  <p className="font-medium" data-testid="text-detail-size">
                    <HardDrive className="h-4 w-4 inline mr-1" />
                    {formatSize(selectedSnapshot.size)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Deployed By</Label>
                  <p className="font-medium" data-testid="text-detail-author">
                    <User className="h-4 w-4 inline mr-1" />
                    {selectedSnapshot.metadata.deployedBy}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Files</Label>
                  <p className="font-medium" data-testid="text-detail-files">
                    <FileText className="h-4 w-4 inline mr-1" />
                    {selectedSnapshot.fileManifest?.length || 0} files
                  </p>
                </div>
              </div>
              
              {selectedSnapshot.metadata.commitHash && (
                <div>
                  <Label className="text-muted-foreground">Commit</Label>
                  <p className="font-mono text-[13px]" data-testid="text-detail-commit">
                    {selectedSnapshot.metadata.commitHash}
                  </p>
                </div>
              )}
              
              {selectedSnapshot.metadata.message && (
                <div>
                  <Label className="text-muted-foreground">Message</Label>
                  <p className="text-[13px] p-2 bg-muted rounded" data-testid="text-detail-message">
                    {selectedSnapshot.metadata.message}
                  </p>
                </div>
              )}
              
              {selectedSnapshot.databaseSchema && (
                <div>
                  <Label className="text-muted-foreground">Database</Label>
                  <p className="text-[13px]" data-testid="text-detail-db">
                    {selectedSnapshot.databaseSchema.tables.length} tables, {selectedSnapshot.databaseSchema.migrations.length} migrations
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
              data-testid="button-close-details"
            >
              Close
            </Button>
            {selectedSnapshot && snapshots.indexOf(selectedSnapshot) !== 0 && (
              <Button
                onClick={() => {
                  setShowDetailsDialog(false);
                  handleRollback(selectedSnapshot);
                }}
                data-testid="button-rollback-from-details"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback to This Version
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RollbackPanel;
