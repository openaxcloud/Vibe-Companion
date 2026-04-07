/**
 * TestResultsPanel Component
 * Displays real-time background test results via WebSocket
 * Part of the Background Auto-Testing System
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  FileCode,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useBackgroundTesting, 
  TestJob, 
  TestFailure, 
  TestEvent 
} from '@/hooks/useBackgroundTesting';
import { useToast } from '@/hooks/use-toast';

interface TestResultsPanelProps {
  projectId: number;
  className?: string;
  onTestEvent?: (event: TestEvent) => void;
}

export function TestResultsPanel({ 
  projectId, 
  className,
  onTestEvent 
}: TestResultsPanelProps) {
  const { toast } = useToast();
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());
  const [isRerunning, setIsRerunning] = useState(false);

  const {
    isConnected,
    isAuthenticated,
    isSubscribed,
    connectionError,
    testQueue,
    runningTests,
    completedTests,
    failedTests,
    currentStatus,
    rerunTests,
    clearResults,
    getTestStatus
  } = useBackgroundTesting({
    projectId,
    enabled: true,
    onEvent: (event) => {
      onTestEvent?.(event);
      
      if (event.type === 'test:completed' && event.results) {
        if (event.results.passed) {
          toast({
            title: 'Tests Passed',
            description: `All ${event.results.total} tests passed successfully.`,
          });
        } else {
          toast({
            title: 'Tests Failed',
            description: `${event.results.failures.length} test(s) failed.`,
            variant: 'destructive',
          });
        }
      }
      
      if (event.type === 'test:failed') {
        toast({
          title: 'Test Execution Failed',
          description: 'An error occurred while running tests.',
          variant: 'destructive',
        });
      }
    }
  });

  useEffect(() => {
    if (isSubscribed) {
      getTestStatus();
    }
  }, [isSubscribed, getTestStatus]);

  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      await rerunTests();
      toast({
        title: 'Tests Scheduled',
        description: 'Background tests have been queued for execution.',
      });
    } catch (error) {
      toast({
        title: 'Failed to Schedule Tests',
        description: 'Could not trigger test execution.',
        variant: 'destructive',
      });
    } finally {
      setIsRerunning(false);
    }
  };

  const handleClear = () => {
    clearResults();
    toast({
      title: 'Results Cleared',
      description: 'Test results have been cleared.',
    });
  };

  const toggleExpand = (projectId: number) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: TestJob['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" data-testid="icon-queued" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" data-testid="icon-running" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-completed" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" data-testid="icon-failed" />;
    }
  };

  const getStatusBadge = (status: TestJob['status']) => {
    const variants: Record<TestJob['status'], string> = {
      queued: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      running: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      completed: 'bg-green-500/10 text-green-600 border-green-500/30',
      failed: 'bg-red-500/10 text-red-600 border-red-500/30',
    };
    
    return (
      <Badge 
        variant="outline" 
        className={cn('text-[11px] capitalize', variants[status])}
        data-testid={`badge-status-${status}`}
      >
        {status}
      </Badge>
    );
  };

  const renderTestJob = (job: TestJob, index: number) => {
    const isExpanded = expandedTests.has(job.projectId);
    const hasResults = job.results && job.results.failures.length > 0;

    return (
      <Card 
        key={`${job.projectId}-${index}`} 
        className="mb-2"
        data-testid={`test-${job.status === 'queued' ? 'queue-item' : job.status === 'running' ? 'running' : 'completed'}-${job.projectId}`}
      >
        <CardHeader className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasResults ? (
                <button 
                  onClick={() => toggleExpand(job.projectId)}
                  className="hover:bg-muted rounded p-0.5"
                  data-testid={`button-expand-${job.projectId}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-5" />
              )}
              {getStatusIcon(job.status)}
              <CardTitle className="text-[13px] font-medium">
                Project #{job.projectId}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(job.status)}
              {job.results && (
                <Badge 
                  variant={job.results.passed ? 'success' : 'destructive'}
                  className="text-[11px]"
                  data-testid={`badge-result-${job.projectId}`}
                >
                  {job.results.passed ? 'Passed' : `${job.results.failures.length} Failed`}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        {isExpanded && job.results && (
          <CardContent className="pt-0 pb-3 px-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Page Load:</span>
                  {job.results.pageLoadPassed ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Console Errors:</span>
                  {job.results.noConsoleErrors ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Clickable Elements:</span>
                  {job.results.clickableElementsPassed ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Forms:</span>
                  {job.results.formsSubmitPassed ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </div>

              {job.results.failures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Failed Tests ({job.results.failures.length})
                  </h4>
                  {job.results.failures.map((failure, idx) => (
                    <div 
                      key={idx}
                      className="bg-red-500/5 border border-red-500/20 rounded-md p-2"
                      data-testid={`failure-${job.projectId}-${idx}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileCode className="h-3 w-3 text-red-500" />
                        <span className="text-[11px] font-medium text-red-600">
                          {failure.test}
                        </span>
                      </div>
                      <pre className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        <code data-testid={`error-message-${job.projectId}-${idx}`}>
                          {failure.error}
                        </code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {job.changedFiles && job.changedFiles.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-[11px] font-medium text-muted-foreground">
                    Changed Files ({job.changedFiles.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {job.changedFiles.slice(0, 5).map((file, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-[11px] font-mono"
                        data-testid={`changed-file-${idx}`}
                      >
                        {file}
                      </Badge>
                    ))}
                    {job.changedFiles.length > 5 && (
                      <Badge variant="outline" className="text-[11px]">
                        +{job.changedFiles.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  const allTests = [...testQueue, ...runningTests, ...completedTests, ...failedTests];
  const hasTests = allTests.length > 0;

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)]", className)} data-testid="test-results-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Tests</span>
          {isConnected ? (
            <Badge className="h-4 px-1 text-[9px] bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)] rounded" data-testid="status-connection">
              Live
            </Badge>
          ) : (
            <Badge className="h-4 px-1 text-[9px] bg-red-500/10 text-red-500 rounded" data-testid="status-connection">
              Offline
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,42%)]/10"
            onClick={handleRerun}
            disabled={isRerunning || !isConnected}
            data-testid="button-rerun-tests"
          >
            {isRerunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={handleClear}
            disabled={!hasTests}
            data-testid="button-clear-results"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => getTestStatus()}
            disabled={!isSubscribed}
            className="h-7 px-2"
            data-testid="button-refresh-status"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <Badge variant="outline" className="bg-muted" data-testid="badge-total-tests">
            Total: {allTests.length}
          </Badge>
          {testQueue.length > 0 && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600" data-testid="badge-queued-count">
              Queued: {testQueue.length}
            </Badge>
          )}
          {runningTests.length > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600" data-testid="badge-running-count">
              Running: {runningTests.length}
            </Badge>
          )}
          {completedTests.length > 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600" data-testid="badge-completed-count">
              Passed: {completedTests.filter(t => t.results?.passed).length}
            </Badge>
          )}
          {failedTests.length > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600" data-testid="badge-failed-count">
              Failed: {failedTests.length}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1" data-testid="scroll-test-results">
        <div className="p-3 space-y-2">
          {!hasTests ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <FileCode className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-[13px] text-muted-foreground">No test results yet</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tests will run automatically when files change
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRerun}
                disabled={isRerunning || !isConnected}
                className="mt-4"
                data-testid="button-run-first-test"
              >
                <Play className="h-3 w-3 mr-1" />
                Run Tests Now
              </Button>
            </div>
          ) : (
            <>
              {testQueue.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Queued ({testQueue.length})
                  </h4>
                  {testQueue.map((job, idx) => renderTestJob(job, idx))}
                </div>
              )}

              {runningTests.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running ({runningTests.length})
                  </h4>
                  {runningTests.map((job, idx) => renderTestJob(job, idx))}
                </div>
              )}

              {(completedTests.length > 0 || failedTests.length > 0) && (
                <div>
                  <h4 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Results ({completedTests.length + failedTests.length})
                  </h4>
                  {[...completedTests, ...failedTests]
                    .sort((a, b) => {
                      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((job, idx) => renderTestJob(job, idx))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {currentStatus && (
        <div className="border-t p-3" data-testid="current-status">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Last Test Run</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(currentStatus.status)}
              <span className="capitalize">{currentStatus.status}</span>
              {currentStatus.completedAt && (
                <span className="text-muted-foreground">
                  {new Date(currentStatus.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestResultsPanel;
