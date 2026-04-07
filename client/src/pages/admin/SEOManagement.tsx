import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ExternalLink,
  Edit, Eye, RefreshCw, Download, Image, FileText, Globe, BarChart3,
  Target, Zap, Sparkles, ArrowUpRight, ArrowDownRight, Activity,
  PieChart, LineChart, Award, Shield, Clock, Users, MousePointer,
  Gauge, Brain, Lightbulb, ChevronRight, Copy, Check, Loader2
} from "lucide-react";
import { LazyMotionDiv, LazyAnimatePresence } from "@/lib/motion";
import { AdminLayout } from "./AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Types
interface PageSEO {
  path: string;
  title: string;
  description: string;
  score: number;
  status: 'excellent' | 'good' | 'needs-work' | 'critical';
  issues: string[];
  lastUpdated: string;
  trend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  hasRealData: boolean;
}

interface SEOAnalyticsResponse {
  pages: PageSEO[];
  hasRealAnalytics: boolean;
  lastSyncedAt: string | null;
}

// Radial Progress Component
function RadialProgress({ value, size = 120, strokeWidth = 10, color = "hsl(var(--primary))" }: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold">{value}</span>
      </div>
    </div>
  );
}

// Sparkline Component
function Sparkline({ data, color = "hsl(var(--primary))", height = 40 }: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// AI Insight Card
function InsightCard({ icon: Icon, title, description, action, type = "info" }: {
  icon: any;
  title: string;
  description: string;
  action?: string;
  type?: "info" | "warning" | "success" | "error";
}) {
  const colors = {
    info: "border-blue-500/20 bg-blue-500/5",
    warning: "border-yellow-500/20 bg-yellow-500/5",
    success: "border-green-500/20 bg-green-500/5",
    error: "border-red-500/20 bg-red-500/5"
  };
  const iconColors = {
    info: "text-blue-500",
    warning: "text-yellow-500",
    success: "text-green-500",
    error: "text-red-500"
  };

  return (
    <div
      className={`p-4 rounded-xl border-2 ${colors[type]} transition-all hover:scale-[1.02] animate-fadeIn`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-background ${iconColors[type]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-[13px] text-muted-foreground">{description}</p>
          {action && (
            <Button variant="link" className="p-0 h-auto mt-2 text-[13px]">
              {action} <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Score Badge Component
function ScoreBadge({ score, size = "default" }: { score: number; size?: "sm" | "default" | "lg" }) {
  const getColor = (s: number) => {
    if (s >= 90) return "bg-gradient-to-r from-green-500 to-emerald-500";
    if (s >= 70) return "bg-gradient-to-r from-blue-500 to-cyan-500";
    if (s >= 50) return "bg-gradient-to-r from-yellow-500 to-orange-500";
    return "bg-gradient-to-r from-red-500 to-pink-500";
  };

  const sizes = {
    sm: "w-8 h-8 text-[11px]",
    default: "w-10 h-10 text-[13px]",
    lg: "w-14 h-14 text-[15px]"
  };

  return (
    <div className={`${sizes[size]} ${getColor(score)} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
      {score}
    </div>
  );
}

export default function SEOManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPage, setSelectedPage] = useState<PageSEO | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: analyticsData, isLoading, error } = useQuery<SEOAnalyticsResponse>({
    queryKey: ['/api/admin/seo/analytics'],
  });

  const pages = analyticsData?.pages ?? [];
  const hasRealAnalytics = analyticsData?.hasRealAnalytics ?? false;

  const filteredPages = pages.filter(page => {
    const matchesSearch = page.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         page.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || page.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => ({
    total: pages.length,
    excellent: pages.filter(p => p.status === 'excellent').length,
    good: pages.filter(p => p.status === 'good').length,
    needsWork: pages.filter(p => p.status === 'needs-work').length,
    critical: pages.filter(p => p.status === 'critical').length,
    averageScore: pages.length > 0 ? Math.round(pages.reduce((acc, p) => acc + p.score, 0) / pages.length) : 0,
    totalImpressions: pages.reduce((acc, p) => acc + p.impressions, 0),
    totalClicks: pages.reduce((acc, p) => acc + p.clicks, 0),
    avgCTR: pages.length > 0 ? parseFloat((pages.reduce((acc, p) => acc + p.ctr, 0) / pages.length).toFixed(2)) : 0,
    issuesCount: pages.reduce((acc, p) => acc + p.issues.length, 0)
  }), [pages]);

  const trendData = [65, 72, 68, 80, 75, 82, 78, 85, 88, 92, 89, stats.averageScore];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'needs-work': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return '';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading SEO analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to load SEO analytics</h2>
            <p className="text-muted-foreground">Please try again later.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="p-6 lg:p-8 space-y-8">
            {/* Premium Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-8 text-white">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                      Enterprise SEO Suite
                    </Badge>
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2" data-testid="heading-seo-command-center">SEO Command Center</h1>
                  <p className="text-white/80 max-w-xl">
                    Monitor, optimize, and dominate search rankings with AI-powered insights
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="bg-white text-violet-600 hover:bg-white/90 gap-2 shadow-xl" data-testid="button-ai-audit">
                    <Sparkles className="h-4 w-4" />
                    AI Audit
                  </Button>
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2" data-testid="button-export-report">
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Overall Score - Featured */}
              <Card className="col-span-2 lg:col-span-1 row-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 overflow-hidden relative">
                <div className="absolute inset-0 bg-grid-white/5" />
                <CardContent className="p-6 relative z-10 flex flex-col items-center justify-center h-full">
                  <p className="text-[13px] text-slate-400 mb-4">Overall SEO Score</p>
                  <RadialProgress
                    value={stats.averageScore}
                    size={140}
                    strokeWidth={12}
                    color={stats.averageScore >= 80 ? "#22c55e" : stats.averageScore >= 60 ? "#3b82f6" : "#f59e0b"}
                  />
                  <div className="flex items-center gap-2 mt-4">
                    {stats.averageScore >= 80 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        <span className="text-[13px] text-green-400">+5 this month</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-yellow-400" />
                        <span className="text-[13px] text-yellow-400">Needs attention</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pages Health */}
              <Card className="overflow-hidden border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Pages</span>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold mb-2">{stats.total}</div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="h-2 rounded-full bg-green-500" style={{ width: `${(stats.excellent / stats.total) * 100}%` }} />
                      </TooltipTrigger>
                      <TooltipContent>{stats.excellent} excellent</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(stats.good / stats.total) * 100}%` }} />
                      </TooltipTrigger>
                      <TooltipContent>{stats.good} good</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="h-2 rounded-full bg-yellow-500" style={{ width: `${(stats.needsWork / stats.total) * 100}%` }} />
                      </TooltipTrigger>
                      <TooltipContent>{stats.needsWork} needs work</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="h-2 rounded-full bg-red-500" style={{ width: `${(stats.critical / stats.total) * 100}%` }} />
                      </TooltipTrigger>
                      <TooltipContent>{stats.critical} critical</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>

              {/* Impressions */}
              <Card className="overflow-hidden border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Impressions</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {(stats.totalImpressions / 1000).toFixed(1)}K
                  </div>
                  <div className="flex items-center gap-1 text-green-500 text-[13px]">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+12.5%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Clicks */}
              <Card className="overflow-hidden border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Clicks</span>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {(stats.totalClicks / 1000).toFixed(1)}K
                  </div>
                  <div className="flex items-center gap-1 text-green-500 text-[13px]">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+8.3%</span>
                  </div>
                </CardContent>
              </Card>

              {/* CTR */}
              <Card className="overflow-hidden border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Avg. CTR</span>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats.avgCTR}%</div>
                  <Progress value={stats.avgCTR * 10} className="h-1" />
                </CardContent>
              </Card>

              {/* Issues */}
              <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Open Issues</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-3xl font-bold text-amber-600 mb-1">{stats.issuesCount}</div>
                  <Button variant="link" className="p-0 h-auto text-amber-600 text-[13px]" data-testid="button-view-all-issues">
                    View all <ChevronRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>

              {/* Score Trend */}
              <Card className="col-span-2 overflow-hidden border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] text-muted-foreground">Score Trend (12 months)</span>
                    <LineChart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="h-12">
                    <Sparkline data={trendData} color="hsl(var(--primary))" height={48} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/20 rounded-xl">
                    <Brain className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="text-[15px]">AI-Powered Insights</CardTitle>
                    <p className="text-[13px] text-muted-foreground">Real-time recommendations from our SEO AI</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InsightCard
                    icon={Lightbulb}
                    title="Quick Win: Add OG Images"
                    description="12 pages are missing Open Graph images. Adding them could increase social shares by 40%."
                    action="Fix automatically"
                    type="warning"
                  />
                  <InsightCard
                    icon={TrendingUp}
                    title="Top Performer: /pricing"
                    description="Your pricing page ranks #3 for 'cloud IDE pricing'. Consider adding FAQ schema."
                    action="Add schema"
                    type="success"
                  />
                  <InsightCard
                    icon={AlertTriangle}
                    title="Critical: Meta Descriptions"
                    description="5 pages have descriptions over 160 chars. Google will truncate them in search results."
                    action="Review & fix"
                    type="error"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Main Content Tabs */}
            <Tabs defaultValue="pages" className="space-y-6">
              <TabsList className="bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="pages" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-pages">
                  <FileText className="h-4 w-4" />
                  All Pages
                </TabsTrigger>
                <TabsTrigger value="issues" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-issues">
                  <AlertTriangle className="h-4 w-4" />
                  Issues ({stats.issuesCount})
                </TabsTrigger>
                <TabsTrigger value="og-generator" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-og-generator">
                  <Image className="h-4 w-4" />
                  OG Generator
                </TabsTrigger>
                <TabsTrigger value="technical" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-technical">
                  <Globe className="h-4 w-4" />
                  Technical SEO
                </TabsTrigger>
              </TabsList>

              {/* Pages Tab */}
              <TabsContent value="pages" className="space-y-4">
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search pages by URL or title..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          data-testid="input-search-seo-pages"
                          className="pl-10 bg-background"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] bg-background" data-testid="select-seo-status-filter">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="excellent">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" /> Excellent
                            </span>
                          </SelectItem>
                          <SelectItem value="good">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" /> Good
                            </span>
                          </SelectItem>
                          <SelectItem value="needs-work">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" /> Needs Work
                            </span>
                          </SelectItem>
                          <SelectItem value="critical">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" /> Critical
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-[300px]">Page</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead className="hidden md:table-cell">Impressions</TableHead>
                            <TableHead className="hidden md:table-cell">CTR</TableHead>
                            <TableHead className="hidden lg:table-cell">Trend</TableHead>
                            <TableHead>Issues</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPages.map((page, index) => (
                              <tr
                                key={page.path}
                                className="group hover:bg-muted/50 animate-fadeIn"
                                style={{ animationDelay: `${index * 20}ms` }}
                                data-testid={`row-seo-page-${page.path.replace(/\//g, '-')}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-1 h-10 rounded-full ${
                                      page.status === 'excellent' ? 'bg-green-500' :
                                      page.status === 'good' ? 'bg-blue-500' :
                                      page.status === 'needs-work' ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`} />
                                    <div>
                                      <div className="font-mono text-[13px] font-medium">{page.path}</div>
                                      <div className="text-[11px] text-muted-foreground truncate max-w-[250px]">
                                        {page.title}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <ScoreBadge score={page.score} size="sm" />
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {page.hasRealData ? (
                                    <div className="font-medium">{(page.impressions / 1000).toFixed(1)}K</div>
                                  ) : (
                                    <Badge variant="outline" className="text-[11px] text-muted-foreground">No data yet</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {page.hasRealData ? (
                                    <div className="font-medium">{page.ctr}%</div>
                                  ) : (
                                    <Badge variant="outline" className="text-[11px] text-muted-foreground">No data yet</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {page.hasRealData ? (
                                    <div className={`flex items-center gap-1 ${page.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {page.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                      <span className="text-[13px]">{Math.abs(page.trend)}%</span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-[11px] text-muted-foreground">No data yet</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {page.issues.length > 0 ? (
                                    <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600">
                                      <AlertTriangle className="h-3 w-3" />
                                      {page.issues.length}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
                                      <CheckCircle className="h-3 w-3" />
                                      OK
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => window.open(page.path, '_blank')}
                                          data-testid={`button-preview-${page.path.replace(/\//g, '-')}`}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Preview</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(`https://e-code.ai${page.path}`)}
                                          data-testid={`button-copy-url-${page.path.replace(/\//g, '-')}`}
                                        >
                                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copy URL</TooltipContent>
                                    </Tooltip>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" data-testid={`button-edit-seo-${page.path.replace(/\//g, '-')}`}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                          <DialogTitle className="flex items-center gap-2">
                                            <ScoreBadge score={page.score} size="sm" />
                                            Edit SEO - {page.path}
                                          </DialogTitle>
                                          <DialogDescription>
                                            Optimize meta tags for better search rankings
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label>Meta Title</Label>
                                              <Badge variant={page.title.length <= 60 ? "secondary" : "destructive"}>
                                                {page.title.length}/60
                                              </Badge>
                                            </div>
                                            <Input defaultValue={page.title} className="font-mono" />
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label>Meta Description</Label>
                                              <Badge variant={page.description.length <= 160 ? "secondary" : "destructive"}>
                                                {page.description.length}/160
                                              </Badge>
                                            </div>
                                            <Textarea defaultValue={page.description} rows={3} className="font-mono" />
                                          </div>
                                          {page.issues.length > 0 && (
                                            <div className="space-y-2">
                                              <Label>Issues to Fix</Label>
                                              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 space-y-2">
                                                {page.issues.map((issue, i) => (
                                                  <div key={i} className="flex items-center gap-2 text-[13px] text-amber-700 dark:text-amber-400">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    {issue}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          <Separator />
                                          <div className="flex gap-2">
                                            <Button className="flex-1 gap-2" data-testid="button-save-seo-changes">
                                              <CheckCircle className="h-4 w-4" />
                                              Save Changes
                                            </Button>
                                            <Button variant="outline" className="gap-2" data-testid="button-ai-optimize-seo">
                                              <Sparkles className="h-4 w-4" />
                                              AI Optimize
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </TableCell>
                              </tr>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Issues Tab */}
              <TabsContent value="issues" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  {pages.filter(p => p.issues.length > 0).map((page) => (
                    <Card key={page.path} className="border-0 shadow-lg overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ScoreBadge score={page.score} size="sm" />
                            <div>
                              <CardTitle className="text-base font-mono">{page.path}</CardTitle>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[250px]">{page.title}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2" data-testid={`button-auto-fix-${page.path.replace(/\//g, '-')}`}>
                            <Sparkles className="h-3 w-3" />
                            Auto-fix
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {page.issues.map((issue, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                              <span className="text-[13px]">{issue}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* OG Generator Tab */}
              <TabsContent value="og-generator" className="space-y-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-5 w-5 text-purple-500" />
                      Open Graph Image Generator
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label>Page Title</Label>
                          <Input placeholder="E-Code - AI Development Platform" className="text-[15px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle (optional)</Label>
                          <Input placeholder="Build & Deploy in Minutes" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Background</Label>
                            <Select defaultValue="gradient-purple">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gradient-purple">Purple Gradient</SelectItem>
                                <SelectItem value="gradient-blue">Blue Gradient</SelectItem>
                                <SelectItem value="gradient-green">Green Gradient</SelectItem>
                                <SelectItem value="dark">Dark Solid</SelectItem>
                                <SelectItem value="light">Light Solid</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Logo Position</Label>
                            <Select defaultValue="top-left">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top-left">Top Left</SelectItem>
                                <SelectItem value="top-right">Top Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                <SelectItem value="none">No Logo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button className="w-full gap-2" size="lg">
                          <Sparkles className="h-5 w-5" />
                          Generate Image
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <Label>Live Preview (1200×630)</Label>
                        <div className="aspect-[1200/630] rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex flex-col items-center justify-center text-white p-8 relative">
                          <div className="absolute inset-0 bg-grid-white/10" />
                          <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-[15px] backdrop-blur-sm">
                              E
                            </div>
                            <span className="font-semibold text-[15px]">E-Code</span>
                          </div>
                          <div className="relative z-10 text-center">
                            <h2 className="text-3xl font-bold mb-3">E-Code - AI Development Platform</h2>
                            <p className="text-xl opacity-80">Build & Deploy in Minutes</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 gap-2">
                            <Download className="h-4 w-4" />
                            Download PNG
                          </Button>
                          <Button variant="outline" className="flex-1 gap-2">
                            <Copy className="h-4 w-4" />
                            Copy URL
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Technical SEO Tab */}
              <TabsContent value="technical" className="space-y-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Globe className="h-5 w-5 text-blue-500" />
                        Sitemap Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <span className="text-[13px]">sitemap.xml</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="text-[13px] text-muted-foreground">
                        {stats.total} URLs indexed
                      </div>
                      <Button variant="outline" className="w-full gap-2" onClick={() => window.open('/sitemap.xml', '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                        View Sitemap
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-5 w-5 text-green-500" />
                        Robots.txt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <span className="text-[13px]">robots.txt</span>
                        <Badge className="bg-green-500">Configured</Badge>
                      </div>
                      <div className="text-[13px] text-muted-foreground">
                        Blocking admin, API, and private routes
                      </div>
                      <Button variant="outline" className="w-full gap-2" onClick={() => window.open('/robots.txt', '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                        View Robots.txt
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-5 w-5 text-purple-500" />
                        Core Web Vitals
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span>LCP</span>
                          <span className="text-green-500 font-medium">1.2s</span>
                        </div>
                        <Progress value={80} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span>FID</span>
                          <span className="text-green-500 font-medium">18ms</span>
                        </div>
                        <Progress value={95} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span>CLS</span>
                          <span className="text-green-500 font-medium">0.05</span>
                        </div>
                        <Progress value={90} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Search Engine Submission */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">Search Engine Submission</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
                        <span>Google Search Console</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <img src="https://www.bing.com/favicon.ico" alt="Bing" className="h-6 w-6" />
                        <span>Bing Webmaster</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Globe className="h-6 w-6" />
                        <span>Yandex Webmaster</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Globe className="h-6 w-6" />
                        <span>Baidu Webmaster</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}
