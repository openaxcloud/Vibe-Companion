import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Database, Loader2, Play, Table2, X, ChevronDown, ChevronRight,
  Copy, Check, Download, Plus, Trash2, AlertTriangle, Settings, Eye, EyeOff,
  ArrowUp, ArrowDown, Search, RefreshCw,
} from "lucide-react";

interface DatabasePanelProps {
  projectId: string;
  onClose: () => void;
}

type DbTab = "data" | "sql" | "settings";
type DbEnv = "development" | "production";

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      data-testid={`button-copy-${label || "credential"}`}
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function DatabasePanel({ projectId, onClose }: DatabasePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DbTab>("data");
  const [dbEnv, setDbEnv] = useState<DbEnv>("development");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, { name: string; type: string }[]>>({});
  const [tablePkCols, setTablePkCols] = useState<Record<string, string>>({});

  const [sqlQuery, setSqlQuery] = useState("SELECT 1;");
  const [queryResults, setQueryResults] = useState<{ columns: string[]; rows: any[][]; rowCount: number; error?: string } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDestructiveQuery, setPendingDestructiveQuery] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [dataOffset, setDataOffset] = useState(0);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState("");
  const [showInsertRow, setShowInsertRow] = useState(false);
  const [insertValues, setInsertValues] = useState<Record<string, string>>({});
  const [showCredentials, setShowCredentials] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const tablesQuery = useQuery<string[]>({
    queryKey: ["db-tables", projectId, dbEnv],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`/api/projects/${projectId}/database/tables?env=${dbEnv}`, { credentials: "include", signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Database connection failed (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.tables || [];
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    },
    retry: 1,
    staleTime: 15000,
  });

  const tableDataQuery = useQuery<TableDataResult>({
    queryKey: ["db-table-data", projectId, selectedTable, dbEnv, sortCol, sortDir, filterCol, filterVal, dataOffset],
    queryFn: async () => {
      if (!selectedTable) return { columns: [], rows: [], totalRows: 0, limit: 100, offset: 0 };
      const params = new URLSearchParams({
        env: dbEnv,
        limit: "100",
        offset: String(dataOffset),
      });
      if (sortCol) { params.set("sort", sortCol); params.set("dir", sortDir); }
      if (filterCol && filterVal) { params.set("filterCol", filterCol); params.set("filterVal", filterVal); }
      const res = await fetch(`/api/projects/${projectId}/database/tables/${selectedTable}/data?${params}`, { credentials: "include" });
      if (!res.ok) return { columns: [], rows: [], totalRows: 0, limit: 100, offset: 0, error: "Failed to load" };
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const credentialsQuery = useQuery({
    queryKey: ["db-credentials", projectId, dbEnv],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/database/credentials?env=${dbEnv}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === "settings",
  });

  const usageQuery = useQuery({
    queryKey: ["db-usage", projectId, dbEnv],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/database/usage?env=${dbEnv}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === "settings",
  });

  const runQueryMutation = useMutation({
    mutationFn: async (sql: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, { sql, env: dbEnv });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        setQueryResults({ columns: [], rows: [], rowCount: 0, error: data.error });
      } else {
        setQueryResults(data);
      }
    },
    onError: (err: any) => {
      setQueryResults({ columns: [], rows: [], rowCount: 0, error: err.message || "Query failed" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async ({ sql, confirm }: { sql: string; confirm?: boolean }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, { sql, confirm, env: dbEnv });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresConfirmation) {
        setPendingDestructiveQuery(data.sql || sqlQuery);
        setConfirmDialogOpen(true);
        return;
      }
      if (data.error === "destructive_query") {
        setPendingDestructiveQuery(sqlQuery);
        setConfirmDialogOpen(true);
        return;
      }
      if (data.error) {
        setQueryResults({ columns: [], rows: [], rowCount: 0, error: data.error });
      } else {
        setQueryResults(data);
        queryClient.invalidateQueries({ queryKey: ["db-tables"] });
        if (selectedTable) queryClient.invalidateQueries({ queryKey: ["db-table-data"] });
      }
    },
    onError: (err: any) => {
      try {
        const parsed = JSON.parse(err.message || "{}");
        if (parsed.requiresConfirmation) {
          setPendingDestructiveQuery(sqlQuery);
          setConfirmDialogOpen(true);
          return;
        }
      } catch {}
      setQueryResults({ columns: [], rows: [], rowCount: 0, error: err.message || "Query failed" });
    },
  });

  const cellUpdateMutation = useMutation({
    mutationFn: async ({ table, column, value, pkCol, pkVal }: { table: string; column: string; value: string; pkCol: string; pkVal: any }) => {
      const sql = `UPDATE "${table}" SET "${column}" = '${value.replace(/'/g, "''")}' WHERE "${pkCol}" = '${String(pkVal).replace(/'/g, "''")}'`;
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, { sql, confirm: true, env: dbEnv });
      return res.json();
    },
    onSuccess: () => {
      setEditingCell(null);
      queryClient.invalidateQueries({ queryKey: ["db-table-data"] });
      toast({ title: "Cell updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const insertRowMutation = useMutation({
    mutationFn: async ({ table, values }: { table: string; values: Record<string, string> }) => {
      const cols = Object.keys(values).filter(k => values[k] !== "");
      const vals = cols.map(c => `'${values[c].replace(/'/g, "''")}'`);
      const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")})`;
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, { sql, confirm: true, env: dbEnv });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Insert failed", description: data.error, variant: "destructive" });
      } else {
        setShowInsertRow(false);
        setInsertValues({});
        queryClient.invalidateQueries({ queryKey: ["db-table-data"] });
        toast({ title: "Row inserted" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Insert failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: async ({ table, pkCol, pkVal }: { table: string; pkCol: string; pkVal: any }) => {
      const sql = `DELETE FROM "${table}" WHERE "${pkCol}" = '${String(pkVal).replace(/'/g, "''")}'`;
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, { sql, confirm: true, env: dbEnv });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db-table-data"] });
      toast({ title: "Row deleted" });
    },
  });

  const removeDatabaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/remove`, { confirmToken: "REMOVE_DATABASE", env: dbEnv });
      return res.json();
    },
    onSuccess: (data) => {
      setRemoveConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["db-tables"] });
      queryClient.invalidateQueries({ queryKey: ["db-usage"] });
      toast({ title: "Database removed", description: `Dropped ${data.droppedTables?.length || 0} tables` });
    },
    onError: (err: any) => {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    },
  });

  const loadColumnsMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, {
        sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`,
        env: dbEnv,
      });
      return res.json();
    },
    onSuccess: (data, tableName) => {
      if (data.rows) {
        setTableColumns(prev => ({
          ...prev,
          [tableName]: data.rows.map((r: any[]) => ({ name: r[0], type: r[1] }))
        }));
      }
    },
  });

  const loadPkMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/execute`, {
        sql: `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = '${tableName.replace(/'/g, "''")}' ORDER BY kcu.ordinal_position LIMIT 1`,
        env: dbEnv,
      });
      return res.json();
    },
    onSuccess: (data, tableName) => {
      if (data.rows && data.rows.length > 0) {
        setTablePkCols(prev => ({ ...prev, [tableName]: data.rows[0][0] }));
      }
    },
  });

  const handleTableSelect = (table: string) => {
    setSelectedTable(table);
    setSortCol(null);
    setSortDir("ASC");
    setFilterCol("");
    setFilterVal("");
    setDataOffset(0);
    setEditingCell(null);
    setShowInsertRow(false);
    if (!tablePkCols[table]) {
      loadPkMutation.mutate(table);
    }
  };

  const handleToggleTable = (table: string) => {
    if (expandedTable === table) {
      setExpandedTable(null);
    } else {
      setExpandedTable(table);
      if (!tableColumns[table]) {
        loadColumnsMutation.mutate(table);
      }
    }
  };

  const handleColumnSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === "ASC" ? "DESC" : "ASC");
    } else {
      setSortCol(col);
      setSortDir("ASC");
    }
    setDataOffset(0);
  };

  const handleRunSql = useCallback(() => {
    const trimmed = sqlQuery.trim().toUpperCase();
    const isReadOnly = trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.startsWith("EXPLAIN") || trimmed.startsWith("SHOW");
    if (isReadOnly) {
      runQueryMutation.mutate(sqlQuery);
    } else {
      executeMutation.mutate({ sql: sqlQuery });
    }
  }, [sqlQuery]);

  const exportCsv = useCallback(() => {
    if (!tableDataQuery.data || !selectedTable) return;
    const { columns, rows } = tableDataQuery.data;
    const header = columns.map(c => c.name).join(",");
    const csvRows = rows.map(row =>
      columns.map(c => {
        const val = row[c.name];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tableDataQuery.data, selectedTable]);

  const tables = tablesQuery.data || [];
  const tableData = tableDataQuery.data;
  const pkCol = selectedTable && tablePkCols[selectedTable] ? tablePkCols[selectedTable] : tableData?.columns?.[0]?.name;

  return (
    <div className="flex flex-col h-full" data-testid="database-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[#0079F2]" /> Database
        </span>
        <div className="flex items-center gap-1">
          <select
            value={dbEnv}
            onChange={(e) => setDbEnv(e.target.value as DbEnv)}
            className="text-[9px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded px-1.5 py-0.5 outline-none focus:border-[#0079F2]"
            data-testid="select-db-env"
          >
            <option value="development">Development</option>
            <option value="production">Production (read-only)</option>
          </select>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-database">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[var(--ide-border)]">
        {(["data", "sql", "settings"] as DbTab[]).map(tab => (
          <button
            key={tab}
            className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${activeTab === tab ? "text-[var(--ide-text)] border-b-2 border-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-db-${tab}`}
          >
            {tab === "data" ? "My Data" : tab === "sql" ? "SQL Runner" : "Settings"}
          </button>
        ))}
      </div>

      {activeTab === "data" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="border-b border-[var(--ide-border)]">
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Tables</span>
                <span className="text-[9px] text-[var(--ide-text-muted)] font-mono" data-testid="text-db-schema">
                  {dbEnv === "production" ? "prod" : "dev"}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["db-tables"] })}
                data-testid="button-refresh-tables">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            {tablesQuery.isLoading && (
              <div className="px-3 py-2"><Loader2 className="w-3.5 h-3.5 text-[var(--ide-text-muted)] animate-spin" /></div>
            )}
            {tablesQuery.isError && (
              <div className="flex flex-col items-center justify-center py-8 px-4 gap-2" data-testid="db-error-message">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center">Failed to connect to database</p>
                <button
                  onClick={() => tablesQuery.refetch()}
                  className="mt-1 text-[10px] px-3 py-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/80 transition-colors border border-[var(--ide-border)]"
                  data-testid="button-retry-db"
                >
                  Retry
                </button>
              </div>
            )}
            {!tablesQuery.isError && tables.length > 0 && (
              <div className="max-h-[160px] overflow-y-auto">
                {tables.map((table) => (
                  <div key={table}>
                    <button
                      className={`w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-[var(--ide-surface)]/40 transition-colors ${selectedTable === table ? "bg-[var(--ide-surface)]/60" : ""}`}
                      onClick={() => handleTableSelect(table)}
                      onDoubleClick={() => handleToggleTable(table)}
                      data-testid={`table-item-${table}`}
                    >
                      {expandedTable === table ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                      <Table2 className="w-3 h-3 text-[#0079F2] shrink-0" />
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
            {tables.length === 0 && !tablesQuery.isLoading && !tablesQuery.isError && (
              <div className="flex flex-col items-center justify-center py-8 px-4 gap-2" data-testid="empty-tables-message">
                <Database className="w-7 h-7 text-[var(--ide-text-muted)] opacity-40" />
                <p className="text-[11px] font-medium text-[var(--ide-text-muted)]">Tables (0)</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] opacity-70 text-center">
                  Your database is ready. Use the SQL tab to create tables.
                </p>
                <button
                  onClick={() => setActiveTab("sql")}
                  className="mt-1 text-[10px] px-3 py-1 rounded bg-[var(--ide-accent)]/10 text-[var(--ide-accent)] hover:bg-[var(--ide-accent)]/20 transition-colors"
                  data-testid="button-open-sql-tab"
                >
                  Open SQL Runner
                </button>
              </div>
            )}
          </div>

          {selectedTable && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ide-border)]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--ide-text)] font-mono">{selectedTable}</span>
                  {tableData && <span className="text-[9px] text-[var(--ide-text-muted)]">{tableData.totalRows} rows</span>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => { setShowInsertRow(true); if (tableData) { const vals: Record<string, string> = {}; tableData.columns.forEach(c => vals[c.name] = ""); setInsertValues(vals); } }}
                    title="Insert row"
                    data-testid="button-insert-row">
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={exportCsv}
                    title="Export CSV"
                    data-testid="button-export-csv">
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["db-table-data"] })}
                    data-testid="button-refresh-data">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="px-3 py-1 border-b border-[var(--ide-border)] flex items-center gap-2">
                <Search className="w-3 h-3 text-[var(--ide-text-muted)]" />
                <select
                  value={filterCol}
                  onChange={(e) => setFilterCol(e.target.value)}
                  className="text-[9px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded px-1 py-0.5"
                  data-testid="select-filter-col"
                >
                  <option value="">Filter column...</option>
                  {tableData?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                {filterCol && (
                  <input
                    type="text"
                    value={filterVal}
                    onChange={(e) => { setFilterVal(e.target.value); setDataOffset(0); }}
                    placeholder="Filter value..."
                    className="text-[9px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded px-1.5 py-0.5 flex-1 outline-none focus:border-[#0079F2] font-mono"
                    data-testid="input-filter-value"
                  />
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {tableDataQuery.isLoading && (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
                )}
                {tableData?.error && (
                  <div className="px-3 py-2">
                    <div className="text-[11px] text-red-400 bg-red-500/10 rounded px-2.5 py-2 font-mono">{tableData.error}</div>
                  </div>
                )}
                {tableData && !tableData.error && tableData.columns.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono" data-testid="table-data-grid">
                      <thead>
                        <tr className="border-b border-[var(--ide-border)]">
                          <th className="px-1.5 py-1 text-[var(--ide-text-muted)] font-normal w-6">#</th>
                          {tableData.columns.map((col) => (
                            <th
                              key={col.name}
                              className="text-left px-2 py-1 text-[var(--ide-text-secondary)] font-semibold whitespace-nowrap cursor-pointer hover:bg-[var(--ide-surface)]/40"
                              onClick={() => handleColumnSort(col.name)}
                            >
                              <span className="flex items-center gap-1">
                                {col.name}
                                <span className="text-[8px] text-[var(--ide-text-muted)]">{col.type}</span>
                                {sortCol === col.name && (sortDir === "ASC" ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}
                              </span>
                            </th>
                          ))}
                          <th className="px-1 py-1 w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {showInsertRow && (
                          <tr className="border-b border-[var(--ide-border)] bg-green-500/5">
                            <td className="px-1.5 py-1 text-[var(--ide-text-muted)]">+</td>
                            {tableData.columns.map(col => (
                              <td key={col.name} className="px-1 py-0.5">
                                <input
                                  type="text"
                                  value={insertValues[col.name] || ""}
                                  onChange={(e) => setInsertValues(prev => ({ ...prev, [col.name]: e.target.value }))}
                                  placeholder={col.hasDefault ? "(default)" : col.name}
                                  className="w-full text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1 py-0.5 text-[var(--ide-text)] outline-none focus:border-[#0079F2] font-mono"
                                  data-testid={`input-insert-${col.name}`}
                                />
                              </td>
                            ))}
                            <td className="px-1 py-0.5">
                              <div className="flex gap-0.5">
                                <button
                                  className="p-0.5 text-green-400 hover:text-green-300"
                                  onClick={() => insertRowMutation.mutate({ table: selectedTable, values: insertValues })}
                                  data-testid="button-confirm-insert"
                                ><Check className="w-3 h-3" /></button>
                                <button
                                  className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400"
                                  onClick={() => setShowInsertRow(false)}
                                  data-testid="button-cancel-insert"
                                ><X className="w-3 h-3" /></button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {tableData.rows.map((row, i) => (
                          <tr key={i} className="group border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30">
                            <td className="px-1.5 py-1 text-[var(--ide-text-muted)]">{dataOffset + i + 1}</td>
                            {tableData.columns.map((col) => (
                              <td
                                key={col.name}
                                className="px-2 py-1 text-[var(--ide-text)] whitespace-nowrap max-w-[200px] truncate cursor-pointer hover:bg-[var(--ide-surface)]/50"
                                onDoubleClick={() => {
                                  if (dbEnv === "production") return;
                                  setEditingCell({ row: i, col: col.name });
                                  setEditCellValue(row[col.name] === null ? "" : String(row[col.name]));
                                }}
                                data-testid={`cell-${i}-${col.name}`}
                              >
                                {editingCell?.row === i && editingCell?.col === col.name ? (
                                  <input
                                    type="text"
                                    value={editCellValue}
                                    onChange={(e) => setEditCellValue(e.target.value)}
                                    onBlur={() => {
                                      if (pkCol && editCellValue !== String(row[col.name] ?? "")) {
                                        cellUpdateMutation.mutate({ table: selectedTable, column: col.name, value: editCellValue, pkCol, pkVal: row[pkCol] });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && pkCol) {
                                        cellUpdateMutation.mutate({ table: selectedTable, column: col.name, value: editCellValue, pkCol, pkVal: row[pkCol] });
                                      }
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    autoFocus
                                    className="w-full text-[10px] bg-[var(--ide-bg)] border border-[#0079F2] rounded px-1 py-0 text-[var(--ide-text)] outline-none font-mono"
                                    data-testid={`input-edit-cell-${i}-${col.name}`}
                                  />
                                ) : (
                                  row[col.name] === null ? <span className="text-[var(--ide-text-muted)] italic">null</span> : String(row[col.name])
                                )}
                              </td>
                            ))}
                            <td className="px-1 py-1">
                              {dbEnv !== "production" && pkCol && (
                                <button
                                  className="p-0.5 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100"
                                  onClick={() => {
                                    if (confirm("Delete this row?")) {
                                      deleteRowMutation.mutate({ table: selectedTable, pkCol, pkVal: row[pkCol] });
                                    }
                                  }}
                                  data-testid={`button-delete-row-${i}`}
                                ><Trash2 className="w-3 h-3" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {tableData && tableData.totalRows > 100 && (
                <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--ide-border)]">
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    Showing {dataOffset + 1}-{Math.min(dataOffset + 100, tableData.totalRows)} of {tableData.totalRows}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px]"
                      disabled={dataOffset === 0}
                      onClick={() => setDataOffset(Math.max(0, dataOffset - 100))}
                      data-testid="button-prev-page">Prev</Button>
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px]"
                      disabled={dataOffset + 100 >= tableData.totalRows}
                      onClick={() => setDataOffset(dataOffset + 100)}
                      data-testid="button-next-page">Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedTable && !tablesQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
              <Table2 className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
              <p className="text-xs text-[var(--ide-text-muted)]">Select a table to browse data</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "sql" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-[var(--ide-border)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">SQL Runner</span>
              <Button
                size="sm"
                className="h-6 px-3 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded gap-1"
                onClick={handleRunSql}
                disabled={!sqlQuery.trim() || runQueryMutation.isPending || executeMutation.isPending}
                data-testid="button-run-query"
              >
                {(runQueryMutation.isPending || executeMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Run
              </Button>
            </div>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full h-[80px] text-[11px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-2 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#0079F2] resize-none"
              placeholder="Enter SQL query... (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP)"
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRunSql(); } }}
              data-testid="textarea-sql-query"
            />
            <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">All SQL statements supported. Destructive queries require confirmation. Ctrl+Enter to execute.</p>
          </div>

          <div className="flex-1 overflow-auto">
            {queryResults?.error && (
              <div className="px-3 py-2">
                <div className="text-[11px] text-red-400 bg-red-500/10 rounded px-2.5 py-2 font-mono" data-testid="text-query-error">{queryResults.error}</div>
              </div>
            )}
            {queryResults && !queryResults.error && queryResults.columns.length > 0 && (
              <div className="px-1">
                <div className="text-[9px] text-[var(--ide-text-muted)] px-2 py-1">{queryResults.rowCount} row{queryResults.rowCount === 1 ? "" : "s"}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono" data-testid="table-query-results">
                    <thead>
                      <tr className="border-b border-[var(--ide-border)]">
                        {queryResults.columns.map((col, i) => (
                          <th key={i} className="text-left px-2 py-1 text-[var(--ide-text-secondary)] font-semibold whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResults.rows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-[var(--ide-text)] whitespace-nowrap max-w-[200px] truncate">
                              {cell === null ? <span className="text-[var(--ide-text-muted)] italic">null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {queryResults && !queryResults.error && queryResults.columns.length === 0 && queryResults.rowCount >= 0 && (
              <div className="px-3 py-2">
                <div className="text-[11px] text-[#0CCE6B] bg-[#0CCE6B]/10 rounded px-2.5 py-2">Query executed successfully. {queryResults.rowCount} row{queryResults.rowCount === 1 ? "" : "s"} affected.</div>
              </div>
            )}
            {!queryResults && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Database className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                <p className="text-xs text-[var(--ide-text-muted)]">Run a query to see results</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">Ctrl+Enter to execute</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-3 border-b border-[var(--ide-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Connection Credentials</span>
              <button
                className="text-[9px] text-[#0079F2] hover:underline flex items-center gap-1"
                onClick={() => setShowCredentials(!showCredentials)}
                data-testid="button-toggle-credentials"
              >
                {showCredentials ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showCredentials ? "Hide" : "Show"}
              </button>
            </div>
            {credentialsQuery.isLoading && <Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" />}
            {credentialsQuery.data?.credentials && (
              <div className="space-y-1.5">
                {Object.entries(credentialsQuery.data.credentials as Record<string, string>).map(([key, maskedVal]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--ide-text-secondary)] font-mono w-24 shrink-0">{key}</span>
                    <span className="text-[9px] text-[var(--ide-text)] font-mono truncate flex-1" data-testid={`text-credential-${key}`}>
                      {showCredentials ? maskedVal : maskedVal.replace(/[^:/@.]/g, "*").slice(0, 30) + "..."}
                    </span>
                    <CopyButton text={maskedVal} label={key.toLowerCase()} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-3 border-b border-[var(--ide-border)]">
            <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Usage</span>
            {usageQuery.isLoading && <Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin mt-2" />}
            {usageQuery.data && !usageQuery.data.error && (
              <div className="mt-2 space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[var(--ide-text-muted)]">Database Size</span>
                    <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-db-size">{formatBytes(usageQuery.data.dbSizeBytes)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--ide-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0079F2] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (usageQuery.data.dbSizeBytes / usageQuery.data.freeLimitBytes) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-[var(--ide-text-muted)]">{usageQuery.data.tableCount} tables</span>
                    <span className="text-[9px] text-[var(--ide-text-muted)]">{usageQuery.data.freeLimit} free</span>
                  </div>
                </div>

                {usageQuery.data.tables && usageQuery.data.tables.length > 0 && (
                  <div>
                    <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider">Table Row Counts</span>
                    <div className="mt-1 space-y-0.5">
                      {usageQuery.data.tables.map((t: any) => (
                        <div key={`${t.schema}.${t.table}`} className="flex items-center justify-between">
                          <span className="text-[9px] text-[var(--ide-text-secondary)] font-mono">{t.schema}.{t.table}</span>
                          <span className="text-[9px] text-[var(--ide-text-muted)]">{t.rowCount} rows</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {dbEnv !== "production" && (
          <div className="px-3 py-3">
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Danger Zone</span>
            <p className="text-[9px] text-[var(--ide-text-muted)] mt-1 mb-2">
              Remove all tables from this database. This action cannot be undone.
            </p>
            {!removeConfirmOpen ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-3 text-[10px]"
                onClick={() => setRemoveConfirmOpen(true)}
                data-testid="button-remove-database"
              >
                <AlertTriangle className="w-3 h-3 mr-1" /> Remove Database
              </Button>
            ) : (
              <div className="bg-red-500/10 rounded p-2 space-y-2">
                <p className="text-[10px] text-red-400">Are you sure? This will drop ALL tables in the database?</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 px-3 text-[9px]"
                    onClick={() => removeDatabaseMutation.mutate()}
                    disabled={removeDatabaseMutation.isPending}
                    data-testid="button-confirm-remove-database"
                  >
                    {removeDatabaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, Remove Everything"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-3 text-[9px]"
                    onClick={() => setRemoveConfirmOpen(false)}
                    data-testid="button-cancel-remove-database"
                  >Cancel</Button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {confirmDialogOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-4 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-semibold text-[var(--ide-text)]">Destructive Query</h3>
            </div>
            <p className="text-[11px] text-[var(--ide-text-secondary)] mb-1">This query may modify or delete data:</p>
            <pre className="text-[10px] font-mono text-[var(--ide-text)] bg-[var(--ide-bg)] rounded p-2 mb-3 max-h-20 overflow-auto">
              {pendingDestructiveQuery || sqlQuery}
            </pre>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-[10px]"
                onClick={() => { setConfirmDialogOpen(false); setPendingDestructiveQuery(null); }}
                data-testid="button-cancel-destructive"
              >Cancel</Button>
              <Button variant="destructive" size="sm" className="h-7 text-[10px]"
                onClick={() => {
                  setConfirmDialogOpen(false);
                  executeMutation.mutate({ sql: pendingDestructiveQuery || sqlQuery, confirm: true });
                  setPendingDestructiveQuery(null);
                }}
                data-testid="button-confirm-destructive"
              >Execute</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
