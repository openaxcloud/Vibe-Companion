import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Database,
  Table,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Play,
  Download,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  LayoutGrid,
  RotateCcw,
  Archive,
  Shield,
  Key,
  Zap,
  ServerOff,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DatabasePanelProps {
  projectId: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
}

interface BackupInfo {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  backupType: string;
  sizeBytes?: number;
  restorePoint?: string;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
}

type DbStatus = 'running' | 'provisioning' | 'stopped' | 'error' | 'deleted';

interface DbDatabase {
  id: number;
  name: string;
  type: string;
  status: DbStatus;
  region: string;
  version?: string;
  plan: DbPlan;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  storageUsedMb?: number;
  storageLimitMb?: number;
  connectionCount?: number;
  maxConnections?: number;
  autoBackup?: boolean;
  provisionedAt?: string;
}

interface DbInfo {
  provisioned: boolean;
  database?: DbDatabase;
}

interface DbCredentials {
  [key: string]: string;
}

interface DbTableStat {
  tableName: string;
  totalBytes: number;
  totalSize: string;
  dataBytes: number;
  indexSize: string;
  estimatedRows: number;
}

interface DbUsage {
  databaseSizeBytes: number | null;
  databaseSizeHuman: string;
  activeConnections: number | null;
  tableStats: DbTableStat[];
  queriedAt: string;
}

interface DbStats {
  totalBackups?: number;
  backupRetentionDays?: number;
  databaseSizeBytes?: number;
}

interface SqlExecuteResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: { name: string }[];
  executionTime: number;
  requiresConfirmation?: boolean;
  isWriteOperation?: boolean;
  statementClass?: 'read' | 'write' | 'ddl';
  targetEnv?: 'dev' | 'prod';
  isProdDdl?: boolean;
  query?: string;
  message?: string;
}

interface QueryResultState {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime?: number;
  error?: string;
}

interface ExportBackupResult {
  backup: {
    id: number;
    name: string;
    status: string;
    backupType: string;
    sizeBytes?: number;
    restorePoint?: string;
    createdAt: string;
    completedAt?: string;
    expiresAt?: string;
  };
  exportInfo: {
    available: boolean;
    restorePoint?: string;
    message: string;
  };
}

type DbTab = 'data' | 'sql' | 'backups' | 'settings';
type DbPlan = 'free' | 'starter' | 'pro' | 'enterprise';

const PLAN_LABELS: Record<DbPlan, { label: string; desc: string }> = {
  free: { label: 'Free', desc: '256 MB storage, shared compute' },
  starter: { label: 'Starter', desc: '1 GB storage, dedicated compute' },
  pro: { label: 'Pro', desc: '10 GB storage + PITR backups' },
  enterprise: { label: 'Enterprise', desc: 'Unlimited + advanced security' },
};

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

// Client-side hint regex — supplementary only; server AST is authoritative
const WRITE_OPERATION_RE = /\b(INSERT|UPDATE|DELETE|MERGE|REPLACE|UPSERT)\b/i;

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return dateStr; }
}

function CopyBtn({ text, 'data-testid': testId }: { text: string; 'data-testid'?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      data-testid={testId || 'button-copy'}
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function StatusBadge({ status }: { status: 'running' | 'provisioning' | 'stopped' | 'error' | 'deleted' }) {
  const cfg = {
    running:     { icon: CheckCircle2, cls: 'text-green-400', label: 'Running' },
    provisioning:{ icon: Clock, cls: 'text-yellow-400', label: 'Provisioning...' },
    stopped:     { icon: ServerOff, cls: 'text-[var(--ide-text-muted)]', label: 'Stopped' },
    error:       { icon: XCircle, cls: 'text-red-400', label: 'Error' },
    deleted:     { icon: XCircle, cls: 'text-red-400', label: 'Deleted' },
  };
  const c = cfg[status as keyof typeof cfg] || cfg.stopped;
  const Icon = c.icon;
  return (
    <span className={cn('flex items-center gap-1 text-[9px]', c.cls)}>
      <Icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DbTab>('data');
  const [dbEnv, setDbEnv] = useState<'dev' | 'prod'>('dev');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, ColumnInfo[]>>({});

  const [sqlQuery, setSqlQuery] = useState('SELECT 1;');
  const [queryResults, setQueryResults] = useState<QueryResultState | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDestructiveQuery, setPendingDestructiveQuery] = useState<string | null>(null);
  const [prodDdlConfirmOpen, setProdDdlConfirmOpen] = useState(false);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [dataOffset, setDataOffset] = useState(0);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showInsertRow, setShowInsertRow] = useState(false);
  const [insertValues, setInsertValues] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState('');

  // Auto-enable write-protect when targeting production
  const isProdEnv = dbEnv === 'prod';

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [restoreBackupId, setRestoreBackupId] = useState<number | null>(null);
  const [deleteBackupId, setDeleteBackupId] = useState<number | null>(null);
  const [exportBackupInfo, setExportBackupInfo] = useState<{ id: number; info: ExportBackupResult } | null>(null);
  const [writeProtect, setWriteProtect] = useState(false);

  const [provisionPlan, setProvisionPlan] = useState<DbPlan>('free');
  const [provisionRegion, setProvisionRegion] = useState('us-east-1');

  // ─── Database Info / Provisioning State ─────────────────────────────────────

  const dbInfoQuery = useQuery<DbInfo>({
    queryKey: ['db-info', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/database/project/${projectId}`, { credentials: 'include' });
      if (!res.ok && res.status !== 404) throw new Error('Failed to check database status');
      const data = await res.json();
      return data;
    },
    staleTime: 20000,
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.database?.status;
      return status === 'provisioning' ? 4000 : false;
    },
  });

  const dbInfo = dbInfoQuery.data;
  const isProvisioned = !!dbInfo?.provisioned;
  const dbStatus = dbInfo?.database?.status;
  const isRunning = isProvisioned && dbStatus === 'running';

  // ─── SQL execute helper ──────────────────────────────────────────────────────

  const execSql = useCallback(async (
    query: string,
    confirmed = false,
    prodConfirmed = false,
  ): Promise<SqlExecuteResult> => {
    const url = `/api/database/project/${projectId}/sql/execute?env=${dbEnv}`;
    const res = await apiRequest('POST', url, { query, confirmed, prodConfirmed });
    const data: SqlExecuteResult = await res.json();
    if (!res.ok || (data as { error?: string }).error) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data;
  }, [projectId, dbEnv]);

  // ─── Tables List ─────────────────────────────────────────────────────────────

  const tablesQuery = useQuery<string[]>({
    queryKey: ['db-tables', projectId],
    queryFn: async () => {
      const data = await execSql(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      );
      return (data.rows || []).map((r) => String((r as Record<string,unknown>).table_name ?? ''));
    },
    enabled: isRunning,
    staleTime: 15000,
    retry: 1,
  });

  const tables = tablesQuery.data || [];

  // ─── Table Columns ───────────────────────────────────────────────────────────

  const columnsQuery = useQuery<ColumnInfo[]>({
    queryKey: ['db-columns', projectId, selectedTable],
    queryFn: async () => {
      if (!selectedTable) return [];
      const safe = selectedTable.replace(/'/g, "''");
      const data = await execSql(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${safe}' AND table_schema = 'public' ORDER BY ordinal_position`
      );
      return (data.rows || []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          name: String(row.column_name ?? ''),
          type: String(row.data_type ?? ''),
          nullable: String(row.is_nullable ?? 'NO') === 'YES',
          hasDefault: row.column_default != null,
        };
      });
    },
    enabled: isRunning && !!selectedTable,
    staleTime: 60000,
  });

  const columns = columnsQuery.data || [];

  // ─── Table Data ──────────────────────────────────────────────────────────────

  const tableDataQuery = useQuery<{ rows: Record<string, unknown>[]; fieldNames: string[]; totalRows: number }>({
    queryKey: ['db-table-data', projectId, selectedTable, sortCol, sortDir, filterCol, filterVal, dataOffset],
    queryFn: async () => {
      if (!selectedTable) return { rows: [], fieldNames: [], totalRows: 0 };
      const safeTable = `"${selectedTable.replace(/"/g, '""')}"`;
      let where = '';
      if (filterCol && filterVal) {
        const safeCol = `"${filterCol.replace(/"/g, '""')}"`;
        const safeVal = filterVal.replace(/'/g, "''");
        where = ` WHERE ${safeCol}::text ILIKE '%${safeVal}%'`;
      }
      const order = sortCol ? ` ORDER BY "${sortCol.replace(/"/g, '""')}" ${sortDir}` : '';
      const dataQ = `SELECT * FROM ${safeTable}${where}${order} LIMIT 100 OFFSET ${dataOffset}`;
      const countQ = `SELECT COUNT(*) AS total FROM ${safeTable}${where}`;
      const [dataRes, countRes] = await Promise.all([execSql(dataQ), execSql(countQ)]);
      return {
        rows: (dataRes.rows || []) as Record<string, unknown>[],
        fieldNames: (dataRes.fields || []).map((f) => f.name),
        totalRows: parseInt(String((countRes.rows[0] as Record<string, unknown>)?.total ?? 0), 10),
      };
    },
    enabled: isRunning && !!selectedTable,
    staleTime: 10000,
  });

  const tableData = tableDataQuery.data;
  const fieldNames = tableData?.fieldNames || columns.map(c => c.name);

  // ─── Credentials ─────────────────────────────────────────────────────────────

  const credentialsQuery = useQuery<{ credentials: DbCredentials } | null>({
    queryKey: ['db-credentials', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/database/project/${projectId}/credentials`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json() as Promise<{ credentials: DbCredentials }>;
    },
    enabled: isProvisioned && activeTab === 'settings',
  });

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const statsQuery = useQuery<{ stats: DbStats } | null>({
    queryKey: ['db-project-stats', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/database/project/${projectId}/stats`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json() as Promise<{ stats: DbStats }>;
    },
    enabled: isProvisioned && activeTab === 'settings',
  });

  // ─── Real-time Usage ─────────────────────────────────────────────────────────

  const usageQuery = useQuery<{ usage: DbUsage } | null>({
    queryKey: ['db-usage', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/database/project/${projectId}/usage`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json() as Promise<{ usage: DbUsage }>;
    },
    enabled: isRunning && activeTab === 'settings',
    staleTime: 30000,
  });

  // ─── Backups ─────────────────────────────────────────────────────────────────

  const backupsQuery = useQuery<{ backups: BackupInfo[] }>({
    queryKey: ['db-backups', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/database/project/${projectId}/backups`, { credentials: 'include' });
      if (!res.ok) return { backups: [] };
      return res.json();
    },
    enabled: isProvisioned && activeTab === 'backups',
    staleTime: 30000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/database/project/${projectId}/provision`, {
        type: 'postgresql',
        region: provisionRegion,
        plan: provisionPlan,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-info'] });
      toast({ title: 'Provisioning started', description: 'Your database is being set up. This takes a few seconds.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Provisioning failed', description: err.message, variant: 'destructive' });
    },
  });

  const executeMutation = useMutation<SqlExecuteResult, Error, { sql: string; confirmed?: boolean; prodConfirmed?: boolean }>({
    mutationFn: ({ sql, confirmed, prodConfirmed }) => execSql(sql, !!confirmed, !!prodConfirmed),
    onSuccess: (data) => {
      if (data.requiresConfirmation) {
        setPendingDestructiveQuery(data.query ?? '');
        if (data.isProdDdl) {
          setProdDdlConfirmOpen(true);
        } else {
          setConfirmDialogOpen(true);
        }
        return;
      }
      const names = (data.fields || []).map((f) => f.name);
      setQueryResults({
        columns: names,
        rows: (data.rows || []).map((r) =>
          names.length > 0 ? names.map((n) => (r as Record<string, unknown>)[n]) : Object.values(r)
        ),
        rowCount: data.rowCount || (data.rows || []).length,
        executionTime: data.executionTime,
      });
      queryClient.invalidateQueries({ queryKey: ['db-tables'] });
      if (selectedTable) queryClient.invalidateQueries({ queryKey: ['db-table-data'] });
    },
    onError: (err) => {
      setQueryResults({ columns: [], rows: [], rowCount: 0, error: err.message || 'Query failed' });
    },
  });

  const exportBackupMutation = useMutation<ExportBackupResult, Error, number>({
    mutationFn: async (backupId) => {
      const res = await fetch(`/api/database/project/${projectId}/backups/${backupId}/export`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export info unavailable');
      return res.json() as Promise<ExportBackupResult>;
    },
    onSuccess: (data, backupId) => {
      setExportBackupInfo({ id: backupId, info: data });
    },
    onError: (err) => toast({ title: 'Export failed', description: err.message, variant: 'destructive' }),
  });

  const insertRowMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable || !columns.length) return;
      const cols = columns.filter(c => insertValues[c.name] !== undefined && insertValues[c.name] !== '');
      if (!cols.length) throw new Error('No values to insert');
      const colNames = cols.map(c => `"${c.name.replace(/"/g, '""')}"`).join(', ');
      const vals = cols.map(c => {
        const v = insertValues[c.name];
        if (c.type.match(/int|float|numeric|double|decimal|serial|real|bigint/i)) return v;
        return `'${v.replace(/'/g, "''")}'`;
      }).join(', ');
      return execSql(`INSERT INTO "${selectedTable.replace(/"/g, '""')}" (${colNames}) VALUES (${vals})`, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-table-data'] });
      setShowInsertRow(false);
      setInsertValues({});
    },
    onError: (err: Error) => toast({ title: 'Insert failed', description: err.message, variant: 'destructive' }),
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ colName, newVal, pkCol, pkVal }: { colName: string; newVal: string; pkCol: string; pkVal: unknown }) => {
      if (!selectedTable) return;
      const col = columns.find(c => c.name === colName);
      const valExpr = newVal === '' ? 'NULL' : col?.type.match(/int|float|numeric|double|decimal|serial|real|bigint/i) ? newVal : `'${newVal.replace(/'/g, "''")}'`;
      const pkExpr = typeof pkVal === 'number' ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;
      return execSql(`UPDATE "${selectedTable.replace(/"/g, '""')}" SET "${colName.replace(/"/g, '""')}" = ${valExpr} WHERE "${pkCol.replace(/"/g, '""')}" = ${pkExpr}`, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-table-data'] });
      setEditingCell(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
      setEditingCell(null);
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: async ({ pkCol, pkVal }: { pkCol: string; pkVal: unknown }) => {
      if (!selectedTable) return;
      const pkExpr = typeof pkVal === 'number' ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;
      return execSql(`DELETE FROM "${selectedTable.replace(/"/g, '""')}" WHERE "${pkCol.replace(/"/g, '""')}" = ${pkExpr}`, true);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db-table-data'] }),
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const rotateCredentialsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/database/project/${projectId}/rotate-credentials`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-credentials'] });
      setRotateConfirmOpen(false);
      toast({ title: 'Credentials rotated', description: 'New credentials are now active. Update your connection strings.' });
    },
    onError: (err: Error) => {
      setRotateConfirmOpen(false);
      toast({ title: 'Rotation failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/database/project/${projectId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-info'] });
      queryClient.removeQueries({ queryKey: ['db-tables'] });
      queryClient.removeQueries({ queryKey: ['db-table-data'] });
      queryClient.removeQueries({ queryKey: ['db-credentials'] });
      setSelectedTable(null);
      setRemoveConfirmOpen(false);
      toast({ title: 'Database deleted', description: 'The database and all its data have been removed.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
      setRemoveConfirmOpen(false);
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/database/project/${projectId}/backups`, {
        name: `manual-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`,
        backupType: 'manual',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-backups'] });
      toast({ title: 'Backup created', description: 'Manual backup initiated successfully.' });
    },
    onError: (err: Error) => toast({ title: 'Backup failed', description: err.message, variant: 'destructive' }),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: number) => {
      const res = await apiRequest('POST', `/api/database/project/${projectId}/backups/${backupId}/restore`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-backups'] });
      queryClient.invalidateQueries({ queryKey: ['db-tables'] });
      setRestoreBackupId(null);
      toast({ title: 'Restore initiated', description: 'Database restore is in progress.' });
    },
    onError: (err: Error) => { setRestoreBackupId(null); toast({ title: 'Restore failed', description: err.message, variant: 'destructive' }); },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: number) => {
      const res = await apiRequest('DELETE', `/api/database/project/${projectId}/backups/${backupId}`, {});
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['db-backups'] }); setDeleteBackupId(null); },
    onError: (err: Error) => { setDeleteBackupId(null); toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }); },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable(table);
    setSortCol(null);
    setSortDir('ASC');
    setFilterCol('');
    setFilterVal('');
    setDataOffset(0);
    setShowInsertRow(false);
    setEditingCell(null);
  }, []);

  const handleToggleExpand = useCallback(async (table: string) => {
    if (expandedTable === table) { setExpandedTable(null); return; }
    setExpandedTable(table);
    if (!expandedColumns[table] && isRunning) {
      try {
        const safe = table.replace(/'/g, "''");
        const data = await execSql(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${safe}' AND table_schema = 'public' ORDER BY ordinal_position`
        );
        const cols = (data.rows || []).map((r) => { const row = r as Record<string,unknown>; return { name: String(row.column_name ?? ''), type: String(row.data_type ?? ''), nullable: false, hasDefault: false }; });
        setExpandedColumns(prev => ({ ...prev, [table]: cols }));
      } catch {}
    }
  }, [expandedTable, expandedColumns, isRunning, execSql]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortCol(col); setSortDir('ASC'); }
    setDataOffset(0);
  };

  const handleInlineUpdate = (rowIdx: number, colName: string, newVal: string) => {
    if (!tableData || !fieldNames.length) return;
    const row = tableData.rows[rowIdx];
    const pkCol = columns.find(c => c.name === 'id') || columns[0];
    if (!pkCol) return;
    const pkIdx = fieldNames.indexOf(pkCol.name);
    const pkVal = pkIdx >= 0 ? (row as Record<string,unknown>)[fieldNames[pkIdx]] : (row as Record<string,unknown>)[pkCol.name];
    updateCellMutation.mutate({ colName, newVal, pkCol: pkCol.name, pkVal });
  };

  const handleDeleteRow = (rowIdx: number) => {
    if (!tableData || !fieldNames.length) return;
    const row = tableData.rows[rowIdx] as Record<string, unknown>;
    const pkCol = columns.find(c => c.name === 'id') || columns[0];
    if (!pkCol) return;
    const pkVal = row[pkCol.name] ?? null;
    if (pkVal == null) { toast({ title: 'Cannot delete', description: 'No primary key found.', variant: 'destructive' }); return; }
    deleteRowMutation.mutate({ pkCol: pkCol.name, pkVal });
  };

  const exportCsv = () => {
    if (!tableData || !selectedTable) return;
    const header = fieldNames.join(',');
    const rows = tableData.rows.map(r =>
      fieldNames.map((col) => {
        const v = (r as Record<string, unknown>)[col];
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${selectedTable}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const TABS: { id: DbTab; label: string }[] = [
    { id: 'data', label: 'Data' },
    { id: 'sql', label: 'SQL' },
    { id: 'backups', label: 'Backups' },
    { id: 'settings', label: 'Settings' },
  ];

  // ─── Provisioning state rendering ────────────────────────────────────────────

  const renderProvisioningUI = () => (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 space-y-4">
        <div className="flex flex-col items-center gap-2 pt-2 pb-1 text-center">
          <Database className="w-10 h-10 text-[#0079F2] opacity-60" />
          <h3 className="text-[13px] font-semibold">Set up a database</h3>
          <p className="text-[10px] text-[var(--ide-text-muted)] max-w-[200px]">
            Provision a dedicated PostgreSQL database for this project.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">Plan</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(PLAN_LABELS) as [DbPlan, { label: string; desc: string }][]).map(([plan, { label, desc }]) => (
              <button
                key={plan}
                className={cn(
                  'text-left p-2 rounded border transition-colors',
                  provisionPlan === plan
                    ? 'border-[#0079F2] bg-[#0079F2]/10'
                    : 'border-[var(--ide-border)] hover:border-[var(--ide-text-muted)]'
                )}
                onClick={() => setProvisionPlan(plan)}
                data-testid={`button-plan-${plan}`}
              >
                <div className="text-[10px] font-semibold">{label}</div>
                <div className="text-[9px] text-[var(--ide-text-muted)] mt-0.5 leading-tight">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">Region</span>
          <select
            className="w-full text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)]"
            value={provisionRegion}
            onChange={(e) => setProvisionRegion(e.target.value)}
            data-testid="select-provision-region"
          >
            {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <Button
          className="w-full text-[11px] h-8 gap-1.5"
          onClick={() => provisionMutation.mutate()}
          disabled={provisionMutation.isPending}
          data-testid="button-provision-database"
        >
          {provisionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Create Database
        </Button>
      </div>
    </ScrollArea>
  );

  const renderProvisioningInProgress = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="w-8 h-8 text-[#0079F2] animate-spin" />
      <div className="text-center">
        <p className="text-[12px] font-medium">Provisioning database...</p>
        <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">This usually takes 15–30 seconds</p>
      </div>
      <Button variant="ghost" size="sm" className="text-[10px] h-6"
        onClick={() => queryClient.invalidateQueries({ queryKey: ['db-info'] })}
        data-testid="button-check-provisioning">
        <RefreshCw className="w-3 h-3 mr-1" /> Check Status
      </Button>
    </div>
  );

  const renderError = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
      <XCircle className="w-8 h-8 text-red-400" />
      <div className="text-center">
        <p className="text-[12px] font-medium text-red-400">Database error</p>
        <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Provisioning failed. Retry to create a fresh database.</p>
      </div>
      <Button size="sm" className="text-[10px] h-7 gap-1"
        onClick={() => provisionMutation.mutate()}
        disabled={provisionMutation.isPending}
        data-testid="button-retry-provision">
        {provisionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
        Retry Provisioning
      </Button>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)] relative" data-testid="database-panel">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[11px] font-semibold">Database</span>
          {dbInfo?.database && (
            <StatusBadge status={dbInfo.database.status} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Dev / Prod environment switcher */}
          <div className="flex items-center rounded border border-[var(--ide-border)] overflow-hidden text-[9px]" data-testid="env-switcher">
            <button
              className={cn('px-1.5 py-0.5 transition-colors', dbEnv === 'dev' ? 'bg-[#0079F2] text-white' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]')}
              onClick={() => setDbEnv('dev')}
              data-testid="button-env-dev"
            >dev</button>
            <button
              className={cn('px-1.5 py-0.5 transition-colors border-l border-[var(--ide-border)]', dbEnv === 'prod' ? 'bg-orange-600 text-white' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]')}
              onClick={() => { setDbEnv('prod'); setWriteProtect(true); }}
              data-testid="button-env-prod"
            >prod</button>
          </div>
          {isRunning && (
            <button
              title={writeProtect || isProdEnv ? 'Write-protect ON — click to allow writes' : 'Write-protect OFF — click to block writes'}
              className={cn(
                'flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border transition-colors',
                writeProtect || isProdEnv
                  ? 'border-amber-500/60 text-amber-400 bg-amber-500/10'
                  : 'border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              )}
              onClick={() => { if (!isProdEnv) setWriteProtect(p => !p); }}
              data-testid="button-write-protect-toggle"
            >
              <Shield className="w-2.5 h-2.5" />
              {writeProtect || isProdEnv ? 'Protected' : 'Writes OK'}
            </button>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['db-info'] });
              queryClient.invalidateQueries({ queryKey: ['db-tables'] });
              queryClient.invalidateQueries({ queryKey: ['db-backups'] });
            }}
            data-testid="button-refresh-db">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex-1 text-[10px] py-1.5 font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-[#0079F2] text-[#0079F2]'
                : 'border-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            )}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-db-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {dbInfoQuery.isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" />
          </div>
        ) : dbInfoQuery.isError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <p className="text-[11px] text-[var(--ide-text-muted)] text-center">Failed to load database info</p>
            <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => dbInfoQuery.refetch()}>Retry</Button>
          </div>
        ) : !isProvisioned && (activeTab === 'data' || activeTab === 'sql') ? (
          renderProvisioningUI()
        ) : isProvisioned && dbStatus === 'provisioning' ? (
          renderProvisioningInProgress()
        ) : isProvisioned && dbStatus === 'error' ? (
          renderError()
        ) : (
          <>
            {/* DATA TAB */}
            {activeTab === 'data' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Tables list header */}
                <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-medium text-[var(--ide-text-muted)]">
                    Tables {tablesQuery.isLoading ? '(...)' : `(${tables.length})`}
                  </span>
                  <Button variant="ghost" size="icon" className="w-5 h-5"
                    onClick={() => { queryClient.invalidateQueries({ queryKey: ['db-tables'] }); setSelectedTable(null); }}
                    data-testid="button-refresh-tables">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>

                {/* Empty state */}
                {!tablesQuery.isLoading && tables.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-3" data-testid="empty-tables-message">
                    <Database className="w-8 h-8 text-[var(--ide-text-muted)] opacity-30" />
                    <div className="text-center">
                      <p className="text-[11px] font-medium text-[var(--ide-text-muted)]">No tables yet</p>
                      <p className="text-[10px] text-[var(--ide-text-muted)] opacity-70 mt-1">Use the SQL tab to create tables</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setActiveTab('sql')} data-testid="button-go-to-sql">
                      <Play className="w-3 h-3 mr-1" /> Open SQL Console
                    </Button>
                  </div>
                )}

                {/* Tables sidebar */}
                {tables.length > 0 && (
                  <div className="max-h-[180px] overflow-y-auto shrink-0 border-b border-[var(--ide-border)]">
                    {tables.map(table => (
                      <div key={table}>
                        <button
                          className={cn(
                            'w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--ide-surface)]/40 transition-colors',
                            selectedTable === table ? 'bg-[var(--ide-surface)]/60' : ''
                          )}
                          onClick={() => handleTableSelect(table)}
                          onDoubleClick={() => handleToggleExpand(table)}
                          data-testid={`table-item-${table}`}
                        >
                          {expandedTable === table
                            ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
                          <Table className="w-3 h-3 text-[#0079F2] shrink-0" />
                          <span className="text-[11px] font-mono truncate">{table}</span>
                        </button>
                        {expandedTable === table && expandedColumns[table] && (
                          <div className="pl-8 pr-3 pb-1">
                            {expandedColumns[table].map(col => (
                              <div key={col.name} className="flex items-center justify-between py-0.5">
                                <span className="text-[10px] font-mono text-[var(--ide-text-muted)]">{col.name}</span>
                                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase opacity-60">{col.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Table data pane */}
                {selectedTable && (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Data header */}
                    <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)] shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold font-mono">{selectedTable}</span>
                        {tableData && <span className="text-[9px] text-[var(--ide-text-muted)]">{tableData.totalRows} rows</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="w-5 h-5"
                          onClick={() => {
                            if (writeProtect) { toast({ title: 'Write-protect enabled', description: 'Toggle off to allow inserts.', variant: 'destructive' }); return; }
                            setShowInsertRow(true); setInsertValues(Object.fromEntries(columns.map(c => [c.name, ''])));
                          }}
                          title={writeProtect ? 'Write-protect enabled' : 'Insert row'} data-testid="button-insert-row">
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-5 h-5" onClick={exportCsv} title="Export CSV" data-testid="button-export-csv">
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-5 h-5"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ['db-table-data'] })}
                          data-testid="button-refresh-data">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Filter bar */}
                    {columns.length > 0 && (
                      <div className="px-3 py-1 flex items-center gap-2 border-b border-[var(--ide-border)] shrink-0">
                        <select className="text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1 py-0.5"
                          value={filterCol} onChange={e => setFilterCol(e.target.value)} data-testid="select-filter-col">
                          <option value="">Filter column...</option>
                          {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        {filterCol && (
                          <Input className="text-[10px] h-5 w-28 px-1" placeholder="value..." value={filterVal}
                            onChange={e => setFilterVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') setDataOffset(0); }}
                            data-testid="input-filter-val" />
                        )}
                      </div>
                    )}

                    {/* Insert row */}
                    {showInsertRow && columns.length > 0 && (
                      <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/30 shrink-0">
                        <div className="text-[10px] font-medium mb-1.5">New Row</div>
                        <div className="grid grid-cols-2 gap-1 mb-1.5">
                          {columns.map(c => (
                            <div key={c.name} className="flex items-center gap-1">
                              <span className="text-[9px] text-[var(--ide-text-muted)] font-mono w-16 truncate shrink-0">{c.name}</span>
                              <Input className="text-[10px] h-5 flex-1 px-1 min-w-0" value={insertValues[c.name] || ''}
                                placeholder={c.hasDefault ? '(default)' : ''}
                                onChange={e => setInsertValues(prev => ({ ...prev, [c.name]: e.target.value }))}
                                data-testid={`input-insert-${c.name}`} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="text-[10px] h-6"
                            onClick={() => insertRowMutation.mutate()}
                            disabled={insertRowMutation.isPending}
                            data-testid="button-confirm-insert">
                            {insertRowMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Insert'}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowInsertRow(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {/* Data grid */}
                    <ScrollArea className="flex-1 min-h-0">
                      {tableDataQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" />
                        </div>
                      ) : tableData && fieldNames.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] font-mono">
                            <thead>
                              <tr className="border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/30 sticky top-0">
                                {fieldNames.map(col => (
                                  <th key={col}
                                    className="px-2 py-1 text-left font-medium text-[var(--ide-text-muted)] cursor-pointer hover:text-[var(--ide-text)] whitespace-nowrap"
                                    onClick={() => handleSort(col)}>
                                    <span className="flex items-center gap-0.5">
                                      {col}
                                      {sortCol === col && (sortDir === 'ASC' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                                    </span>
                                  </th>
                                ))}
                                <th className="w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/20">
                                  {fieldNames.map((col) => {
                                    const val = (row as Record<string, unknown>)[col];
                                    return (
                                      <td key={col} className="px-2 py-0.5 max-w-[200px] truncate cursor-pointer"
                                        onDoubleClick={() => { setEditingCell({ row: ri, col }); setEditCellValue(val === null ? '' : String(val)); }}
                                        data-testid={`cell-${ri}-${col}`}>
                                        {editingCell?.row === ri && editingCell?.col === col ? (
                                          <Input className="text-[10px] h-5 px-1" value={editCellValue} autoFocus
                                            onChange={e => setEditCellValue(e.target.value)}
                                            onBlur={() => handleInlineUpdate(ri, col, editCellValue)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleInlineUpdate(ri, col, editCellValue); if (e.key === 'Escape') setEditingCell(null); }} />
                                        ) : (
                                          <span className={cn(val === null ? 'text-[var(--ide-text-muted)] italic' : 'text-[var(--ide-text)]')}>
                                            {val === null ? 'NULL' : String(val)}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-1">
                                    <button className={cn('p-0.5', writeProtect ? 'text-[var(--ide-text-muted)] opacity-30 cursor-not-allowed' : 'text-[var(--ide-text-muted)] hover:text-red-400')}
                                      onClick={() => { if (writeProtect) { toast({ title: 'Write-protect enabled', variant: 'destructive' }); return; } handleDeleteRow(ri); }}
                                      data-testid={`button-delete-row-${ri}`}>
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-[11px] text-[var(--ide-text-muted)] text-center">No data in this table</div>
                      )}
                    </ScrollArea>

                    {tableData && tableData.totalRows > 100 && (
                      <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--ide-border)] shrink-0">
                        <span className="text-[9px] text-[var(--ide-text-muted)]">
                          {dataOffset + 1}–{Math.min(dataOffset + 100, tableData.totalRows)} of {tableData.totalRows}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" disabled={dataOffset === 0}
                            onClick={() => setDataOffset(Math.max(0, dataOffset - 100))} data-testid="button-prev-page">Prev</Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2"
                            disabled={dataOffset + 100 >= tableData.totalRows}
                            onClick={() => setDataOffset(dataOffset + 100)} data-testid="button-next-page">Next</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!selectedTable && tables.length > 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 text-[var(--ide-text-muted)]">
                    <LayoutGrid className="w-6 h-6 mb-2 opacity-30" />
                    <p className="text-[11px]">Select a table to view data</p>
                  </div>
                )}
              </div>
            )}

            {/* SQL TAB */}
            {activeTab === 'sql' && (
              <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
                <textarea
                  className="flex-none h-24 p-2 text-[11px] font-mono bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded resize-none text-[var(--ide-text)] outline-none focus:border-[#0079F2]"
                  value={sqlQuery}
                  onChange={e => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM my_table LIMIT 10;"
                  spellCheck={false}
                  data-testid="textarea-sql-query"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="text-[10px] h-7 gap-1"
                    onClick={() => {
                      if (writeProtect && WRITE_OPERATION_RE.test(sqlQuery)) {
                        toast({ title: 'Write-protect enabled', description: 'Toggle off to allow write operations.', variant: 'destructive' });
                        return;
                      }
                      executeMutation.mutate({ sql: sqlQuery });
                    }}
                    disabled={executeMutation.isPending || !isRunning}
                    data-testid="button-run-query">
                    {executeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </Button>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    {writeProtect ? 'Write-protect ON — writes blocked' : 'Write ops (INSERT/UPDATE/DELETE) require server-side confirmation'}
                  </span>
                </div>

                {queryResults && (
                  <ScrollArea className="flex-1 min-h-0">
                    {queryResults.error ? (
                      <div className="p-2 text-[11px] text-red-400 bg-red-400/10 rounded font-mono">{queryResults.error}</div>
                    ) : (
                      <div>
                        <div className="text-[9px] text-[var(--ide-text-muted)] mb-1">
                          {queryResults.rowCount} row(s){queryResults.executionTime ? ` · ${queryResults.executionTime}ms` : ''}
                        </div>
                        {queryResults.columns.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] font-mono" data-testid="table-query-results">
                              <thead>
                                <tr className="border-b border-[var(--ide-border)]">
                                  {queryResults.columns.map(col => (
                                    <th key={col} className="px-2 py-1 text-left font-medium text-[var(--ide-text-muted)] whitespace-nowrap">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {queryResults.rows.map((row, ri) => (
                                  <tr key={ri} className="border-b border-[var(--ide-border)]/50">
                                    {row.map((val, ci) => (
                                      <td key={ci} className="px-2 py-0.5 max-w-[200px] truncate">
                                        {val === null ? <span className="text-[var(--ide-text-muted)] italic">NULL</span> : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-[10px] text-green-400 bg-green-400/10 px-2 py-1.5 rounded" data-testid="text-query-success">
                            Query executed successfully. {queryResults.rowCount} row(s) affected.
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            )}

            {/* BACKUPS TAB */}
            {activeTab === 'backups' && isProvisioned && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5 text-[#0079F2]" /> Backups
                    </span>
                    <Button size="sm" className="text-[10px] h-6 gap-1"
                      onClick={() => createBackupMutation.mutate()}
                      disabled={createBackupMutation.isPending || !isRunning}
                      data-testid="button-create-backup">
                      {createBackupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Create Backup
                    </Button>
                  </div>

                  {backupsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
                    </div>
                  ) : !backupsQuery.data?.backups?.length ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-[var(--ide-text-muted)]">
                      <Archive className="w-8 h-8 opacity-25" />
                      <p className="text-[11px]">No backups yet</p>
                      <p className="text-[10px] opacity-60 text-center max-w-[160px]">
                        Create a manual backup or enable auto-backup in Settings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {backupsQuery.data.backups.map(backup => (
                        <div key={backup.id} className="border border-[var(--ide-border)] rounded p-2 space-y-1" data-testid={`backup-card-${backup.id}`}>
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[10px] font-mono font-medium truncate">{backup.name}</span>
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded-full shrink-0',
                              backup.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                              backup.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              backup.status === 'running' || backup.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-[var(--ide-surface)] text-[var(--ide-text-muted)]'
                            )}>
                              {backup.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-[var(--ide-text-muted)]">
                            <span>{formatDate(backup.createdAt)}</span>
                            <div className="flex items-center gap-2">
                              {backup.sizeBytes != null && <span>{formatBytes(backup.sizeBytes)}</span>}
                              {backup.restorePoint && (
                                <span className="flex items-center gap-0.5">
                                  PITR
                                  <CopyBtn text={backup.restorePoint} data-testid={`button-copy-restore-point-${backup.id}`} />
                                </span>
                              )}
                            </div>
                          </div>
                          {backup.expiresAt && (
                            <div className="text-[9px] text-[var(--ide-text-muted)] opacity-60">
                              Expires {formatDate(backup.expiresAt)}
                            </div>
                          )}
                          <div className="flex items-center gap-1 pt-0.5">
                            {restoreBackupId === backup.id ? (
                              <>
                                <Button variant="destructive" size="sm" className="text-[9px] h-5 px-2"
                                  onClick={() => restoreBackupMutation.mutate(backup.id)}
                                  disabled={restoreBackupMutation.isPending}
                                  data-testid={`button-confirm-restore-${backup.id}`}>
                                  {restoreBackupMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Confirm Restore'}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[9px] h-5 px-2" onClick={() => setRestoreBackupId(null)}>Cancel</Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-[9px] h-5 px-2 gap-1"
                                onClick={() => setRestoreBackupId(backup.id)}
                                disabled={backup.status !== 'completed'}
                                data-testid={`button-restore-${backup.id}`}>
                                <RotateCcw className="w-2.5 h-2.5" /> Restore
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-[9px] h-5 px-2 gap-1"
                              onClick={() => exportBackupMutation.mutate(backup.id)}
                              disabled={backup.status !== 'completed' || exportBackupMutation.isPending}
                              data-testid={`button-export-backup-${backup.id}`}>
                              {exportBackupMutation.isPending && exportBackupInfo?.id !== backup.id
                                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                : <Download className="w-2.5 h-2.5" />}
                              Export
                            </Button>
                            {deleteBackupId === backup.id ? (
                              <>
                                <Button variant="destructive" size="sm" className="text-[9px] h-5 px-2"
                                  onClick={() => deleteBackupMutation.mutate(backup.id)}
                                  disabled={deleteBackupMutation.isPending}
                                  data-testid={`button-confirm-delete-backup-${backup.id}`}>
                                  {deleteBackupMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Delete'}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[9px] h-5 px-2" onClick={() => setDeleteBackupId(null)}>Cancel</Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-[9px] h-5 px-2 text-red-400 hover:text-red-300 gap-1"
                                onClick={() => setDeleteBackupId(backup.id)}
                                data-testid={`button-delete-backup-${backup.id}`}>
                                <Trash2 className="w-2.5 h-2.5" /> Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && isProvisioned && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-4">

                  {/* Database Info */}
                  {dbInfo?.database && (
                    <div className="bg-[var(--ide-surface)] rounded p-2 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--ide-text-muted)]">Plan</span>
                        <span className="capitalize">{dbInfo.database.plan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--ide-text-muted)]">Region</span>
                        <span>{dbInfo.database.region}</span>
                      </div>
                      {dbInfo.database.version && (
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">PostgreSQL</span>
                          <span>{dbInfo.database.version}</span>
                        </div>
                      )}
                      {dbInfo.database.storageLimitMb && (
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Storage</span>
                          <span>{dbInfo.database.storageUsedMb ?? 0} / {dbInfo.database.storageLimitMb} MB</span>
                        </div>
                      )}
                      {dbInfo.database.maxConnections && (
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Connections</span>
                          <span>{dbInfo.database.connectionCount ?? 0} / {dbInfo.database.maxConnections}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connection Credentials */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" /> Connection Info
                      </span>
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1"
                        onClick={() => setShowCredentials(!showCredentials)} data-testid="button-toggle-credentials">
                        {showCredentials ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showCredentials ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    {credentialsQuery.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
                    ) : credentialsQuery.data?.credentials ? (
                      <div className="space-y-1 bg-[var(--ide-surface)] rounded p-2">
                        {Object.entries(credentialsQuery.data.credentials).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between gap-2">
                            <span className="text-[9px] text-[var(--ide-text-muted)] font-mono shrink-0 w-24">{key}</span>
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <span className="text-[10px] font-mono truncate flex-1" data-testid={`text-credential-${key}`}>
                                {showCredentials ? val : '••••••••'}
                              </span>
                              <CopyBtn text={val} data-testid={`button-copy-${key}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--ide-text-muted)]">No credentials available</div>
                    )}

                    {/* Rotate Credentials */}
                    <div className="mt-2">
                      {rotateConfirmOpen ? (
                        <div className="flex items-center gap-2">
                          <Button variant="destructive" size="sm" className="text-[10px] h-6"
                            onClick={() => rotateCredentialsMutation.mutate()}
                            disabled={rotateCredentialsMutation.isPending}
                            data-testid="button-confirm-rotate-credentials">
                            {rotateCredentialsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Rotate'}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setRotateConfirmOpen(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1"
                          onClick={() => setRotateConfirmOpen(true)}
                          data-testid="button-rotate-credentials">
                          <Shield className="w-3 h-3" /> Rotate Credentials
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Real-time Usage Metrics */}
                  <div>
                    <span className="text-[11px] font-medium">Usage</span>
                    {usageQuery.isLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)] mt-1" />
                    )}
                    {usageQuery.data?.usage && (
                      <div className="mt-1 space-y-1 text-[10px] bg-[var(--ide-surface)] rounded p-2" data-testid="section-usage">
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Database Size</span>
                          <span data-testid="text-db-size">{usageQuery.data.usage.databaseSizeHuman}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Active Connections</span>
                          <span data-testid="text-active-connections">{usageQuery.data.usage.activeConnections}</span>
                        </div>
                        {usageQuery.data.usage.tableStats.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-[9px] text-[var(--ide-text-muted)] font-medium uppercase tracking-wider mb-1">Top Tables</div>
                            {usageQuery.data.usage.tableStats.map((t) => (
                              <div key={t.tableName} className="flex justify-between" data-testid={`text-table-size-${t.tableName}`}>
                                <span className="font-mono text-[9px] text-[var(--ide-text-muted)] truncate max-w-[120px]">{t.tableName}</span>
                                <span className="text-[9px]">{t.totalSize}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Stats fallback: backup info */}
                    {statsQuery.data?.stats && (
                      <div className="mt-1 space-y-1 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Auto-backup</span>
                          <span>{dbInfo?.database?.autoBackup ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        {statsQuery.data.stats.totalBackups != null && (
                          <div className="flex justify-between">
                            <span className="text-[var(--ide-text-muted)]">Total Backups</span>
                            <span>{statsQuery.data.stats.totalBackups}</span>
                          </div>
                        )}
                        {statsQuery.data.stats.backupRetentionDays != null && (
                          <div className="flex justify-between">
                            <span className="text-[var(--ide-text-muted)]">Retention</span>
                            <span>{statsQuery.data.stats.backupRetentionDays} days</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t border-[var(--ide-border)] pt-3">
                    <span className="text-[11px] font-medium text-red-400">Danger Zone</span>
                    <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">
                      Permanently delete this database and all its data. This cannot be undone.
                    </p>
                    {removeConfirmOpen ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="destructive" size="sm" className="text-[10px] h-7"
                          onClick={() => deleteDatabaseMutation.mutate()}
                          disabled={deleteDatabaseMutation.isPending}
                          data-testid="button-confirm-remove-db">
                          {deleteDatabaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete Database'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setRemoveConfirmOpen(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="text-[10px] h-7 mt-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
                        onClick={() => setRemoveConfirmOpen(true)} data-testid="button-remove-db">
                        <Trash2 className="w-3 h-3 mr-1" /> Delete Database
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}

            {/* Backups + Settings tabs when not provisioned */}
            {(activeTab === 'backups' || activeTab === 'settings') && !isProvisioned && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
                <Database className="w-8 h-8 opacity-25" />
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center">No database provisioned yet</p>
                <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setActiveTab('data')}>
                  Provision a Database
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backup Export Info Dialog */}
      {exportBackupInfo && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-[#0079F2]" />
              <span className="text-[12px] font-semibold">Backup Export</span>
            </div>
            <div className="text-[10px] text-[var(--ide-text-muted)] mb-3 space-y-1">
              <div className="flex justify-between">
                <span>Name</span><span className="font-mono">{exportBackupInfo.info.backup?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Size</span>
                <span>{exportBackupInfo.info.backup?.sizeBytes ? formatBytes(exportBackupInfo.info.backup.sizeBytes) : 'N/A'}</span>
              </div>
              {exportBackupInfo.info.backup?.restorePoint && (
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0">Restore Point</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-mono text-[9px] truncate">{exportBackupInfo.info.backup.restorePoint}</span>
                    <CopyBtn text={exportBackupInfo.info.backup.restorePoint} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[var(--ide-text-muted)] bg-[var(--ide-surface)] rounded p-2 mb-3">
              {exportBackupInfo.info.exportInfo?.message}
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" className="text-[10px]" onClick={() => setExportBackupInfo(null)}
                data-testid="button-close-export-info">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Write/DDL-Confirm Dialog (first confirmation) */}
      {confirmDialogOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-[12px] font-semibold">
                Confirm {dbEnv === 'prod' ? 'Production ' : ''}Write Operation
              </span>
            </div>
            {dbEnv === 'prod' && (
              <p className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-1 rounded mb-2">
                ⚠️ Targeting PRODUCTION database
              </p>
            )}
            <p className="text-[10px] text-[var(--ide-text-muted)] mb-3">
              This query modifies data (INSERT / UPDATE / DELETE / DDL). Review before executing.
            </p>
            <pre className="text-[9px] font-mono bg-[var(--ide-surface)] p-2 rounded mb-3 max-h-24 overflow-auto" data-testid="text-pending-query">
              {pendingDestructiveQuery}
            </pre>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-[10px]"
                onClick={() => { setConfirmDialogOpen(false); setPendingDestructiveQuery(null); }}
                data-testid="button-cancel-destructive">Cancel</Button>
              <Button variant="destructive" size="sm" className="text-[10px]"
                onClick={() => {
                  setConfirmDialogOpen(false);
                  if (pendingDestructiveQuery) executeMutation.mutate({ sql: pendingDestructiveQuery, confirmed: true });
                  setPendingDestructiveQuery(null);
                }}
                data-testid="button-confirm-destructive">
                Execute
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prod DDL Double-Confirm Dialog (second confirmation for production DDL) */}
      {prodDdlConfirmOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--ide-bg)] border border-orange-500/50 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-[12px] font-semibold text-orange-400">Production DDL — Double Confirm</span>
            </div>
            <p className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-1.5 rounded mb-2">
              ⚠️ This DDL statement will modify the PRODUCTION database schema. This cannot be undone.
            </p>
            <pre className="text-[9px] font-mono bg-[var(--ide-surface)] p-2 rounded mb-3 max-h-24 overflow-auto" data-testid="text-prod-ddl-query">
              {pendingDestructiveQuery}
            </pre>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-[10px]"
                onClick={() => { setProdDdlConfirmOpen(false); setPendingDestructiveQuery(null); }}
                data-testid="button-cancel-prod-ddl">Cancel</Button>
              <Button size="sm" className="text-[10px] bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => {
                  setProdDdlConfirmOpen(false);
                  if (pendingDestructiveQuery) {
                    executeMutation.mutate({ sql: pendingDestructiveQuery, confirmed: true, prodConfirmed: true });
                  }
                  setPendingDestructiveQuery(null);
                }}
                data-testid="button-confirm-prod-ddl">
                Yes, Execute on Production
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
