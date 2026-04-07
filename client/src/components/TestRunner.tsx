import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Terminal,
  Beaker,
  TrendingUp,
  Bug
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

interface TestResult {
  id: string;
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: {
    message: string;
    stack: string;
  };
}

interface TestSuite {
  name: string;
  file: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface TestRun {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  suites: TestSuite[];
}

export function TestRunner({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [selectedSuite, setSelectedSuite] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  // Fetch test run status
  const { data: testRun, refetch: refetchTestRun } = useQuery<TestRun>({
    queryKey: [`/api/projects/${projectId}/tests/run`],
    enabled: !!projectId,
    refetchInterval: (data) => data?.status === 'running' ? 1000 : false
  });

  // Run tests mutation
  const runTestsMutation = useMutation({
    mutationFn: async (testPattern?: string) => {
      return await apiRequest(`/api/projects/${projectId}/tests/run`, {
        method: 'POST',
        body: JSON.stringify({ pattern: testPattern })
      });
    },
    onSuccess: () => {
      toast({
        title: "Tests started",
        description: "Running test suite..."
      });
      refetchTestRun();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to run tests",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Stop tests mutation
  const stopTestsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/projects/${projectId}/tests/stop`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Tests stopped",
        description: "Test run has been cancelled"
      });
      refetchTestRun();
    }
  });

  const toggleSuiteExpansion = (suiteName: string) => {
    const newExpanded = new Set(expandedSuites);
    if (newExpanded.has(suiteName)) {
      newExpanded.delete(suiteName);
    } else {
      newExpanded.add(suiteName);
    }
    setExpandedSuites(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredSuites = testRun?.suites.filter(suite => {
    const matchesSearch = suite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      suite.tests.some(test => test.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterStatus === 'all') return matchesSearch;
    
    return matchesSearch && suite.tests.some(test => test.status === filterStatus);
  }) || [];

  const progress = testRun && testRun.totalTests > 0
    ? ((testRun.passedTests + testRun.failedTests + testRun.skippedTests) / testRun.totalTests) * 100
    : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Test Runner</CardTitle>
              <CardDescription>
                {testRun?.status === 'running' 
                  ? `Running tests... ${Math.round(progress)}%`
                  : testRun?.status === 'completed'
                  ? `${testRun.passedTests} passed, ${testRun.failedTests} failed`
                  : 'Run your test suite'
                }
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {testRun?.status === 'running' ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => stopTestsMutation.mutate()}
                disabled={stopTestsMutation.isPending}
              >
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => runTestsMutation.mutate()}
                disabled={runTestsMutation.isPending}
              >
                {runTestsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Run All Tests
              </Button>
            )}
          </div>
        </div>

        {testRun?.status === 'running' && (
          <Progress value={progress} className="mt-4" />
        )}
      </CardHeader>

      <div className="flex-1 flex">
        {/* Test Suites Sidebar */}
        <div className="w-80 border-r bg-muted/10">
          <div className="p-4 space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              <div className="flex gap-1">
                {(['all', 'passed', 'failed', 'skipped'] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={filterStatus === status ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(status)}
                    className="flex-1 text-xs"
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test Stats */}
            {testRun && testRun.status === 'completed' && (
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-md bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{testRun.passedTests}</p>
                  <p className="text-xs text-muted-foreground">Passed</p>
                </div>
                <div className="text-center p-2 rounded-md bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{testRun.failedTests}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="text-center p-2 rounded-md bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{testRun.skippedTests}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Test Suites List */}
          <ScrollArea className="h-[calc(100%-200px)]">
            <div className="p-2">
              {filteredSuites.map((suite) => {
                const isExpanded = expandedSuites.has(suite.name);
                return (
                  <div key={suite.name} className="mb-2">
                    <button
                      onClick={() => {
                        toggleSuiteExpansion(suite.name);
                        setSelectedSuite(suite.name);
                      }}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedSuite === suite.name
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium flex-1 truncate">{suite.name}</span>
                        <div className="flex items-center gap-1">
                          {suite.passed > 0 && (
                            <Badge variant="secondary" className="text-xs bg-green-500/20">
                              {suite.passed}
                            </Badge>
                          )}
                          {suite.failed > 0 && (
                            <Badge variant="secondary" className="text-xs bg-red-500/20">
                              {suite.failed}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1">
                        {suite.tests.map((test) => (
                          <div
                            key={test.id}
                            className="flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-muted/50 rounded"
                          >
                            {getStatusIcon(test.status)}
                            <span className="flex-1 truncate">{test.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {test.duration}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Tabs defaultValue="results" className="h-full">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="coverage">Coverage</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="flex-1 m-0">
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="p-6">
                  {selectedSuite && testRun?.suites.find(s => s.name === selectedSuite) ? (
                    <div className="space-y-4">
                      {testRun.suites
                        .find(s => s.name === selectedSuite)
                        ?.tests.filter(test => 
                          filterStatus === 'all' || test.status === filterStatus
                        )
                        .map((test) => (
                          <div key={test.id} className="border rounded-md p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(test.status)}
                                <h3 className="font-medium">{test.name}</h3>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {test.duration}ms
                              </Badge>
                            </div>
                            
                            {test.error && (
                              <div className="mt-3 space-y-2">
                                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                                  <p className="text-sm font-medium text-red-600">
                                    {test.error.message}
                                  </p>
                                </div>
                                <details>
                                  <summary className="text-sm text-muted-foreground cursor-pointer">
                                    Stack trace
                                  </summary>
                                  <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto">
                                    {test.error.stack}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Beaker className="h-12 w-12 mb-4" />
                      <p>Select a test suite to view results</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="coverage" className="flex-1 m-0">
              <div className="p-6">
                {testRun?.coverage ? (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Code Coverage</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(testRun.coverage).map(([type, percentage]) => (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize">{type}</span>
                            <span className="text-sm font-bold">{percentage}%</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>Coverage reports are generated after each test run</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mb-4" />
                    <p>No coverage data available</p>
                    <p className="text-sm mt-1">Run tests to generate coverage reports</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="output" className="flex-1 m-0">
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="p-4 font-mono text-sm">
                  {consoleOutput.length > 0 ? (
                    <pre className="whitespace-pre-wrap">{consoleOutput.join('\n')}</pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Terminal className="h-12 w-12 mb-4" />
                      <p className="font-sans">Test output will appear here</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Card>
  );
}