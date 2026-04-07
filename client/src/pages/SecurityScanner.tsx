// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  FileSearch,
  Lock,
  Bug,
  Package,
  Code2,
  RefreshCw,
  Download,
  ChevronRight,
  Info,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ECodeLoading } from "@/components/ECodeLoading";

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  package?: string;
  version?: string;
  fixedVersion?: string;
  file?: string;
  line?: number;
  cve?: string;
  cwe?: string;
  recommendation: string;
}

interface ScanResult {
  id: string;
  status: 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  filesScanned: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: Vulnerability[];
  score: number;
}

interface SecurityMetrics {
  lastScan: string;
  totalScans: number;
  averageScore: number;
  trendsData: {
    date: string;
    score: number;
    vulnerabilities: number;
  }[];
}

export default function SecurityScanner() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  // Fetch current scan results
  const { data: scanResult, isLoading: scanLoading } = useQuery<ScanResult>({
    queryKey: ['/api/security/scan/latest'],
  });

  // Fetch security metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SecurityMetrics>({
    queryKey: ['/api/security/metrics'],
  });

  // Start scan mutation
  const startScanMutation = useMutation({
    mutationFn: async () => {
      setScanProgress(0);
      const res = await apiRequest('POST', '/api/security/scan');
      if (!res.ok) throw new Error('Failed to start security scan');
      
      // Simulate scan progress
      const interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security/scan/latest'] });
      toast({
        title: "Security scan started",
        description: "Your code is being analyzed for vulnerabilities",
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  if (scanLoading || metricsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="relative h-full min-h-[calc(100vh-200px)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <ECodeLoading size="lg" text="Loading security data..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Security Scanner</h1>
          <p className="text-muted-foreground">
            Analyze your code for vulnerabilities and security issues
          </p>
        </div>
        <Button 
          onClick={() => startScanMutation.mutate()}
          disabled={startScanMutation.isPending || scanProgress > 0 && scanProgress < 100}
          data-testid="button-run-scan"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${startScanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanProgress > 0 && scanProgress < 100 ? `Scanning... ${scanProgress}%` : 'Run Scan'}
        </Button>
      </div>

      {/* Security Score */}
      {scanResult && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Security Score</CardTitle>
                <CardDescription>Based on your latest scan</CardDescription>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold ${getScoreColor(scanResult.score)}`}>
                  {scanResult.score}
                </div>
                <p className="text-[13px] text-muted-foreground mt-1">out of 100</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {scanProgress > 0 && scanProgress < 100 && (
              <div className="mb-4">
                <p className="text-[13px] text-muted-foreground mb-2">Scanning in progress...</p>
                <Progress value={scanProgress} className="h-2" />
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-500">{scanResult.vulnerabilities.critical}</div>
                <p className="text-[13px] text-muted-foreground">Critical</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">{scanResult.vulnerabilities.high}</div>
                <p className="text-[13px] text-muted-foreground">High</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">{scanResult.vulnerabilities.medium}</div>
                <p className="text-[13px] text-muted-foreground">Medium</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-500">{scanResult.vulnerabilities.low}</div>
                <p className="text-[13px] text-muted-foreground">Low</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-security">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities" data-testid="tab-vulnerabilities">
            Vulnerabilities
            {scanResult && scanResult.vulnerabilities.total > 0 && (
              <Badge variant="destructive" className="ml-2">
                {scanResult.vulnerabilities.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSearch className="h-4 w-4" />
                  Files Scanned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scanResult?.filesScanned || 0}</div>
                <p className="text-[11px] text-muted-foreground">
                  Last scan: {metrics?.lastScan}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Total Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalScans || 0}</div>
                <p className="text-[11px] text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Average Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(metrics?.averageScore || 0)}`}>
                  {metrics?.averageScore || 0}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Security Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Security Best Practices</CardTitle>
              <CardDescription>
                Follow these guidelines to improve your security score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Keep Dependencies Updated</AlertTitle>
                <AlertDescription>
                  Regularly update your dependencies to patch known vulnerabilities
                </AlertDescription>
              </Alert>
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Use Environment Variables</AlertTitle>
                <AlertDescription>
                  Never hardcode sensitive data like API keys in your source code
                </AlertDescription>
              </Alert>
              <Alert>
                <Code2 className="h-4 w-4" />
                <AlertTitle>Validate User Input</AlertTitle>
                <AlertDescription>
                  Always sanitize and validate user input to prevent injection attacks
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities" className="space-y-4">
          {scanResult && scanResult.findings.length > 0 ? (
            <div className="space-y-4">
              {scanResult.findings.map((vuln) => (
                <Card key={vuln.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedVulnerability(vuln)}
                  data-testid={`card-vulnerability-${vuln.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-[15px] flex items-center gap-2">
                          <Badge className={getSeverityColor(vuln.severity)}>
                            {vuln.severity.toUpperCase()}
                          </Badge>
                          {vuln.title}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {vuln.description}
                        </CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-[13px]">
                      {vuln.file && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <FileSearch className="h-3 w-3" />
                          {vuln.file}:{vuln.line}
                        </div>
                      )}
                      {vuln.package && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {vuln.package} v{vuln.version}
                        </div>
                      )}
                      {vuln.cve && (
                        <Badge variant="outline">{vuln.cve}</Badge>
                      )}
                      {vuln.cwe && (
                        <Badge variant="outline">{vuln.cwe}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No vulnerabilities found</h3>
                <p className="text-muted-foreground">
                  Your code passed all security checks!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Score Trend</CardTitle>
              <CardDescription>
                Your security score over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.trendsData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded" data-testid={`row-trend-${index}`}>
                    <span className="text-[13px]">{data.date}</span>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono">
                        {data.vulnerabilities} issues
                      </Badge>
                      <div className={`font-semibold ${getScoreColor(data.score)}`}>
                        Score: {data.score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Scan History</AlertTitle>
            <AlertDescription>
              Detailed scan history and reports are available in your project settings
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}