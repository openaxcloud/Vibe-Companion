// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Rocket,
  GitBranch,
  Package,
  Shield,
  Globe,
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Terminal,
  FileCode,
  Server,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs?: string[];
  steps: PipelineStep[];
}

interface PipelineStep {
  id: string;
  name: string;
  command?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

interface Pipeline {
  id: string;
  projectId: number;
  branch: string;
  commit: {
    id: string;
    message: string;
    author: string;
  };
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  stages: PipelineStage[];
  startTime: Date;
  endTime?: Date;
  deploymentUrl?: string;
  artifacts?: {
    name: string;
    size: number;
    url: string;
  }[];
}

interface DeploymentPipelineProps {
  projectId: number;
  className?: string;
}

export function ReplitDeploymentPipeline({ projectId, className }: DeploymentPipelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const { data: currentPipeline } = useQuery<Pipeline>({
    queryKey: [`/api/deployment/${projectId}/pipeline/current`],
    refetchInterval: (_data, _query) => {
      const pipeline = _data;
      if (pipeline && ['running', 'pending'].includes(pipeline.status)) {
        return autoRefresh ? 5000 : false;
      }
      return false;
    }
  });

  const { data: pipelineHistory = [] } = useQuery<Pipeline[]>({
    queryKey: [`/api/deployment/${projectId}/pipeline/history`]
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/deployment/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployment/${projectId}/pipeline`] });
      toast({
        title: 'Deployment started',
        description: 'Your deployment pipeline has been triggered'
      });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      return apiRequest('POST', `/api/deployment/${projectId}/pipeline/${pipelineId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployment/${projectId}/pipeline`] });
      toast({
        title: 'Deployment cancelled',
        description: 'The deployment has been cancelled'
      });
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      return apiRequest('POST', `/api/deployment/${projectId}/pipeline/${pipelineId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deployment/${projectId}/pipeline`] });
      toast({
        title: 'Deployment retried',
        description: 'The deployment has been retried'
      });
    }
  });

  useEffect(() => {
    if (!canvasRef.current || !currentPipeline) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stageWidth = 150;
    const stageHeight = 80;
    const stageSpacing = 50;
    const startX = 50;
    const startY = canvas.height / 2 - stageHeight / 2;

    currentPipeline.stages.forEach((stage, index) => {
      const x = startX + index * (stageWidth + stageSpacing);
      const y = startY;

      if (index > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(var(--border))';
        ctx.lineWidth = 2;
        ctx.moveTo(x - stageSpacing, y + stageHeight / 2);
        ctx.lineTo(x, y + stageHeight / 2);
        ctx.stroke();
      }

      let bgColor = 'hsl(var(--card))';
      if (stage.status === 'success') bgColor = 'hsl(var(--ecode-green))';
      else if (stage.status === 'failed') bgColor = 'hsl(var(--destructive))';
      else if (stage.status === 'running') bgColor = 'hsl(var(--primary))';
      else if (stage.status === 'skipped') bgColor = 'hsl(var(--muted))';

      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(x, y, stageWidth, stageHeight, 8);
      ctx.fill();

      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      let icon = '○';
      if (stage.status === 'success') icon = '✓';
      else if (stage.status === 'failed') icon = '✗';
      else if (stage.status === 'running') icon = '◉';
      else if (stage.status === 'skipped') icon = '⊘';
      ctx.fillText(icon, x + stageWidth / 2, y + 30);

      ctx.font = '14px sans-serif';
      ctx.fillText(stage.name, x + stageWidth / 2, y + 55);

      if (stage.duration) {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.fillText(`${(stage.duration / 1000).toFixed(1)}s`, x + stageWidth / 2, y + 70);
      }
    });
  }, [currentPipeline]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-destructive" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-destructive';
      case 'running':
        return 'text-primary';
      case 'pending':
        return 'text-muted-foreground';
      case 'skipped':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <TooltipProvider>
      <Card className={cn("h-full flex flex-col", className, isFullscreen && "fixed inset-0 z-50")}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Deployment Pipeline
            </CardTitle>
            <div className="flex items-center gap-2">
              {currentPipeline && currentPipeline.status === 'running' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelMutation.mutate(currentPipeline.id)}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              {currentPipeline && currentPipeline.status === 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate(currentPipeline.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => deployMutation.mutate()}
                disabled={currentPipeline?.status === 'running' || deployMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Deploy
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4">
          {currentPipeline ? (
            <>
              <div className="mb-4 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <Badge variant={currentPipeline.status === 'success' ? 'default' : 
                                  currentPipeline.status === 'failed' ? 'destructive' : 
                                  'secondary'}>
                      {currentPipeline.status}
                    </Badge>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      {currentPipeline.branch}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <FileCode className="h-4 w-4" />
                      {currentPipeline.commit.id.slice(0, 7)}
                    </div>
                  </div>
                  {currentPipeline.deploymentUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentPipeline.deploymentUrl} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        View Deployment
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-[13px]">{currentPipeline.commit.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  by {currentPipeline.commit.author} • {new Date(currentPipeline.startTime).toLocaleString()}
                  {currentPipeline.endTime && ` • ${formatDuration(new Date(currentPipeline.endTime).getTime() - new Date(currentPipeline.startTime).getTime())}`}
                </p>
              </div>

              <div className="mb-4 border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={150}
                  className="w-full bg-background"
                />
              </div>

              <Tabs defaultValue="stages" className="flex-1 flex flex-col">
                <TabsList>
                  <TabsTrigger value="stages">Stages</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="artifacts">
                    Artifacts
                    {currentPipeline.artifacts && currentPipeline.artifacts.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {currentPipeline.artifacts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="stages" className="flex-1">
                  <ScrollArea className="h-full">
                    <div className="space-y-4">
                      {currentPipeline.stages.map((stage) => (
                        <div
                          key={stage.id}
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer",
                            selectedStage?.id === stage.id && "border-primary"
                          )}
                          onClick={() => setSelectedStage(stage)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(stage.status)}
                              <h3 className="font-medium">{stage.name}</h3>
                            </div>
                            {stage.duration && (
                              <span className="text-[13px] text-muted-foreground">
                                {formatDuration(stage.duration)}
                              </span>
                            )}
                          </div>

                          {stage.status === 'running' && (
                            <Progress value={50} className="mb-2" />
                          )}

                          <div className="space-y-2">
                            {stage.steps.map((step) => (
                              <div
                                key={step.id}
                                className="flex items-center justify-between text-[13px]"
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(step.status)}
                                  <span className={getStatusColor(step.status)}>
                                    {step.name}
                                  </span>
                                </div>
                                {step.command && (
                                  <code className="text-[11px] bg-muted px-2 py-1 rounded">
                                    {step.command}
                                  </code>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="logs" className="flex-1">
                  <ScrollArea className="h-full">
                    <div className="bg-[var(--ecode-terminal-bg)] p-4 rounded-lg font-mono text-[11px] text-green-400">
                      {selectedStage ? (
                        selectedStage.logs?.map((log, index) => (
                          <div key={index}>{log}</div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">Select a stage to view logs</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="artifacts" className="flex-1">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {currentPipeline.artifacts?.map((artifact, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span className="font-medium">{artifact.name}</span>
                            <span className="text-[13px] text-muted-foreground">
                              {(artifact.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={artifact.url} download>
                              Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="history" className="flex-1">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {pipelineHistory.map((pipeline) => (
                        <div
                          key={pipeline.id}
                          className="p-3 rounded-lg border cursor-pointer hover:bg-muted"
                          onClick={() => setSelectedPipeline(pipeline)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(pipeline.status)}
                              <span className="font-medium">
                                {pipeline.commit.message}
                              </span>
                            </div>
                            <Badge variant="outline">
                              {pipeline.commit.id.slice(0, 7)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                            <span>{new Date(pipeline.startTime).toLocaleString()}</span>
                            {pipeline.endTime && (
                              <span>{formatDuration(new Date(pipeline.endTime).getTime() - new Date(pipeline.startTime).getTime())}</span>
                            )}
                            <span>{pipeline.branch}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-[15px] font-medium">No active deployment</p>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Click Deploy to start a new deployment
                </p>
                <Button onClick={() => deployMutation.mutate()}>
                  <Play className="h-4 w-4 mr-2" />
                  Deploy Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
