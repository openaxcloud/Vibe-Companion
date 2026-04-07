// @ts-nocheck
/**
 * UI Component for managing isolated project environments
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ECodeSpinner } from './ECodeLoading';
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Play,
  Square,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface Environment {
  id: string;
  projectId: number;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  resourceLimits: {
    memory: number;
    cpu: number;
  };
  resourceUsage?: {
    cpu: number;
    memory: number;
    disk: number;
  };
  networkNamespace: string;
  databaseNamespace: string;
  createdAt: string;
  lastActivity: string;
}

interface IsolationManagerProps {
  projectId: number;
  projectName?: string;
}

export const IsolationManager: React.FC<IsolationManagerProps> = ({ 
  projectId, 
  projectName 
}) => {
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [memoryLimit, setMemoryLimit] = useState('512');
  const [cpuLimit, setCpuLimit] = useState('25');

  // Query for environment status
  const { data: environment, isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/environment`],
    retry: false,
    refetchInterval: (data) => {
      if (data?.status === 'running') {
        return 5000; // Refresh every 5 seconds when running
      }
      return false;
    }
  });

  // Mutation to create environment
  const createEnvironmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/environment`, {
        memory: parseInt(memoryLimit),
        cpu: parseInt(cpuLimit)
      });
      if (!res.ok) throw new Error('Failed to create environment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/projects/${projectId}/environment`] 
      });
      toast({
        title: "Environment Created",
        description: "Isolated environment is starting up...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create environment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation to stop environment
  const stopEnvironmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/environment`);
      if (!res.ok) throw new Error('Failed to stop environment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/projects/${projectId}/environment`] 
      });
      toast({
        title: "Environment Stopped",
        description: "The isolated environment has been terminated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop environment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running':
        return 'text-green-500';
      case 'starting':
        return 'text-yellow-500';
      case 'stopped':
        return 'text-gray-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4" />;
      case 'starting':
        return <Clock className="h-4 w-4" />;
      case 'stopped':
        return <Square className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUptime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <ECodeSpinner size={32} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-[var(--ecode-accent)]" />
              <div>
                <CardTitle>Isolated Environment</CardTitle>
                <CardDescription>
                  {projectName ? `Container for ${projectName}` : 'Project Container'}
                </CardDescription>
              </div>
            </div>
            {environment && (
              <Badge 
                variant={environment.status === 'running' ? 'default' : 'secondary'}
                className={`flex items-center gap-1 ${getStatusColor(environment.status)}`}
              >
                {getStatusIcon(environment.status)}
                {environment.status}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!environment || environment.error ? (
            // No environment exists
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-[var(--ecode-surface)] flex items-center justify-center">
                  <Server className="h-8 w-8 text-[var(--ecode-muted)]" />
                </div>
              </div>
              <div>
                <h3 className="font-medium text-[var(--ecode-text)]">
                  No Isolated Environment
                </h3>
                <p className="text-[13px] text-[var(--ecode-muted)] mt-1">
                  Create an isolated container for this project
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button
                  onClick={() => createEnvironmentMutation.mutate()}
                  disabled={createEnvironmentMutation.isPending}
                  size="sm"
                >
                  {createEnvironmentMutation.isPending ? (
                    <>
                      <ECodeSpinner className="mr-2" size={16} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Create Environment
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Environment exists
            <div className="space-y-4">
              {/* Connection Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[11px] text-[var(--ecode-muted)]">Port</Label>
                  <div className="font-mono text-[13px]">{environment.port}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-[var(--ecode-muted)]">Uptime</Label>
                  <div className="text-[13px]">{formatUptime(environment.createdAt)}</div>
                </div>
              </div>

              <Separator />

              {/* Resource Usage */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Resource Usage
                </h4>

                {/* CPU Usage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <Cpu className="h-3 w-3" />
                      CPU
                    </span>
                    <span className="text-[11px] text-[var(--ecode-muted)]">
                      {environment.resourceUsage?.cpu?.toFixed(1) || 0}% / {environment.resourceLimits.cpu}%
                    </span>
                  </div>
                  <Progress 
                    value={(environment.resourceUsage?.cpu || 0) / environment.resourceLimits.cpu * 100} 
                    className="h-1"
                  />
                </div>

                {/* Memory Usage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      Memory
                    </span>
                    <span className="text-[11px] text-[var(--ecode-muted)]">
                      {environment.resourceUsage?.memory?.toFixed(0) || 0} MB / {environment.resourceLimits.memory} MB
                    </span>
                  </div>
                  <Progress 
                    value={(environment.resourceUsage?.memory || 0) / environment.resourceLimits.memory * 100} 
                    className="h-1"
                  />
                </div>

                {/* Disk Usage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3" />
                      Disk
                    </span>
                    <span className="text-[11px] text-[var(--ecode-muted)]">
                      {environment.resourceUsage?.disk?.toFixed(0) || 0} MB
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Network Info */}
              <div className="space-y-2">
                <h4 className="text-[13px] font-medium flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Network Isolation
                </h4>
                <div className="text-[11px] font-mono bg-[var(--ecode-surface)] p-2 rounded">
                  {environment.networkNamespace}
                </div>
              </div>

              {/* Database Info */}
              <div className="space-y-2">
                <h4 className="text-[13px] font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Database Namespace
                </h4>
                <div className="text-[11px] font-mono bg-[var(--ecode-surface)] p-2 rounded">
                  {environment.databaseNamespace}
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {environment && !environment.error && (
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ 
                queryKey: [`/api/projects/${projectId}/environment`] 
              })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => stopEnvironmentMutation.mutate()}
              disabled={stopEnvironmentMutation.isPending}
            >
              {stopEnvironmentMutation.isPending ? (
                <>
                  <ECodeSpinner className="mr-2" size={16} />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Environment
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Environment Configuration</DialogTitle>
            <DialogDescription>
              Configure resource limits for the isolated environment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memory">Memory Limit (MB)</Label>
              <Select value={memoryLimit} onValueChange={setMemoryLimit}>
                <SelectTrigger id="memory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256 MB</SelectItem>
                  <SelectItem value="512">512 MB</SelectItem>
                  <SelectItem value="1024">1 GB</SelectItem>
                  <SelectItem value="2048">2 GB</SelectItem>
                  <SelectItem value="4096">4 GB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpu">CPU Limit (%)</Label>
              <Select value={cpuLimit} onValueChange={setCpuLimit}>
                <SelectTrigger id="cpu">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowSettings(false);
              createEnvironmentMutation.mutate();
            }}>
              Create with Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};