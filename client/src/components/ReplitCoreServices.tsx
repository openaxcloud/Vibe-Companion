import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Download, 
  Terminal, 
  Activity, 
  Database,
  Key,
  Server,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Cpu,
  Network,
  Users
} from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  line?: number;
  file: string;
}

interface ExportStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
}

interface SSHKey {
  id: string;
  name: string;
  type: string;
  fingerprint: string;
  created: string;
  isActive: boolean;
}

interface DatabaseInstance {
  id: string;
  name: string;
  type: string;
  status: string;
  plan: string;
  region: string;
  created: string;
}

interface SystemStatus {
  overall_status: string;
  services: Array<{
    name: string;
    status: string;
    uptime: number;
    responseTime: number;
  }>;
}

export function ReplitCoreServices() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('security');
  const [loading, setLoading] = useState(false);
  
  // Security Scanner State
  const [securityIssues, setSecurityIssues] = useState<SecurityIssue[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  
  // Export Manager State
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [exportType, setExportType] = useState('zip');
  
  // SSH Manager State
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [keyType, setKeyType] = useState('ed25519');
  
  // Database Hosting State
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [newDbName, setNewDbName] = useState('');
  const [dbType, setDbType] = useState('postgresql');
  const [dbPlan, setDbPlan] = useState('free');
  
  // Status Page State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchSSHKeys();
    fetchDatabases();
    fetchSystemStatus();
  }, []);

  // Security Scanner Functions
  const runSecurityScan = async () => {
    setLoading(true);
    setScanProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiRequest('POST', '/api/security/quick-scan', {
        code: `
          const API_KEY = "sk-1234567890abcdef";
          const password = "p@ssw0rd";
          app.use(cors());
          eval(userInput);
        `
      });

      const issues = await response.json();
      setSecurityIssues(issues);
      setScanProgress(100);
      
      toast({
        title: "Security Scan Complete",
        description: `Found ${issues.length} security issues`,
      });
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to complete security scan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Export Manager Functions
  const startExport = async () => {
    setLoading(true);
    
    try {
      const result = await apiRequest('POST', '/api/export/1', {
        format: exportType,
        includeFiles: true,
        includeSecrets: false,
        includeGitHistory: true
      });

      setExportStatus({
        id: result.exportId,
        status: 'processing',
        progress: 0
      });

      // Poll for progress
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`/api/exports/${result.exportId}`);
        const status = await statusResponse.json();
        
        setExportStatus(prev => ({
          ...prev!,
          ...status,
          progress: status.status === 'completed' ? 100 : prev!.progress + 10
        }));

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
        }
      }, 1000);

      toast({
        title: "Export Started",
        description: "Your project export is being processed",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to start project export",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // SSH Manager Functions
  const fetchSSHKeys = async () => {
    try {
      const response = await fetch('/api/ssh/keys');
      const keys = await response.json();
      setSSHKeys(keys);
    } catch (error) {
      console.error('Failed to fetch SSH keys:', error);
    }
  };

  const generateSSHKey = async () => {
    setLoading(true);
    
    try {
      const newKey = await apiRequest('POST', '/api/ssh/keys', {
        name: newKeyName,
        type: keyType
      });

      setSSHKeys(prev => [...prev, newKey]);
      setNewKeyName('');
      
      toast({
        title: "SSH Key Generated",
        description: `New ${keyType} key "${newKeyName}" created successfully`,
      });
    } catch (error) {
      toast({
        title: "Key Generation Failed",
        description: "Unable to generate SSH key",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Database Hosting Functions
  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/database/instances');
      const instances = await response.json();
      setDatabases(instances);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    }
  };

  const createDatabase = async () => {
    setLoading(true);
    
    try {
      const newDb = await apiRequest('POST', '/api/database/create', {
        name: newDbName,
        type: dbType,
        plan: dbPlan,
        projectId: 1
      });

      setDatabases(prev => [...prev, newDb]);
      setNewDbName('');
      
      toast({
        title: "Database Created",
        description: `New ${dbType} database "${newDbName}" is being provisioned`,
      });
    } catch (error) {
      toast({
        title: "Database Creation Failed",
        description: "Unable to create database instance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Status Page Functions  
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'partial_outage': return 'bg-orange-500';
      case 'major_outage': return 'bg-red-500';
      case 'maintenance': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      case 'info': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">E-Code Core Services</h1>
        <p className="text-muted-foreground">
          Complete platform functionality with enterprise-grade services
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Scanner
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Manager
          </TabsTrigger>
          <TabsTrigger value="ssh" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            SSH Access
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status Page
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Hosting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Scanner
              </CardTitle>
              <CardDescription>
                Comprehensive security analysis with vulnerability detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={runSecurityScan} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Run Security Scan
                </Button>
                {scanProgress > 0 && (
                  <div className="flex-1">
                    <Progress value={scanProgress} className="w-full" />
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Scanning... {scanProgress}%
                    </p>
                  </div>
                )}
              </div>

              {securityIssues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Security Issues Found</h3>
                  <ScrollArea className="h-64 border rounded-md p-4">
                    {securityIssues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-3 p-2 border-b">
                        <Badge className={`${getSeverityColor(issue.severity)} text-white`}>
                          {issue.severity}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{issue.type}</p>
                          <p className="text-[13px] text-muted-foreground">{issue.message}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {issue.file} {issue.line && `(line ${issue.line})`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Manager
              </CardTitle>
              <CardDescription>
                Export projects in multiple formats (ZIP, Docker, GitHub-ready)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="export-type">Export Format</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zip">ZIP Archive</SelectItem>
                      <SelectItem value="docker">Docker Container</SelectItem>
                      <SelectItem value="github">GitHub Ready</SelectItem>
                      <SelectItem value="template">Template</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={startExport} 
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Start Export
                  </Button>
                </div>
              </div>

              {exportStatus && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Export Progress</span>
                        <Badge className={
                          exportStatus.status === 'completed' ? 'bg-green-500' :
                          exportStatus.status === 'failed' ? 'bg-red-500' :
                          'bg-blue-500'
                        }>
                          {exportStatus.status}
                        </Badge>
                      </div>
                      <Progress value={exportStatus.progress} />
                      {exportStatus.downloadUrl && (
                        <Button variant="outline" className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Download Export
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssh" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                SSH Access Management
              </CardTitle>
              <CardDescription>
                Generate and manage SSH keys for secure remote access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="my-ssh-key"
                  />
                </div>
                <div>
                  <Label htmlFor="key-type">Key Type</Label>
                  <Select value={keyType} onValueChange={setKeyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ed25519">ED25519 (Recommended)</SelectItem>
                      <SelectItem value="rsa">RSA 4096</SelectItem>
                      <SelectItem value="ecdsa">ECDSA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={generateSSHKey} 
                    disabled={loading || !newKeyName}
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Generate Key
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--ecode-text)]">SSH Keys</h3>
                <ScrollArea className="h-64 border border-[var(--ecode-border)] rounded-md">
                  {sshKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--ecode-border)]">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[var(--ecode-text)]">{key.name}</p>
                        <p className="text-[10px] text-[var(--ecode-text-muted)]">
                          {key.type.toUpperCase()} • {key.fingerprint}
                        </p>
                        <p className="text-[10px] text-[var(--ecode-text-muted)]">
                          Created {new Date(key.created).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={`text-[10px] h-5 ${key.isActive ? 'bg-green-500' : 'bg-gray-500'}`}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>
                Real-time monitoring of all E-Code services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={fetchSystemStatus} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Refresh Status
              </Button>

              {systemStatus && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus.overall_status)}`} />
                    <span className="font-medium">
                      Overall Status: {systemStatus.overall_status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {systemStatus.services.map((service) => (
                      <div key={service.name} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
                          <span className="font-medium">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                          <span>{service.uptime.toFixed(1)}% uptime</span>
                          <span>{service.responseTime}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Hosting
              </CardTitle>
              <CardDescription>
                Managed database instances with automatic scaling and backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="db-name">Database Name</Label>
                  <Input
                    id="db-name"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    placeholder="my-database"
                  />
                </div>
                <div>
                  <Label htmlFor="db-type">Database Type</Label>
                  <Select value={dbType} onValueChange={setDbType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                      <SelectItem value="redis">Redis</SelectItem>
                      <SelectItem value="sqlite">SQLite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="db-plan">Plan</Label>
                  <Select value={dbPlan} onValueChange={setDbPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={createDatabase} 
                    disabled={loading || !newDbName}
                    className="flex items-center gap-2"
                  >
                    <Database className="h-4 w-4" />
                    Create Database
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium text-[var(--ecode-text)]">Database Instances</h3>
                <ScrollArea className="h-64 border border-[var(--ecode-border)] rounded-md">
                  {databases.map((db) => (
                    <div key={db.id} className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--ecode-border)]">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[var(--ecode-text)]">{db.name}</p>
                        <p className="text-[10px] text-[var(--ecode-text-muted)]">
                          {db.type.toUpperCase()} • {db.plan} plan • {db.region}
                        </p>
                        <p className="text-[10px] text-[var(--ecode-text-muted)]">
                          Created {new Date(db.created).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={`text-[10px] h-5 ${getStatusColor(db.status)}`}>
                        {db.status}
                      </Badge>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}