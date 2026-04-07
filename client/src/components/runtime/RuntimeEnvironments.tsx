import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  RefreshCw,
  Settings,
  Download,
  Upload,
  Terminal,
  Code,
  Cpu,
  HardDrive,
  Activity,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Globe,
  FileCode,
  Bug,
  BarChart3,
  Layers,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Supported languages with their configurations
const SUPPORTED_LANGUAGES = {
  javascript: {
    name: 'JavaScript',
    icon: '🟨',
    runtime: 'node',
    version: '20.x',
    extensions: ['.js', '.mjs'],
    packageManager: 'npm',
    debugger: true,
    profiler: true,
  },
  typescript: {
    name: 'TypeScript',
    icon: '🔷',
    runtime: 'node',
    version: '20.x',
    extensions: ['.ts', '.tsx'],
    packageManager: 'npm',
    debugger: true,
    profiler: true,
  },
  python: {
    name: 'Python',
    icon: '🐍',
    runtime: 'python',
    version: '3.11',
    extensions: ['.py'],
    packageManager: 'pip',
    debugger: true,
    profiler: true,
  },
  java: {
    name: 'Java',
    icon: '☕',
    runtime: 'java',
    version: '17',
    extensions: ['.java'],
    packageManager: 'maven',
    debugger: true,
    profiler: true,
  },
  cpp: {
    name: 'C++',
    icon: '🔧',
    runtime: 'gcc',
    version: '11',
    extensions: ['.cpp', '.cc', '.cxx'],
    packageManager: 'vcpkg',
    debugger: true,
    profiler: true,
  },
  go: {
    name: 'Go',
    icon: '🐹',
    runtime: 'go',
    version: '1.21',
    extensions: ['.go'],
    packageManager: 'go',
    debugger: true,
    profiler: true,
  },
  rust: {
    name: 'Rust',
    icon: '🦀',
    runtime: 'rust',
    version: '1.75',
    extensions: ['.rs'],
    packageManager: 'cargo',
    debugger: true,
    profiler: true,
  },
  ruby: {
    name: 'Ruby',
    icon: '💎',
    runtime: 'ruby',
    version: '3.2',
    extensions: ['.rb'],
    packageManager: 'gem',
    debugger: true,
    profiler: false,
  },
  php: {
    name: 'PHP',
    icon: '🐘',
    runtime: 'php',
    version: '8.2',
    extensions: ['.php'],
    packageManager: 'composer',
    debugger: true,
    profiler: true,
  },
  csharp: {
    name: 'C#',
    icon: '🟦',
    runtime: 'dotnet',
    version: '8.0',
    extensions: ['.cs'],
    packageManager: 'nuget',
    debugger: true,
    profiler: true,
  },
  swift: {
    name: 'Swift',
    icon: '🍎',
    runtime: 'swift',
    version: '5.9',
    extensions: ['.swift'],
    packageManager: 'spm',
    debugger: true,
    profiler: false,
  },
  kotlin: {
    name: 'Kotlin',
    icon: '🟣',
    runtime: 'kotlin',
    version: '1.9',
    extensions: ['.kt', '.kts'],
    packageManager: 'gradle',
    debugger: true,
    profiler: true,
  },
  dart: {
    name: 'Dart',
    icon: '🎯',
    runtime: 'dart',
    version: '3.2',
    extensions: ['.dart'],
    packageManager: 'pub',
    debugger: true,
    profiler: true,
  },
  elixir: {
    name: 'Elixir',
    icon: '💜',
    runtime: 'elixir',
    version: '1.15',
    extensions: ['.ex', '.exs'],
    packageManager: 'mix',
    debugger: true,
    profiler: false,
  },
  haskell: {
    name: 'Haskell',
    icon: '🔵',
    runtime: 'ghc',
    version: '9.6',
    extensions: ['.hs'],
    packageManager: 'cabal',
    debugger: false,
    profiler: true,
  },
  r: {
    name: 'R',
    icon: '📊',
    runtime: 'r',
    version: '4.3',
    extensions: ['.r', '.R'],
    packageManager: 'cran',
    debugger: false,
    profiler: true,
  },
  julia: {
    name: 'Julia',
    icon: '🟢',
    runtime: 'julia',
    version: '1.9',
    extensions: ['.jl'],
    packageManager: 'pkg',
    debugger: true,
    profiler: true,
  },
  scala: {
    name: 'Scala',
    icon: '🔴',
    runtime: 'scala',
    version: '3.3',
    extensions: ['.scala'],
    packageManager: 'sbt',
    debugger: true,
    profiler: true,
  },
  lua: {
    name: 'Lua',
    icon: '🌙',
    runtime: 'lua',
    version: '5.4',
    extensions: ['.lua'],
    packageManager: 'luarocks',
    debugger: true,
    profiler: false,
  },
  perl: {
    name: 'Perl',
    icon: '🐪',
    runtime: 'perl',
    version: '5.38',
    extensions: ['.pl', '.pm'],
    packageManager: 'cpan',
    debugger: true,
    profiler: false,
  },
};

interface RuntimeStatus {
  isRunning: boolean;
  pid?: number;
  port?: number;
  startTime?: Date;
  memory?: number;
  cpu?: number;
  logs?: string[];
}

interface RuntimeEnvironmentsProps {
  projectId: number;
  activeFile?: { name: string; content: string };
  onRun?: () => void;
  onStop?: () => void;
  onDebug?: () => void;
}

export function RuntimeEnvironments({
  projectId,
  activeFile,
  onRun,
  onStop,
  onDebug,
}: RuntimeEnvironmentsProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [isDebugging, setIsDebugging] = useState(false);
  const [isProfiling, setIsProfiling] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const { toast } = useToast();

  // Detect language from file extension
  useEffect(() => {
    if (activeFile?.name) {
      const extension = activeFile.name.split('.').pop()?.toLowerCase();
      for (const [lang, config] of Object.entries(SUPPORTED_LANGUAGES)) {
        if (config.extensions.some(ext => ext.slice(1) === extension)) {
          setSelectedLanguage(lang);
          break;
        }
      }
    }
  }, [activeFile?.name]);

  // Fetch runtime status
  const { data: runtimeStatus, refetch: refetchStatus } = useQuery<RuntimeStatus>({
    queryKey: [`/api/projects/${projectId}/runtime/status`],
    refetchInterval: 2000, // Poll every 2 seconds when running
    enabled: !!projectId,
  });

  // Runtime control mutations
  const startRuntimeMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/projects/${projectId}/runtime/start`, {
        method: 'POST',
        body: JSON.stringify({
          language: selectedLanguage,
          entryFile: activeFile?.name,
          debug: isDebugging,
          profile: isProfiling,
        }),
      }),
    onSuccess: () => {
      refetchStatus();
      toast({
        title: 'Runtime Started',
        description: `${SUPPORTED_LANGUAGES[selectedLanguage as keyof typeof SUPPORTED_LANGUAGES].name} runtime is starting...`,
      });
      onRun?.();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to start runtime',
        variant: 'destructive',
      });
    },
  });

  const stopRuntimeMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/projects/${projectId}/runtime/stop`, {
        method: 'POST',
      }),
    onSuccess: () => {
      refetchStatus();
      toast({
        title: 'Runtime Stopped',
        description: 'Runtime has been stopped',
      });
      onStop?.();
    },
  });

  const installDependencyMutation = useMutation({
    mutationFn: async (packageName: string) =>
      apiRequest(`/api/projects/${projectId}/runtime/install`, {
        method: 'POST',
        body: JSON.stringify({
          language: selectedLanguage,
          package: packageName,
        }),
      }),
    onSuccess: () => {
      toast({
        title: 'Package Installed',
        description: 'Dependency has been installed successfully',
      });
    },
  });

  const currentLanguage = SUPPORTED_LANGUAGES[selectedLanguage as keyof typeof SUPPORTED_LANGUAGES];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Layers className="h-5 w-5" />
            <h3 className="font-semibold">Runtime Environments</h3>
          </div>
          
          {/* Language Selector */}
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48">
              <SelectValue>
                <div className="flex items-center space-x-2">
                  <span>{currentLanguage.icon}</span>
                  <span>{currentLanguage.name}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SUPPORTED_LANGUAGES).map(([key, lang]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center space-x-2">
                    <span>{lang.icon}</span>
                    <span>{lang.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {lang.version}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="runtime" className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="runtime">Runtime</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            </TabsList>

            {/* Runtime Tab */}
            <TabsContent value="runtime" className="h-full p-4 space-y-4">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Runtime Status
                    {runtimeStatus?.isRunning ? (
                      <Badge variant="default" className="bg-green-600">
                        <Activity className="h-3 w-3 mr-1" />
                        Running
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Square className="h-3 w-3 mr-1" />
                        Stopped
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Control Buttons */}
                  <div className="flex space-x-2">
                    {!runtimeStatus?.isRunning ? (
                      <Button
                        onClick={() => startRuntimeMutation.mutate()}
                        disabled={startRuntimeMutation.isPending || !activeFile}
                        className="flex-1"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run {activeFile?.name || 'No file selected'}
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => stopRuntimeMutation.mutate()}
                        disabled={stopRuntimeMutation.isPending}
                        className="flex-1"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={() => refetchStatus()}
                      disabled={!runtimeStatus?.isRunning}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Runtime Info */}
                  {runtimeStatus?.isRunning && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Process ID:</span>
                          <span className="ml-2 font-mono">{runtimeStatus.pid}</span>
                        </div>
                        {runtimeStatus.port && (
                          <div>
                            <span className="text-muted-foreground">Port:</span>
                            <span className="ml-2 font-mono">{runtimeStatus.port}</span>
                          </div>
                        )}
                      </div>

                      {/* Resource Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center">
                            <Cpu className="h-4 w-4 mr-1" />
                            CPU Usage
                          </span>
                          <span>{runtimeStatus.cpu || 0}%</span>
                        </div>
                        <Progress value={runtimeStatus.cpu || 0} className="h-2" />
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center">
                            <HardDrive className="h-4 w-4 mr-1" />
                            Memory
                          </span>
                          <span>{Math.round((runtimeStatus.memory || 0) / 1024 / 1024)} MB</span>
                        </div>
                        <Progress value={(runtimeStatus.memory || 0) / 1024 / 1024 / 512 * 100} className="h-2" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Language Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Language Features</CardTitle>
                  <CardDescription>
                    Available features for {currentLanguage.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      {currentLanguage.debugger ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Debugger Support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {currentLanguage.profiler ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Profiler Support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Package Manager: {currentLanguage.packageManager}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Code className="h-4 w-4" />
                      <span className="text-sm">Version: {currentLanguage.version}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Debug Tab */}
            <TabsContent value="debug" className="h-full p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Debugger
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsDebugging(true);
                        startRuntimeMutation.mutate();
                        onDebug?.();
                      }}
                      disabled={!currentLanguage.debugger || runtimeStatus?.isRunning}
                    >
                      <Bug className="h-4 w-4 mr-2" />
                      Start Debugging
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Set breakpoints and debug your {currentLanguage.name} code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!currentLanguage.debugger ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p className="text-sm">Debugger not available for {currentLanguage.name}</p>
                    </div>
                  ) : isDebugging ? (
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="font-medium mb-2">Debug Console</h4>
                        <ScrollArea className="h-64 w-full rounded border bg-background p-2">
                          <pre className="text-xs font-mono">
                            Debugger attached to process {runtimeStatus?.pid}
                            {'\n'}Waiting for breakpoints...
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <p>Click "Start Debugging" to begin a debug session</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="h-full p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Performance Profiler
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsProfiling(true);
                        startRuntimeMutation.mutate();
                      }}
                      disabled={!currentLanguage.profiler || runtimeStatus?.isRunning}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Start Profiling
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Analyze performance and optimize your code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!currentLanguage.profiler ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p className="text-sm">Profiler not available for {currentLanguage.name}</p>
                    </div>
                  ) : isProfiling ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">0.00ms</div>
                            <p className="text-xs text-muted-foreground">Execution Time</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">0 MB</div>
                            <p className="text-xs text-muted-foreground">Memory Usage</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">0</div>
                            <p className="text-xs text-muted-foreground">Function Calls</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <p>Click "Start Profiling" to analyze performance</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dependencies Tab */}
            <TabsContent value="dependencies" className="h-full p-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">Package Management</CardTitle>
                  <CardDescription>
                    Manage {currentLanguage.packageManager} packages for your project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder={`Enter ${currentLanguage.packageManager} package name`}
                        className="flex-1 px-3 py-2 border rounded-md"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            installDependencyMutation.mutate(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Install
                      </Button>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Installed Packages</h4>
                      <div className="text-sm text-muted-foreground">
                        No packages installed yet
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}