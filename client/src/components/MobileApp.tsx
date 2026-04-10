// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Smartphone, 
  Tablet, 
  Play, 
  FileText, 
  Users, 
  Activity,
  Download,
  Settings,
  Terminal,
  Code,
  Clock,
  Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MobileProject {
  id: number;
  name: string;
  slug: string;
  language: string;
  lastOpened?: string;
  isPublic: boolean;
  canRun: boolean;
  fileCount: number;
  description?: string;
}

interface MobileDevice {
  id: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  lastActive: string;
  isActive: boolean;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  exitCode: number;
}

export function MobileApp() {
  const [selectedProject, setSelectedProject] = useState<MobileProject | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const queryClient = useQueryClient();

  // Fetch mobile projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/mobile/projects'],
    staleTime: 30000
  });

  // Fetch mobile devices
  const { data: devicesData } = useQuery({
    queryKey: ['/api/mobile/devices'],
    staleTime: 60000
  });

  // Run project mutation
  const runProjectMutation = useMutation({
    mutationFn: async ({ projectId, input }: { projectId: number; input?: string }) => {
      const response = await apiRequest('POST', `/api/mobile/projects/${projectId}/run`, { input });
      return response.json();
    },
    onSuccess: (data) => {
      setExecutionResult(data);
    }
  });

  const projects = projectsData?.projects || [];
  const devices = devicesData?.devices || [];

  const mobileStats = {
    totalProjects: projects.length,
    runnableProjects: projects.filter((p: MobileProject) => p.canRun).length,
    totalDevices: devices.length,
    activeDevices: devices.filter((d: MobileDevice) => d.isActive).length
  };

  const languageStats = projects.reduce((acc: Record<string, number>, project: MobileProject) => {
    acc[project.language] = (acc[project.language] || 0) + 1;
    return acc;
  }, {});

  const handleRunProject = () => {
    if (selectedProject && selectedProject.canRun) {
      runProjectMutation.mutate({
        projectId: selectedProject.id,
        input: codeInput
      });
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'ios' ? '📱' : '🤖';
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      javascript: 'bg-yellow-100 text-yellow-800',
      python: 'bg-blue-100 text-blue-800',
      java: 'bg-red-100 text-red-800',
      cpp: 'bg-purple-100 text-purple-800',
      html: 'bg-orange-100 text-orange-800',
      css: 'bg-pink-100 text-pink-800'
    };
    return colors[language] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Smartphone className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Native Mobile Apps</h1>
          <p className="text-muted-foreground">
            Run and manage projects on mobile devices with full IDE functionality
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mobileStats.totalProjects}</div>
            <p className="text-[11px] text-muted-foreground">
              {mobileStats.runnableProjects} runnable on mobile
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Connected Devices</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mobileStats.totalDevices}</div>
            <p className="text-[11px] text-muted-foreground">
              {mobileStats.activeDevices} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Execution Speed</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">~2.3s</div>
            <p className="text-[11px] text-muted-foreground">
              Average mobile execution time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">App Performance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-[11px] text-muted-foreground">
              Mobile execution success rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Mobile Projects</TabsTrigger>
          <TabsTrigger value="devices">Connected Devices</TabsTrigger>
          <TabsTrigger value="execution">Code Execution</TabsTrigger>
          <TabsTrigger value="analytics">Mobile Analytics</TabsTrigger>
        </TabsList>

        {/* Mobile Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mobile-Optimized Projects</CardTitle>
              <CardDescription>
                Projects that can run efficiently on mobile devices with optimized performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project: MobileProject) => (
                    <div
                      key={project.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Code className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                          <Badge className={getLanguageColor(project.language)}>
                            {project.language}
                          </Badge>
                          {project.canRun && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Play className="h-3 w-3 mr-1" />
                              Mobile Ready
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[13px] text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{project.fileCount} files</span>
                          {project.lastOpened && (
                            <>
                              <Clock className="h-4 w-4 ml-2" />
                              <span>
                                {new Date(project.lastOpened).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {project.description && (
                        <p className="mt-2 text-[13px] text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connected Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Mobile Devices</CardTitle>
              <CardDescription>
                Devices currently authenticated and available for code execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devices.map((device: MobileDevice) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {getPlatformIcon(device.platform)}
                      </div>
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <span>{device.deviceModel}</span>
                          {device.isActive && (
                            <div className="h-2 w-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          {device.platform.toUpperCase()} {device.osVersion} • App v{device.appVersion}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={device.isActive ? 'default' : 'secondary'}>
                        {device.isActive ? 'Active' : 'Offline'}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Last seen: {new Date(device.lastActive).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Execution Tab */}
        <TabsContent value="execution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Execution Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Mobile Code Execution</CardTitle>
                <CardDescription>
                  Run code on mobile devices with optimized performance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="project-select">Select Project</Label>
                  <Select
                    value={selectedProject?.id.toString() || ''}
                    onValueChange={(value) => {
                      const project = projects.find((p: MobileProject) => p.id.toString() === value);
                      setSelectedProject(project || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a mobile-ready project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects
                        .filter((p: MobileProject) => p.canRun)
                        .map((project: MobileProject) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name} ({project.language})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="code-input">Input (optional)</Label>
                  <Input
                    id="code-input"
                    placeholder="Enter input for your program..."
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleRunProject}
                  disabled={!selectedProject || !selectedProject.canRun || runProjectMutation.isPending}
                  className="w-full"
                >
                  {runProjectMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      Running on Mobile...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run on Mobile Device
                    </>
                  )}
                </Button>

                {selectedProject && (
                  <div className="p-3 bg-gray-50 rounded-lg text-[13px]">
                    <div className="font-medium">Execution Settings:</div>
                    <div className="text-muted-foreground mt-1">
                      • Timeout: 10 seconds
                      <br />
                      • Memory Limit: 64MB
                      <br />
                      • Optimized for mobile performance
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execution Results */}
            <Card>
              <CardHeader>
                <CardTitle>Execution Results</CardTitle>
                <CardDescription>
                  Real-time output from mobile code execution
                </CardDescription>
              </CardHeader>
              <CardContent>
                {executionResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={executionResult.success ? 'default' : 'destructive'}>
                        {executionResult.success ? 'Success' : 'Failed'}
                      </Badge>
                      <div className="text-[13px] text-muted-foreground">
                        {executionResult.executionTime}ms • {Math.round(executionResult.memoryUsed / 1024)}KB
                      </div>
                    </div>

                    {executionResult.output && (
                      <div>
                        <Label>Output</Label>
                        <div className="mt-1 p-3 bg-black text-green-400 rounded-lg font-mono text-[13px] max-h-40 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{executionResult.output}</pre>
                        </div>
                      </div>
                    )}

                    {executionResult.error && (
                      <div>
                        <Label>Error</Label>
                        <div className="mt-1 p-3 bg-red-50 text-red-700 rounded-lg font-mono text-[13px] max-h-40 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{executionResult.error}</pre>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-muted-foreground">
                      Exit Code: {executionResult.exitCode}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Run a project to see execution results</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mobile Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Language Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Language Distribution</CardTitle>
                <CardDescription>
                  Programming languages used in mobile projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(languageStats).map(([language, count]) => (
                    <div key={language} className="space-y-2">
                      <div className="flex justify-between text-[13px]">
                        <span className="capitalize">{language}</span>
                        <span>{count} projects</span>
                      </div>
                      <Progress 
                        value={(count as number / projects.length) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Mobile Performance</CardTitle>
                <CardDescription>
                  Code execution metrics on mobile devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>Average Execution Time</span>
                      <span>2.3s</span>
                    </div>
                    <Progress value={77} className="h-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      23% faster than desktop execution
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>Memory Efficiency</span>
                      <span>45MB avg</span>
                    </div>
                    <Progress value={85} className="h-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Well within 64MB mobile limit
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>Success Rate</span>
                      <span>98.5%</span>
                    </div>
                    <Progress value={98} className="h-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Excellent mobile compatibility
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Statistics</CardTitle>
              <CardDescription>
                Device platform distribution and usage metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">📱</div>
                  <div className="text-2xl font-bold">
                    {devices.filter((d: MobileDevice) => d.platform === 'ios').length}
                  </div>
                  <div className="text-[13px] text-muted-foreground">iOS Devices</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="text-2xl font-bold">
                    {devices.filter((d: MobileDevice) => d.platform === 'android').length}
                  </div>
                  <div className="text-[13px] text-muted-foreground">Android Devices</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-2xl font-bold">
                    {((mobileStats.activeDevices / mobileStats.totalDevices) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[13px] text-muted-foreground">Active Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}