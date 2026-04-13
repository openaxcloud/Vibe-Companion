import { useState, useCallback } from 'react';
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
  Search,
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
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatabasePanelProps {
  projectId: string;
}

interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
}

interface TableDataResult {
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  totalRows: number;
  limit: number;
  offset: number;
  error?: string;
}

type DbTab = 'data' | 'sql' | 'settings';
type DbEnv = 'development' | 'production';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      data-testid="button-copy-credential"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DbTab>('data');
  const [dbEnv, setDbEnv] = useState<DbEnv>('development');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, { name: string; type: string }[]>>({});

  const [sqlQuery, setSqlQuery] = useState('SELECT 1;');
  const [queryResults, setQueryResults] = useState<{ columns: string[]; rows: any[][]; rowCount: number; error?: string; requiresConfirmation?: boolean } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDestructiveQuery, setPendingDestructiveQuery] = useState<string | null>(null);

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
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const tablesQuery = useQuery<string[]>({
    queryKey: ['db-tables', projectId, dbEnv],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`/api/projects/${projectId}/database/tables?env=${dbEnv}`, { credentials: 'include', signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return [];
        const data = await res.json();
        if (data.error) return [];
        return data.tables || [];
      } catch {
        clearTimeout(timeout);
        return [];
      }
    },
    retry: 1,
    staleTime: 15000,
  });

  const tables = tablesQuery.data || [];

  const tableDataQuery = useQuery<TableDataResult>({
    queryKey: ['db-table-data', projectId, selectedTable, dbEnv, sortCol, sortDir, filterCol, filterVal, dataOffset],
    queryFn: async () => {
      if (!selectedTable) return { columns: [], rows: [], totalRows: 0, limit: 100, offset: 0 };
      const params = new URLSearchParams({ env: dbEnv, limit: '100', offset: String(dataOffset) });
      if (sortCol) { params.set('sort', sortCol); params.set('dir', sortDir); }
      if (filterCol && filterVal) { params.set('filterCol', filterCol); params.set('filterVal', filterVal); }
      const res = await fetch(`/api/projects/${projectId}/database/tables/${selectedTable}/data?${params}`, { credentials: 'include' });
      if (!res.ok) return { columns: [], rows: [], totalRows: 0, limit: 100, offset: 0, error: 'Failed to load' };
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const tableData = tableDataQuery.data;

  const credentialsQuery = useQuery({
    queryKey: ['db-credentials', projectId, dbEnv],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/database/credentials?env=${dbEnv}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === 'settings',
  });

  const usageQuery = useQuery({
    queryKey: ['db-usage', projectId, dbEnv],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/database/usage?env=${dbEnv}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === 'settings',
  });

  const executeMutation = useMutation({
    mutationFn: async ({ sql, confirm }: { sql: string; confirm?: boolean }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/database/execute`, { sql, confirm, env: dbEnv });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresConfirmation) {
        setPendingDestructiveQuery(data.sql || sqlQuery);
        setConfirmDialogOpen(true);
        return;
      }
      if (data.error) {
        setQueryResults({ columns: [], rows: [], rowCount: 0, error: data.error });
      } else {
        setQueryResults(data);
        queryClient.invalidateQueries({ queryKey: ['db-tables'] });
        if (selectedTable) queryClient.invalidateQueries({ queryKey: ['db-table-data'] });
      }
    },
    onError: (err: any) => {
      setQueryResults({ columns: [], rows: [], rowCount: 0, error: err.message || 'Query failed' });
    },
  });

  const removeDatabaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/database/remove`, { confirmToken: 'REMOVE_DATABASE', env: dbEnv });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-tables'] });
      queryClient.invalidateQueries({ queryKey: ['db-usage'] });
      setSelectedTable(null);
      setRemoveConfirmOpen(false);
      toast({ title: 'Database cleared', description: 'All tables have been removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleTableSelect = useCallback((table: string) => {
    setSelectedTable(table);
    setSortCol(null);
    setSortDir('ASC');
    setFilterCol('');
    setFilterVal('');
    setDataOffset(0);
  }, []);

  const handleToggleTable = useCallback(async (table: string) => {
    if (expandedTable === table) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(table);
    if (!tableColumns[table]) {
      try {
        const params = new URLSearchParams({ env: dbEnv, limit: '1', offset: '0' });
        const res = await fetch(`/api/projects/${projectId}/database/tables/${table}/data?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.columns) {
            setTableColumns(prev => ({ ...prev, [table]: data.columns.map((c: any) => ({ name: c.name, type: c.type })) }));
          }
        }
      } catch {}
    }
  }, [expandedTable, tableColumns, dbEnv, projectId]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortCol(col);
      setSortDir('ASC');
    }
    setDataOffset(0);
  };

  const exportCsv = () => {
    if (!tableData || !selectedTable) return;
    const cols = tableData.columns.map(c => c.name);
    const header = cols.join(',');
    const rows = tableData.rows.map(r => cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedTable}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleInlineUpdate = async (rowIdx: number, colName: string, newValue: string) => {
    if (!selectedTable || !tableData) return;
    const row = tableData.rows[rowIdx];
    const pkCol = tableData.columns.find(c => c.name === 'id') || tableData.columns[0];
    if (!pkCol) return;
    const pkVal = row[pkCol.name];
    const isNum = tableData.columns.find(c => c.name === colName)?.type?.match(/int|float|numeric|double|decimal|serial|real/i);
    const valExpr = newValue === '' ? 'NULL' : isNum ? newValue : `'${newValue.replace(/'/g, "''")}'`;
    const sql = `UPDATE "${selectedTable}" SET "${colName}" = ${valExpr} WHERE "${pkCol.name}" = ${typeof pkVal === 'number' ? pkVal : `'${pkVal}'`}`;
    executeMutation.mutate({ sql });
    setEditingCell(null);
  };

  const handleInsertRow = async () => {
    if (!selectedTable || !tableData) return;
    const cols = Object.keys(insertValues).filter(k => insertValues[k] !== '');
    if (cols.length === 0) return;
    const colNames = cols.map(c => `"${c}"`).join(', ');
    const values = cols.map(c => {
      const meta = tableData.columns.find(m => m.name === c);
      const v = insertValues[c];
      if (meta?.type?.match(/int|float|numeric|double|decimal|serial|real/i)) return v;
      return `'${v.replace(/'/g, "''")}'`;
    }).join(', ');
    executeMutation.mutate({ sql: `INSERT INTO "${selectedTable}" (${colNames}) VALUES (${values})` });
    setShowInsertRow(false);
    setInsertValues({});
  };

  const handleDeleteRow = async (rowIdx: number) => {
    if (!selectedTable || !tableData) return;
    const row = tableData.rows[rowIdx];
    const pkCol = tableData.columns.find(c => c.name === 'id') || tableData.columns[0];
    if (!pkCol) return;
    const pkVal = row[pkCol.name];
    executeMutation.mutate({ sql: `DELETE FROM "${selectedTable}" WHERE "${pkCol.name}" = ${typeof pkVal === 'number' ? pkVal : `'${pkVal}'`}`, confirm: true });
  };

  const isLoaded = !tablesQuery.isLoading;
  const hasError = tablesQuery.isError;
  const noDatabase = isLoaded && !hasError && tables.length === 0;

  return (
    <div className="h-full flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="database-panel">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[11px] font-semibold">Database</span>
        </div>
        <div className="flex items-center gap-1">
          <select
            className="text-[10px] bg-[var(--ide-surface)] text-[var(--ide-text)] border border-[var(--ide-border)] rounded px-1.5 py-0.5"
            value={dbEnv}
            onChange={(e) => setDbEnv(e.target.value as DbEnv)}
            data-testid="select-db-env"
          >
            <option value="development">Development</option>
            <option value="production">Production</option>
          </select>
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['db-tables'] });
            queryClient.invalidateQueries({ queryKey: ['db-usage'] });
          }} data-testid="button-refresh-db">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        {(['data', 'sql', 'settings'] as DbTab[]).map(tab => (
          <button
            key={tab}
            className={cn(
              'flex-1 text-[10px] py-1.5 font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-[#0079F2] text-[#0079F2]'
                : 'border-transparent text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
            )}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-db-${tab}`}
          >
            {tab === 'data' ? 'Data' : tab === 'sql' ? 'SQL' : 'Settings'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {tablesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" />
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <span className="text-[11px] text-[var(--ide-text-muted)] text-center">Failed to connect to database</span>
            <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => tablesQuery.refetch()} data-testid="button-retry-db">
              Retry
            </Button>
          </div>
        ) : (
          <>
            {activeTab === 'data' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-medium text-[var(--ide-text-muted)]">Tables ({tables.length})</span>
                  <Button variant="ghost" size="icon" className="w-5 h-5"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['db-tables'] })}
                    data-testid="button-refresh-tables">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>

                {noDatabase && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-3" data-testid="no-database-message">
                    <Database className="w-8 h-8 text-[var(--ide-text-muted)] opacity-40" />
                    <div className="text-center">
                      <p className="text-[12px] font-medium text-[var(--ide-text-muted)]">No database configured</p>
                      <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-70">
                        Create tables using the SQL tab or configure DATABASE_URL in your project settings.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 mt-1"
                      onClick={() => setActiveTab('sql')}
                      data-testid="button-go-to-sql"
                    >
                      <Play className="w-3 h-3 mr-1" /> Open SQL Console
                    </Button>
                  </div>
                )}

                {tables.length > 0 && (
                  <div className="max-h-[180px] overflow-y-auto shrink-0 border-b border-[var(--ide-border)]">
                    {tables.map((table) => (
                      <div key={table}>
                        <button
                          className={cn(
                            'w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--ide-surface)]/40 transition-colors',
                            selectedTable === table ? 'bg-[var(--ide-surface)]/60' : ''
                          )}
                          onClick={() => handleTableSelect(table)}
                          onDoubleClick={() => handleToggleTable(table)}
                          data-testid={`table-item-${table}`}
                        >
                          {expandedTable === table ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                          <Table className="w-3 h-3 text-[#0079F2] shrink-0" />
                          <span className="text-[11px] text-[var(--ide-text)] font-mono truncate">{table}</span>
                        </button>
                        {expandedTable === table && tableColumns[table] && (
                          <div className="pl-7 pr-3 py-0.5">
                            {tableColumns[table].map((col) => (
                              <div key={col.name} className="flex items-center justify-between py-0.5">
                                <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">{col.name}</span>
                                <span className="text-[9px] text-[var(--ide-text-muted)] font-mono uppercase">{col.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedTable && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)] shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold font-mono">{selectedTable}</span>
                        {tableData && <span className="text-[9px] text-[var(--ide-text-muted)]">{tableData.totalRows} rows</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="w-5 h-5"
                          onClick={() => { setShowInsertRow(true); if (tableData) { const vals: Record<string, string> = {}; tableData.columns.forEach(c => vals[c.name] = ''); setInsertValues(vals); } }}
                          title="Insert row" data-testid="button-insert-row">
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

                    {tableData && tableData.columns.length > 0 && (
                      <div className="px-3 py-1 flex items-center gap-2 border-b border-[var(--ide-border)] shrink-0">
                        <select className="text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1 py-0.5"
                          value={filterCol} onChange={(e) => setFilterCol(e.target.value)} data-testid="select-filter-col">
                          <option value="">Filter column...</option>
                          {tableData.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        {filterCol && (
                          <Input className="text-[10px] h-5 w-24 px-1" placeholder="value..." value={filterVal}
                            onChange={(e) => setFilterVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setDataOffset(0); }}
                            data-testid="input-filter-val" />
                        )}
                      </div>
                    )}

                    {showInsertRow && tableData && (
                      <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/30 shrink-0">
                        <div className="text-[10px] font-medium mb-1">Insert Row</div>
                        <div className="grid grid-cols-2 gap-1">
                          {tableData.columns.map(c => (
                            <div key={c.name} className="flex items-center gap-1">
                              <span className="text-[9px] text-[var(--ide-text-muted)] font-mono w-20 truncate">{c.name}</span>
                              <Input className="text-[10px] h-5 flex-1 px-1" value={insertValues[c.name] || ''} placeholder={c.hasDefault ? '(default)' : ''}
                                onChange={(e) => setInsertValues(prev => ({ ...prev, [c.name]: e.target.value }))} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <Button size="sm" className="text-[10px] h-6" onClick={handleInsertRow} data-testid="button-confirm-insert">Insert</Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowInsertRow(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    <ScrollArea className="flex-1 min-h-0">
                      {tableDataQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>
                      ) : tableData?.error ? (
                        <div className="px-3 py-4 text-[11px] text-red-400">{tableData.error}</div>
                      ) : tableData && tableData.columns.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] font-mono">
                            <thead>
                              <tr className="border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/30">
                                {tableData.columns.map(col => (
                                  <th key={col.name} className="px-2 py-1 text-left font-medium text-[var(--ide-text-muted)] cursor-pointer hover:text-[var(--ide-text)] whitespace-nowrap"
                                    onClick={() => handleSort(col.name)}>
                                    <span className="flex items-center gap-0.5">
                                      {col.name}
                                      {sortCol === col.name && (sortDir === 'ASC' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                                    </span>
                                  </th>
                                ))}
                                <th className="w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/20">
                                  {tableData.columns.map(col => (
                                    <td key={col.name} className="px-2 py-0.5 max-w-[200px] truncate cursor-pointer"
                                      onDoubleClick={() => { setEditingCell({ row: ri, col: col.name }); setEditCellValue(row[col.name] === null ? '' : String(row[col.name])); }}>
                                      {editingCell?.row === ri && editingCell?.col === col.name ? (
                                        <Input className="text-[10px] h-5 px-1" value={editCellValue}
                                          autoFocus
                                          onChange={(e) => setEditCellValue(e.target.value)}
                                          onBlur={() => handleInlineUpdate(ri, col.name, editCellValue)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleInlineUpdate(ri, col.name, editCellValue); if (e.key === 'Escape') setEditingCell(null); }} />
                                      ) : (
                                        <span className={cn(row[col.name] === null ? 'text-[var(--ide-text-muted)] italic' : 'text-[var(--ide-text)]')}>
                                          {row[col.name] === null ? 'NULL' : String(row[col.name])}
                                        </span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-1">
                                    <button className="text-[var(--ide-text-muted)] hover:text-red-400 p-0.5" onClick={() => handleDeleteRow(ri)}
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
                          {dataOffset + 1}-{Math.min(dataOffset + 100, tableData.totalRows)} of {tableData.totalRows}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" disabled={dataOffset === 0}
                            onClick={() => setDataOffset(Math.max(0, dataOffset - 100))} data-testid="button-prev-page">Prev</Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" disabled={dataOffset + 100 >= tableData.totalRows}
                            onClick={() => setDataOffset(dataOffset + 100)} data-testid="button-next-page">Next</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!selectedTable && tables.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]">
                    <LayoutGrid className="w-6 h-6 mb-2 opacity-40" />
                    <p className="text-[11px]">Select a table to view data</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sql' && (
              <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
                <textarea
                  className="flex-none h-24 p-2 text-[11px] font-mono bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded resize-none text-[var(--ide-text)]"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM ..."
                  spellCheck={false}
                  data-testid="textarea-sql-query"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="text-[10px] h-7 gap-1"
                    onClick={() => executeMutation.mutate({ sql: sqlQuery })}
                    disabled={executeMutation.isPending}
                    data-testid="button-run-query">
                    {executeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </Button>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    {dbEnv === 'production' ? 'Read-only in production' : 'Destructive queries require confirmation'}
                  </span>
                </div>

                {queryResults && (
                  <ScrollArea className="flex-1 min-h-0">
                    {queryResults.error ? (
                      <div className="p-2 text-[11px] text-red-400 bg-red-400/10 rounded">{queryResults.error}</div>
                    ) : (
                      <div>
                        <div className="text-[9px] text-[var(--ide-text-muted)] mb-1">{queryResults.rowCount} row(s) returned</div>
                        {queryResults.columns.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] font-mono">
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
                                    {row.map((val: any, ci: number) => (
                                      <td key={ci} className="px-2 py-0.5 max-w-[200px] truncate">
                                        {val === null ? <span className="text-[var(--ide-text-muted)] italic">NULL</span> : String(val)}
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
                  </ScrollArea>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium">Connection Info</span>
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
                        {Object.entries(credentialsQuery.data.credentials as Record<string, string>).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between gap-2">
                            <span className="text-[9px] text-[var(--ide-text-muted)] font-mono shrink-0">{key}</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[10px] font-mono truncate">{showCredentials ? val : '••••••••'}</span>
                              <CopyBtn text={val} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--ide-text-muted)]">No credentials available</div>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium">Usage</span>
                    {usageQuery.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)] mt-2" />
                    ) : usageQuery.data ? (
                      <div className="mt-1 space-y-1 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Tables</span>
                          <span>{usageQuery.data.tableCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Total Size</span>
                          <span>{formatBytes(usageQuery.data.dbSizeBytes || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--ide-text-muted)]">Limit</span>
                          <span>{usageQuery.data.freeLimit}</span>
                        </div>
                        {usageQuery.data.tables?.length > 0 && (
                          <div className="mt-2 border-t border-[var(--ide-border)] pt-1">
                            {usageQuery.data.tables.map((t: any) => (
                              <div key={t.table} className="flex justify-between py-0.5">
                                <span className="font-mono text-[var(--ide-text-muted)]">{t.table}</span>
                                <span>{t.rowCount} rows / {formatBytes(t.sizeBytes)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--ide-text-muted)] mt-1">Usage data not available</div>
                    )}
                  </div>

                  <div className="border-t border-[var(--ide-border)] pt-3">
                    <span className="text-[11px] font-medium text-red-400">Danger Zone</span>
                    <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">Remove all tables and data from this project's database.</p>
                    {removeConfirmOpen ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="destructive" size="sm" className="text-[10px] h-7"
                          onClick={() => removeDatabaseMutation.mutate()}
                          disabled={removeDatabaseMutation.isPending}
                          data-testid="button-confirm-remove-db">
                          {removeDatabaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Remove Everything'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setRemoveConfirmOpen(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="text-[10px] h-7 mt-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
                        onClick={() => setRemoveConfirmOpen(true)} data-testid="button-remove-db">
                        <Trash2 className="w-3 h-3 mr-1" /> Remove Database
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {confirmDialogOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-4 max-w-sm mx-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-[12px] font-medium">Confirm Destructive Query</span>
            </div>
            <p className="text-[10px] text-[var(--ide-text-muted)] mb-3">This query will modify or delete data. Are you sure?</p>
            <pre className="text-[9px] font-mono bg-[var(--ide-surface)] p-2 rounded mb-3 max-h-24 overflow-auto">{pendingDestructiveQuery}</pre>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => { setConfirmDialogOpen(false); setPendingDestructiveQuery(null); }}>Cancel</Button>
              <Button variant="destructive" size="sm" className="text-[10px]"
                onClick={() => { setConfirmDialogOpen(false); if (pendingDestructiveQuery) executeMutation.mutate({ sql: pendingDestructiveQuery, confirm: true }); setPendingDestructiveQuery(null); }}
                data-testid="button-confirm-destructive">
                Execute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
