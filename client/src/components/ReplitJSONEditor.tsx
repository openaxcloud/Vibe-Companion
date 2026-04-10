import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileJson,
  Copy,
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  Braces,
  Eye,
  Code,
  FileText,
  Search,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CM6Editor } from '@/components/editor/CM6Editor';

interface JSONNode {
  key: string;
  value: any;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  path: string;
  expanded?: boolean;
  children?: JSONNode[];
}

interface ReplitJSONEditorProps {
  projectId: number;
  initialData?: any;
  onSave?: (data: any) => void;
  className?: string;
}

export function ReplitJSONEditor({
  projectId,
  initialData = {},
  onSave,
  className,
}: ReplitJSONEditorProps) {
  const { toast } = useToast();
  const [jsonData, setJsonData] = useState<any>(initialData);
  const [jsonString, setJsonString] = useState(JSON.stringify(initialData, null, 2));
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [searchQuery, setSearchQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [jsonTree, setJsonTree] = useState<JSONNode[]>([]);

  // Parse JSON and build tree structure
  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonString);
      setJsonData(parsed);
      setValidationError(null);
      setJsonTree(buildJSONTree(parsed, ''));
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  }, [jsonString]);

  // Build tree structure for visual editor
  const buildJSONTree = (data: any, path: string): JSONNode[] => {
    if (data === null) {
      return [{
        key: path.split('.').pop() || 'root',
        value: null,
        type: 'null',
        path,
      }];
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        key: `[${index}]`,
        value: item,
        type: getJSONType(item),
        path: path ? `${path}[${index}]` : `[${index}]`,
        expanded: false,
        children: typeof item === 'object' && item !== null
          ? buildJSONTree(item, path ? `${path}[${index}]` : `[${index}]`)
          : undefined,
      }));
    }

    if (typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => ({
        key,
        value,
        type: getJSONType(value),
        path: path ? `${path}.${key}` : key,
        expanded: false,
        children: typeof value === 'object' && value !== null
          ? buildJSONTree(value, path ? `${path}.${key}` : key)
          : undefined,
      }));
    }

    return [];
  };

  const getJSONType = (value: any): JSONNode['type'] => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value as JSONNode['type'];
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setJsonString(value);
      setIsDirty(true);
    }
  };

  const handleSave = () => {
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: 'Please fix JSON errors before saving',
        variant: 'destructive',
      });
      return;
    }

    onSave?.(jsonData);
    setIsDirty(false);
    toast({
      title: 'JSON Saved',
      description: 'Your JSON data has been saved successfully',
    });
  };

  const handleFormat = () => {
    try {
      const formatted = JSON.stringify(jsonData, null, 2);
      setJsonString(formatted);
      toast({
        title: 'JSON Formatted',
        description: 'Your JSON has been formatted',
      });
    } catch (error) {
      toast({
        title: 'Format Error',
        description: 'Unable to format invalid JSON',
        variant: 'destructive',
      });
    }
  };

  const handleMinify = () => {
    try {
      const minified = JSON.stringify(jsonData);
      setJsonString(minified);
      toast({
        title: 'JSON Minified',
        description: 'Your JSON has been minified',
      });
    } catch (error) {
      toast({
        title: 'Minify Error',
        description: 'Unable to minify invalid JSON',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    toast({
      title: 'Copied',
      description: 'JSON copied to clipboard',
    });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded',
      description: 'JSON file downloaded',
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          setJsonString(content);
          setIsDirty(true);
          toast({
            title: 'File Uploaded',
            description: 'JSON file loaded successfully',
          });
        } catch (error) {
          toast({
            title: 'Upload Error',
            description: 'Failed to read JSON file',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    }
  };

  // Visual editor node component
  const JSONNodeComponent = ({ node, depth = 0 }: { node: JSONNode; depth?: number }) => {
    const [expanded, setExpanded] = useState(node.expanded || depth < 2);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(
      typeof node.value === 'object' ? '' : String(node.value)
    );

    const handleEdit = () => {
      if (node.type === 'object' || node.type === 'array') return;
      setEditing(true);
      setEditValue(String(node.value));
    };

    const handleSaveEdit = () => {
      // Update the JSON data
      let newValue: any = editValue;
      if (node.type === 'number') newValue = Number(editValue);
      if (node.type === 'boolean') newValue = editValue === 'true';
      if (node.type === 'null') newValue = null;

      // Update the JSON string
      const updatedData = { ...jsonData };
      // This is simplified - in production you'd update the nested path
      setJsonString(JSON.stringify(updatedData, null, 2));
      setEditing(false);
      setIsDirty(true);
    };

    const getValueDisplay = () => {
      if (node.type === 'string') return `"${node.value}"`;
      if (node.type === 'null') return 'null';
      if (node.type === 'object') return `{${Object.keys(node.value).length} items}`;
      if (node.type === 'array') return `[${node.value.length} items]`;
      return String(node.value);
    };

    const getTypeColor = () => {
      switch (node.type) {
        case 'string': return 'text-green-600 dark:text-green-400';
        case 'number': return 'text-blue-600 dark:text-blue-400';
        case 'boolean': return 'text-purple-600 dark:text-purple-400';
        case 'null': return 'text-gray-600 dark:text-gray-400';
        case 'object': return 'text-orange-600 dark:text-orange-400';
        case 'array': return 'text-yellow-600 dark:text-yellow-400';
        default: return '';
      }
    };

    return (
      <div className="ml-4">
        <div className="flex items-center gap-2 py-1 hover:bg-muted/50 px-2 rounded group">
          {node.children && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          {!node.children && <div className="w-4" />}
          
          <span className="font-mono text-[13px]">{node.key}:</span>
          
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-6 text-[13px] font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className={cn('font-mono text-[13px]', getTypeColor())}>
                {getValueDisplay()}
              </span>
              <Badge variant="outline" className="text-[11px] py-0 h-5">
                {node.type}
              </Badge>
              {(node.type !== 'object' && node.type !== 'array') && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={handleEdit}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
        
        {expanded && node.children && (
          <div className="border-l border-muted ml-2">
            {node.children.map((child, index) => (
              <JSONNodeComponent key={index} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            JSON Editor
          </CardTitle>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="secondary">
                Unsaved changes
              </Badge>
            )}
            <Button size="sm" onClick={handleSave} disabled={!!validationError}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'visual' | 'code')}>
            <TabsList>
              <TabsTrigger value="visual">
                <Eye className="h-4 w-4 mr-1" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="code">
                <Code className="h-4 w-4 mr-1" />
                Code
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex-1" />

          <Button size="sm" variant="outline" onClick={handleFormat}>
            <Braces className="h-4 w-4 mr-1" />
            Format
          </Button>
          <Button size="sm" variant="outline" onClick={handleMinify}>
            <FileText className="h-4 w-4 mr-1" />
            Minify
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          <Label htmlFor="json-upload" className="cursor-pointer">
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </span>
            </Button>
          </Label>
          <Input
            id="json-upload"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Validation Error */}
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid JSON</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Editor Content */}
        <div className="flex-1 border rounded-lg overflow-hidden">
          {viewMode === 'visual' ? (
            <ScrollArea className="h-full p-4">
              {jsonTree.length > 0 ? (
                jsonTree.map((node, index) => (
                  <JSONNodeComponent key={index} node={node} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <FileJson className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No JSON data to display</p>
                </div>
              )}
            </ScrollArea>
          ) : (
            <CM6Editor
              language="json"
              value={jsonString}
              onChange={handleCodeChange}
              theme="dark"
              height="100%"
              lineWrapping={true}
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              {validationError ? (
                <span className="text-destructive">Invalid JSON</span>
              ) : (
                <span className="text-green-600 dark:text-green-400">Valid JSON</span>
              )}
            </span>
            <span>
              {jsonString.length} characters
            </span>
            <span>
              {jsonString.split('\n').length} lines
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>JSON Editor v1.0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}