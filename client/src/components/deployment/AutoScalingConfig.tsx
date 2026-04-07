import React, { useState, useEffect } from 'react';
import {
  Zap, Plus, Trash2, Edit, Save, X, TrendingUp, TrendingDown,
  Cpu, HardDrive, Network, Clock, DollarSign, AlertTriangle,
  Info, Settings, History, Play, Pause, ChevronRight, Calculator
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LazyMotionDiv } from '@/lib/motion';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface AutoScalingConfigProps {
  deploymentId: string;
  className?: string;
}

interface ScalingPolicy {
  id?: string;
  name: string;
  enabled: boolean;
  metric: 'cpu' | 'memory' | 'requests' | 'responseTime' | 'custom';
  thresholdUp: number;
  thresholdDown: number;
  scaleUpBy: number;
  scaleDownBy: number;
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number;
  customMetric?: {
    query: string;
    aggregation: 'avg' | 'max' | 'min' | 'sum';
  };
}

interface ScalingEvent {
  id: string;
  policyId: string;
  action: 'scale_up' | 'scale_down' | 'no_action';
  previousInstances: number;
  newInstances: number;
  metric: string;
  metricValue: number;
  threshold: number;
  timestamp: string;
  reason: string;
}

interface CostEstimate {
  currentCost: number;
  estimatedCost: number;
  savingsOrIncrease: number;
  breakdown: {
    compute: number;
    memory: number;
    network: number;
    storage: number;
  };
}

const METRIC_ICONS = {
  cpu: Cpu,
  memory: HardDrive,
  requests: Network,
  responseTime: Clock,
  custom: Settings,
};

const METRIC_LABELS = {
  cpu: 'CPU Usage',
  memory: 'Memory Usage',
  requests: 'Request Count',
  responseTime: 'Response Time',
  custom: 'Custom Metric',
};

export function AutoScalingConfig({ deploymentId, className }: AutoScalingConfigProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<ScalingPolicy | null>(null);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ScalingPolicy | null>(null);
  const [previewInstances, setPreviewInstances] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch scaling policies
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'scaling-policies'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/autoscale`);
      return response.json();
    },
  });

  // Fetch scaling history
  const { data: history = [] } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'scaling-history'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/autoscale/history`);
      return response.json();
    },
  });

  // Fetch scaling status
  const { data: status } = useQuery({
    queryKey: ['/api/deployments', deploymentId, 'scaling-status'],
    queryFn: async () => {
      const response = await fetch(`/api/deployments/${deploymentId}/autoscale/status`);
      return response.json();
    },
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Create or update policy mutation
  const savePolicyMutation = useMutation({
    mutationFn: async (policy: ScalingPolicy) => {
      const url = policy.id 
        ? `/api/deployments/${deploymentId}/autoscale/${policy.id}`
        : `/api/deployments/${deploymentId}/autoscale`;
      const method = policy.id ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, url, policy);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'scaling-policies'] });
      setShowPolicyDialog(false);
      setEditingPolicy(null);
      toast({
        title: 'Success',
        description: 'Scaling policy saved successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save scaling policy',
        variant: 'destructive',
      });
    },
  });

  // Delete policy mutation
  const deletePolicyMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const response = await apiRequest('DELETE', `/api/deployments/${deploymentId}/autoscale/${policyId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'scaling-policies'] });
      toast({
        title: 'Success',
        description: 'Scaling policy deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete scaling policy',
        variant: 'destructive',
      });
    },
  });

  // Toggle policy mutation
  const togglePolicyMutation = useMutation({
    mutationFn: async ({ policyId, enabled }: { policyId: string; enabled: boolean }) => {
      const response = await apiRequest('POST', `/api/deployments/${deploymentId}/autoscale/${policyId}/toggle`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId, 'scaling-policies'] });
    },
  });

  const handleCreatePolicy = () => {
    setEditingPolicy({
      name: 'New Scaling Policy',
      enabled: true,
      metric: 'cpu',
      thresholdUp: 70,
      thresholdDown: 30,
      scaleUpBy: 1,
      scaleDownBy: 1,
      minInstances: 1,
      maxInstances: 10,
      cooldownPeriod: 300,
    });
    setShowPolicyDialog(true);
  };

  const handleEditPolicy = (policy: ScalingPolicy) => {
    setEditingPolicy(policy);
    setShowPolicyDialog(true);
  };

  const handleSavePolicy = () => {
    if (editingPolicy) {
      savePolicyMutation.mutate(editingPolicy);
    }
  };

  const calculateCostEstimate = (instances: number): number => {
    // Basic cost calculation (in production, this would be more sophisticated)
    const baseHourlyCost = 0.05; // $0.05 per instance per hour
    const monthlyCost = baseHourlyCost * instances * 730; // 730 hours in a month
    return monthlyCost;
  };

  const formatEventTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const PolicyCard = ({ policy }: { policy: ScalingPolicy }) => {
    const Icon = METRIC_ICONS[policy.metric];
    const isActive = policy.enabled;
    
    return (
      <LazyMotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn(
          'glassmorphism hover:shadow-lg transition-all duration-300 cursor-pointer',
          !isActive && 'opacity-60'
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'p-2 rounded-lg',
                  isActive ? 'bg-ecode-primary/10' : 'bg-gray-500/10'
                )}>
                  <Icon className={cn('h-5 w-5', isActive ? 'text-ecode-primary' : 'text-gray-500')} />
                </div>
                <div>
                  <h4 className="font-semibold">{policy.name}</h4>
                  <p className="text-[13px] text-muted-foreground">{METRIC_LABELS[policy.metric]}</p>
                </div>
              </div>
              <Switch
                checked={policy.enabled}
                onCheckedChange={(checked) => 
                  togglePolicyMutation.mutate({ policyId: policy.id!, enabled: checked })
                }
                className={cn(isActive && 'data-[state=checked]:bg-ecode-primary')}
              />
            </div>
            
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scale Up</span>
                <span className="font-medium">
                  {policy.thresholdUp}% → +{policy.scaleUpBy} instance(s)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scale Down</span>
                <span className="font-medium">
                  {policy.thresholdDown}% → -{policy.scaleDownBy} instance(s)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Instance Range</span>
                <span className="font-medium">{policy.minInstances} - {policy.maxInstances}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cooldown</span>
                <span className="font-medium">{policy.cooldownPeriod}s</span>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleEditPolicy(policy)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => policy.id && deletePolicyMutation.mutate(policy.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </LazyMotionDiv>
    );
  };

  const ScalingEventItem = ({ event }: { event: ScalingEvent }) => {
    const isScaleUp = event.action === 'scale_up';
    const isScaleDown = event.action === 'scale_down';
    
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className={cn(
          'p-2 rounded-full',
          isScaleUp && 'bg-green-500/10 text-green-500',
          isScaleDown && 'bg-blue-500/10 text-blue-500',
          event.action === 'no_action' && 'bg-gray-500/10 text-gray-500'
        )}>
          {isScaleUp && <TrendingUp className="h-4 w-4" />}
          {isScaleDown && <TrendingDown className="h-4 w-4" />}
          {event.action === 'no_action' && <Info className="h-4 w-4" />}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium">
              {event.action === 'scale_up' && `Scaled up from ${event.previousInstances} to ${event.newInstances}`}
              {event.action === 'scale_down' && `Scaled down from ${event.previousInstances} to ${event.newInstances}`}
              {event.action === 'no_action' && 'No action taken'}
            </p>
            <span className="text-[11px] text-muted-foreground">
              {formatEventTime(event.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {event.reason}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auto-Scaling Configuration</h2>
          <p className="text-muted-foreground">
            Configure automatic scaling policies to optimize performance and costs
          </p>
        </div>
        <Button onClick={handleCreatePolicy} className="bg-ecode-primary hover:bg-ecode-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Current Status */}
      {status && (
        <Card className="glassmorphism">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[13px] text-muted-foreground">Current Instances</p>
                <p className="text-2xl font-bold">{status.currentInstances || 1}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Target Instances</p>
                <p className="text-2xl font-bold">{status.targetInstances || 1}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Active Policies</p>
                <p className="text-2xl font-bold">{status.activePolicies || 0}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Est. Monthly Cost</p>
                <p className="text-2xl font-bold text-ecode-primary">
                  ${status.estimatedCost?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            
            {status.inCooldown && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cooldown Active</AlertTitle>
                <AlertDescription>
                  Scaling is temporarily paused. Cooldown ends at {new Date(status.cooldownEndsAt).toLocaleTimeString()}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="policies">Scaling Policies</TabsTrigger>
          <TabsTrigger value="history">Scaling History</TabsTrigger>
          <TabsTrigger value="simulator">Cost Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ecode-primary"></div>
            </div>
          ) : policies.length === 0 ? (
            <Card className="glassmorphism">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No Scaling Policies</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first auto-scaling policy to optimize resource usage
                </p>
                <Button onClick={handleCreatePolicy}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((policy: ScalingPolicy) => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Scaling Events</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <History className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No scaling events yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((event: ScalingEvent) => (
                      <ScalingEventItem key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-4">
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Cost Simulator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="instance-slider">Number of Instances</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider
                    id="instance-slider"
                    min={1}
                    max={20}
                    step={1}
                    value={[previewInstances]}
                    onValueChange={(value) => setPreviewInstances(value[0])}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono">{previewInstances}</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[13px] text-muted-foreground">Hourly Cost</p>
                  <p className="text-2xl font-bold">
                    ${(previewInstances * 0.05).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] text-muted-foreground">Monthly Cost</p>
                  <p className="text-2xl font-bold text-ecode-primary">
                    ${calculateCostEstimate(previewInstances).toFixed(2)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Compute</span>
                  <span>${(previewInstances * 0.02 * 730).toFixed(2)}/mo</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Memory</span>
                  <span>${(previewInstances * 0.01 * 730).toFixed(2)}/mo</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Network</span>
                  <span>${(previewInstances * 0.015 * 730).toFixed(2)}/mo</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Storage</span>
                  <span>${(previewInstances * 0.005 * 730).toFixed(2)}/mo</span>
                </div>
              </div>
              
              <Alert>
                <Calculator className="h-4 w-4" />
                <AlertTitle>Cost Optimization Tip</AlertTitle>
                <AlertDescription>
                  With auto-scaling, you can save up to 40% by automatically scaling down during low-traffic periods.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Policy Edit Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy?.id ? 'Edit Scaling Policy' : 'Create Scaling Policy'}
            </DialogTitle>
          </DialogHeader>
          
          {editingPolicy && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="policy-name">Policy Name</Label>
                <Input
                  id="policy-name"
                  value={editingPolicy.name}
                  onChange={(e) => setEditingPolicy({ ...editingPolicy, name: e.target.value })}
                  placeholder="e.g., CPU Auto-scaling"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="metric">Metric</Label>
                  <Select 
                    value={editingPolicy.metric} 
                    onValueChange={(v: any) => setEditingPolicy({ ...editingPolicy, metric: v })}
                  >
                    <SelectTrigger id="metric">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpu">CPU Usage</SelectItem>
                      <SelectItem value="memory">Memory Usage</SelectItem>
                      <SelectItem value="requests">Request Count</SelectItem>
                      <SelectItem value="responseTime">Response Time</SelectItem>
                      <SelectItem value="custom">Custom Metric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="cooldown">Cooldown Period (seconds)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={editingPolicy.cooldownPeriod}
                    onChange={(e) => setEditingPolicy({ ...editingPolicy, cooldownPeriod: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">Scale Up Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="threshold-up">Threshold (%)</Label>
                    <Input
                      id="threshold-up"
                      type="number"
                      value={editingPolicy.thresholdUp}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, thresholdUp: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="scale-up-by">Add Instances</Label>
                    <Input
                      id="scale-up-by"
                      type="number"
                      value={editingPolicy.scaleUpBy}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, scaleUpBy: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Scale Down Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="threshold-down">Threshold (%)</Label>
                    <Input
                      id="threshold-down"
                      type="number"
                      value={editingPolicy.thresholdDown}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, thresholdDown: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="scale-down-by">Remove Instances</Label>
                    <Input
                      id="scale-down-by"
                      type="number"
                      value={editingPolicy.scaleDownBy}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, scaleDownBy: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">Instance Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min-instances">Minimum Instances</Label>
                    <Input
                      id="min-instances"
                      type="number"
                      value={editingPolicy.minInstances}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, minInstances: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-instances">Maximum Instances</Label>
                    <Input
                      id="max-instances"
                      type="number"
                      value={editingPolicy.maxInstances}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, maxInstances: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePolicy}
              className="bg-ecode-primary hover:bg-ecode-primary/90"
              disabled={savePolicyMutation.isPending}
            >
              {savePolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}