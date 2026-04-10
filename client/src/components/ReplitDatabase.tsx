import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Database, Plus, Search, Download, 
  Trash2, Edit, Key, Table, BarChart3, 
  RefreshCw, Copy, Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DatabaseEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  createdAt: Date;
  updatedAt: Date;
}

interface ReplitDatabaseProps {
  projectId: number;
}

export function ReplitDatabase({ projectId }: ReplitDatabaseProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DatabaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEntry, setNewEntry] = useState({
    key: '',
    value: '',
    type: 'string' as 'string' | 'number' | 'boolean' | 'object' | 'array'
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [projectId]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/database/${projectId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Error fetching database entries:', error);
      toast({
        title: "Error",
        description: "Failed to fetch database entries",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newEntry.key.trim() || !newEntry.value.trim()) {
      toast({
        title: "Validation Error",
        description: "Key and value are required",
        variant: "destructive"
      });
      return;
    }

    try {
      let parsedValue: any = newEntry.value;
      
      // Parse value based on type
      switch (newEntry.type) {
        case 'number':
          const numValue = parseFloat(newEntry.value);
          if (isNaN(numValue)) {
            toast({
              title: "Invalid Number",
              description: "Please enter a valid number",
              variant: "destructive"
            });
            return;
          }
          parsedValue = numValue;
          break;
        case 'boolean':
          parsedValue = newEntry.value.toLowerCase() === 'true';
          break;
        case 'object':
        case 'array':
          try {
            parsedValue = JSON.parse(newEntry.value);
          } catch (e) {
            toast({
              title: "Invalid JSON",
              description: "Please enter valid JSON",
              variant: "destructive"
            });
            return;
          }
          break;
      }

      const response = await apiRequest('POST', `/api/database/${projectId}`, {
        key: newEntry.key,
        value: parsedValue
      });

      if (response.ok) {
        toast({
          title: "Entry Added",
          description: `Database entry "${newEntry.key}" has been added`
        });
        
        setNewEntry({ key: '', value: '', type: 'string' });
        setShowAddDialog(false);
        fetchEntries();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add database entry",
        variant: "destructive"
      });
    }
  };

  const deleteEntry = async (key: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/database/${projectId}/${encodeURIComponent(key)}`, {});

      if (response.ok) {
        toast({
          title: "Entry Deleted",
          description: `Database entry "${key}" has been removed`
        });
        fetchEntries();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete database entry",
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

  const exportDatabase = async () => {
    try {
      const response = await fetch(`/api/database/${projectId}/export`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `database-${projectId}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Export Complete",
          description: "Database exported successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export database",
        variant: "destructive"
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'number': return 'text-green-600 bg-green-50 border-green-200';
      case 'boolean': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'object': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'array': return 'text-pink-600 bg-pink-50 border-pink-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatValue = (value: any, type: string) => {
    if (type === 'object' || type === 'array') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const filteredEntries = entries.filter(entry => 
    entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(entry.value).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            E-Code Database
          </h2>
          <p className="text-muted-foreground">
            Simple key-value database for your application data
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportDatabase}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Database Entry</DialogTitle>
                <DialogDescription>
                  Add a new key-value pair to your database
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="key">Key</Label>
                    <Input
                      id="key"
                      placeholder="user_settings"
                      value={newEntry.key}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, key: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <select
                      id="type"
                      value={newEntry.type}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value as 'string' | 'number' | 'boolean' | 'object' | 'array' }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Textarea
                    id="value"
                    placeholder={
                      newEntry.type === 'object' ? '{"theme": "dark", "notifications": true}' :
                      newEntry.type === 'array' ? '["item1", "item2", "item3"]' :
                      newEntry.type === 'boolean' ? 'true' :
                      newEntry.type === 'number' ? '42' :
                      'Enter your value here...'
                    }
                    value={newEntry.value}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, value: e.target.value }))}
                    rows={newEntry.type === 'object' || newEntry.type === 'array' ? 5 : 3}
                    className="font-mono"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addEntry}>
                    Add Entry
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search database entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-4 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Table className="h-4 w-4" />
            {entries.length} entries
          </div>
          
          <div className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            {new Blob([JSON.stringify(entries)]).size} bytes
          </div>
        </div>
      </div>

      {/* Database Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Database Entries
            <Button variant="ghost" size="sm" onClick={fetchEntries}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            {filteredEntries.length} of {entries.length} entries
            {searchQuery && ` matching "${searchQuery}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2">Loading database...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              {searchQuery ? (
                <>
                  <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No entries match your search</p>
                </>
              ) : (
                <>
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">Database is empty</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first key-value pair to get started
                  </p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Entry
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card key={entry.key} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <Key className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono font-medium">{entry.key}</span>
                        </div>
                        <Badge className={`${getTypeColor(entry.type)} border text-[11px]`}>
                          {entry.type}
                        </Badge>
                      </div>
                      
                      <div className="bg-muted p-3 rounded-lg">
                        <pre className="text-[13px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {formatValue(entry.value, entry.type)}
                        </pre>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span>Created {new Date(entry.createdAt).toLocaleDateString()}</span>
                        {entry.updatedAt !== entry.createdAt && (
                          <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyValue(entry.value, entry.key)}
                      >
                        {copiedKey === entry.key ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteEntry(entry.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Using E-Code Database in Your Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">JavaScript/Node.js</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-[13px]">
              <div>// Read a value</div>
              <div>const value = await db.get('user_settings');</div>
              <div className="mt-2">// Set a value</div>
              <div>{`await db.set('user_settings', {theme: 'dark'});`}</div>
              <div className="mt-2">// Delete a value</div>
              <div>await db.delete('user_settings');</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Python</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-[13px]">
              <div># Read a value</div>
              <div>value = db.get('user_settings')</div>
              <div className="mt-2"># Set a value</div>
              <div>{`db.set('user_settings', {'theme': 'dark'})`}</div>
              <div className="mt-2"># Delete a value</div>
              <div>db.delete('user_settings')</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Features</h4>
            <ul className="text-[13px] text-muted-foreground space-y-1">
              <li>• Simple key-value storage with JSON support</li>
              <li>• Automatic data type detection and validation</li>
              <li>• Real-time updates across your application</li>
              <li>• Built-in search and filtering capabilities</li>
              <li>• Export and import functionality</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}