import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  Table as TableIcon, 
  Search, 
  RefreshCw, 
  Download, 
  Upload,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  Key
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    isPrimary?: boolean;
  }[];
  rowCount: number;
}

interface DatabaseInfo {
  name: string;
  size: string;
  tables: TableSchema[];
}

export function DatabaseBrowser({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [queryInput, setQueryInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch database info
  const { data: dbInfo, refetch: refetchDbInfo } = useQuery<DatabaseInfo>({
    queryKey: [`/api/projects/${projectId}/database/info`],
    enabled: !!projectId,
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/database/info`);
      if (!response.ok) throw new Error('Failed to fetch database info');
      return response.json();
    }
  });

  // Fetch table data
  const { data: tableData, refetch: refetchTableData, isLoading: isLoadingTableData } = useQuery({
    queryKey: [`/api/projects/${projectId}/database/tables/${selectedTable}`, currentPage, pageSize],
    enabled: !!selectedTable,
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/database/tables/${selectedTable}?page=${currentPage}&pageSize=${pageSize}`);
      if (!response.ok) throw new Error('Failed to fetch table data');
      return response.json();
    }
  });

  // Execute query mutation
  const executeQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error('Failed to execute query');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Query executed",
        description: `Affected ${data?.affectedRows || 0} rows`
      });
      refetchTableData();
      refetchDbInfo();
    },
    onError: (error: Error) => {
      toast({
        title: "Query failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleExecuteQuery = () => {
    if (!queryInput.trim()) return;
    executeQueryMutation.mutate(queryInput);
  };

  const exportTable = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/database/export/${selectedTable}`);
      if (!response.ok) throw new Error('Failed to export table');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Table exported",
        description: `${selectedTable} data exported successfully`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export table data",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Database Browser</CardTitle>
              <CardDescription>
                {dbInfo ? `${dbInfo.name} (${dbInfo.size})` : 'PostgreSQL Database'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchDbInfo();
                refetchTableData();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex">
        {/* Tables Sidebar */}
        <div className="w-64 border-r bg-muted/10">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          
          <ScrollArea className="h-[calc(100%-73px)]">
            <div className="p-2">
              {dbInfo?.tables
                .filter(table => table.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((table) => (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${
                      selectedTable === table.name
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TableIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{table.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {table.rowCount} rows
                      </Badge>
                    </div>
                  </button>
                ))
              }
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <Tabs defaultValue="data" className="flex-1">
            <div className="border-b px-4">
              <TabsList className="h-12 bg-transparent">
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="query">Query</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="data" className="m-0 flex-1 flex flex-col">
              {selectedTable ? (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold">{selectedTable}</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={exportTable}>
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Insert Row
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    {isLoadingTableData ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : tableData && tableData.rows && tableData.rows.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(tableData.rows[0]).map((column) => (
                              <TableHead key={column} className="font-medium">
                                {column}
                              </TableHead>
                            ))}
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.rows.map((row: any, index: number) => (
                            <TableRow key={index}>
                              {Object.values(row).map((value: any, i: number) => (
                                <TableCell key={i} className="font-mono text-sm">
                                  {value === null ? (
                                    <span className="text-muted-foreground">NULL</span>
                                  ) : typeof value === 'object' ? (
                                    <span className="text-xs">{JSON.stringify(value)}</span>
                                  ) : (
                                    String(value)
                                  )}
                                </TableCell>
                              ))}
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <TableIcon className="h-12 w-12 mb-4" />
                        <p>No data in this table</p>
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {tableData && tableData.totalRows && tableData.totalRows > pageSize && (
                    <div className="p-4 border-t flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, tableData.totalRows)} of {tableData.totalRows} rows
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">Page {currentPage}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage * pageSize >= tableData.totalRows}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Database className="h-12 w-12 mb-4" />
                  <p>Select a table to view data</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="structure" className="m-0 p-4">
              {selectedTable && dbInfo?.tables.find(t => t.name === selectedTable) && (
                <div className="space-y-4">
                  <h3 className="font-semibold">{selectedTable} Structure</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Nullable</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead>Key</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbInfo.tables
                        .find(t => t.name === selectedTable)
                        ?.columns.map((column) => (
                          <TableRow key={column.name}>
                            <TableCell className="font-mono">{column.name}</TableCell>
                            <TableCell className="font-mono text-sm">{column.type}</TableCell>
                            <TableCell>{column.nullable ? 'Yes' : 'No'}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {column.default || '-'}
                            </TableCell>
                            <TableCell>
                              {column.isPrimary && (
                                <Badge variant="outline" className="gap-1">
                                  <Key className="h-3 w-3" />
                                  Primary
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="query" className="m-0 flex flex-col">
              <div className="flex-1 flex flex-col p-4 space-y-4">
                <div className="flex-1">
                  <textarea
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Enter SQL query..."
                    className="w-full h-full p-4 font-mono text-sm bg-background border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Write custom SQL queries to interact with your database
                  </p>
                  <Button
                    onClick={handleExecuteQuery}
                    disabled={!queryInput.trim() || executeQueryMutation.isPending}
                  >
                    {executeQueryMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Execute Query
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Card>
  );
}