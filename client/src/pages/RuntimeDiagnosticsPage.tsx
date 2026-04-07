/**
 * Runtime Diagnostics Page
 * Displays detailed diagnostics about available runtime environments
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Import Spinner from components/ui/spinner.tsx
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
  InfoIcon, AlertCircle, CheckCircle2, XCircle, ServerIcon, 
  Cpu, HardDrive, Boxes, TerminalIcon
} from 'lucide-react';

export default function RuntimeDiagnosticsPage() {
  // Fetch runtime dashboard data
  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['/api/runtime/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch detailed dependencies data
  const { data: dependencies, isLoading: isDependenciesLoading, error: dependenciesError } = useQuery({
    queryKey: ['/api/runtime/dependencies'],
    refetchInterval: false, // Don't auto-refresh this data
  });

  // Handle loading state
  if (isDashboardLoading || isDependenciesLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-muted-foreground">Loading runtime diagnostics...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (dashboardError || dependenciesError) {
    return (
      <div className="container py-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Diagnostics</AlertTitle>
          <AlertDescription>
            {dashboardError ? 'Failed to load runtime dashboard data.' : ''}
            {dependenciesError ? 'Failed to load runtime dependencies data.' : ''}
            Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Extract data from API responses
  const systemHealth = dashboard?.systemHealth || {};
  const runtimeEnvironments = dashboard?.runtimeEnvironments || {};
  const recommendations = dashboard?.recommendations || [];
  const activeProjects = dashboard?.activeProjects || [];
  
  const availableLanguages = dependencies?.summary?.availableLanguages || [];
  const missingLanguages = dependencies?.summary?.missingLanguages || [];
  const systemInfo = dependencies?.system || {};

  // Calculate memory usage as a percentage
  const memoryPercentage = parseFloat(systemHealth.memoryUsage?.replace('%', '') || '0');

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Runtime Diagnostics</h1>
      
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="system">System Resources</TabsTrigger>
          <TabsTrigger value="projects">Active Projects</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* System Health Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center">
                  <ServerIcon className="mr-2 h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Current system resources and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">CPU Load</span>
                      <span className="text-sm text-muted-foreground">{systemHealth.cpuUsage?.toFixed(2) || '0'}</span>
                    </div>
                    <Progress value={systemHealth.cpuUsage * 10} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm text-muted-foreground">{systemHealth.memoryUsage || '0%'}</span>
                    </div>
                    <Progress value={memoryPercentage} className="h-2" />
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex justify-between text-sm">
                      <span>Platform:</span>
                      <span className="text-muted-foreground">{systemHealth.platform || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Architecture:</span>
                      <span className="text-muted-foreground">{systemHealth.arch || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Uptime:</span>
                      <span className="text-muted-foreground">
                        {systemHealth.uptime ? `${Math.floor(systemHealth.uptime / 3600)} hours` : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Runtime Environments Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center">
                  <Boxes className="mr-2 h-5 w-5" />
                  Runtime Support
                </CardTitle>
                <CardDescription>
                  Available runtime engines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">Docker</span>
                    </div>
                    {runtimeEnvironments.docker?.available ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        <XCircle className="mr-1 h-3 w-3" /> Not Available
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">Nix</span>
                    </div>
                    {runtimeEnvironments.nix?.available ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        <XCircle className="mr-1 h-3 w-3" /> Not Available
                      </Badge>
                    )}
                  </div>
                  
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-sm font-medium mb-2">Available Languages</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(runtimeEnvironments.languages || {})
                        .filter(([_, info]: [string, any]) => info.available)
                        .map(([language]: [string, any]) => (
                          <Badge key={language} variant="secondary" className="text-xs">
                            {language}
                          </Badge>
                        ))
                      }
                      {Object.values(runtimeEnvironments.languages || {}).filter((info: any) => info.available).length === 0 && (
                        <span className="text-sm text-muted-foreground">No languages detected</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Recommendations Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center">
                  <InfoIcon className="mr-2 h-5 w-5" />
                  Recommendations
                </CardTitle>
                <CardDescription>
                  Suggested environment improvements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recommendations.map((recommendation: string, index: number) => (
                    <li key={index} className="text-sm flex">
                      <InfoIcon className="h-4 w-4 mr-2 mt-0.5 text-blue-500 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                  {recommendations.length === 0 && (
                    <li className="text-sm text-muted-foreground">No recommendations available</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Languages Tab */}
        <TabsContent value="languages">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available Languages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                  Available Languages
                </CardTitle>
                <CardDescription>
                  Languages ready to use on this system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableLanguages.length > 0 ? (
                  <div className="space-y-4">
                    {availableLanguages.map((lang: any) => (
                      <div key={lang.language} className="pb-3 border-b last:border-0">
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-medium">{lang.language}</h3>
                          <Badge variant="outline">{lang.version.split('\\n')[0]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{lang.notes}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    No languages are available on this system
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Missing Languages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <XCircle className="mr-2 h-5 w-5 text-red-500" />
                  Missing Languages
                </CardTitle>
                <CardDescription>
                  Languages that could be installed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {missingLanguages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {missingLanguages.map((lang: string) => (
                      <div key={lang} className="border rounded-md p-3">
                        <div className="font-medium text-sm">{lang}</div>
                        <div className="text-xs text-muted-foreground mt-1">Not installed</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    All supported languages are installed
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* System Resources Tab */}
        <TabsContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU & Memory */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="mr-2 h-5 w-5" />
                  System Resources
                </CardTitle>
                <CardDescription>
                  CPU, memory and hardware details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">CPU Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">CPU Cores</div>
                        <div className="font-medium text-lg">{systemInfo.cpus || 'N/A'}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Architecture</div>
                        <div className="font-medium text-lg">{systemInfo.architecture || 'N/A'}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">CPU Load</div>
                        <div className="font-medium text-lg">{systemHealth.cpuUsage?.toFixed(2) || 'N/A'}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Platform</div>
                        <div className="font-medium text-lg">{systemInfo.platform || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Memory Usage</h3>
                    <div className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Memory Utilization</span>
                        <span className="text-sm text-muted-foreground">{systemHealth.memoryUsage}</span>
                      </div>
                      <Progress value={memoryPercentage} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Total Memory</div>
                        <div className="font-medium">{systemInfo.memory?.total || 'N/A'}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Free Memory</div>
                        <div className="font-medium">{systemInfo.memory?.free || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* System Environment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TerminalIcon className="mr-2 h-5 w-5" />
                  Environment Details
                </CardTitle>
                <CardDescription>
                  Software environment and runtime details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Node.js Environment</h3>
                    <div className="border rounded-md p-3">
                      <div className="grid grid-cols-2 gap-y-2">
                        <div className="text-sm font-medium">Version</div>
                        <div className="text-sm text-muted-foreground">{systemInfo.nodeVersion || 'N/A'}</div>
                        
                        <div className="text-sm font-medium">Package Manager</div>
                        <div className="text-sm text-muted-foreground">npm</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Runtime Engines</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <span className="text-sm font-medium">Docker</span>
                        {runtimeEnvironments.docker?.available ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
                            {runtimeEnvironments.docker.version?.split('\n')[0] || 'Installed'}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Not Available</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <span className="text-sm font-medium">Nix</span>
                        {runtimeEnvironments.nix?.available ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
                            {runtimeEnvironments.nix.version?.split(' ')[2] || 'Installed'}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Not Available</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Active Projects Tab */}
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Active Runtime Projects</CardTitle>
              <CardDescription>
                Projects currently running in the runtime environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeProjects.length > 0 ? (
                <div className="space-y-4">
                  {activeProjects.map((project: any) => (
                    <div key={project.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">{project.name}</h3>
                        <Badge>{project.status.language || 'Unknown'}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Status</div>
                          <div>{project.status.isRunning ? 'Running' : 'Stopped'}</div>
                        </div>
                        
                        <div>
                          <div className="text-muted-foreground">Port</div>
                          <div>{project.status.port || 'N/A'}</div>
                        </div>
                        
                        <div>
                          <div className="text-muted-foreground">URL</div>
                          <div className="truncate">
                            {project.status.url ? (
                              <a href={project.status.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                Open
                              </a>
                            ) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <HardDrive className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No active runtime projects</p>
                  <p className="text-sm">Start a project runtime to see it listed here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="text-xs text-muted-foreground text-center mt-6">
        Last updated: {dashboard?.timestamp ? new Date(dashboard.timestamp).toLocaleString() : 'Unknown'}
      </div>
    </div>
  );
}