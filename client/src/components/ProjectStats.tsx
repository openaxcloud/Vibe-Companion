import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  GitBranch,
  Clock,
  Package,
  Users,
  Activity,
  BarChart3,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

interface ProjectStatsProps {
  projectId: number;
  className?: string;
}

interface LanguageStats {
  language: string;
  percentage: number;
  lines: number;
  color: string;
}

interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  totalSize: string;
  languages: LanguageStats[];
  commits: number;
  branches: number;
  contributors: number;
  lastUpdated: string;
  dependencies: number;
  devDependencies: number;
  buildTime: number;
  testCoverage: number;
}

export function ProjectStats({ projectId, className }: ProjectStatsProps) {
  const { data: metrics, isLoading, isError, refetch } = useQuery<ProjectMetrics>({
    queryKey: ['/api/projects', projectId, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/stats`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch project stats');
      }
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Project Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError || !metrics) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Project Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-[13px] text-muted-foreground mb-3">Unable to load project statistics</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Project Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="languages">Languages</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Files</span>
                  <span className="font-mono font-medium">{metrics.totalFiles}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Lines of Code</span>
                  <span className="font-mono font-medium">{metrics.totalLines.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Project Size</span>
                  <span className="font-mono font-medium">{metrics.totalSize}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Dependencies</span>
                  <span className="font-mono font-medium">{metrics.dependencies + metrics.devDependencies}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Build Time</span>
                  <span className="font-mono font-medium">{metrics.buildTime}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Test Coverage</span>
                  <span className="font-mono font-medium">{metrics.testCoverage}%</span>
                </div>
              </div>
            </div>

            {/* Test Coverage Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Test Coverage</span>
                <span className={cn(
                  "font-medium",
                  metrics.testCoverage >= 80 ? "text-green-500" : 
                  metrics.testCoverage >= 60 ? "text-yellow-500" : 
                  "text-red-500"
                )}>
                  {metrics.testCoverage}%
                </span>
              </div>
              <Progress value={metrics.testCoverage} className="h-2" />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Branches</p>
                  <p className="font-medium">{metrics.branches}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Contributors</p>
                  <p className="font-medium">{metrics.contributors}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Updated</p>
                  <p className="font-medium text-[11px]">{metrics.lastUpdated}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="languages" className="space-y-4 mt-4">
            {/* Language Distribution */}
            <div className="space-y-3">
              {metrics.languages.map((lang) => (
                <div key={lang.language} className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: lang.color }}
                      />
                      <span className="font-medium">{lang.language}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{lang.lines.toLocaleString()} lines</span>
                      <span className="font-mono">{lang.percentage}%</span>
                    </div>
                  </div>
                  <Progress 
                    value={lang.percentage} 
                    className="h-2"
                    style={{
                      '--progress-color': lang.color
                    } as any}
                  />
                </div>
              ))}
            </div>

            {/* Language Summary */}
            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                {metrics.languages.map((lang) => (
                  <Badge 
                    key={lang.language} 
                    variant="secondary"
                    className="text-[11px]"
                  >
                    <div 
                      className="w-2 h-2 rounded-full mr-1" 
                      style={{ backgroundColor: lang.color }}
                    />
                    {lang.language} {lang.percentage}%
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* Activity Stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Commits</p>
                    <p className="text-[13px] text-muted-foreground">Total commits to main branch</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{metrics.commits}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Dependencies</p>
                    <p className="text-[13px] text-muted-foreground">{metrics.dependencies} prod, {metrics.devDependencies} dev</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{metrics.dependencies + metrics.devDependencies}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Performance</p>
                    <p className="text-[13px] text-muted-foreground">Average build time</p>
                  </div>
                </div>
                <Badge variant={metrics.buildTime < 60 ? "default" : "destructive"}>
                  {metrics.buildTime}s
                </Badge>
              </div>
            </div>

            {/* Recent Activity - Git integration required */}
            <div className="pt-4 border-t">
              <h4 className="text-[13px] font-medium mb-2">Recent Activity</h4>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <GitBranch className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-[13px] text-muted-foreground">
                  Connect a Git repository to see activity
                </p>
                <Badge variant="outline" className="mt-2 text-[11px]">
                  Git integration required
                </Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}