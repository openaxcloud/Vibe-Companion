import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bot, Play, Square, Plus, FileText, Code, DollarSign, AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react';

interface AgentV2Progress {
  status: 'initializing' | 'analyzing' | 'building' | 'testing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  stepsCompleted: string[];
  filesModified: number;
  linesWritten: number;
  tokensUsed: number;
  estimatedCost: number;
  checkpointsCreated: number;
  errors: string[];
  actions: Array<{
    timestamp: Date;
    type: string;
    description: string;
    result?: any;
  }>;
}

interface AgentV2InterfaceProps {
  projectId: number;
}

export function AgentV2Interface({ projectId }: AgentV2InterfaceProps) {
  const { toast } = useToast();
  const [taskDescription, setTaskDescription] = useState('');
  const [complexity, setComplexity] = useState<'simple' | 'moderate' | 'complex' | 'expert'>('moderate');
  const [autoCheckpoints, setAutoCheckpoints] = useState(true);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [additionalContext, setAdditionalContext] = useState('');

  // Check for active build - RATE LIMIT FIX: Reduced polling frequency
  const { data: activeBuildData } = useQuery({
    queryKey: ['/api/agent-v2/active-build', projectId],
    queryFn: () => apiRequest('GET', `/api/agent-v2/active-build/${projectId}`).then(res => res.json()),
    refetchInterval: 30000, // 30s (was 5s) - prevents rate limit exceeded
    refetchIntervalInBackground: false,
  });

  const activeBuildId = activeBuildData?.buildId;

  // Get build progress - RATE LIMIT FIX: Reduced polling frequency
  const { data: progressData } = useQuery({
    queryKey: ['/api/agent-v2/build-progress', activeBuildId],
    queryFn: () => apiRequest('GET', `/api/agent-v2/build-progress/${activeBuildId}`).then(res => res.json()),
    enabled: !!activeBuildId,
    refetchInterval: realTimeUpdates ? 10000 : 30000, // 10s/30s (was 1s/5s) - prevents rate limit
    refetchIntervalInBackground: false,
  });

  const progress = progressData?.progress as AgentV2Progress | undefined;

  // Start build mutation
  const startBuild = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/agent-v2/start-build', data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-v2/active-build', projectId] });
      toast({
        title: 'Build Started',
        description: 'Agent v2 is now working on your task.',
      });
      setTaskDescription('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start build',
        variant: 'destructive',
      });
    }
  });

  // Stop build mutation
  const stopBuild = useMutation({
    mutationFn: (buildId: string) => apiRequest('POST', `/api/agent-v2/stop-build/${buildId}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-v2/active-build', projectId] });
      toast({
        title: 'Build Stopped',
        description: 'The build has been stopped.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to stop build',
        variant: 'destructive',
      });
    }
  });

  // Provide context mutation
  const provideContext = useMutation({
    mutationFn: (data: { buildId: string; context: string }) => 
      apiRequest('POST', `/api/agent-v2/provide-context/${data.buildId}`, { context: data.context }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Context Provided',
        description: 'Additional context has been sent to the agent.',
      });
      setAdditionalContext('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to provide context',
        variant: 'destructive',
      });
    }
  });

  const handleStartBuild = () => {
    if (!taskDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please describe what you want the agent to build',
        variant: 'destructive',
      });
      return;
    }

    startBuild.mutate({
      projectId,
      taskDescription,
      complexity,
      autoCheckpoints,
      realTimeUpdates
    });
  };

  const handleProvideContext = () => {
    if (!additionalContext.trim() || !activeBuildId) return;

    provideContext.mutate({
      buildId: activeBuildId,
      context: additionalContext
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'initializing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'analyzing':
        return <Sparkles className="h-4 w-4" />;
      case 'building':
        return <Code className="h-4 w-4" />;
      case 'testing':
        return <FileText className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Agent v2 - Claude Sonnet 4.0
          </h2>
          <p className="text-muted-foreground">Autonomous AI builder with advanced capabilities</p>
        </div>
      </div>

      {/* Build Configuration */}
      {!activeBuildId && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Build</CardTitle>
            <CardDescription>Describe what you want the AI agent to build</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task">Task Description</Label>
              <Textarea
                id="task"
                placeholder="Build a todo app with user authentication, task categories, and due dates..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Complexity Level</Label>
              <RadioGroup value={complexity} onValueChange={setComplexity as any}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="simple" id="simple" />
                  <Label htmlFor="simple">Simple (Basic features, &lt;$5)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="moderate" />
                  <Label htmlFor="moderate">Moderate (Standard app, $5-$20)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="complex" id="complex" />
                  <Label htmlFor="complex">Complex (Advanced features, $20-$50)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expert" id="expert" />
                  <Label htmlFor="expert">Expert (Enterprise features, $50+)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-checkpoints"
                  checked={autoCheckpoints}
                  onCheckedChange={setAutoCheckpoints}
                />
                <Label htmlFor="auto-checkpoints">Auto-checkpoints</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="real-time"
                  checked={realTimeUpdates}
                  onCheckedChange={setRealTimeUpdates}
                />
                <Label htmlFor="real-time">Real-time updates</Label>
              </div>
            </div>

            <Button 
              onClick={handleStartBuild}
              disabled={startBuild.isPending}
              className="w-full"
            >
              {startBuild.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Building
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Build Progress */}
      {progress && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(progress.status)}
                <CardTitle>Build Progress</CardTitle>
                <Badge variant={getStatusBadgeVariant(progress.status) as any}>
                  {progress.status}
                </Badge>
              </div>
              {progress.status !== 'completed' && progress.status !== 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stopBuild.mutate(activeBuildId)}
                  disabled={stopBuild.isPending}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span>{progress.currentStep}</span>
                <span>{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.filesModified}</div>
                <div className="text-[11px] text-muted-foreground">Files Modified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.linesWritten}</div>
                <div className="text-[11px] text-muted-foreground">Lines Written</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.tokensUsed}</div>
                <div className="text-[11px] text-muted-foreground">Tokens Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {(progress.estimatedCost / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-muted-foreground">Estimated Cost</div>
              </div>
            </div>

            {progress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {progress.errors[progress.errors.length - 1]}
                </AlertDescription>
              </Alert>
            )}

            {/* Recent Actions */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-medium">Recent Actions</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {progress.actions.slice(-5).reverse().map((action, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    <span className="font-mono">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                    {' - '}
                    <span>{action.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provide Additional Context */}
            {progress.status !== 'completed' && progress.status !== 'error' && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="context">Provide Additional Context</Label>
                <div className="flex gap-2">
                  <Textarea
                    id="context"
                    placeholder="Add more details or clarifications..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleProvideContext}
                    disabled={!additionalContext.trim() || provideContext.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed Message */}
      {progress?.status === 'completed' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Build completed successfully! The agent created {progress.filesModified} files, 
            wrote {progress.linesWritten} lines of code, and created {progress.checkpointsCreated} checkpoints. 
            Total cost: ${(progress.estimatedCost / 100).toFixed(2)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}