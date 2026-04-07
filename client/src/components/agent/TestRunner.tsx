import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Monitor,
  Smartphone,
  Tablet,
  Image,
  Video,
  FileText,
  Loader2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TestExecutionResult {
  id: string;
  sessionId: string;
  status: 'running' | 'passed' | 'failed' | 'error';
  testScript: string;
  browserType: 'chromium' | 'firefox' | 'webkit';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result?: {
    passed: boolean;
    errors?: Array<{ message: string; stack?: string }>;
    assertions?: number;
  };
  artifacts?: Array<{
    type: 'screenshot' | 'video' | 'trace';
    url: string;
    name: string;
  }>;
}

interface TestRunnerProps {
  sessionId: string;
  projectId: string;
  className?: string;
}

export function TestRunner({ sessionId, projectId, className }: TestRunnerProps) {
  // Use current origin in example, fallback to production URL for SSR
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://e-code.ai';
  const [testScript, setTestScript] = useState(
    `// Example Playwright test\nawait page.goto('${baseUrl}');\nawait page.waitForSelector('[data-testid="button-login"]');\nawait page.click('[data-testid="button-login"]');`
  );
  const [browser, setBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [testType, setTestType] = useState<'e2e' | 'visual_regression' | 'performance' | 'accessibility' | 'cross_browser'>('e2e');
  const [recordVideo, setRecordVideo] = useState(false);
  const [traceEnabled, setTraceEnabled] = useState(false);
  const [openResults, setOpenResults] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch test execution history
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/admin/agent/test/history', sessionId],
  });

  const executions: TestExecutionResult[] = historyData?.history || [];

  // Execute test mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/agent/test/execute`, {
        sessionId,
        projectId,
        testScript,
        options: {
          testType,
          browser,
          recordVideo,
          traceEnabled,
          viewport: { width: 1920, height: 1080 }
        }
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Test Started',
        description: `Execution ID: ${data.execution?.id || 'Unknown'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agent/test/history', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to execute test',
        variant: 'destructive',
      });
    },
  });

  const toggleResult = (executionId: string) => {
    setOpenResults(prev => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (openResults.size === executions.length) {
      setOpenResults(new Set());
    } else {
      setOpenResults(new Set(executions.map(e => e.id)));
    }
  };

  const getStatusIcon = (status: TestExecutionResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getBrowserIcon = (browser: string) => {
    switch (browser) {
      case 'chromium':
        return <Monitor className="h-4 w-4" />;
      case 'firefox':
        return <Monitor className="h-4 w-4" />;
      case 'webkit':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs defaultValue="runner" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="runner" data-testid="tab-test-runner">
            Test Runner
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-test-history">
            History ({executions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runner" className="flex-1 flex flex-col gap-4 mt-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="test-script">Test Script</Label>
                <Textarea
                  id="test-script"
                  value={testScript}
                  onChange={(e) => setTestScript(e.target.value)}
                  placeholder="Enter Playwright test script..."
                  className="font-mono text-[13px] min-h-[200px] mt-2"
                  data-testid="textarea-test-script"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="browser">Browser</Label>
                  <Select value={browser} onValueChange={(v: any) => setBrowser(v)}>
                    <SelectTrigger id="browser" data-testid="select-browser">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chromium" data-testid="option-chromium">
                        Chromium
                      </SelectItem>
                      <SelectItem value="firefox" data-testid="option-firefox">
                        Firefox
                      </SelectItem>
                      <SelectItem value="webkit" data-testid="option-webkit">
                        WebKit (Safari)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-type">Test Type</Label>
                  <Select value={testType} onValueChange={(v: any) => setTestType(v)}>
                    <SelectTrigger id="test-type" data-testid="select-test-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="e2e" data-testid="option-e2e">
                        End-to-End
                      </SelectItem>
                      <SelectItem value="visual_regression" data-testid="option-visual">
                        Visual Regression
                      </SelectItem>
                      <SelectItem value="performance" data-testid="option-performance">
                        Performance
                      </SelectItem>
                      <SelectItem value="accessibility" data-testid="option-accessibility">
                        Accessibility
                      </SelectItem>
                      <SelectItem value="cross_browser" data-testid="option-cross-browser">
                        Cross-Browser
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 mt-8">
                  <Switch
                    id="record-video"
                    checked={recordVideo}
                    onCheckedChange={setRecordVideo}
                    data-testid="switch-record-video"
                  />
                  <Label htmlFor="record-video">Record Video</Label>
                </div>

                <div className="flex items-center space-x-2 mt-8">
                  <Switch
                    id="trace-enabled"
                    checked={traceEnabled}
                    onCheckedChange={setTraceEnabled}
                    data-testid="switch-trace-enabled"
                  />
                  <Label htmlFor="trace-enabled">Enable Trace</Label>
                </div>
              </div>

              <Button
                onClick={() => executeMutation.mutate(undefined)}
                disabled={executeMutation.isPending || !testScript.trim()}
                className="w-full"
                data-testid="button-run-test"
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Test
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="flex-1 flex flex-col mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Test Execution History</h3>
            {executions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                data-testid="button-toggle-all-results"
              >
                {openResults.size === executions.length ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand All
                  </>
                )}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </Card>
                ))}
              </div>
            ) : executions.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No test executions yet</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Run your first test to see results here
                </p>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="container-test-results">
                {executions.map((execution) => (
                  <Collapsible
                    key={execution.id}
                    open={openResults.has(execution.id)}
                    onOpenChange={() => toggleResult(execution.id)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <button 
                          className="w-full p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
                          data-testid={`button-toggle-result-${execution.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {getStatusIcon(execution.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium">
                                    Execution #{execution.id}
                                  </span>
                                  <Badge
                                    variant={
                                      execution.status === 'passed'
                                        ? 'default'
                                        : execution.status === 'failed'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    data-testid={`badge-status-${execution.id}`}
                                  >
                                    {execution.status}
                                  </Badge>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    {getBrowserIcon(execution.browserType)}
                                    <span>{execution.browserType}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {new Date(execution.startedAt).toLocaleString()}
                                  </span>
                                  {execution.duration && (
                                    <>
                                      <span>•</span>
                                      <span>{execution.duration}ms</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                openResults.has(execution.id) && "rotate-180"
                              )}
                            />
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-4">
                          {/* Test Script */}
                          <div>
                            <Label className="text-[11px] font-semibold text-muted-foreground mb-2 block">
                              Test Script
                            </Label>
                            <pre className="bg-muted p-3 rounded-md text-[11px] font-mono overflow-x-auto">
                              {execution.testScript}
                            </pre>
                          </div>

                          {/* Errors */}
                          {execution.result?.errors && execution.result.errors.length > 0 && (
                            <div>
                              <Label className="text-[11px] font-semibold text-destructive mb-2 block">
                                Errors
                              </Label>
                              <div className="space-y-2">
                                {execution.result.errors.map((error, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-destructive/10 border border-destructive/20 p-3 rounded-md"
                                  >
                                    <p className="text-[13px] font-medium text-destructive">
                                      {error.message}
                                    </p>
                                    {error.stack && (
                                      <pre className="text-[11px] text-muted-foreground mt-2 overflow-x-auto">
                                        {error.stack}
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Artifacts */}
                          {execution.artifacts && execution.artifacts.length > 0 && (
                            <div>
                              <Label className="text-[11px] font-semibold text-muted-foreground mb-2 block">
                                Artifacts
                              </Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {execution.artifacts.map((artifact, idx) => (
                                  <a
                                    key={idx}
                                    href={artifact.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 border rounded-md hover:bg-accent transition-colors"
                                    data-testid={`link-artifact-${idx}`}
                                  >
                                    {artifact.type === 'screenshot' && (
                                      <Image className="h-4 w-4 text-blue-500" />
                                    )}
                                    {artifact.type === 'video' && (
                                      <Video className="h-4 w-4 text-purple-500" />
                                    )}
                                    {artifact.type === 'trace' && (
                                      <FileText className="h-4 w-4 text-green-500" />
                                    )}
                                    <span className="text-[13px] truncate flex-1">
                                      {artifact.name}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          {execution.result && (
                            <div className="flex gap-4 text-[13px]">
                              <div>
                                <span className="text-muted-foreground">Assertions:</span>{' '}
                                <span className="font-medium">
                                  {execution.result.assertions || 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Status:</span>{' '}
                                <span
                                  className={cn(
                                    "font-medium",
                                    execution.result.passed
                                      ? "text-green-500"
                                      : "text-red-500"
                                  )}
                                >
                                  {execution.result.passed ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
