// @ts-nocheck
/**
 * File Operations Grid Component
 * AG Grid-based file operations table with diff viewer and rollback
 * Phase 2 - Agent Activity Dashboard
 */

import { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useQuery } from '@tanstack/react-query';
import { 
  RefreshCw, Search, Loader2, FileCode, FilePlus, FileEdit, 
  Trash2, FolderInput, ArrowRight, ChevronRight, Plus, Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMediaQuery } from '@/hooks/use-media-query';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { defaultGridOptions, fileOperationGridColDefs } from './ag-grid-config';
import { gridCellRenderers } from './GridCellRenderers';
import type { FileOperationRow, FileOperationsGridResponse } from '@shared/types/agent-grid.types';
import type { GridReadyEvent, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import './ag-grid-theme.css';

interface FileOperationsGridProps {
  sessionId?: string;
  onFileSelect?: (file: FileOperationRow) => void;
  height?: string | number;
}

function FileCard({ file, onSelect }: { file: FileOperationRow; onSelect?: (f: FileOperationRow) => void }) {
  const opConfig: Record<string, { icon: typeof FilePlus; color: string; label: string }> = {
    create: { icon: FilePlus, color: 'text-green-600', label: 'Created' },
    edit: { icon: FileEdit, color: 'text-blue-600', label: 'Modified' },
    delete: { icon: Trash2, color: 'text-red-600', label: 'Deleted' },
    move: { icon: FolderInput, color: 'text-orange-600', label: 'Moved' },
  };
  const config = opConfig[file.operationType] || opConfig.edit;
  const OpIcon = config.icon;

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
      onClick={() => onSelect?.(file)}
      data-testid={`file-card-${file.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <OpIcon className={cn("h-4 w-4", config.color)} />
              <Badge variant="outline" className="text-[11px]">{config.label}</Badge>
              {file.language && <Badge variant="secondary" className="text-[11px]">{file.language}</Badge>}
            </div>
            <div className="text-[13px] font-medium truncate mb-1">{file.fileName}</div>
            <div className="text-[11px] text-muted-foreground truncate mb-2">{file.filePath}</div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-green-600 flex items-center gap-1"><Plus className="h-3 w-3" />{file.linesAdded || 0}</span>
              <span className="text-red-600 flex items-center gap-1"><Minus className="h-3 w-3" />{file.linesRemoved || 0}</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
        <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground">
          {file.createdAt ? format(new Date(file.createdAt), 'MMM d, HH:mm:ss') : '-'}
        </div>
      </CardContent>
    </Card>
  );
}

export function FileOperationsGrid({ 
  sessionId, 
  onFileSelect,
  height = 350 
}: FileOperationsGridProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    
    if (sessionId) params.set('sessionId', sessionId);
    if (typeFilter !== 'all') params.set('operationType', typeFilter);
    if (languageFilter !== 'all') params.set('language', languageFilter);
    
    return params.toString();
  }, [page, pageSize, sessionId, typeFilter, languageFilter]);

  const { data, isLoading, error, refetch } = useQuery<FileOperationsGridResponse>({
    queryKey: ['/api/agent-grid/files', buildQueryParams()],
    enabled: !!sessionId || true,
  });

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onRowClicked = useCallback((event: any) => {
    if (onFileSelect && event.data) {
      onFileSelect(event.data);
    }
  }, [onFileSelect]);

  const handleQuickFilter = useCallback((text: string) => {
    setSearchQuery(text);
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', text);
    }
  }, [gridApi]);

  const filteredData = useMemo(() => {
    if (!data?.rows) return [];
    if (!searchQuery) return data.rows;
    
    const query = searchQuery.toLowerCase();
    return data.rows.filter((row: FileOperationRow) => 
      row.fileName.toLowerCase().includes(query) ||
      row.filePath.toLowerCase().includes(query) ||
      row.language?.toLowerCase().includes(query)
    );
  }, [data?.rows, searchQuery]);

  const stats = useMemo(() => {
    if (!data?.rows) return { created: 0, edited: 0, deleted: 0 };
    return {
      created: data.rows.filter((r: FileOperationRow) => r.operationType === 'create').length,
      edited: data.rows.filter((r: FileOperationRow) => r.operationType === 'edit').length,
      deleted: data.rows.filter((r: FileOperationRow) => r.operationType === 'delete').length,
    };
  }, [data?.rows]);

  const gridOptions = useMemo(() => ({
    ...defaultGridOptions,
    onRowClicked,
    components: gridCellRenderers,
    rowHeight: 40,
  }), [onRowClicked]);

  return (
    <div className="flex flex-col gap-3" data-testid="file-operations-grid">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-[13px]">File Operations</h4>
          {data && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[11px] bg-green-500/10 text-green-600">
                <FilePlus className="h-2.5 w-2.5 mr-1" />
                {stats.created}
              </Badge>
              <Badge variant="secondary" className="text-[11px] bg-blue-500/10 text-blue-600">
                <FileEdit className="h-2.5 w-2.5 mr-1" />
                {stats.edited}
              </Badge>
              {stats.deleted > 0 && (
                <Badge variant="secondary" className="text-[11px] bg-red-500/10 text-red-600">
                  <Trash2 className="h-2.5 w-2.5 mr-1" />
                  {stats.deleted}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => handleQuickFilter(e.target.value)}
              className="pl-7 w-[150px] h-8 text-[11px]"
              data-testid="input-search-files"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[90px] h-8 text-[11px]" data-testid="select-file-op-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="edit">Edit</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>

          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-[100px] h-8 text-[11px]" data-testid="select-file-language">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            data-testid="button-refresh-files"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Grid / Mobile Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-[13px]">
          <p>Failed to load files</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isMobile ? (
        <div className="space-y-3" data-testid="files-mobile-view">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-[13px]">
              No file operations found
            </div>
          ) : (
            filteredData.map((file) => (
              <FileCard key={file.id} file={file} onSelect={onFileSelect} />
            ))
          )}
        </div>
      ) : (
        <div 
          className="ag-theme-custom rounded-lg border overflow-hidden"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          <AgGridReact
            rowData={filteredData}
            columnDefs={fileOperationGridColDefs}
            gridOptions={gridOptions}
            onGridReady={onGridReady}
          />
        </div>
      )}
    </div>
  );
}

export default FileOperationsGrid;
