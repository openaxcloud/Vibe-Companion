import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Database, Loader2, Play, Table2, X, ChevronDown, ChevronRight } from "lucide-react";

interface DatabasePanelProps {
  projectId: string;
  onClose: () => void;
}

export default function DatabasePanel({ projectId, onClose }: DatabasePanelProps) {
  const { toast } = useToast();
  const [sqlQuery, setSqlQuery] = useState("SELECT name FROM sqlite_master WHERE type='table';");
  const [queryResults, setQueryResults] = useState<{ columns: string[]; rows: any[][]; rowCount: number; error?: string } | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, { name: string; type: string }[]>>({});

  const runQueryMutation = useMutation({
    mutationFn: async (sql: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/query`, { sql });
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

  const loadTablesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/query`, {
        sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.rows) {
        setTables(data.rows.map((r: any[]) => r[0]));
      }
    },
  });

  const loadColumnsMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/database/query`, {
        sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public' ORDER BY ordinal_position;`
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

  return (
    <div className="flex flex-col h-full" data-testid="database-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[#0079F2]" /> Database
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => loadTablesMutation.mutate()} data-testid="button-refresh-tables">
            <Table2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-database">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="border-b border-[var(--ide-border)]">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Tables</span>
          {tables.length === 0 && !loadTablesMutation.isPending && (
            <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] text-[#0079F2] hover:bg-[#0079F2]/10" onClick={() => loadTablesMutation.mutate()} data-testid="button-load-tables">
              Load
            </Button>
          )}
        </div>
        {loadTablesMutation.isPending && (
          <div className="px-3 py-2"><Loader2 className="w-3.5 h-3.5 text-[var(--ide-text-muted)] animate-spin" /></div>
        )}
        {tables.length > 0 && (
          <div className="max-h-[160px] overflow-y-auto">
            {tables.map((table) => (
              <div key={table}>
                <button
                  className="w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-[var(--ide-surface)]/40 transition-colors group"
                  onClick={() => handleToggleTable(table)}
                  onDoubleClick={() => { setSqlQuery(`SELECT * FROM "${table}" LIMIT 50;`); }}
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
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Query</span>
            <Button
              size="sm"
              className="h-6 px-3 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded gap-1"
              onClick={() => runQueryMutation.mutate(sqlQuery)}
              disabled={!sqlQuery.trim() || runQueryMutation.isPending}
              data-testid="button-run-query"
            >
              {runQueryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </Button>
          </div>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            className="w-full h-[60px] text-[11px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-2 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#0079F2] resize-none"
            placeholder="Enter SQL query..."
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runQueryMutation.mutate(sqlQuery); } }}
            data-testid="textarea-sql-query"
          />
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
    </div>
  );
}
