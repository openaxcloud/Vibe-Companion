import { useState } from 'react';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Database,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  FileText,
  Rocket,
  Key,
  Plus,
  Table as TableIcon,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Server,
  HardDrive,
  Users,
  Calendar,
  Loader2,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

interface TableInfo {
  name: string;
  displayName: string;
  rowCount: number;
  description: string;
  icon: string;
  columns?: TableColumn[];
}

interface ProjectDataTablesResponse {
  projectId: string;
  projectName: string;
  tables: TableInfo[];
  totalTables: number;
}

interface TableDataResponse {
  tableName: string;
  projectId: string;
  rows: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface DatabaseInfo {
  provisioned: boolean;
  status?: 'running' | 'stopped' | 'error' | 'provisioning';
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  storageUsedMb?: number;
  storageLimitMb?: number;
  connectionCount?: number;
  maxConnections?: number;
  lastBackupAt?: string;
  plan?: string;
  region?: string;
}

interface DatabaseCredentials {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  connectionUrl: string;
}

interface ProvisionRequest {
  plan: string;
  region: string;
}

interface BackupInfo {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  backupType: 'scheduled' | 'manual' | 'pre_migration' | 'pitr';
  sizeBytes?: number;
  restorePoint?: string;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
}

interface BackupsResponse {
  backups: BackupInfo[];
}

interface MobileDatabasePanelProps {
  projectId: string;
  className?: string;
}

const iconMap: Record<string, any> = {
  FileText,
  Rocket,
  Key,
  Database
};

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free', storage: '500MB' },
  { value: 'starter', label: 'Starter', storage: '2GB' },
  { value: 'pro', label: 'Pro', storage: '10GB' },
  { value: 'enterprise', label: 'Enterprise', storage: '100GB' },
];

const REGION_OPTIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-muted rounded-lg overflow-hidden relative skeleton-shimmer", className)} />
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ShimmerSkeleton className="w-[18px] h-[18px] rounded" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-4 w-32" />
              <ShimmerSkeleton className="h-3 w-48" />
            </div>
            <ShimmerSkeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DataRowSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-center justify-between">
              <ShimmerSkeleton className="h-3 w-20" />
              <ShimmerSkeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Database className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
      <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2 text-center">
        No Data Available
      </h3>
      <p className="text-[15px] leading-[20px] text-muted-foreground text-center mb-6 max-w-[280px]">
        This project doesn't have any data tables yet. Create your first table to get started.
      </p>
      {onAction && (
        <Button
          onClick={onAction}
          className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[15px] font-medium"
          data-testid="button-create-table"
        >
          <Plus className="w-[18px] h-[18px] mr-2" />
          Create Table
        </Button>
      )}
    </div>
  );
}

export function MobileDatabasePanel({ projectId, className }: MobileDatabasePanelProps) {
  const [selectedTable, setSelectedTable] = useState<string>('files');
  const [activeTab, setActiveTab] = useState<'provision' | 'tables' | 'data' | 'backups'>('provision');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(['files']));
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [selectedRegion, setSelectedRegion] = useState<string>('us-east-1');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const { toast } = useToast();

  const { data: databaseInfo, isLoading: databaseInfoLoading, refetch: refetchDatabaseInfo } = useQuery<DatabaseInfo>({
    queryKey: ['/api/database/project', projectId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/database/project/${projectId}`);
        return response;
      } catch (error: any) {
        if (error?.status === 404) {
          return { provisioned: false };
        }
        throw error;
      }
    },
    staleTime: 30000,
    enabled: !!projectId
  });

  const { data: credentials, isLoading: credentialsLoading, refetch: refetchCredentials } = useQuery<DatabaseCredentials>({
    queryKey: ['/api/database/project', projectId, 'credentials'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/database/project/${projectId}/credentials`);
      return response;
    },
    staleTime: 60000,
    enabled: !!projectId && databaseInfo?.provisioned === true
  });

  const provisionMutation = useMutation({
    mutationFn: async (data: ProvisionRequest) => {
      return apiRequest('POST', `/api/database/project/${projectId}/provision`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId] });
      toast({
        title: 'Database Provisioned',
        description: 'Your PostgreSQL database is being provisioned.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Provisioning Failed',
        description: error.message || 'Failed to provision database',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/database/project/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId] });
      toast({
        title: 'Database Deleted',
        description: 'Your database has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete database',
        variant: 'destructive',
      });
    },
  });

  const { data: backupsData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery<BackupsResponse>({
    queryKey: ['/api/database/project', projectId, 'backups'],
    queryFn: async () => {
      return apiRequest('GET', `/api/database/project/${projectId}/backups`);
    },
    staleTime: 30000,
    enabled: !!projectId && databaseInfo?.provisioned === true
  });

  const createBackupMutation = useMutation({
    mutationFn: async (data: { name?: string; backupType?: string }) => {
      return apiRequest('POST', `/api/database/project/${projectId}/backups`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId, 'backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId] });
      toast({
        title: 'Backup Created',
        description: 'Your database backup has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Backup Failed',
        description: error.message || 'Failed to create backup',
        variant: 'destructive',
      });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: number) => {
      return apiRequest('POST', `/api/database/project/${projectId}/backups/${backupId}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId, 'backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId] });
      toast({
        title: 'Restore Started',
        description: 'Database restore is in progress.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore backup',
        variant: 'destructive',
      });
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: number) => {
      return apiRequest('DELETE', `/api/database/project/${projectId}/backups/${backupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database/project', projectId, 'backups'] });
      toast({
        title: 'Backup Deleted',
        description: 'Backup has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete backup',
        variant: 'destructive',
      });
    },
  });

  const { data: tablesData, isLoading: tablesLoading, error: tablesError, refetch: refetchTables } = useQuery<ProjectDataTablesResponse>({
    queryKey: ['/api/projects', projectId, 'data/tables'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/data/tables`);
      return response;
    },
    staleTime: 30000,
    enabled: activeTab === 'tables' || activeTab === 'data'
  });

  const { data: tableData, isLoading: dataLoading } = useQuery<TableDataResponse>({
    queryKey: ['/api/projects', projectId, 'data', selectedTable, 'page', currentPage],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/data/${selectedTable}/data?page=${currentPage}&limit=100`);
      return response;
    },
    enabled: !!selectedTable && activeTab === 'data',
    staleTime: 30000
  });

  const allTables = tablesData?.tables || [];
  
  const schemasQueries = useQueries({
    queries: allTables.map(table => ({
      queryKey: ['/api/projects', projectId, 'data', table.name, 'schema'],
      queryFn: async () => {
        const response = await apiRequest('GET', `/api/projects/${projectId}/data/${table.name}/schema`);
        return response;
      },
      enabled: expandedTables.has(table.name),
      staleTime: 60000
    }))
  });

  const getSchemaForTable = (tableName: string) => {
    const queryIndex = schemasQueries.findIndex(
      (query) => query.data && (query.data as any).tableName === tableName
    );
    if (queryIndex !== -1) return schemasQueries[queryIndex];
    
    const matchingQuery = schemasQueries.find((_, idx) => {
      const table = allTables[idx];
      return table && table.name === tableName;
    });
    
    return matchingQuery;
  };

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(1);
    setActiveTab('data');
  };

  const handleNextPage = () => {
    if (tableData?.pagination.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (tableData?.pagination.hasPrevPage) {
      setCurrentPage(prev => Math.max(1, prev - 1));
    }
  };

  const handleRefresh = () => {
    refetchTables();
    refetchDatabaseInfo();
    toast({
      title: "Refreshed",
      description: "Project data reloaded"
    });
  };

  const handleProvision = () => {
    provisionMutation.mutate({ plan: selectedPlan, region: selectedRegion });
  };

  const handleCopyConnectionUrl = async () => {
    if (credentials?.connectionUrl) {
      try {
        await navigator.clipboard.writeText(credentials.connectionUrl);
        toast({
          title: 'Copied',
          description: 'Connection URL copied to clipboard',
        });
      } catch {
        toast({
          title: 'Copy Failed',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Running</Badge>;
      case 'stopped':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Stopped</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30">Error</Badge>;
      case 'provisioning':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">Provisioning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const storagePercentage = databaseInfo?.storageLimitMb 
    ? ((databaseInfo.storageUsedMb || 0) / databaseInfo.storageLimitMb) * 100 
    : 0;

  const connectionPercentage = databaseInfo?.maxConnections 
    ? ((databaseInfo.connectionCount || 0) / databaseInfo.maxConnections) * 100 
    : 0;

  const Icon = selectedTable && tablesData?.tables.find(t => t.name === selectedTable)
    ? iconMap[tablesData.tables.find(t => t.name === selectedTable)!.icon] || Database
    : Database;

  return (
    <div className={cn("flex flex-col h-full bg-background", className)} data-testid="mobile-database-panel">
      <div className="p-4 border-b border-border min-h-[56px] flex flex-col justify-center space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-medium leading-tight text-foreground flex items-center gap-2">
            <Database className="w-[18px] h-[18px] text-primary" />
            Project Data
          </h3>
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={tablesLoading || databaseInfoLoading}
            className="w-11 h-11 p-0 rounded-lg hover:bg-muted"
            data-testid="button-refresh-database"
          >
            <RefreshCw className={cn("w-[18px] h-[18px] text-muted-foreground", (tablesLoading || databaseInfoLoading) && "animate-spin")} />
          </Button>
        </div>

        {tablesData && (
          <div className="text-[13px] text-muted-foreground">
            {tablesData.projectName} • {tablesData.totalTables} data sources
          </div>
        )}
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('provision')}
          className={cn(
            "flex-1 min-w-0 h-10 text-[13px] font-medium border-b-2 transition-colors px-1",
            activeTab === 'provision'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-provision"
        >
          DB
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          className={cn(
            "flex-1 min-w-0 h-10 text-[13px] font-medium border-b-2 transition-colors px-1",
            activeTab === 'tables'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-tables"
        >
          Tables
        </button>
        <button
          onClick={() => setActiveTab('data')}
          disabled={!selectedTable}
          className={cn(
            "flex-1 min-w-0 h-10 text-[13px] font-medium border-b-2 transition-colors px-1",
            activeTab === 'data'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
            !selectedTable && "opacity-50 cursor-not-allowed"
          )}
          data-testid="tab-data"
        >
          Data
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          disabled={!databaseInfo?.provisioned}
          className={cn(
            "flex-1 min-w-0 h-10 text-[13px] font-medium border-b-2 transition-colors px-1",
            activeTab === 'backups'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
            !databaseInfo?.provisioned && "opacity-50 cursor-not-allowed"
          )}
          data-testid="tab-backups"
        >
          Backups
        </button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'provision' && (
          <div className="p-4">
            {databaseInfoLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : databaseInfo?.provisioned ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground text-[15px]">PostgreSQL</h4>
                      <p className="text-[13px] text-muted-foreground">{databaseInfo.plan} • {databaseInfo.region}</p>
                    </div>
                  </div>
                  {getStatusBadge(databaseInfo.status)}
                </div>

                <div className="border border-border rounded-lg p-4 space-y-4">
                  <h5 className="font-medium text-foreground flex items-center gap-2 text-[15px]">
                    <Key className="h-4 w-4" />
                    Connection Info
                  </h5>
                  
                  {credentialsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : credentials ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between min-h-[40px]">
                        <span className="text-[13px] text-muted-foreground">Host</span>
                        <code className="text-[13px] font-mono text-foreground bg-muted px-2 py-1 rounded" data-testid="text-host">
                          {credentials.host}
                        </code>
                      </div>
                      <div className="flex items-center justify-between min-h-[40px]">
                        <span className="text-[13px] text-muted-foreground">Port</span>
                        <code className="text-[13px] font-mono text-foreground bg-muted px-2 py-1 rounded" data-testid="text-port">
                          {credentials.port}
                        </code>
                      </div>
                      <div className="flex items-center justify-between min-h-[40px]">
                        <span className="text-[13px] text-muted-foreground">Database</span>
                        <code className="text-[13px] font-mono text-foreground bg-muted px-2 py-1 rounded" data-testid="text-database-name">
                          {credentials.databaseName}
                        </code>
                      </div>
                      <div className="flex items-center justify-between min-h-[40px]">
                        <span className="text-[13px] text-muted-foreground">Username</span>
                        <code className="text-[13px] font-mono text-foreground bg-muted px-2 py-1 rounded" data-testid="text-username">
                          {credentials.username}
                        </code>
                      </div>
                      <div className="flex items-center justify-between min-h-[40px]">
                        <span className="text-[13px] text-muted-foreground">Password</span>
                        <div className="flex items-center gap-2">
                          <code className="text-[13px] font-mono text-foreground bg-muted px-2 py-1 rounded" data-testid="text-password">
                            {showPassword ? credentials.password : '••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full h-11 mt-2"
                        onClick={handleCopyConnectionUrl}
                        data-testid="button-copy-connection-url"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Connection URL
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">Unable to load credentials</p>
                  )}
                </div>

                <div className="border border-border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-foreground flex items-center gap-2 text-[15px]">
                    <HardDrive className="h-4 w-4" />
                    Storage
                  </h5>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Used</span>
                    <span className="text-foreground" data-testid="text-storage-usage">
                      {databaseInfo.storageUsedMb?.toFixed(1) || 0} / {databaseInfo.storageLimitMb || 0} MB
                    </span>
                  </div>
                  <Progress value={storagePercentage} className="h-2" data-testid="progress-storage" />
                </div>

                <div className="border border-border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-foreground flex items-center gap-2 text-[15px]">
                    <Users className="h-4 w-4" />
                    Connections
                  </h5>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Active</span>
                    <span className="text-foreground" data-testid="text-connection-count">
                      {databaseInfo.connectionCount || 0} / {databaseInfo.maxConnections || 0}
                    </span>
                  </div>
                  <Progress value={connectionPercentage} className="h-2" data-testid="progress-connections" />
                </div>

                {databaseInfo.lastBackupAt && (
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[13px] text-muted-foreground">Last Backup</span>
                      </div>
                      <span className="text-[13px] text-foreground" data-testid="text-last-backup">
                        {new Date(databaseInfo.lastBackupAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full h-11"
                      data-testid="button-delete-database"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Database
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Database?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All data will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(undefined)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h4 className="text-[17px] font-medium text-foreground mb-2">No Database</h4>
                  <p className="text-[15px] text-muted-foreground max-w-[280px] mx-auto">
                    Provision a dedicated PostgreSQL database for your project
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[15px] font-medium text-foreground mb-2 block">Plan</label>
                    <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                      <SelectTrigger className="h-11" data-testid="select-plan">
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_OPTIONS.map((plan) => (
                          <SelectItem key={plan.value} value={plan.value} data-testid={`option-plan-${plan.value}`}>
                            {plan.label} ({plan.storage})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[15px] font-medium text-foreground mb-2 block">Region</label>
                    <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                      <SelectTrigger className="h-11" data-testid="select-region">
                        <SelectValue placeholder="Select a region" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map((region) => (
                          <SelectItem key={region.value} value={region.value} data-testid={`option-region-${region.value}`}>
                            {region.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full h-11"
                    onClick={handleProvision}
                    disabled={provisionMutation.isPending}
                    data-testid="button-provision-database"
                  >
                    {provisionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    Provision Database
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="p-4 space-y-3">
            {tablesLoading && <TableSkeleton />}

            {tablesError && (
              <div className="text-center py-16">
                <Database className="w-12 h-12 text-muted-foreground opacity-40 mx-auto mb-4" />
                <p className="text-[15px] text-muted-foreground">Failed to load project data</p>
                <Button
                  onClick={() => refetchTables()}
                  className="h-11 mt-4 px-6 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Try Again
                </Button>
              </div>
            )}

            {tablesData && tablesData.tables.length === 0 && (
              <EmptyState onAction={() => {}} />
            )}

            {tablesData && tablesData.tables.map((table) => {
              const TableIconComponent = iconMap[table.icon] || Database;
              const isExpanded = expandedTables.has(table.name);

              return (
                <div
                  key={table.name}
                  className="border border-border rounded-lg overflow-hidden bg-card animate-fade-in"
                  data-testid={`table-${table.name}`}
                >
                  <div className="flex items-center justify-between p-4 hover:bg-muted transition-colors cursor-pointer">
                    <div
                      className="flex items-center gap-3 flex-1 min-h-[44px]"
                      onClick={() => handleTableSelect(table.name)}
                    >
                      <TableIconComponent className="w-[18px] h-[18px] text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-foreground leading-[20px]">
                          {table.displayName}
                        </div>
                        <div className="text-[13px] text-muted-foreground truncate">
                          {table.description}
                        </div>
                      </div>
                      <Badge className="bg-muted text-muted-foreground border-border text-[11px] uppercase tracking-wider">
                        {table.rowCount} rows
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTableExpansion(table.name);
                      }}
                      className="w-11 h-11 p-0 rounded-lg hover:bg-accent ml-2"
                      data-testid={`button-expand-${table.name}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-[18px] h-[18px] text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  <div className={`collapsible-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
                    {isExpanded && (() => {
                      const schemaQuery = getSchemaForTable(table.name);
                      const schemaData = schemaQuery?.data;
                      const schemaLoading = schemaQuery?.isLoading;

                      return (
                        <div className="border-t border-border bg-background p-4 space-y-3">
                          {schemaLoading && (
                            <div className="space-y-2">
                              {[1, 2, 3].map((i) => (
                                <ShimmerSkeleton key={i} className="h-8 w-full" />
                              ))}
                            </div>
                          )}

                          {schemaData && schemaData.columns && (
                            <div className="space-y-2">
                              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                                Columns
                              </div>
                              {schemaData.columns.map((col: TableColumn) => (
                                <div
                                  key={col.name}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-card min-h-[40px]"
                                  data-testid={`column-${col.name}`}
                                >
                                  <span className="font-mono text-[13px] text-foreground">{col.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] text-muted-foreground">{col.type}</span>
                                    {col.isPrimaryKey && (
                                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[11px]">
                                        PK
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="p-4 space-y-3">
            {selectedTable && (
              <div className="flex items-center gap-2 min-h-[44px]">
                <Icon className="w-[18px] h-[18px] text-primary" />
                <span className="text-[17px] font-medium text-foreground">
                  {tablesData?.tables.find(t => t.name === selectedTable)?.displayName || selectedTable}
                </span>
              </div>
            )}

            {dataLoading && <DataRowSkeleton />}

            {tableData && tableData.rows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <TableIcon className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2">
                  No Data
                </h3>
                <p className="text-[15px] leading-[20px] text-muted-foreground text-center">
                  This table is empty
                </p>
              </div>
            )}

            {tableData && tableData.rows.length > 0 && (
              <div className="space-y-3">
                <div className="text-[13px] text-muted-foreground">
                  Showing {tableData.rows.length} of {tableData.pagination.total} rows
                </div>

                {tableData.rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-lg p-4 space-y-3 bg-card animate-fade-in"
                    data-testid={`row-${idx}`}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3">
                        <span className="text-[13px] font-medium text-muted-foreground shrink-0">
                          {key}:
                        </span>
                        <span className="text-[13px] font-mono text-foreground text-right break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                <h4 className="text-[17px] font-medium text-foreground">Database Backups</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetchBackups()}
                  disabled={backupsLoading}
                  className="h-9 w-9"
                  data-testid="button-refresh-backups"
                >
                  <RefreshCw className={cn("h-4 w-4", backupsLoading && "animate-spin")} />
                </Button>
                <Button
                  onClick={() => createBackupMutation.mutate({ name: `Manual Backup ${new Date().toLocaleString()}`, backupType: 'manual' })}
                  disabled={createBackupMutation.isPending}
                  className="h-9"
                  data-testid="button-create-backup"
                >
                  {createBackupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Backup
                </Button>
              </div>
            </div>

            {backupsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : backupsData?.backups && backupsData.backups.length > 0 ? (
              <div className="space-y-3">
                {backupsData.backups.map((backup) => (
                  <div key={backup.id} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-foreground text-[15px]">{backup.name}</h5>
                        <p className="text-[13px] text-muted-foreground">
                          {new Date(backup.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={cn(
                        "text-[11px]",
                        backup.status === 'completed' ? "bg-green-500/10 text-green-500" :
                        backup.status === 'running' ? "bg-blue-500/10 text-blue-500" :
                        backup.status === 'failed' ? "bg-red-500/10 text-red-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {backup.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-foreground capitalize">{backup.backupType}</span>
                    </div>
                    
                    {backup.sizeBytes && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">Size</span>
                        <span className="text-foreground">{(backup.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    )}
                    
                    {backup.restorePoint && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">Restore Point</span>
                        <span className="text-foreground">{new Date(backup.restorePoint).toLocaleString()}</span>
                      </div>
                    )}

                    {backup.expiresAt && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">Expires</span>
                        <span className="text-foreground">{new Date(backup.expiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 h-10"
                            disabled={backup.status !== 'completed' || restoreBackupMutation.isPending}
                            data-testid={`button-restore-${backup.id}`}
                          >
                            Restore
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restore Database?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will restore your database to {new Date(backup.createdAt).toLocaleString()}. Current data will be replaced.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => restoreBackupMutation.mutate(backup.id)}
                              data-testid={`button-confirm-restore-${backup.id}`}
                            >
                              Restore
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-10 w-10"
                            disabled={deleteBackupMutation.isPending}
                            data-testid={`button-delete-backup-${backup.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The backup will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteBackupMutation.mutate(backup.id)}
                              className="bg-destructive hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${backup.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Archive className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2 text-center">
                  No Backups Yet
                </h3>
                <p className="text-[15px] leading-[20px] text-muted-foreground text-center mb-6 max-w-[280px]">
                  Create your first backup to protect your data
                </p>
                <Button
                  onClick={() => createBackupMutation.mutate({ name: `First Backup ${new Date().toLocaleString()}`, backupType: 'manual' })}
                  disabled={createBackupMutation.isPending}
                  className="h-11 px-6"
                  data-testid="button-create-first-backup"
                >
                  {createBackupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create First Backup
                </Button>
              </div>
            )}

            <div className="border border-border rounded-lg p-4 space-y-2">
              <h5 className="font-medium text-foreground text-[15px]">Backup Policy</h5>
              <div className="text-[13px] text-muted-foreground space-y-1">
                <p>• Automatic backups run daily when enabled</p>
                <p>• Backup retention: {databaseInfo?.plan === 'enterprise' ? '90 days' : databaseInfo?.plan === 'pro' ? '30 days' : databaseInfo?.plan === 'starter' ? '14 days' : '7 days'}</p>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {activeTab === 'data' && tableData && (tableData.pagination.hasNextPage || tableData.pagination.hasPrevPage) && (
        <div
          className="border-t border-border bg-card p-4 flex items-center justify-between"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <Button
            variant="outline"
            disabled={!tableData.pagination.hasPrevPage}
            onClick={handlePrevPage}
            className="h-10 px-4 rounded-lg border-border bg-muted text-foreground hover:bg-accent disabled:opacity-50"
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="text-[13px] text-muted-foreground">
            Page {tableData.pagination.page} of {tableData.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={!tableData.pagination.hasNextPage}
            onClick={handleNextPage}
            className="h-10 px-4 rounded-lg border-border bg-muted text-foreground hover:bg-accent disabled:opacity-50"
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
