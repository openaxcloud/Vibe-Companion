import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight, ChevronDown, FileIcon, FolderOpen, Folder,
  Plus, RefreshCw, MoreHorizontal, Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  fileId?: number;
  children: FileNode[];
}

interface ReplitFileExplorerProps {
  projectId: string;
  onFileSelect: (file: { id: number; name: string }) => void;
  selectedFileId: number | null;
  isBootstrapping?: boolean;
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { bg: string; label: string }> = {
    js: { bg: 'bg-yellow-500', label: 'JS' },
    jsx: { bg: 'bg-yellow-500', label: 'JS' },
    ts: { bg: 'bg-blue-500', label: 'TS' },
    tsx: { bg: 'bg-blue-500', label: 'TS' },
    py: { bg: 'bg-green-500', label: 'PY' },
    css: { bg: 'bg-pink-500', label: 'CS' },
    html: { bg: 'bg-orange-500', label: 'HT' },
    json: { bg: 'bg-amber-500', label: 'JS' },
    md: { bg: 'bg-gray-500', label: 'MD' },
  };
  const icon = iconMap[ext];
  if (icon) {
    return (
      <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0', icon.bg)}>
        <span className="text-[7px] font-bold text-white">{icon.label}</span>
      </span>
    );
  }
  return <FileIcon className="w-3.5 h-3.5 shrink-0 text-[var(--ide-text-secondary)]" />;
}

function buildFileTree(files: any[]): FileNode[] {
  const root: FileNode[] = [];
  for (const file of files) {
    const parts = (file.filename || file.name || '').split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join('/');
      if (isLast) {
        current.push({ name: part, path: pathSoFar, type: 'file', fileId: file.id, children: [] });
      } else {
        let dir = current.find(n => n.type === 'dir' && n.name === part);
        if (!dir) {
          dir = { name: part, path: pathSoFar, type: 'dir', children: [] };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }
  const sortNodes = (nodes: FileNode[]): FileNode[] =>
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => ({ ...n, children: sortNodes(n.children) }));
  return sortNodes(root);
}

function TreeItem({
  node, depth, selectedFileId, expandedDirs, toggleDir, onFileSelect
}: {
  node: FileNode; depth: number; selectedFileId: number | null;
  expandedDirs: Set<string>; toggleDir: (path: string) => void;
  onFileSelect: (file: { id: number; name: string }) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.type === 'file' && node.fileId === selectedFileId;

  return (
    <div>
      <button
        className={cn(
          'flex items-center gap-1.5 w-full h-7 text-left transition-colors',
          isSelected ? 'bg-[var(--ide-surface)] text-[var(--ide-text)]' : 'text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50 hover:text-[var(--ide-text)]'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (node.type === 'dir') {
            toggleDir(node.path);
          } else if (node.fileId) {
            onFileSelect({ id: node.fileId, name: node.path });
          }
        }}
      >
        {node.type === 'dir' ? (
          <>
            {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
            {isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileTypeIcon filename={node.name} />
          </>
        )}
        <span className="text-[11px] truncate">{node.name}</span>
      </button>
      {node.type === 'dir' && isExpanded && node.children.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFileId={selectedFileId}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
}

export function ReplitFileExplorer({ projectId, onFileSelect, selectedFileId, isBootstrapping }: ReplitFileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const filesQuery = useQuery({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/files`);
      return res.json();
    },
    enabled: !!projectId && !isBootstrapping,
  });

  const tree = useMemo(() => buildFileTree(filesQuery.data || []), [filesQuery.data]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1 px-2 h-7 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-md">
          <Search className="w-3 h-3 text-[var(--ide-text-muted)]" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[11px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filesQuery.isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-[#0079F2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[var(--ide-text-muted)]">No files yet</p>
          </div>
        ) : (
          tree.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedFileId={selectedFileId}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
