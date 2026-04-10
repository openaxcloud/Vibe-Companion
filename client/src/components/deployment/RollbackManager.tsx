import React, { useState } from 'react';
import {
  RotateCcw, History, Package, Database, Settings, AlertTriangle,
  CheckCircle, XCircle, Clock, Download, Upload, Eye, ChevronRight,
  GitBranch, Save, Loader2, Info, Shield, FileText, Diff,
  ArrowLeft, ArrowRight, Calendar, User, Tag, HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LazyMotionDiv } from '@/lib/motion';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface RollbackManagerProps {
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
  }[];
  fromVersion: string;
  toVersion: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface VersionDiff {
  files: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  config: {
    added: Record<string, any>;
    modified: Record<string, { old: any; new: any }>;
    deleted: Record<string, any>;
  };
  database: {
    tablesAdded: string[];
    tablesModified: string[];
    tablesDeleted: string[];
    migrationsApplied: string[];
  };
}

export function RollbackManager({ deploymentId, className }: RollbackManagerProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DeploymentSnapshot | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[string, string] | null>(null);
  const [rollbackOptions, setRollbackOptions] = useState({
    skipFiles: false,
    skipDatabase: false,
    skipConfig: false,
    dryRun: false,
    reason: '',
  });
  const [activeRollback, setActiveRollback] = useState<RollbackStatus | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch deployment snapshots
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'versions'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/versions`);
      return response.json();
    },
  });

  // Fetch version diff
  const { data: versionDiff } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'diff', compareVersions],
    queryFn: async () => {
      if (!compareVersions) return null;
      const response = await fetch(
        `/api/deployments/${deploymentId}/diff?v1=${compareVersions[0]}&v2=${compareVersions[1]}`
      );
      return response.json();
    },
    enabled: !!compareVersions,
  });

  // Fetch rollback history
  const { data: rollbackHistory = [], isLoading: isLoadingHistory } = useQuery<RollbackStatus[]>({
    queryKey: ['/api/deployments', deploymentId, 'rollback', 'history'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/rollback/history`);
      const data = await response.json();
      return data.history || [];
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async ({ version, options }: { version: string; options: typeof rollbackOptions }) => {
      const response = await apiRequest('POST', `/api/deployments/${deploymentId}/rollback`, { version, ...options });
      return response.json();
    },
    onSuccess: (data) => {
      setActiveRollback(data);
      setShowRollbackDialog(false);
      toast({
        title: 'Rollback Initiated',
        description: 'The rollback process has started. This may take a few minutes.',
      });
      // Start polling for rollback status
      pollRollbackStatus(data.id);
    },
    onError: () => {
      toast({
        title: 'Rollback Failed',
        description: 'Failed to initiate rollback. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Create snapshot mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async (data: {} = {}) => {
      const response = await apiRequest('POST', `/api/deployments/${deploymentId}/snapshot`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'versions'] });
      toast({
        title: 'Snapshot Created',
        description: 'A new snapshot of the current deployment has been created.',
      });
    },
    onError: () => {
      toast({
        title: 'Snapshot Failed',
        description: 'Failed to create snapshot. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const pollRollbackStatus = async (rollbackId: string) => {
    const checkStatus = async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/rollback/${rollbackId}/status`);
      const status = await response.json();
      setActiveRollback(status);
      
      if (status.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId] });
        queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'rollback', 'history'] });
        toast({
          title: 'Rollback Completed',
          description: `Successfully rolled back to version ${status.toVersion}`,
        });
      } else if (status.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'rollback', 'history'] });
        toast({
          title: 'Rollback Failed',
          description: status.error || 'The rollback process encountered an error.',
          variant: 'destructive',
        });
      } else if (status.status === 'in_progress') {
        setTimeout(checkStatus, 2000); // Check again in 2 seconds
      }
    };
    
    checkStatus();
  };

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

  const handleRollback = (snapshot: DeploymentSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShowRollbackDialog(true);
  };

  const handleCompare = (v1: string, v2: string) => {
    setCompareVersions([v1, v2]);
    setShowDiffDialog(true);
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
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'glassmorphism hover:shadow-lg transition-all duration-300',
        isActive && 'ring-2 ring-ecode-primary'
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="font-semibold">Version {snapshot.version}</h4>
                <p className="text-[13px] text-muted-foreground">{formatDate(snapshot.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActive && (
                <Badge variant="default" className="bg-green-500">
                  Active
                </Badge>
              )}
              <Badge variant="outline" className={getEnvironmentColor(snapshot.environment)}>
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
                <span className="font-mono">{snapshot.metadata.commitHash.slice(0, 7)}</span>
              </div>
            )}
            {snapshot.metadata.deployedBy && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">By:</span>
                <span>{snapshot.metadata.deployedBy}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Size:</span>
              <span>{formatSize(snapshot.size)}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Files:</span>
              <span>{snapshot.fileManifest.length}</span>
            </div>
          </div>
          
          {snapshot.metadata.message && (
            <div className="text-[13px] text-muted-foreground p-2 bg-muted/50 rounded">
              {snapshot.metadata.message}
            </div>
          )}
          
          {snapshot.metadata.tags && snapshot.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {snapshot.metadata.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px]">
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
              onClick={() => handleCompare(snapshots[0]?.version, snapshot.version)}
              disabled={!snapshots[0] || snapshots[0].version === snapshot.version}
            >
              <Diff className="h-4 w-4 mr-1" />
              Compare
            </Button>
            {!isActive && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-ecode-primary hover:text-ecode-primary/90 hover:bg-ecode-primary/10"
                onClick={() => handleRollback(snapshot)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Rollback
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );

  const RollbackStep = ({ step, index }: { step: RollbackStatus['steps'][0]; index: number }) => {
    const getIcon = () => {
      switch (step.status) {
        case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'running': return <Loader2 className="h-5 w-5 text-ecode-primary animate-spin" />;
        case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
        case 'skipped': return <ChevronRight className="h-5 w-5 text-gray-400" />;
        default: return <Clock className="h-5 w-5 text-gray-400" />;
      }
    };
    
    return (
      <div className="flex items-center gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className={cn(
            'font-medium',
            step.status === 'running' && 'text-ecode-primary',
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
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Version Management</h2>
          <p className="text-muted-foreground">
            Manage deployment versions and perform rollbacks when needed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => createSnapshotMutation.mutate({})}
            disabled={createSnapshotMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {createSnapshotMutation.isPending ? 'Creating...' : 'Create Snapshot'}
          </Button>
          <Button className="bg-ecode-primary hover:bg-ecode-primary/90">
            <Upload className="h-4 w-4 mr-2" />
            Deploy New Version
          </Button>
        </div>
      </div>

      {/* Active Rollback Status */}
      {activeRollback && activeRollback.status === 'in_progress' && (
        <Alert className="border-ecode-primary/20 bg-ecode-primary/5">
          <Loader2 className="h-4 w-4 animate-spin text-ecode-primary" />
          <AlertTitle>Rollback In Progress</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between text-[13px]">
                <span>Rolling back from {activeRollback.fromVersion} to {activeRollback.toVersion}</span>
                <span className="font-medium">{activeRollback.progress}%</span>
              </div>
              <Progress value={activeRollback.progress} className="h-2" />
              <div className="space-y-2 mt-4">
                {activeRollback.steps.map((step, index) => (
                  <RollbackStep key={index} step={step} index={index} />
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-Rollback Configuration */}
      <Card className="glassmorphism">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auto-Rollback Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Automatic Rollback on Failure</p>
              <p className="text-[13px] text-muted-foreground">
                Automatically rollback if health score drops below 50%
              </p>
            </div>
            <Switch className="data-[state=checked]:bg-ecode-primary" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="versions" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="versions">Version History</TabsTrigger>
          <TabsTrigger value="activity">Rollback Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ecode-primary"></div>
            </div>
          ) : snapshots.length === 0 ? (
            <Card className="glassmorphism">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No Version History</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No deployment snapshots have been created yet
                </p>
                <Button onClick={() => createSnapshotMutation.mutate({})}>
                  <Save className="h-4 w-4 mr-2" />
                  Create First Snapshot
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        <TabsContent value="activity" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Recent Rollback Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ecode-primary"></div>
                </div>
              ) : rollbackHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">No Rollback Activity</h3>
                  <p className="text-muted-foreground text-center">
                    No rollback activity yet. Rollbacks will appear here once performed.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {rollbackHistory.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                        {activity.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : activity.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : activity.status === 'cancelled' ? (
                          <XCircle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-500" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">
                            Rollback to {activity.toVersion} {activity.status}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            {activity.error ? activity.error : `Rolled back from ${activity.fromVersion}`} • {formatDate(activity.startedAt)}
                          </p>
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

      {/* Rollback Confirmation Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              You are about to rollback to version {selectedSnapshot?.version}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Rolling back will revert all changes made after this version. Make sure to backup any important data before proceeding.
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
                  />
                  <Label htmlFor="dry-run">Dry run (preview changes only)</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="reason">Reason for rollback</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for this rollback..."
                  value={rollbackOptions.reason}
                  onChange={(e) => setRollbackOptions({ ...rollbackOptions, reason: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={executeRollback}
              className="bg-ecode-primary hover:bg-ecode-primary/90"
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {rollbackOptions.dryRun ? 'Preview Rollback' : 'Execute Rollback'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Diff Dialog */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version Comparison</DialogTitle>
            <DialogDescription>
              Comparing version {compareVersions?.[0]} with {compareVersions?.[1]}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh]">
            {versionDiff && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">File Changes</h4>
                  <div className="space-y-2">
                    {versionDiff.files.added.length > 0 && (
                      <div>
                        <p className="text-[13px] text-green-600 font-medium">
                          + {versionDiff.files.added.length} files added
                        </p>
                        <div className="text-[13px] text-muted-foreground pl-4">
                          {versionDiff.files.added.slice(0, 5).map((file: string) => (
                            <div key={file}>+ {file}</div>
                          ))}
                          {versionDiff.files.added.length > 5 && (
                            <div>... and {versionDiff.files.added.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {versionDiff.files.modified.length > 0 && (
                      <div>
                        <p className="text-[13px] text-yellow-600 font-medium">
                          ~ {versionDiff.files.modified.length} files modified
                        </p>
                        <div className="text-[13px] text-muted-foreground pl-4">
                          {versionDiff.files.modified.slice(0, 5).map((file: string) => (
                            <div key={file}>~ {file}</div>
                          ))}
                          {versionDiff.files.modified.length > 5 && (
                            <div>... and {versionDiff.files.modified.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {versionDiff.files.deleted.length > 0 && (
                      <div>
                        <p className="text-[13px] text-red-600 font-medium">
                          - {versionDiff.files.deleted.length} files deleted
                        </p>
                        <div className="text-[13px] text-muted-foreground pl-4">
                          {versionDiff.files.deleted.slice(0, 5).map((file: string) => (
                            <div key={file}>- {file}</div>
                          ))}
                          {versionDiff.files.deleted.length > 5 && (
                            <div>... and {versionDiff.files.deleted.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Configuration Changes</h4>
                  <div className="space-y-2 text-[13px]">
                    {Object.keys(versionDiff.config.added).length > 0 && (
                      <div>
                        <p className="text-green-600 font-medium">Added:</p>
                        <pre className="bg-muted p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(versionDiff.config.added, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {Object.keys(versionDiff.config.modified).length > 0 && (
                      <div>
                        <p className="text-yellow-600 font-medium">Modified:</p>
                        {Object.entries(versionDiff.config.modified).map(([key, value]: [string, any]) => (
                          <div key={key} className="mt-1">
                            <p className="font-mono">{key}:</p>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div className="bg-red-50 p-2 rounded">
                                <span className="text-red-600">Old:</span> {JSON.stringify(value.old)}
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <span className="text-green-600">New:</span> {JSON.stringify(value.new)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {versionDiff.database && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Database Changes</h4>
                      <div className="space-y-2 text-[13px]">
                        {versionDiff.database.tablesAdded.length > 0 && (
                          <p className="text-green-600">
                            + {versionDiff.database.tablesAdded.length} tables added
                          </p>
                        )}
                        {versionDiff.database.tablesDeleted.length > 0 && (
                          <p className="text-red-600">
                            - {versionDiff.database.tablesDeleted.length} tables deleted
                          </p>
                        )}
                        {versionDiff.database.migrationsApplied.length > 0 && (
                          <p className="text-blue-600">
                            {versionDiff.database.migrationsApplied.length} migrations applied
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiffDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}