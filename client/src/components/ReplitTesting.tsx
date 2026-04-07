import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TestTube, Play, CheckCircle, XCircle, AlertCircle,
  Clock, Target, FileText, BarChart3, Settings,
  Plus, RefreshCw, Eye, Filter, TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: Test[];
  status: 'idle' | 'running' | 'passed' | 'failed' | 'partial';
  lastRun?: Date;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

interface Test {
  id: string;
  name: string;
  description: string;
  file: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  assertions?: {
    passed: number;
    failed: number;
    total: number;
  };
}

interface TestRun {
  id: string;
  suiteId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  results: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

interface ReplitTestingProps {
  projectId: number;
}

export function ReplitTesting({ projectId }: ReplitTestingProps) {
  const { toast } = useToast();
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'pending'>('all');
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);

  useEffect(() => {
    fetchTestSuites();
    fetchTestRuns();
  }, [projectId]);

  const fetchTestSuites = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tests/${projectId}/suites`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestSuites(data.suites || []);
      }
    } catch (error) {
      console.error('Error fetching test suites:', error);
      toast({
        title: "Error",
        description: "Failed to fetch test suites",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTestRuns = async () => {
    try {
      const response = await fetch(`/api/tests/${projectId}/runs`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Error fetching test runs:', error);
    }
  };

  // Security Fix: Store interval ref to ensure cleanup on unmount
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef<number>(0);
  const MAX_POLLING_ATTEMPTS = 300; // Max 5 minutes (300 * 1000ms)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    pollingAttemptsRef.current = 0;
    setRunning(false);
  };

  const runAllTests = async () => {
    try {
      setRunning(true);
      pollingAttemptsRef.current = 0;
      const response = await apiRequest('POST', `/api/tests/${projectId}/run`);

      if (response.ok) {
        toast({
          title: "Tests Started",
          description: "Running all test suites..."
        });
        
        // Poll for updates with guaranteed cleanup
        pollingIntervalRef.current = setInterval(async () => {
          // Security: Max attempts to prevent infinite polling
          pollingAttemptsRef.current++;
          if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
            stopPolling();
            toast({
              title: "Timeout",
              description: "Test polling timed out after 5 minutes",
              variant: "destructive"
            });
            return;
          }

          await fetchTestSuites();
          await fetchTestRuns();
          
          // Check if tests are complete
          try {
            const updatedResponse = await fetch(`/api/tests/${projectId}/status`, {
              credentials: 'include'
            });
            
            if (updatedResponse.ok) {
              const status = await updatedResponse.json();
              if (status.running === false) {
                stopPolling();
                toast({
                  title: "Tests Completed",
                  description: `${status.results.passed}/${status.results.total} tests passed`
                });
              }
            }
          } catch (e) {
            // Network error during polling - continue polling
          }
        }, 1000);
        
        // Backup timeout to stop polling after 5 minutes
        pollingTimeoutRef.current = setTimeout(() => {
          stopPolling();
        }, 300000);
      }
    } catch (error) {
      stopPolling();
      toast({
        title: "Error",
        description: "Failed to run tests",
        variant: "destructive"
      });
    }
  };

  const runSuite = async (suiteId: string) => {
    try {
      const response = await apiRequest('POST', `/api/tests/${projectId}/suites/${suiteId}/run`);

      if (response.ok) {
        toast({
          title: "Test Suite Started",
          description: "Running selected test suite..."
        });
        fetchTestSuites();
        fetchTestRuns();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run test suite",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'partial': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'partial': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredTests = selectedSuite?.tests.filter(test => {
    if (filter === 'all') return true;
    return test.status === filter;
  }) || [];

  const totalTests = testSuites.reduce((acc, suite) => acc + suite.tests.length, 0);
  const passedTests = testSuites.reduce((acc, suite) => 
    acc + suite.tests.filter(t => t.status === 'passed').length, 0
  );
  const failedTests = testSuites.reduce((acc, suite) => 
    acc + suite.tests.filter(t => t.status === 'failed').length, 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TestTube className="h-6 w-6" />
            Test Runner
          </h2>
          <p className="text-muted-foreground">
            Run and manage your test suites with comprehensive reporting
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchTestSuites(); fetchTestRuns(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={runAllTests} disabled={running}>
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run All Tests
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Test Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{totalTests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Passed</p>
                <p className="text-2xl font-bold text-green-600">{passedTests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{failedTests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-[13px] text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suites">Test Suites ({testSuites.length})</TabsTrigger>
          <TabsTrigger value="runs">Test Runs ({testRuns.length})</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="suites" className="space-y-4">
          {testSuites.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <TestTube className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No test suites found</h3>
                <p className="text-muted-foreground mb-4">
                  Create test files in your project to see them here
                </p>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test Suite
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {testSuites.map((suite) => (
                <Card key={suite.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <TestTube className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{suite.name}</CardTitle>
                          <CardDescription>{suite.description}</CardDescription>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(suite.status)} border`}>
                          {getStatusIcon(suite.status)}
                          <span className="ml-1 capitalize">{suite.status}</span>
                        </Badge>
                        
                        <Button
                          size="sm"
                          onClick={() => runSuite(suite.id)}
                          disabled={suite.status === 'running'}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Run
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSuite(suite)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center gap-4 text-[13px] text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {suite.tests.length} tests
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        {suite.tests.filter(t => t.status === 'passed').length} passed
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-600" />
                        {suite.tests.filter(t => t.status === 'failed').length} failed
                      </div>
                      
                      {suite.lastRun && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last run {new Date(suite.lastRun).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    {suite.coverage && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span>Code Coverage</span>
                          <span>{suite.coverage.lines}%</span>
                        </div>
                        <Progress value={suite.coverage.lines} className="h-1" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {testRuns.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No test runs yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {testRuns.map((run) => (
                <Card key={run.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(run.status)} border`}>
                        {getStatusIcon(run.status)}
                        <span className="ml-1 capitalize">{run.status}</span>
                      </Badge>
                      
                      <div>
                        <p className="font-medium">
                          Test Run #{run.id.slice(0, 8)}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          Started {new Date(run.startedAt).toLocaleString()}
                          {run.completedAt && (
                            <span> • Duration {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {run.status === 'completed' && (
                      <div className="flex items-center gap-4 text-[13px]">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          {run.results.passed}
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" />
                          {run.results.failed}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="h-3 w-3" />
                          {run.results.skipped}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Code Coverage Report
              </CardTitle>
              <CardDescription>
                Analyze test coverage across your codebase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">85%</p>
                  <p className="text-[13px] text-muted-foreground">Lines</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">92%</p>
                  <p className="text-[13px] text-muted-foreground">Functions</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">78%</p>
                  <p className="text-[13px] text-muted-foreground">Branches</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">88%</p>
                  <p className="text-[13px] text-muted-foreground">Statements</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">File Coverage</h4>
                {[
                  { file: 'src/utils/helpers.ts', coverage: 95 },
                  { file: 'src/components/Button.tsx', coverage: 88 },
                  { file: 'src/services/api.ts', coverage: 72 },
                  { file: 'src/hooks/useAuth.ts', coverage: 65 }
                ].map((item) => (
                  <div key={item.file} className="flex items-center justify-between p-3 border rounded">
                    <span className="font-mono text-[13px]">{item.file}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            item.coverage >= 80 ? 'bg-green-500' : 
                            item.coverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.coverage}%` }}
                        />
                      </div>
                      <span className="text-[13px] font-medium w-12">{item.coverage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Details Modal */}
      {selectedSuite && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedSuite.name} - Test Details</CardTitle>
              <div className="flex gap-2">
                <div className="flex gap-1">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === 'passed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('passed')}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Passed
                  </Button>
                  <Button
                    variant={filter === 'failed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('failed')}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedSuite(null)}
                >
                  ×
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <p className="font-medium">{test.name}</p>
                      <p className="text-[13px] text-muted-foreground">{test.description}</p>
                      {test.error && (
                        <p className="text-[13px] text-red-600 mt-1">{test.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right text-[13px] text-muted-foreground">
                    {test.duration && <p>{test.duration}ms</p>}
                    {test.assertions && (
                      <p>{test.assertions.passed}/{test.assertions.total} assertions</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}