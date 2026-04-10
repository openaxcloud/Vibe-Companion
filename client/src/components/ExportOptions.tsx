import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  FileArchive, 
  FileCode, 
  Github,
  Package,
  Terminal,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Box
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExportJob {
  id: number;
  projectId: number;
  type: 'zip' | 'github' | 'docker' | 'npm' | 'binary';
  format?: string;
  options: {
    includeNodeModules?: boolean;
    includeEnvVars?: boolean;
    includeDatabase?: boolean;
    includeSecrets?: boolean;
    branch?: string;
    repository?: string;
    dockerfile?: boolean;
    platform?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
}

interface ExportOptionsProps {
  projectId: number;
}

export function ExportOptions({ projectId }: ExportOptionsProps) {
  const [exportType, setExportType] = useState<ExportJob['type']>('zip');
  const [exportOptions, setExportOptions] = useState({
    includeNodeModules: false,
    includeEnvVars: true,
    includeDatabase: false,
    includeSecrets: false,
    branch: 'main',
    repository: '',
    dockerfile: true,
    platform: 'linux/amd64'
  });

  // Fetch export history
  const { data: exportHistory = [] } = useQuery<ExportJob[]>({
    queryKey: ['/api/exports', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/exports/${projectId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch export history');
      return response.json();
    }
  });

  // Create export
  const createExportMutation = useMutation({
    mutationFn: (data: { type: ExportJob['type']; options: typeof exportOptions }) =>
      apiRequest('POST', `/api/exports/${projectId}`, data),
    onSuccess: () => {
      toast({
        title: "Export started",
        description: "Your project export is being prepared"
      });
    }
  });

  const getExportIcon = (type: ExportJob['type']) => {
    switch (type) {
      case 'zip': return <FileArchive className="h-5 w-5" />;
      case 'github': return <Github className="h-5 w-5" />;
      case 'docker': return <Box className="h-5 w-5" />;
      case 'npm': return <Package className="h-5 w-5" />;
      case 'binary': return <Terminal className="h-5 w-5" />;
      default: return <FileCode className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleExport = () => {
    createExportMutation.mutate({
      type: exportType,
      options: exportOptions
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Export Project</h2>
        <p className="text-muted-foreground">
          Export your project in various formats for deployment or backup
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Export Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'zip', label: 'ZIP Archive', icon: FileArchive, description: 'Download as compressed archive' },
                  { value: 'github', label: 'GitHub Repository', icon: Github, description: 'Push to GitHub repository' },
                  { value: 'docker', label: 'Docker Image', icon: Box, description: 'Build Docker container' },
                  { value: 'npm', label: 'NPM Package', icon: Package, description: 'Publish as NPM package' },
                  { value: 'binary', label: 'Binary Executable', icon: Terminal, description: 'Compile to native binary' }
                ].map(format => (
                  <Card 
                    key={format.value}
                    className={`cursor-pointer transition-colors ${
                      exportType === format.value ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setExportType(format.value as ExportJob['type'])}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <format.icon className="h-5 w-5 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{format.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Format-specific options */}
            {exportType === 'zip' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="node-modules">Include node_modules</Label>
                  <Switch
                    id="node-modules"
                    checked={exportOptions.includeNodeModules}
                    onCheckedChange={(checked) => 
                      setExportOptions({ ...exportOptions, includeNodeModules: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="env-vars">Include environment variables</Label>
                  <Switch
                    id="env-vars"
                    checked={exportOptions.includeEnvVars}
                    onCheckedChange={(checked) => 
                      setExportOptions({ ...exportOptions, includeEnvVars: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="database">Include database dump</Label>
                  <Switch
                    id="database"
                    checked={exportOptions.includeDatabase}
                    onCheckedChange={(checked) => 
                      setExportOptions({ ...exportOptions, includeDatabase: checked })
                    }
                  />
                </div>
              </div>
            )}

            {exportType === 'github' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Repository URL</Label>
                  <input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    className="w-full px-3 py-2 border rounded-md"
                    value={exportOptions.repository}
                    onChange={(e) => 
                      setExportOptions({ ...exportOptions, repository: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <input
                    type="text"
                    placeholder="main"
                    className="w-full px-3 py-2 border rounded-md"
                    value={exportOptions.branch}
                    onChange={(e) => 
                      setExportOptions({ ...exportOptions, branch: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {exportType === 'docker' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dockerfile">Generate Dockerfile</Label>
                  <Switch
                    id="dockerfile"
                    checked={exportOptions.dockerfile}
                    onCheckedChange={(checked) => 
                      setExportOptions({ ...exportOptions, dockerfile: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    value={exportOptions.platform}
                    onValueChange={(value) => 
                      setExportOptions({ ...exportOptions, platform: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linux/amd64">Linux AMD64</SelectItem>
                      <SelectItem value="linux/arm64">Linux ARM64</SelectItem>
                      <SelectItem value="windows/amd64">Windows AMD64</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button 
              className="w-full"
              onClick={handleExport}
              disabled={createExportMutation.isPending}
            >
              {createExportMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Preparing Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Project
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export History */}
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exportHistory.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-8">
                  No exports yet
                </p>
              ) : (
                exportHistory.map(job => (
                  <Card key={job.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getExportIcon(job.type)}
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {job.type.toUpperCase()} Export
                              {getStatusIcon(job.status)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString()}
                            </p>
                            {job.error && (
                              <p className="text-[11px] text-red-600 mt-1">
                                {job.error}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {job.status === 'processing' && (
                          <div className="w-24">
                            <Progress value={job.progress} className="h-2" />
                            <p className="text-[11px] text-center mt-1">
                              {job.progress}%
                            </p>
                          </div>
                        )}
                        
                        {job.status === 'completed' && job.downloadUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(job.downloadUrl, '_blank')}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Export Presets</CardTitle>
          <CardDescription>
            Common export configurations for different use cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5" />
                    <h4 className="font-medium">Quick Backup</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ZIP with all files, env vars, and database
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setExportType('zip');
                      setExportOptions({
                        ...exportOptions,
                        includeNodeModules: false,
                        includeEnvVars: true,
                        includeDatabase: true,
                        includeSecrets: false
                      });
                      handleExport();
                    }}
                  >
                    Export Backup
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Box className="h-5 w-5" />
                    <h4 className="font-medium">Deploy Ready</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Docker image with production settings
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setExportType('docker');
                      setExportOptions({
                        ...exportOptions,
                        dockerfile: true,
                        platform: 'linux/amd64'
                      });
                      handleExport();
                    }}
                  >
                    Build Image
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    <h4 className="font-medium">Open Source</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Clean export for GitHub without secrets
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setExportType('github');
                      setExportOptions({
                        ...exportOptions,
                        includeSecrets: false,
                        branch: 'main'
                      });
                    }}
                  >
                    Configure Git
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}