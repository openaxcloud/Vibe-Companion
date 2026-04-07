import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { LazyMotionDiv } from '@/lib/motion';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FlaskConical,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Settings,
  Filter,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface TestRun {
  id: string;
  projectId: string;
  runId: string;
  runner: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration?: number;
  startedAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

interface TestCase {
  id: string;
  testRunId: string;
  suiteName: string;
  testName: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  error?: string;
  errorStack?: string;
  retries?: number;
  startedAt?: string;
  completedAt?: string;
}

interface TestSuite {
  id: string;
  name: string;
  file: string;
  tests: TestCase[];
}

interface ReplitTestingPanelProps {
  projectId?: string;
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("bg-muted rounded-lg overflow-hidden", className)}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <LazyMotionDiv
        className="h-full w-full bg-gradient-to-r from-transparent via-accent to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </LazyMotionDiv>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <ShimmerSkeleton className="h-10 w-full" />
      <ShimmerSkeleton className="h-10 w-full" />
      <ShimmerSkeleton className="h-10 w-3/4" />
      <ShimmerSkeleton className="h-10 w-5/6" />
      <ShimmerSkeleton className="h-10 w-2/3" />
    </div>
  );
}

export function ReplitTestingPanel({ projectId = 'default-project', className }: ReplitTestingPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'pending'>('all');
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: testRuns = [], isLoading, refetch } = useQuery<TestRun[]>({
    queryKey: ['/api/workspace/projects', projectId, 'test-runs'],
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/test-runs/ws?projectId=${projectId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'initial') {
        } else if (message.type === 'update' || message.type === 'complete') {
          refetch();
        } else if (message.type === 'test_case') {
          setTestCases(prev => {
            const filtered = prev.filter(tc => tc.id !== message.testCase.id);
            return [...filtered, message.testCase];
          });
        }
      } catch (error) {
        console.error('[TestRuns] Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[TestRuns] WebSocket error:', error);
    };

    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [projectId, refetch]);

  const testSuites: TestSuite[] = [];
  const suiteMap = new Map<string, TestSuite>();

  testCases.forEach(testCase => {
    if (!suiteMap.has(testCase.suiteName)) {
      suiteMap.set(testCase.suiteName, {
        id: testCase.suiteName,
        name: testCase.suiteName,
        file: testCase.filePath,
        tests: [],
      });
    }
    suiteMap.get(testCase.suiteName)!.tests.push(testCase);
  });

  suiteMap.forEach(suite => testSuites.push(suite));

  const filteredSuites = testSuites
    .map(suite => ({
      ...suite,
      tests: suite.tests.filter(test => {
        const matchesSearch = test.testName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'all' || test.status === filter;
        return matchesSearch && matchesFilter;
      }),
    }))
    .filter(suite => suite.tests.length > 0);

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const getTestIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />;
      case 'failed':
        return <XCircle className="w-[18px] h-[18px] text-destructive" />;
      case 'skipped':
        return <AlertCircle className="w-[18px] h-[18px] text-yellow-500" />;
      case 'pending':
        return <Clock className="w-[18px] h-[18px] text-muted-foreground" />;
    }
  };

  const latestRun = testRuns[0];
  const totalTests = latestRun?.totalTests || 0;
  const passedTests = latestRun?.passedTests || 0;
  const failedTests = latestRun?.failedTests || 0;
  const skippedTests = latestRun?.skippedTests || 0;

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Testing</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-7 px-2 rounded bg-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,38%)] text-white text-[10px]"
            data-testid="button-run-tests"
          >
            <PlayCircle className="w-3.5 h-3.5 mr-1" />
            Run
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded hover:bg-[var(--ecode-sidebar-hover)]">
                <Settings className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
              <DropdownMenuItem className="text-xs text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">Configure Test Runner</DropdownMenuItem>
              <DropdownMenuItem className="text-xs text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">Watch Mode</DropdownMenuItem>
              <DropdownMenuItem className="text-xs text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">Coverage Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] space-y-1.5 shrink-0">

        {latestRun && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[var(--ecode-text-muted)]">Results:</span>
            <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-[var(--ecode-border)] text-[var(--ecode-text)]">
              {totalTests}
            </Badge>
            {passedTests > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 text-[hsl(142,72%,42%)] border-[hsl(142,72%,42%)]">
                {passedTests} pass
              </Badge>
            )}
            {failedTests > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 text-destructive border-destructive">
                {failedTests} fail
              </Badge>
            )}
            {skippedTests > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 text-yellow-500 border-yellow-500">
                {skippedTests} skip
              </Badge>
            )}
            {latestRun.duration && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-[var(--ecode-border)] text-[var(--ecode-text-muted)]">
                {latestRun.duration}ms
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <Input
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 rounded text-xs bg-[var(--ecode-surface)] border-[var(--ecode-border)] text-[var(--ecode-text)] placeholder:text-[var(--ecode-text-muted)]"
            data-testid="input-search-tests"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 px-2 rounded border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:bg-[var(--ecode-sidebar-hover)] text-[10px] text-[var(--ecode-text)]">
                <Filter className="w-3.5 h-3.5 mr-1 text-[var(--ecode-text-muted)]" />
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem onClick={() => setFilter('all')} className="text-[15px] leading-[20px] text-foreground hover:bg-accent">All Tests</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('passed')} className="text-[15px] leading-[20px] text-foreground hover:bg-accent">Passed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('failed')} className="text-[15px] leading-[20px] text-foreground hover:bg-accent">Failed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('pending')} className="text-[15px] leading-[20px] text-foreground hover:bg-accent">Pending</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredSuites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FlaskConical className="w-12 h-12 text-muted-foreground opacity-40 mb-4" style={{ width: 48, height: 48 }} />
              <p className="text-[17px] font-medium leading-tight text-foreground mb-2">
                {searchQuery ? 'No tests match your search' : 'No tests found'}
              </p>
              <p className="text-[13px] text-muted-foreground max-w-[240px]">
                {testRuns.length === 0 ? 'Run tests to see results here' : 'Create test files to get started'}
              </p>
            </div>
          ) : (
            filteredSuites.map(suite => (
              <div key={suite.id} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSuite(suite.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-lg transition-colors text-left"
                  data-testid={`suite-${suite.id}`}
                >
                  {expandedSuites.has(suite.id) ? (
                    <ChevronDown className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
                  )}
                  <FlaskConical className="w-[18px] h-[18px] text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] leading-[20px] font-medium text-foreground truncate">
                      {suite.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground truncate font-mono">
                      {suite.file}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[13px] bg-muted border-border text-muted-foreground">
                    {suite.tests.length}
                  </Badge>
                </button>

                {expandedSuites.has(suite.id) && (
                  <div className="ml-8 mt-1 space-y-1">
                    {suite.tests.map(test => (
                      <div
                        key={test.id}
                        className="flex items-start gap-2 px-3 py-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                        data-testid={`test-${test.id}`}
                      >
                        {getTestIcon(test.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] leading-[20px] text-foreground">
                            {test.testName}
                          </p>
                          {test.error && (
                            <p className="text-[13px] text-destructive mt-1 font-mono whitespace-pre-wrap">
                              {test.error}
                            </p>
                          )}
                          {test.duration && (
                            <p className="text-[13px] text-muted-foreground mt-0.5">
                              {test.duration}ms
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {testRuns.length > 0 && (
        <div className="border-t border-border p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Recent Runs
          </p>
          <div className="space-y-1">
            {testRuns.slice(0, 3).map(run => (
              <div
                key={run.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                data-testid={`run-${run.id}`}
              >
                {run.status === 'passed' && <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />}
                {run.status === 'failed' && <XCircle className="w-[18px] h-[18px] text-destructive" />}
                {run.status === 'running' && <RefreshCw className="w-[18px] h-[18px] text-primary animate-spin" />}
                {run.status === 'cancelled' && <AlertCircle className="w-[18px] h-[18px] text-yellow-500" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] leading-[20px] text-foreground font-mono">
                    {run.runner} • {run.runId.slice(0, 8)}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {run.passedTests}/{run.totalTests} passed
                    {run.duration && ` • ${run.duration}ms`}
                  </p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[13px]",
                    run.status === 'passed' && "bg-card text-green-500 border-green-500",
                    run.status === 'failed' && "bg-card text-destructive border-destructive",
                    run.status === 'running' && "bg-card text-primary border-primary"
                  )}
                >
                  {run.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
