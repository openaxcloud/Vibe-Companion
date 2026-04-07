import React, { useState, useEffect } from 'react';
import { 
  Database, Plus, Search, Trash2, Edit, Save, X, 
  Copy, Download, Upload, RefreshCw, Filter,
  ChevronRight, ChevronDown, Code, Eye, EyeOff,
  Key, Hash, Type, Calendar, ToggleLeft, List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ReplitDBProps {
  projectId: number;
  className?: string;
}

interface DBEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  size: number;
  lastModified?: string;
}

interface DBStats {
  totalKeys: number;
  totalSize: string;
  largestKey: string;
  oldestKey: string;
  newestKey: string;
}

export function ReplitDB({ projectId, className }: ReplitDBProps) {
  const [entries, setEntries] = useState<DBEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DBEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<DBEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newValueType, setNewValueType] = useState<DBEntry['type']>('string');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<DBStats | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showJsonView, setShowJsonView] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
    loadStats();
  }, [projectId]);

  useEffect(() => {
    const filtered = entries.filter(entry => 
      entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(entry.value).toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEntries(filtered);
  }, [entries, searchQuery]);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/db`);
      if (response.ok) {
        const data = await response.json();
          // Get all keys and their values
        const keys = data.keys || [];
        const entries: DBEntry[] = [];
        
        for (const key of keys) {
          const valueResponse = await fetch(`/api/projects/${projectId}/db/${key}`);
          if (valueResponse.ok) {
            const { value } = await valueResponse.json();
            entries.push({
              key,
              value,
              type: getValueType(value),
              size: JSON.stringify(value).length,
              lastModified: new Date().toISOString()
            });
          }
        }
        
        setEntries(entries);
      }
    } catch (error) {
      console.error('Failed to load DB entries:', error);
      toast({
        title: "Failed to load entries",
        description: "Could not load database entries",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/db/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load DB stats:', error);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      let parsedValue: any = newValue;
      
      // Parse value based on type
      if (newValueType === 'number') {
        parsedValue = Number(newValue);
        if (isNaN(parsedValue)) {
          toast({
            title: "Invalid Number",
            description: "Please enter a valid number",
            variant: "destructive"
          });
          return;
        }
      } else if (newValueType === 'boolean') {
        parsedValue = newValue.toLowerCase() === 'true';
      } else if (newValueType === 'object' || newValueType === 'array') {
        try {
          parsedValue = JSON.parse(newValue);
        } catch (e) {
          toast({
            title: "Invalid JSON",
            description: "Please enter valid JSON",
            variant: "destructive"
          });
          return;
        }
      } else if (newValueType === 'null') {
        parsedValue = null;
      }

      const response = await fetch(`/api/projects/${projectId}/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: parsedValue })
      });

      if (response.ok) {
        await loadEntries();
        setShowAddDialog(false);
        setNewKey('');
        setNewValue('');
        toast({
          title: "Entry Added",
          description: `Key "${newKey}" added successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Add Entry",
        description: "Could not add the database entry",
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedEntry || !editValue.trim()) return;

    try {
      let parsedValue: any = editValue;
      
      // Parse value based on type
      if (selectedEntry.type === 'number') {
        parsedValue = Number(editValue);
      } else if (selectedEntry.type === 'boolean') {
        parsedValue = editValue.toLowerCase() === 'true';
      } else if (selectedEntry.type === 'object' || selectedEntry.type === 'array') {
        parsedValue = JSON.parse(editValue);
      }

      const response = await fetch(`/api/projects/${projectId}/db/${selectedEntry.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsedValue })
      });

      if (response.ok) {
        await loadEntries();
        setIsEditing(false);
        toast({
          title: "Entry Updated",
          description: `Key "${selectedEntry.key}" updated successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not update the database entry",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/db/${key}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadEntries();
        if (selectedEntry?.key === key) {
          setSelectedEntry(null);
        }
        toast({
          title: "Entry Deleted",
          description: `Key "${key}" deleted successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the database entry",
        variant: "destructive"
      });
    }
  };

  const handleExport = async () => {
    try {
      const data = entries.reduce((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {} as Record<string, any>);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replit-db-${projectId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Database Exported",
        description: "Your database has been exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export the database",
        variant: "destructive"
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch(`/api/projects/${projectId}/db/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });

      if (response.ok) {
        await loadEntries();
        toast({
          title: "Database Imported",
          description: "Your database has been imported successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Could not import the database file",
        variant: "destructive"
      });
    }
  };

  const getValuePreview = (value: any, type: DBEntry['type']) => {
    if (type === 'null') return <span className="text-muted-foreground">null</span>;
    if (type === 'boolean') return <Badge variant={value ? 'default' : 'secondary'}>{String(value)}</Badge>;
    if (type === 'number') return <code className="text-sm">{value}</code>;
    if (type === 'string') return <span className="text-sm truncate max-w-[200px] inline-block">{value}</span>;
    if (type === 'array') return <span className="text-sm text-muted-foreground">[{value.length} items]</span>;
    if (type === 'object') return <span className="text-sm text-muted-foreground">{Object.keys(value).length} properties</span>;
  };

  const getValueType = (value: any): DBEntry['type'] => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  };

  const getTypeIcon = (type: DBEntry['type']) => {
    switch (type) {
      case 'string': return <Type className="h-3 w-3" />;
      case 'number': return <Hash className="h-3 w-3" />;
      case 'boolean': return <ToggleLeft className="h-3 w-3" />;
      case 'object': return <Code className="h-3 w-3" />;
      case 'array': return <List className="h-3 w-3" />;
      default: return <Key className="h-3 w-3" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Replit DB
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={loadEntries}
                disabled={isLoading}
                className="h-7 w-7"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <label className="flex items-center cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Search and Stats */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keys or values..."
                className="pl-9 h-8"
              />
            </div>
            
            {stats && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Keys:</span>
                  <span className="font-medium">{stats.totalKeys}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Size:</span>
                  <span className="font-medium">{stats.totalSize}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex h-[400px]">
            {/* Keys List */}
            <div className="w-1/3 border-r">
              <ScrollArea className="h-full">
                <div className="p-2">
                  {filteredEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedEntry?.key === entry.key 
                          ? 'bg-accent' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        setSelectedEntry(entry);
                        setEditValue(JSON.stringify(entry.value, null, 2));
                        setIsEditing(false);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1 mb-1">
                            {getTypeIcon(entry.type)}
                            <span className="text-sm font-medium truncate">{entry.key}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getValuePreview(entry.value, entry.type)}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2">
                          {formatSize(entry.size)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Value Display/Editor */}
            <div className="flex-1 p-4">
              {selectedEntry ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium flex items-center">
                        {getTypeIcon(selectedEntry.type)}
                        <span className="ml-2">{selectedEntry.key}</span>
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {selectedEntry.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(selectedEntry.size)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={handleUpdate}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsEditing(false);
                              setEditValue(JSON.stringify(selectedEntry.value, null, 2));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditing(true)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(selectedEntry.value));
                              toast({
                                title: "Copied",
                                description: "Value copied to clipboard",
                              });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(selectedEntry.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    {isEditing ? (
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-full font-mono text-xs resize-none"
                        placeholder="Enter value..."
                      />
                    ) : (
                      <ScrollArea className="h-full">
                        <pre className="text-xs p-3 bg-muted rounded">
                          <code>{JSON.stringify(selectedEntry.value, null, 2)}</code>
                        </pre>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a key to view its value</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Database Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-key">Key</Label>
              <Input
                id="new-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="user:123"
              />
            </div>
            <div>
              <Label htmlFor="value-type">Value Type</Label>
              <Select value={newValueType} onValueChange={(v) => setNewValueType(v as DBEntry['type'])}>
                <SelectTrigger id="value-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                  <SelectItem value="null">Null</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-value">Value</Label>
              {newValueType === 'boolean' ? (
                <Select value={newValue} onValueChange={setNewValue}>
                  <SelectTrigger id="new-value">
                    <SelectValue placeholder="Select boolean value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : newValueType === 'null' ? (
                <Input id="new-value" value="null" disabled />
              ) : (
                <Textarea
                  id="new-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    newValueType === 'object' ? '{"name": "value"}' :
                    newValueType === 'array' ? '["item1", "item2"]' :
                    newValueType === 'number' ? '42' :
                    'Enter value...'
                  }
                  className="font-mono text-sm"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newKey.trim() || !newValue.trim()}>
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}