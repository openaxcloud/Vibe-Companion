// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Database, 
  Table as TableIcon,
  Play,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Code,
  Eye,
  Columns,
  Key
} from 'lucide-react';
import { LightSyntaxHighlighter, darkStyle } from '@/components/ui/LightSyntaxHighlighter';

interface DatabaseTable {
  name: string;
  schema: string;
  rowCount: number;
  size: string;
}

interface TableSchema {
  column: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimary: boolean;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export function PostgreSQLMCPPanel({ projectId }: { projectId?: number }) {
  const [activeTab, setActiveTab] = useState('tables');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const { toast } = useToast();

  // Load from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('sql-query-history');
    if (savedHistory) {
      setQueryHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Query for database tables
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = useQuery<DatabaseTable[]>({
    queryKey: ['/api/mcp/postgres/tables'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/mcp/postgres/tables');
      if (!response.ok) throw new Error('Failed to fetch tables');
      return response.json();
    }
  });

  // Query for selected table schema
  const { data: tableSchema, isLoading: schemaLoading } = useQuery<TableSchema[]>({
    queryKey: ['/api/mcp/postgres/schema', selectedTable],
    queryFn: async () => {
      if (!selectedTable) return [];
      const response = await apiRequest('GET', `/api/mcp/postgres/schema/${selectedTable}`);
      if (!response.ok) throw new Error('Failed to fetch table schema');
      return response.json();
    },
    enabled: !!selectedTable
  });

  // Execute query mutation
  const executeQueryMutation = useMutation<QueryResult, Error, string>({
    mutationFn: async (query: string) => {
      const response = await apiRequest('POST', '/api/mcp/postgres/query', { query });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Query execution failed');
      }
      return response.json();
    },
    onSuccess: (data, query) => {
      toast({
        title: 'Query Executed',
        description: `${data.rowCount} rows affected in ${data.executionTime}ms`
      });
      
      // Add to history
      const newHistory = [query, ...queryHistory.filter(q => q !== query)].slice(0, 10);
      setQueryHistory(newHistory);
      localStorage.setItem('sql-query-history', JSON.stringify(newHistory));
    },
    onError: (error) => {
      toast({
        title: 'Query Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Backup database mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/mcp/postgres/backup');
      if (!response.ok) throw new Error('Backup failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Backup Created',
        description: `Database backed up successfully: ${data.filename}`
      });
    },
    onError: (error) => {
      toast({
        title: 'Backup Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const queryResult = executeQueryMutation.data;

  return (
    <Card className="h-full bg-[var(--ecode-bg)] border-[var(--ecode-border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--ecode-accent)]" />
            <CardTitle className="text-[var(--ecode-text)]">PostgreSQL Database</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
            >
              {backupMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <CardDescription className="text-[var(--ecode-muted)]">
          Execute queries and manage your PostgreSQL database
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-[var(--ecode-sidebar)]">
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="query">SQL Query</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-medium text-[var(--ecode-text)]">Database Tables</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchTables()}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <ScrollArea className="h-[400px] border rounded-lg bg-[var(--ecode-sidebar)]">
                  {tablesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--ecode-muted)]" />
                    </div>
                  ) : tables?.length === 0 ? (
                    <div className="text-center py-8 text-[var(--ecode-muted)]">
                      <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tables found</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {tables?.map((table) => (
                        <div
                          key={table.name}
                          onClick={() => setSelectedTable(table.name)}
                          className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                            selectedTable === table.name
                              ? 'bg-[var(--ecode-accent)]/10 border border-[var(--ecode-accent)]'
                              : 'hover:bg-[var(--ecode-sidebar-hover)]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TableIcon className="w-4 h-4 text-[var(--ecode-muted)]" />
                              <span className="font-medium text-[var(--ecode-text)]">{table.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[11px]">
                              {table.rowCount} rows
                            </Badge>
                          </div>
                          <div className="text-[11px] text-[var(--ecode-muted)] mt-1">
                            Schema: {table.schema} • Size: {table.size}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div>
                {selectedTable && (
                  <div className="border rounded-lg bg-[var(--ecode-sidebar)] p-4">
                    <h4 className="font-medium text-[var(--ecode-text)] mb-3 flex items-center gap-2">
                      <Columns className="w-4 h-4" />
                      Table Schema: {selectedTable}
                    </h4>
                    {schemaLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--ecode-muted)]" />
                      </div>
                    ) : (
                      <ScrollArea className="h-[340px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Column</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Nullable</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableSchema?.map((col) => (
                              <TableRow key={col.column}>
                                <TableCell className="font-mono text-[13px]">
                                  <div className="flex items-center gap-1">
                                    {col.isPrimary && <Key className="w-3 h-3 text-yellow-500" />}
                                    {col.column}
                                  </div>
                                </TableCell>
                                <TableCell className="text-[13px] text-[var(--ecode-muted)]">
                                  {col.type}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={col.nullable ? 'outline' : 'default'} className="text-[11px]">
                                    {col.nullable ? 'Yes' : 'No'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="query" className="space-y-4">
            <div>
              <Label htmlFor="sql-query">SQL Query</Label>
              <Textarea
                id="sql-query"
                placeholder="SELECT * FROM users LIMIT 10;"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="font-mono text-[13px] bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] min-h-[200px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={() => executeQueryMutation.mutate(sqlQuery)}
                disabled={!sqlQuery.trim() || executeQueryMutation.isPending}
              >
                {executeQueryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Query
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  const viewQuery = selectedTable 
                    ? `SELECT * FROM ${selectedTable} LIMIT 100;`
                    : 'SELECT * FROM  LIMIT 100;';
                  setSqlQuery(viewQuery);
                }}
                disabled={!selectedTable}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Table
              </Button>
            </div>

            {queryHistory.length > 0 && (
              <div>
                <h4 className="text-[13px] font-medium text-[var(--ecode-text)] mb-2">Query History</h4>
                <ScrollArea className="h-[150px] border rounded-lg bg-[var(--ecode-sidebar)] p-2">
                  {queryHistory.map((query, index) => (
                    <div
                      key={index}
                      onClick={() => setSqlQuery(query)}
                      className="p-2 mb-1 rounded hover:bg-[var(--ecode-sidebar-hover)] cursor-pointer"
                    >
                      <code className="text-[11px] text-[var(--ecode-muted)]">{query}</code>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {queryResult ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-medium text-[var(--ecode-text)]">
                    Query Results ({queryResult.rowCount} rows)
                  </h4>
                  <Badge variant="outline">
                    Execution time: {queryResult.executionTime}ms
                  </Badge>
                </div>

                <ScrollArea className="h-[400px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {queryResult.columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryResult.rows.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="font-mono text-[13px]">
                              {cell === null ? (
                                <span className="text-[var(--ecode-muted)]">NULL</span>
                              ) : typeof cell === 'object' ? (
                                <code className="text-[11px]">{JSON.stringify(cell)}</code>
                              ) : (
                                String(cell)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--ecode-muted)]">
                <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No query results yet</p>
                <p className="text-[13px] mt-1">Execute a query to see results here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}