import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Database, 
  Server, 
  HardDrive, 
  Activity,
  Shield,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DatabaseInstance {
  id: number;
  name: string;
  type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  version: string;
  region: 'us-east' | 'us-west' | 'eu-west' | 'ap-southeast';
  size: 'micro' | 'small' | 'medium' | 'large' | 'xlarge';
  status: 'active' | 'creating' | 'updating' | 'backing_up' | 'restoring' | 'stopped';
  connectionString: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslRequired: boolean;
  metrics: {
    connections: number;
    queries: number;
    storage: number; // MB
    maxStorage: number; // MB
    cpu: number; // percentage
    memory: number; // percentage
    iops: number;
  };
  backups: DatabaseBackup[];
  replicas: DatabaseReplica[];
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseBackup {
  id: number;
  instanceId: number;
  name: string;
  size: number; // MB
  type: 'manual' | 'automatic' | 'snapshot';
  status: 'completed' | 'in_progress' | 'failed';
  createdAt: Date;
}

interface DatabaseReplica {
  id: number;
  primaryId: number;
  name: string;
  region: string;
  status: 'active' | 'syncing' | 'failed';
  lag: number; // seconds
}

interface DatabaseHostingProps {
  projectId: number;
}

export function DatabaseHosting({ projectId }: DatabaseHostingProps) {
  const queryClient = useQueryClient();
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseInstance | null>(null);
  const [showNewDatabase, setShowNewDatabase] = useState(false);
  const [showQueryConsole, setShowQueryConsole] = useState(false);
  const [query, setQuery] = useState('');
  const [databaseConfig, setDatabaseConfig] = useState({
    name: '',
    type: 'postgres',
    version: '14',
    region: 'us-east',
    size: 'small'
  });

  // Fetch databases
  const { data: databases = [] } = useQuery<DatabaseInstance[]>({
    queryKey: ['/api/database-hosting', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/database-hosting/${projectId}`, undefined);
      return res.json();
    }
  });

  // Create database
  const createDatabaseMutation = useMutation({
    mutationFn: (data: typeof databaseConfig) =>
      apiRequest('POST', `/api/database-hosting/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database-hosting', projectId] });
      setShowNewDatabase(false);
      toast({
        title: "Database created",
        description: "Your database is being provisioned"
      });
    }
  });

  // Create backup
  const createBackupMutation = useMutation({
    mutationFn: (databaseId: number) =>
      apiRequest('POST', `/api/database-hosting/${projectId}/${databaseId}/backup`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database-hosting', projectId] });
      toast({
        title: "Backup started",
        description: "Your database backup is in progress"
      });
    }
  });

  // Execute query
  const executeQueryMutation = useMutation({
    mutationFn: async ({ databaseId, query }: { databaseId: number; query: string }) => {
      const res = await apiRequest('POST', `/api/database-hosting/${projectId}/${databaseId}/query`, { query });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Query executed",
        description: `Returned ${data.rows?.length || 0} rows`
      });
    }
  });

  const getDatabaseIcon = (type: DatabaseInstance['type']) => {
    switch (type) {
      case 'postgres':
        return <Database className="h-5 w-5 text-blue-600" />;
      case 'mysql':
        return <Database className="h-5 w-5 text-orange-600" />;
      case 'mongodb':
        return <Database className="h-5 w-5 text-green-600" />;
      case 'redis':
        return <Database className="h-5 w-5 text-red-600" />;
      case 'sqlite':
        return <Database className="h-5 w-5 text-gray-600" />;
      default:
        return <Database className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: DatabaseInstance['status']) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'creating': return 'text-blue-600';
      case 'updating': return 'text-yellow-600';
      case 'backing_up': return 'text-purple-600';
      case 'stopped': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getSizeSpecs = (size: DatabaseInstance['size']) => {
    const specs = {
      micro: { cpu: '0.5 vCPU', memory: '1 GB', storage: '10 GB', price: 5 },
      small: { cpu: '1 vCPU', memory: '2 GB', storage: '25 GB', price: 15 },
      medium: { cpu: '2 vCPU', memory: '4 GB', storage: '50 GB', price: 30 },
      large: { cpu: '4 vCPU', memory: '8 GB', storage: '100 GB', price: 60 },
      xlarge: { cpu: '8 vCPU', memory: '16 GB', storage: '200 GB', price: 120 }
    };
    return specs[size];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Hosting</h2>
          <p className="text-muted-foreground">
            Managed databases with automatic backups, scaling, and monitoring
          </p>
        </div>
        <Button onClick={() => setShowNewDatabase(true)}>
          <Database className="h-4 w-4 mr-2" />
          New Database
        </Button>
      </div>

      {/* Database List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {databases.map(database => {
          const specs = getSizeSpecs(database.size);
          const storagePercentage = (database.metrics.storage / database.metrics.maxStorage) * 100;

          return (
            <Card 
              key={database.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedDatabase(database)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getDatabaseIcon(database.type)}
                    <div>
                      <CardTitle className="text-[15px]">{database.name}</CardTitle>
                      <CardDescription>
                        {database.type} v{database.version}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(database.status)}>
                    {database.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Region</span>
                    <span className="font-medium">{database.region}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Storage</span>
                      <span>{(database.metrics.storage / 1024).toFixed(1)} / {(database.metrics.maxStorage / 1024).toFixed(0)} GB</span>
                    </div>
                    <Progress value={storagePercentage} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{database.metrics.connections} conn</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      <span>{database.metrics.queries}/s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Size</span>
                    <Badge variant="secondary">{specs.cpu} • {specs.memory}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* New Database Form */}
      {showNewDatabase && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Database Name</Label>
                <Input
                  placeholder="my-database"
                  value={databaseConfig.name}
                  onChange={(e) => setDatabaseConfig({ ...databaseConfig, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Database Type</Label>
                <Select
                  value={databaseConfig.type}
                  onValueChange={(value: any) => setDatabaseConfig({ ...databaseConfig, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={databaseConfig.version}
                  onValueChange={(value: any) => setDatabaseConfig({ ...databaseConfig, version: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {databaseConfig.type === 'postgres' && (
                      <>
                        <SelectItem value="14">14</SelectItem>
                        <SelectItem value="13">13</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                      </>
                    )}
                    {databaseConfig.type === 'mysql' && (
                      <>
                        <SelectItem value="8.0">8.0</SelectItem>
                        <SelectItem value="5.7">5.7</SelectItem>
                      </>
                    )}
                    {databaseConfig.type === 'mongodb' && (
                      <>
                        <SelectItem value="5.0">5.0</SelectItem>
                        <SelectItem value="4.4">4.4</SelectItem>
                      </>
                    )}
                    {databaseConfig.type === 'redis' && (
                      <>
                        <SelectItem value="6.2">6.2</SelectItem>
                        <SelectItem value="6.0">6.0</SelectItem>
                      </>
                    )}
                    {databaseConfig.type === 'sqlite' && (
                      <SelectItem value="3.36">3.36</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={databaseConfig.region}
                  onValueChange={(value: any) => setDatabaseConfig({ ...databaseConfig, region: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east">US East</SelectItem>
                    <SelectItem value="us-west">US West</SelectItem>
                    <SelectItem value="eu-west">EU West</SelectItem>
                    <SelectItem value="ap-southeast">Asia Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instance Size</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['micro', 'small', 'medium', 'large', 'xlarge'] as const).map(size => {
                  const specs = getSizeSpecs(size);
                  return (
                    <Card 
                      key={size}
                      className={cn(
                        "cursor-pointer transition-colors",
                        databaseConfig.size === size && "ring-2 ring-primary"
                      )}
                      onClick={() => setDatabaseConfig({ ...databaseConfig, size })}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          <h4 className="font-medium capitalize">{size}</h4>
                          <p className="text-[11px] text-muted-foreground">
                            {specs.cpu} • {specs.memory} • {specs.storage}
                          </p>
                          <p className="text-[13px] font-medium">
                            ${specs.price}/month
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => createDatabaseMutation.mutate(databaseConfig)}
                disabled={!databaseConfig.name || createDatabaseMutation.isPending}
              >
                {createDatabaseMutation.isPending ? 'Creating...' : 'Create Database'}
              </Button>
              <Button variant="outline" onClick={() => setShowNewDatabase(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Database Details */}
      {selectedDatabase && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getDatabaseIcon(selectedDatabase.type)}
                <CardTitle>{selectedDatabase.name}</CardTitle>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedDatabase(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="backups">Backups</TabsTrigger>
                <TabsTrigger value="query">Query Console</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[13px]">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className={getStatusColor(selectedDatabase.status)}>
                        {selectedDatabase.status}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[13px]">Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">
                        {selectedDatabase.type} v{selectedDatabase.version}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[13px]">Region</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium uppercase">{selectedDatabase.region}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[13px]">Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium capitalize">{selectedDatabase.size}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => createBackupMutation.mutate(selectedDatabase.id)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Backup Now
                    </Button>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Restart
                    </Button>
                    <Button variant="outline" size="sm">
                      <Upload className="h-3 w-3 mr-1" />
                      Import Data
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowQueryConsole(true)}
                    >
                      <Terminal className="h-3 w-3 mr-1" />
                      Query Console
                    </Button>
                  </CardContent>
                </Card>

                {selectedDatabase.replicas.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Read Replicas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedDatabase.replicas.map(replica => (
                          <div key={replica.id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <p className="font-medium">{replica.name}</p>
                              <p className="text-[13px] text-muted-foreground">{replica.region}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant={replica.status === 'active' ? 'default' : 'secondary'}>
                                {replica.status}
                              </Badge>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Lag: {replica.lag}s
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="connection" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Connection Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <div className="flex gap-2">
                        <Input value={selectedDatabase.host} readOnly />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedDatabase.host);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Input value={selectedDatabase.port} readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label>Database</Label>
                        <Input value={selectedDatabase.database} readOnly />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={selectedDatabase.username} readOnly />
                    </div>

                    <div className="space-y-2">
                      <Label>Connection String</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={selectedDatabase.connectionString} 
                          type="password"
                          readOnly 
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedDatabase.connectionString);
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {selectedDatabase.sslRequired && (
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        SSL connection required
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span>CPU Usage</span>
                          <span>{selectedDatabase.metrics.cpu}%</span>
                        </div>
                        <Progress value={selectedDatabase.metrics.cpu} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span>Memory Usage</span>
                          <span>{selectedDatabase.metrics.memory}%</span>
                        </div>
                        <Progress value={selectedDatabase.metrics.memory} />
                      </div>
                      <div className="flex items-center justify-between text-[13px]">
                        <span>IOPS</span>
                        <span className="font-medium">{selectedDatabase.metrics.iops}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Active Connections</span>
                        <span className="font-medium">{selectedDatabase.metrics.connections}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Queries/sec</span>
                        <span className="font-medium">{selectedDatabase.metrics.queries}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Storage Used</span>
                        <span className="font-medium">
                          {(selectedDatabase.metrics.storage / 1024).toFixed(1)} GB
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="backups" className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[15px] font-semibold">Database Backups</h3>
                  <Button size="sm">Configure Schedule</Button>
                </div>

                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {selectedDatabase.backups.map(backup => (
                      <Card key={backup.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{backup.name}</p>
                              <p className="text-[13px] text-muted-foreground">
                                {new Date(backup.createdAt).toLocaleString()} • {backup.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={backup.status === 'completed' ? 'default' : 'secondary'}>
                                {backup.status}
                              </Badge>
                              <span className="text-[13px] font-medium">
                                {(backup.size / 1024).toFixed(1)} GB
                              </span>
                              <Button variant="outline" size="sm">
                                Restore
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="query" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Query Console</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Enter your SQL query..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="font-mono min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => executeQueryMutation.mutate({
                          databaseId: selectedDatabase.id,
                          query
                        })}
                        disabled={!query || executeQueryMutation.isPending}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Execute Query
                      </Button>
                      <Button variant="outline" onClick={() => setQuery('')}>
                        Clear
                      </Button>
                    </div>

                    {executeQueryMutation.data && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Results</h4>
                        <div className="border rounded overflow-auto max-h-96">
                          <pre className="p-4 text-[11px]">
                            {JSON.stringify(executeQueryMutation.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}