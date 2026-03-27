// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Database,
  Table,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Search,
  Settings,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  MoreVertical,
  Terminal,
  LayoutGrid,
  List,
  Filter,
  Columns,
  Plus,
  Calendar,
  Info,
  Grid3X3,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface DatabasePanelProps {
  projectId: string;
}

interface TableInfo {
  name: string;
  displayName: string;
  icon: 'table' | 'file' | 'key' | 'rocket';
  rowCount: number;
}

interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
}

interface ProjectDataTablesResponse {
  tables: TableInfo[];
}

interface TableSchemaResponse {
  tableName: string;
  columns: TableColumn[];
}

interface TableDataResponse {
  tableName: string;
  data: any[];
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
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
  computeHours?: number;
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
  provider?: string;
}

type DatabaseView = 'all' | 'development' | 'production';
type DetailTab = 'overview' | 'mydata' | 'settings';

const HISTORY_RETENTION_OPTIONS = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
];

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const { toast } = useToast();
  
  const [currentView, setCurrentView] = useState<DatabaseView>('all');
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('overview');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showDatabaseUrl, setShowDatabaseUrl] = useState<boolean>(false);
  const [historyRetention, setHistoryRetention] = useState<string>('7');
  const [restoreDate, setRestoreDate] = useState<string>('');
  const [restoreTime, setRestoreTime] = useState<string>('');
  const [restoreTimezone, setRestoreTimezone] = useState<string>('Asia/Jerusalem');
  const [readOnlyMode, setReadOnlyMode] = useState<boolean>(true);
  const [tableRowsCount, setTableRowsCount] = useState<boolean>(true);
  const [expandSubviews, setExpandSubviews] = useState<boolean>(false);
  const [paginationType, setPaginationType] = useState<'limit' | 'pages'>('limit');
  const [flatSchemas, setFlatSchemas] = useState<boolean>(false);
  const [showByteaAs, setShowByteaAs] = useState<'hex' | 'utf8'>('hex');
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [showSqlConsole, setShowSqlConsole] = useState<boolean>(false);
  const [autoRetryAttempted, setAutoRetryAttempted] = useState<boolean>(false);

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

  useEffect(() => {
    if (
      databaseInfo?.status === 'error' && 
      !autoRetryAttempted && 
      !provisionMutation.isPending &&
      projectId
    ) {
      setAutoRetryAttempted(true);
      const retryTimer = setTimeout(() => {
        provisionMutation.mutate({ plan: 'free', region: 'us-east-1' });
      }, 1000);
      return () => clearTimeout(retryTimer);
    }
  }, [databaseInfo?.status, autoRetryAttempted, provisionMutation.isPending, projectId]);

  useEffect(() => {
    if (databaseInfo?.status === 'running' && autoRetryAttempted) {
      setAutoRetryAttempted(false);
    }
  }, [databaseInfo?.status, autoRetryAttempted]);

  useEffect(() => {
    if (
      databaseInfo?.provisioned === false && 
      !databaseInfo?.status &&
      !autoRetryAttempted && 
      !provisionMutation.isPending &&
      !databaseInfoLoading &&
      projectId
    ) {
      setAutoRetryAttempted(true);
      const provisionTimer = setTimeout(() => {
        provisionMutation.mutate({ plan: 'free', region: 'us-east-1' });
      }, 1500);
      return () => clearTimeout(provisionTimer);
    }
  }, [databaseInfo?.provisioned, databaseInfo?.status, autoRetryAttempted, provisionMutation.isPending, databaseInfoLoading, projectId]);

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
      setCurrentView('all');
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete database',
        variant: 'destructive',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (data: { timestamp: string; timezone: string }) => {
      return apiRequest('POST', `/api/database/project/${projectId}/restore`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Restore Initiated',
        description: 'Point-in-time restore has been initiated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore database',
        variant: 'destructive',
      });
    },
  });

  const [sqlResults, setSqlResults] = useState<{ rows: any[]; rowCount: number; fields: any[] } | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const executeSqlMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest('POST', `/api/database/project/${projectId}/sql/execute`, { query });
    },
    onSuccess: (data) => {
      setSqlResults(data);
      setSqlError(null);
      toast({
        title: 'Query Executed',
        description: `Returned ${data.rowCount || 0} rows in ${data.executionTime || 0}ms`,
      });
    },
    onError: (error: any) => {
      setSqlError(error.message || 'Query execution failed');
      setSqlResults(null);
      toast({
        title: 'Query Failed',
        description: error.message || 'Failed to execute query',
        variant: 'destructive',
      });
    },
  });

  const handleExecuteSql = () => {
    if (!sqlQuery.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a SQL query',
        variant: 'destructive',
      });
      return;
    }
    executeSqlMutation.mutate(sqlQuery);
  };

  const { data: tablesData, isLoading: tablesLoading, refetch: refetchTables } = useQuery<ProjectDataTablesResponse>({
    queryKey: isAdmin ? ['/api/admin/database/tables'] : ['/api/projects', projectId, 'data/tables'],
    queryFn: async () => {
      const endpoint = isAdmin 
        ? '/api/admin/database/tables'
        : `/api/projects/${projectId}/data/tables`;
      const response = await apiRequest('GET', endpoint);
      return response;
    },
    staleTime: 30000,
    enabled: (isAdmin || !!projectId) && currentView !== 'all'
  });

  const allTables = tablesData?.tables || [];

  useEffect(() => {
    if (allTables.length > 0 && !selectedTable) {
      setSelectedTable(allTables[0].name);
    }
  }, [allTables, selectedTable]);

  const tableExists = allTables.some(t => t.name === selectedTable);
  
  const { data: tableData, isLoading: dataLoading } = useQuery<TableDataResponse>({
    queryKey: isAdmin 
      ? ['/api/admin/database', selectedTable, 'data', 'page', currentPage]
      : ['/api/projects', projectId, 'data', selectedTable, 'page', currentPage],
    queryFn: async () => {
      const endpoint = isAdmin
        ? `/api/admin/database/${selectedTable}/data?page=${currentPage}&limit=50`
        : `/api/projects/${projectId}/data/${selectedTable}/data?page=${currentPage}&limit=50`;
      const res = await apiRequest('GET', endpoint);
      return res;
    },
    enabled: !!selectedTable && tableExists && activeDetailTab === 'mydata',
    staleTime: 30000
  });

  const { data: tableSchema } = useQuery<TableSchemaResponse>({
    queryKey: isAdmin
      ? ['/api/admin/database', selectedTable, 'schema']
      : ['/api/projects', projectId, 'data', selectedTable, 'schema'],
    queryFn: async () => {
      const endpoint = isAdmin
        ? `/api/admin/database/${selectedTable}/schema`
        : `/api/projects/${projectId}/data/${selectedTable}/schema`;
      const response = await apiRequest('GET', endpoint);
      return response;
    },
    enabled: !!selectedTable && tableExists && activeDetailTab === 'mydata',
    staleTime: 60000
  });

  const handleRefresh = () => {
    refetchTables();
    refetchDatabaseInfo();
    toast({
      title: 'Refreshed',
      description: 'Database information refreshed'
    });
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleRestore = () => {
    if (!restoreDate) {
      toast({
        title: 'Missing Date',
        description: 'Please select a date for restoration',
        variant: 'destructive',
      });
      return;
    }
    const timestamp = `${restoreDate}T${restoreTime || '00:00:00'}`;
    restoreMutation.mutate({ timestamp, timezone: restoreTimezone });
  };

  const filteredTables = (allTables || []).filter(table =>
    table?.name && typeof table.name === 'string' && table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const storageUsedMb = databaseInfo?.storageUsedMb || 0;
  const storageLimitMb = databaseInfo?.storageLimitMb || 1024;
  const storagePercentage = storageLimitMb > 0 ? (storageUsedMb / storageLimitMb) * 100 : 0;
  const computeHours = databaseInfo?.computeHours || 0;

  const formatStorage = (mb: number, limitMb: number) => {
    if (limitMb >= 1024) {
      return `${mb.toFixed(2)}MB / ${(limitMb / 1024).toFixed(0)}GB`;
    }
    return `${mb.toFixed(2)}MB / ${limitMb}MB`;
  };

  const AllDatabasesView = () => (
    <div className="flex flex-col h-full">
      <div className="h-9 px-2.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <h3 className="text-xs font-medium text-[var(--ecode-text-muted)]">Database</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={handleRefresh}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh}>Refresh All</DropdownMenuItem>
              <DropdownMenuItem>Documentation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-3">Databases</h4>
            <div className="space-y-2">
              <button
                onClick={() => setCurrentView('development')}
                className="w-full flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid="button-development-db"
              >
                <div className="flex items-center gap-3">
                  <Table className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium text-foreground">Development Database</div>
                    <div className="text-[13px] text-muted-foreground">
                      {formatStorage(storageUsedMb, storageLimitMb)}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>

              <button
                onClick={() => setCurrentView('production')}
                className="w-full flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid="button-production-db"
              >
                <div className="flex items-center gap-3">
                  <Table className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium text-foreground">Production Database</div>
                    <div className="text-[13px] text-muted-foreground">
                      {formatStorage(storageUsedMb, storageLimitMb)}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-2">Billing Period</h4>
            <p className="text-[13px] text-muted-foreground">Renews monthly</p>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-2">Hours of Compute Used</h4>
            <p className="text-[13px] text-muted-foreground">{computeHours.toFixed(2)} hours</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  const OverviewTab = () => (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <h4 className="text-[13px] font-semibold text-foreground mb-3">Tables</h4>
        {tablesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => (
              <button
                key={table.name}
                onClick={() => {
                  setSelectedTable(table.name);
                  setActiveDetailTab('mydata');
                }}
                className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`button-table-${table.name}`}
              >
                <div className="flex items-center gap-3">
                  <Table className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] font-medium text-foreground">{table.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">{table.rowCount} rows</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
            {filteredTables.length === 0 && !tablesLoading && (
              <p className="text-[13px] text-muted-foreground text-center py-4">No tables found</p>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );

  const MyDataTab = () => (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
      <div className="w-full md:w-48 lg:w-64 border-b md:border-b-0 md:border-r border-border flex flex-col shrink-0">
        <div className="p-3 space-y-2">
          <Button
            variant={showSqlConsole ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={() => setShowSqlConsole(!showSqlConsole)}
            data-testid="button-sql-console"
          >
            <Terminal className="h-4 w-4" />
            SQL console
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            data-testid="button-database-studio"
          >
            <Database className="h-4 w-4" />
            Database studio
          </Button>
        </div>

        <div className="px-3 pb-2">
          <Select defaultValue="public">
            <SelectTrigger className="w-full" data-testid="select-schema">
              <SelectValue placeholder="schema: public" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">schema: public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 pb-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="h-8 pl-7 text-[11px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-tables"
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Filter className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[13px] hover:bg-muted",
                  selectedTable === table.name && "bg-primary/10 text-primary"
                )}
                data-testid={`button-select-${table.name}`}
              >
                <Table className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{table.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'production' && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between">
            <span className="text-[13px] text-amber-600 dark:text-amber-400">
              You're viewing your database in read-only.
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Enable Editing</span>
              <Switch
                checked={!readOnlyMode}
                onCheckedChange={(checked) => setReadOnlyMode(!checked)}
                data-testid="switch-enable-editing"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-2 sm:px-4 py-2 border-b border-border">
          <div className="flex items-center gap-1 border border-border rounded-md">
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-none">
              <List className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-none hidden sm:flex">
              <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-none hidden md:flex">
              <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-none">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-none hidden sm:flex">
              <Columns className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          <Button size="icon" className="h-7 w-7 sm:h-8 sm:w-8 bg-primary text-primary-foreground">
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-2">50</span>
            <span className="px-2">{(currentPage - 1) * 50}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!tableData?.pagination?.hasNextPage}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {showSqlConsole && (
          <div className="p-4 border-b border-border">
            <textarea
              className="w-full h-24 p-2 text-[13px] font-mono bg-muted border border-border rounded-md resize-none"
              placeholder="Enter SQL query..."
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              data-testid="textarea-sql"
            />
            <div className="flex justify-end mt-2">
              <Button 
                size="sm" 
                onClick={handleExecuteSql}
                disabled={executeSqlMutation.isPending}
                data-testid="button-execute-sql"
              >
                {executeSqlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Execute
              </Button>
            </div>
            {sqlError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-[11px]" data-testid="sql-error">
                <div>{sqlError}</div>
                {sqlError.includes('not provisioned') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => provisionMutation.mutate({ plan: 'free', region: 'us-east-1' })}
                    disabled={provisionMutation.isPending}
                  >
                    {provisionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Provision Database
                  </Button>
                )}
                {sqlError.includes('not available') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => executeSqlMutation.mutate(sqlQuery)}
                    disabled={executeSqlMutation.isPending}
                  >
                    {executeSqlMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Retry
                  </Button>
                )}
              </div>
            )}
            {sqlResults && (
              <div className="mt-2" data-testid="sql-results-container">
                <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-green-600 text-[11px] mb-2" data-testid="sql-results-summary">
                  Query executed successfully. {sqlResults.rowCount !== undefined ? `${sqlResults.rowCount} row(s)` : 'No rows'} affected/returned.
                </div>
                {sqlResults.rows && sqlResults.rows.length > 0 && (
                  <div className="max-h-48 overflow-auto border border-border rounded" data-testid="sql-results-table">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          {Object.keys(sqlResults.rows[0] || {}).map((key) => (
                            <th key={key} className="px-2 py-1 text-left font-medium text-foreground" data-testid={`sql-column-${key}`}>
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResults.rows.map((row, index) => (
                          <tr key={index} className="border-b border-border" data-testid={`sql-row-${index}`}>
                            {Object.values(row).map((value, i) => (
                              <td key={i} className="px-2 py-1 text-muted-foreground font-mono" data-testid={`sql-cell-${index}-${i}`}>
                                {value !== null && value !== undefined ? String(value) : 'null'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {dataLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="min-w-full">
              {tableSchema?.columns && tableSchema.columns.length > 0 && (
                <div className="flex border-b border-border bg-muted/50 sticky top-0">
                  <div className="w-8 p-2 border-r border-border" />
                  {tableSchema.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex-1 min-w-[150px] p-2 border-r border-border text-[11px]"
                    >
                      <div className="font-medium text-foreground">{col.name}</div>
                      <div className="text-muted-foreground">{col.type}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {tableData?.data && tableData.data.length > 0 ? (
                tableData.data.map((row, index) => (
                  <div key={index} className="flex border-b border-border hover:bg-muted/50">
                    <div className="w-8 p-2 border-r border-border text-[11px] text-muted-foreground">
                      {(currentPage - 1) * 50 + index + 1}
                    </div>
                    {tableSchema?.columns?.map((col) => (
                      <div
                        key={col.name}
                        className="flex-1 min-w-[150px] p-2 border-r border-border text-[11px] truncate"
                      >
                        {row[col.name] !== null && row[col.name] !== undefined
                          ? String(row[col.name])
                          : <span className="text-muted-foreground">null</span>
                        }
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p className="text-[13px]">No rows</p>
                  <p className="text-[11px] mt-1">limit 50 offset {(currentPage - 1) * 50}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {showSettingsPanel && (
          <div className="absolute right-0 top-0 w-72 h-full bg-background border-l border-border shadow-lg z-10 overflow-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Table rows count</span>
                <Switch
                  checked={tableRowsCount}
                  onCheckedChange={setTableRowsCount}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Beware count(*) operation performs light scan of the table which can be both slow and billed by serverless databases for row reads
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-medium">Expand subviews</span>
                  <p className="text-[11px] text-muted-foreground">Always keep subviews visible</p>
                </div>
                <Switch
                  checked={expandSubviews}
                  onCheckedChange={setExpandSubviews}
                />
              </div>

              <div>
                <span className="text-[13px] font-medium">Pagination type</span>
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={paginationType === 'limit'}
                      onChange={() => setPaginationType('limit')}
                    />
                    LIMIT OFFSET
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={paginationType === 'pages'}
                      onChange={() => setPaginationType('pages')}
                    />
                    PAGES
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-medium">Flat schemas</span>
                  <p className="text-[11px] text-muted-foreground">Show tables without grouping by schema</p>
                </div>
                <Switch
                  checked={flatSchemas}
                  onCheckedChange={setFlatSchemas}
                />
              </div>

              <div>
                <span className="text-[13px] font-medium">Show bytea as</span>
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={showByteaAs === 'hex'}
                      onChange={() => setShowByteaAs('hex')}
                    />
                    HEX <code className="text-[11px] bg-muted px-1 rounded">\x69643A3130303031</code>
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={showByteaAs === 'utf8'}
                      onChange={() => setShowByteaAs('utf8')}
                    />
                    UTF8 <code className="text-[11px] bg-muted px-1 rounded">id:10001</code>
                  </label>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => handleCopyToClipboard('-- Schema dump', 'Schema')}
              >
                <Layers className="h-4 w-4" />
                Copy database schema
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const SettingsTab = () => (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-2">History Retention</h4>
          <p className="text-[13px] text-muted-foreground mb-3">
            Maintain a history of changes for a period of time, enabling features like point-in-time restore and restoring a database back to an agent checkpoint.
          </p>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1 block">History Retention Period</label>
            <Select value={historyRetention} onValueChange={setHistoryRetention}>
              <SelectTrigger className="w-full" data-testid="select-retention">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HISTORY_RETENTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-2">Restore</h4>
          <p className="text-[13px] text-muted-foreground mb-3">
            Quickly restore a branch to a point within it's history retention period.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-[13px] text-muted-foreground mb-1 block">Timestamp</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="date"
                  className="flex-1 min-w-0"
                  value={restoreDate}
                  onChange={(e) => setRestoreDate(e.target.value)}
                  placeholder="jj / mm / aaaa"
                  data-testid="input-restore-date"
                />
                <Input
                  type="time"
                  className="w-full sm:w-32"
                  value={restoreTime}
                  onChange={(e) => setRestoreTime(e.target.value)}
                  placeholder="--:--:--"
                  data-testid="input-restore-time"
                />
              </div>
            </div>
            <Select value={restoreTimezone} onValueChange={setRestoreTimezone}>
              <SelectTrigger data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              data-testid="button-restore"
            >
              {restoreMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Restore
            </Button>
          </div>
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-2">Storage Used</h4>
          <Progress value={storagePercentage} className="h-2 mb-2" data-testid="progress-storage" />
          <div className="flex justify-between text-[13px] text-muted-foreground">
            <span>Total usage: {storageUsedMb.toFixed(1)}MB</span>
            <span>Max usage: {(storageLimitMb / 1024).toFixed(0)}GB</span>
          </div>
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-foreground mb-3">Environment variables</h4>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">DATABASE_URL</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded max-w-[120px] sm:max-w-[200px] truncate">
                  {showDatabaseUrl ? credentials?.connectionUrl : '••••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyToClipboard(credentials?.connectionUrl || '', 'DATABASE_URL')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setShowDatabaseUrl(!showDatabaseUrl)}
                >
                  {showDatabaseUrl ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">PGDATABASE</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded truncate">
                  {credentials?.databaseName || 'neondb'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyToClipboard(credentials?.databaseName || '', 'PGDATABASE')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">PGHOST</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded max-w-[120px] sm:max-w-[200px] truncate">
                  {credentials?.host || 'ep-lively-resonance-a6vcsxeu.u'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyToClipboard(credentials?.host || '', 'PGHOST')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">PGPORT</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded">
                  {credentials?.port || '5432'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopyToClipboard(String(credentials?.port || '5432'), 'PGPORT')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">PGUSER</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded truncate">
                  {credentials?.username || 'neondb_owner'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyToClipboard(credentials?.username || '', 'PGUSER')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-[13px] font-mono text-muted-foreground shrink-0">PGPASSWORD</span>
              <div className="flex items-center gap-1 min-w-0">
                <code className="text-[11px] sm:text-[13px] bg-muted px-2 py-1 rounded truncate">
                  {showPassword ? credentials?.password : '••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleCopyToClipboard(credentials?.password || '', 'PGPASSWORD')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              data-testid="button-remove-database"
            >
              <Trash2 className="h-4 w-4" />
              Remove Database
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Database?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All data stored in this database will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollArea>
  );

  const DatabaseDetailView = () => (
    <div className="flex flex-col h-full">
      <div className="h-9 px-2.5 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentView('all')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Database className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs font-medium text-[var(--ecode-text-muted)] hover:text-foreground">
                {currentView === 'development' ? 'Development' : 'Production'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCurrentView('development')}>
                Development Database
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentView('production')}>
                Production Database
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      <div className="h-9 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
        <div className="flex px-2.5 overflow-x-auto scrollbar-none h-full items-center" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setActiveDetailTab('overview')}
            className={cn(
              "flex items-center gap-1 px-2.5 h-full text-xs border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeDetailTab === 'overview'
                ? "border-[hsl(142,72%,42%)] text-[var(--ecode-text)]"
                : "border-transparent text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]"
            )}
            data-testid="tab-overview"
          >
            <Info className="h-3.5 w-3.5" />
            Overview
          </button>
          <button
            onClick={() => setActiveDetailTab('mydata')}
            className={cn(
              "flex items-center gap-1 px-2.5 h-full text-xs border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeDetailTab === 'mydata'
                ? "border-[hsl(142,72%,42%)] text-[var(--ecode-text)]"
                : "border-transparent text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]"
            )}
            data-testid="tab-mydata"
          >
            <Database className="h-3.5 w-3.5" />
            My Data
          </button>
          <button
            onClick={() => setActiveDetailTab('settings')}
            className={cn(
              "flex items-center gap-1 px-2.5 h-full text-xs border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeDetailTab === 'settings'
                ? "border-[hsl(142,72%,42%)] text-[var(--ecode-text)]"
                : "border-transparent text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]"
            )}
            data-testid="tab-settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeDetailTab === 'overview' && <OverviewTab />}
        {activeDetailTab === 'mydata' && <MyDataTab />}
        {activeDetailTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );

  if (databaseInfoLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      {currentView === 'all' ? <AllDatabasesView /> : <DatabaseDetailView />}
    </div>
  );
}
