import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageShell, PageHeader, PageShellLoading } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Database, Plus, Search, Download, Upload,
  Trash2, Edit, Key, Table, BarChart3, 
  RefreshCw, Copy, Check, Clock, AlertCircle,
  FileJson, FileText, Binary, Filter, X,
  Settings, Info, Zap, HardDrive
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface KVEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json' | 'binary';
  size: number;
  ttl?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface KVStats {
  totalKeys: number;
  totalSize: number;
  maxSize: number;
  avgKeySize: number;
  avgValueSize: number;
  expiringKeys: number;
}

export default function KVStorePage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'string' | 'number' | 'boolean' | 'json' | 'binary'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KVEntry | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({
    key: '',
    value: '',
    type: 'string' as KVEntry['type'],
    ttl: '',
    enableTTL: false
  });
  const [importData, setImportData] = useState('');

  const { data: entries = [], isLoading, error: entriesError } = useQuery<KVEntry[]>({
    queryKey: ['/api/kv-store'],
    queryFn: async () => {
      const response = await fetch('/api/kv-store', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch KV entries');
      }
      return response.json();
    }
  });

  const { data: stats } = useQuery<KVStats>({
    queryKey: ['/api/kv-store/stats'],
    queryFn: async () => {
      const response = await fetch('/api/kv-store/stats', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch KV stats');
      }
      return response.json();
    }
  });

  const addEntryMutation = useMutation({
    mutationFn: async (entry: { key: string; value: any; type: string; ttl?: number }) => {
      const res = await apiRequest('POST', '/api/kv-store', entry);
      if (!res.ok) throw new Error('Failed to add entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store/stats'] });
      toast({
        title: "Entry added",
        description: `Key "${newEntry.key}" has been added successfully`,
      });
      setShowAddDialog(false);
      resetNewEntry();
    },
    onError: () => {
      toast({
        title: "Failed to add entry",
        description: "Please check your input and try again",
        variant: "destructive"
      });
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: async (entry: { key: string; value: any; type: string; ttl?: number }) => {
      const res = await apiRequest('PUT', `/api/kv-store/${encodeURIComponent(entry.key)}`, entry);
      if (!res.ok) throw new Error('Failed to update entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store/stats'] });
      toast({
        title: "Entry updated",
        description: "The key-value pair has been updated",
      });
      setShowEditDialog(false);
      setSelectedEntry(null);
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest('DELETE', `/api/kv-store/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Failed to delete entry');
      return res.json();
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store/stats'] });
      toast({
        title: "Entry deleted",
        description: `Key "${key}" has been removed`,
      });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const res = await apiRequest('DELETE', '/api/kv-store/bulk', { keys });
      if (!res.ok) throw new Error('Failed to delete entries');
      return res.json();
    },
    onSuccess: (_, keys) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store/stats'] });
      toast({
        title: "Entries deleted",
        description: `${keys.length} entries have been removed`,
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest('POST', '/api/kv-store/import', { data });
      if (!res.ok) throw new Error('Failed to import data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kv-store/stats'] });
      toast({
        title: "Import successful",
        description: "Data has been imported successfully",
      });
      setShowImportDialog(false);
      setImportData('');
    }
  });

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           String(entry.value).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || entry.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [entries, searchQuery, filterType]);

  const resetNewEntry = () => {
    setNewEntry({ key: '', value: '', type: 'string', ttl: '', enableTTL: false });
  };

  const handleAddEntry = () => {
    if (!newEntry.key.trim()) {
      toast({
        title: "Validation error",
        description: "Key is required",
        variant: "destructive"
      });
      return;
    }

    let parsedValue: any = newEntry.value;
    
    try {
      switch (newEntry.type) {
        case 'number':
          parsedValue = parseFloat(newEntry.value);
          if (isNaN(parsedValue)) throw new Error('Invalid number');
          break;
        case 'boolean':
          parsedValue = newEntry.value.toLowerCase() === 'true';
          break;
        case 'json':
          parsedValue = JSON.parse(newEntry.value);
          break;
      }
    } catch (e) {
      toast({
        title: "Invalid value",
        description: `Value is not a valid ${newEntry.type}`,
        variant: "destructive"
      });
      return;
    }

    addEntryMutation.mutate({
      key: newEntry.key,
      value: parsedValue,
      type: newEntry.type,
      ttl: newEntry.enableTTL && newEntry.ttl ? parseInt(newEntry.ttl) : undefined
    });
  };

  const handleExport = () => {
    const exportData = entries.reduce((acc, entry) => {
      acc[entry.key] = entry.value;
      return acc;
    }, {} as Record<string, any>);
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kv-store-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Export complete",
      description: `Exported ${entries.length} entries`,
    });
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importData);
      if (typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid format');
      }
      importMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive"
      });
    }
  };

  const copyValue = (value: any, key: string) => {
    const textValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    navigator.clipboard.writeText(textValue);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({
      title: "Copied",
      description: "Value copied to clipboard"
    });
  };

  const getTypeIcon = (type: KVEntry['type']) => {
    switch (type) {
      case 'json': return <FileJson className="h-4 w-4" />;
      case 'binary': return <Binary className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: KVEntry['type']) => {
    switch (type) {
      case 'string': return 'text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200';
      case 'number': return 'text-green-600 bg-green-50 dark:bg-green-950 border-green-200';
      case 'boolean': return 'text-purple-600 bg-purple-50 dark:bg-purple-950 border-purple-200';
      case 'json': return 'text-orange-600 bg-orange-50 dark:bg-orange-950 border-orange-200';
      case 'binary': return 'text-pink-600 bg-pink-50 dark:bg-pink-950 border-pink-200';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-950 border-gray-200';
    }
  };

  const formatValue = (value: any, type: KVEntry['type']) => {
    if (type === 'json') {
      return JSON.stringify(value, null, 2);
    }
    if (type === 'binary') {
      return '<binary data>';
    }
    return String(value);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <PageShellLoading text="Loading key-value store..." />;
  }

  const usagePercentage = stats ? (stats.totalSize / stats.maxSize) * 100 : 0;

  return (
    <PageShell>
      <PageHeader
        title="Key-Value Store"
        description="Fast, persistent key-value storage for your application data"
        icon={Database}
        actions={
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={handleExport} data-testid="button-export" className="min-h-[44px] text-[13px] sm:text-base">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import" className="min-h-[44px] text-[13px] sm:text-base">
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg sm:w-full">
                <DialogHeader>
                  <DialogTitle>Import Data</DialogTitle>
                  <DialogDescription>
                    Paste JSON data to import key-value pairs
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder='{"key1": "value1", "key2": {"nested": true}}'
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="font-mono min-h-[150px] sm:min-h-[200px] text-[13px]"
                  data-testid="textarea-import"
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)} className="min-h-[44px] w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={importMutation.isPending}
                    data-testid="button-import-confirm"
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-entry" className="min-h-[44px] text-[13px] sm:text-base">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Entry</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg sm:w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Entry</DialogTitle>
                  <DialogDescription>
                    Create a new key-value pair in the store
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key">Key</Label>
                    <Input
                      id="key"
                      placeholder="user:settings:theme"
                      value={newEntry.key}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, key: e.target.value }))}
                      data-testid="input-key"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">Value Type</Label>
                    <Select
                      value={newEntry.type}
                      onValueChange={(v) => setNewEntry(prev => ({ ...prev, type: v as KVEntry['type'] }))}
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="binary">Binary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <Textarea
                      id="value"
                      placeholder={
                        newEntry.type === 'json' ? '{"theme": "dark", "notifications": true}' :
                        newEntry.type === 'boolean' ? 'true or false' :
                        newEntry.type === 'number' ? '42' :
                        'Enter value...'
                      }
                      value={newEntry.value}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, value: e.target.value }))}
                      className="font-mono min-h-[100px]"
                      data-testid="textarea-value"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[13px]">Enable TTL (Time to Live)</span>
                    </div>
                    <Switch
                      checked={newEntry.enableTTL}
                      onCheckedChange={(checked) => setNewEntry(prev => ({ ...prev, enableTTL: checked }))}
                      data-testid="switch-ttl"
                    />
                  </div>
                  
                  {newEntry.enableTTL && (
                    <div className="space-y-2">
                      <Label htmlFor="ttl">TTL (seconds)</Label>
                      <Input
                        id="ttl"
                        type="number"
                        placeholder="3600"
                        value={newEntry.ttl}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, ttl: e.target.value }))}
                        data-testid="input-ttl"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Key will automatically expire after the specified time
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => { setShowAddDialog(false); resetNewEntry(); }} className="min-h-[44px] w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddEntry} 
                    disabled={addEntryMutation.isPending}
                    data-testid="button-add-confirm"
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    Add Entry
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-stat-keys">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Total Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.totalKeys || entries.length}</div>
            <p className="text-[11px] text-muted-foreground">Active entries</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-storage">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Used
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{formatSize(stats?.totalSize || 0)}</div>
            <Progress value={usagePercentage} className="h-1 mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {usagePercentage.toFixed(1)}% of {formatSize(stats?.maxSize || 50000000)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-avg-size">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Average Size
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{formatSize(stats?.avgValueSize || 0)}</div>
            <p className="text-[11px] text-muted-foreground">Per value</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-expiring">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-yellow-500">{stats?.expiringKeys || 0}</div>
            <p className="text-[11px] text-muted-foreground">Keys with TTL</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys or values..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px] text-[13px] sm:text-base"
              data-testid="input-search"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-full sm:w-[130px] min-h-[44px]" data-testid="select-filter-type">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/kv-store'] })}
            data-testid="button-refresh"
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-[13px] sm:text-base flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Key-Value Entries
            </span>
            <span className="text-[11px] sm:text-[13px] font-normal text-muted-foreground">
              {filteredEntries.length} of {entries.length} entries
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery || filterType !== 'all' ? (
                <>
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">No entries found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button variant="outline" onClick={() => { setSearchQuery(''); setFilterType('all'); }}>
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">No entries yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first key-value pair to get started
                  </p>
                  <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Entry
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card 
                  key={entry.key} 
                  className="p-3 sm:p-4 hover:shadow-md transition-shadow"
                  data-testid={`card-entry-${entry.key}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <Key className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono font-medium text-[11px] sm:text-[13px] truncate max-w-[150px] sm:max-w-[200px]" title={entry.key}>
                            {entry.key}
                          </span>
                        </div>
                        <Badge className={cn("border text-[11px]", getTypeColor(entry.type))}>
                          {getTypeIcon(entry.type)}
                          <span className="ml-1">{entry.type}</span>
                        </Badge>
                        {entry.ttl && (
                          <Badge variant="outline" className="text-[11px] hidden sm:flex">
                            <Clock className="h-3 w-3 mr-1" />
                            TTL: {entry.ttl}s
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[11px]">
                          {formatSize(entry.size)}
                        </Badge>
                      </div>
                      
                      <div className="bg-muted p-2 sm:p-3 rounded-lg overflow-x-auto">
                        <ScrollArea className="max-h-24">
                          <pre className="text-[11px] sm:text-[13px] font-mono whitespace-pre-wrap break-all">
                            {formatValue(entry.value, entry.type)}
                          </pre>
                        </ScrollArea>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                        {entry.updatedAt !== entry.createdAt && (
                          <span className="hidden sm:inline">Updated: {new Date(entry.updatedAt).toLocaleDateString()}</span>
                        )}
                        {entry.expiresAt && (
                          <span className="text-yellow-600">
                            Expires: {new Date(entry.expiresAt).toLocaleString()}
                          </span>
                        )}
                        {entry.ttl && (
                          <span className="sm:hidden text-muted-foreground">
                            TTL: {entry.ttl}s
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 flex-shrink-0 self-end sm:self-start">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyValue(entry.value, entry.key)}
                        data-testid={`button-copy-${entry.key}`}
                        className="min-h-[44px] min-w-[44px] h-9 w-9 sm:h-10 sm:w-10"
                      >
                        {copiedKey === entry.key ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setSelectedEntry(entry);
                          setShowEditDialog(true);
                        }}
                        data-testid={`button-edit-${entry.key}`}
                        className="min-h-[44px] min-w-[44px] h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteEntryMutation.mutate(entry.key)}
                        disabled={deleteEntryMutation.isPending}
                        data-testid={`button-delete-${entry.key}`}
                        className="min-h-[44px] min-w-[44px] h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-[13px] sm:text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Using E-Code KV Store in Your Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <Tabs defaultValue="javascript">
            <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
              <TabsTrigger value="javascript" className="text-[11px] sm:text-[13px] flex-1 sm:flex-none min-h-[40px]">JavaScript/Node.js</TabsTrigger>
              <TabsTrigger value="python" className="text-[11px] sm:text-[13px] flex-1 sm:flex-none min-h-[40px]">Python</TabsTrigger>
              <TabsTrigger value="rest" className="text-[11px] sm:text-[13px] flex-1 sm:flex-none min-h-[40px]">REST API</TabsTrigger>
            </TabsList>
            <TabsContent value="javascript" className="mt-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg font-mono text-[11px] sm:text-[13px] space-y-2 overflow-x-auto">
                <div className="text-muted-foreground">// Import the KV client</div>
                <div>import {"{ kv }"} from '@ecode/kv';</div>
                <div className="mt-3 text-muted-foreground">// Set a value</div>
                <div>await kv.set('user:1234', {"{ name: 'John', email: 'john@example.com' }"});</div>
                <div className="mt-3 text-muted-foreground">// Set with TTL (expires in 1 hour)</div>
                <div>await kv.set('session:abc', token, {"{ ttl: 3600 }"});</div>
                <div className="mt-3 text-muted-foreground">// Get a value</div>
                <div>const user = await kv.get('user:1234');</div>
                <div className="mt-3 text-muted-foreground">// Delete a value</div>
                <div>await kv.delete('user:1234');</div>
              </div>
            </TabsContent>
            <TabsContent value="python" className="mt-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg font-mono text-[11px] sm:text-[13px] space-y-2 overflow-x-auto">
                <div className="text-muted-foreground"># Import the KV client</div>
                <div>from ecode import kv</div>
                <div className="mt-3 text-muted-foreground"># Set a value</div>
                <div>kv.set('user:1234', {"{'name': 'John', 'email': 'john@example.com'}"})</div>
                <div className="mt-3 text-muted-foreground"># Set with TTL (expires in 1 hour)</div>
                <div>kv.set('session:abc', token, ttl=3600)</div>
                <div className="mt-3 text-muted-foreground"># Get a value</div>
                <div>user = kv.get('user:1234')</div>
                <div className="mt-3 text-muted-foreground"># Delete a value</div>
                <div>kv.delete('user:1234')</div>
              </div>
            </TabsContent>
            <TabsContent value="rest" className="mt-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg font-mono text-[11px] sm:text-[13px] space-y-2 overflow-x-auto">
                <div className="text-muted-foreground"># Set a value</div>
                <div>curl -X POST /api/kv-store \</div>
                <div className="pl-4">-H "Content-Type: application/json" \</div>
                <div className="pl-4">-d '{"{"}"key": "user:1234", "value": {"{"}"name": "John"{"}"}{"}"}'</div>
                <div className="mt-3 text-muted-foreground"># Get a value</div>
                <div>curl /api/kv-store/user:1234</div>
                <div className="mt-3 text-muted-foreground"># Delete a value</div>
                <div>curl -X DELETE /api/kv-store/user:1234</div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] max-w-lg sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-[15px]">Edit Entry</DialogTitle>
            <DialogDescription className="text-[13px]">
              Modify the value for key: <code className="font-mono bg-muted px-1 rounded text-[11px] sm:text-[13px] break-all">{selectedEntry?.key}</code>
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Value</Label>
                <Textarea
                  value={typeof selectedEntry.value === 'object' 
                    ? JSON.stringify(selectedEntry.value, null, 2) 
                    : String(selectedEntry.value)}
                  onChange={(e) => setSelectedEntry({ ...selectedEntry, value: e.target.value })}
                  className="font-mono min-h-[120px] sm:min-h-[150px] text-[13px]"
                  data-testid="textarea-edit-value"
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)} className="min-h-[44px] w-full sm:w-auto">
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    let parsedValue = selectedEntry.value;
                    if (selectedEntry.type === 'json') {
                      try {
                        parsedValue = JSON.parse(selectedEntry.value);
                      } catch {
                        toast({
                          title: "Invalid JSON",
                          description: "Please enter valid JSON",
                          variant: "destructive"
                        });
                        return;
                      }
                    }
                    updateEntryMutation.mutate({
                      key: selectedEntry.key,
                      value: parsedValue,
                      type: selectedEntry.type
                    });
                  }}
                  disabled={updateEntryMutation.isPending}
                  data-testid="button-save-edit"
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

