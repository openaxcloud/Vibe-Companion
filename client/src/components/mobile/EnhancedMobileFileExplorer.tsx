import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FolderOpen, Folder, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';

interface FileItem {
  id: number;
  filename: string;
  content: string;
}

interface FolderNode {
  name: string;
  path: string;
  files: FileItem[];
  children: FolderNode[];
}

function buildTree(files: FileItem[]): FolderNode {
  const root: FolderNode = { name: '', path: '', files: [], children: [] };
  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let child = current.children.find(c => c.name === folderName);
      if (!child) {
        child = { name: folderName, path: parts.slice(0, i + 1).join('/'), files: [], children: [] };
        current.children.push(child);
      }
      current = child;
    }
    current.files.push(file);
  }
  const sortNode = (node: FolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.filename.localeCompare(b.filename));
    node.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

function getFileEmoji(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: '🟦', tsx: '⚛️', js: '🟨', jsx: '⚛️', json: '📋', css: '🎨', html: '🌐',
    md: '📝', py: '🐍', sql: '🗃️', yml: '⚙️', yaml: '⚙️', sh: '🖥️', env: '🔐',
  };
  return map[ext] || '📄';
}

export function EnhancedMobileFileExplorer({ projectId, onFileSelect }: {
  projectId: string;
  onFileSelect?: (fileId: number, filename: string) => void;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/files`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.files || []);
        setFiles(list);
        setTree(buildTree(list));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderNode = (node: FolderNode, depth: number = 0): React.ReactNode => {
    const isOpen = expanded.has(node.path);
    const pl = depth * 16 + 12;
    return (
      <div key={node.path || 'root'}>
        {node.name && (
          <button onClick={() => toggle(node.path)} className="w-full flex items-center gap-1.5 py-2 px-2 text-[12px] text-[var(--ide-text)] hover:bg-[var(--ide-hover)] active:bg-[var(--ide-active)]" style={{ paddingLeft: pl }}>
            {isOpen ? <ChevronDown className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" />}
            <span className="truncate font-medium">{node.name}</span>
          </button>
        )}
        {(isOpen || !node.name) && (
          <>
            {node.children.map(c => renderNode(c, depth + 1))}
            {node.files.map(f => {
              const name = f.filename.split('/').pop() || f.filename;
              return (
                <button key={f.id} onClick={() => { setSelectedId(f.id); onFileSelect?.(f.id, f.filename); }}
                  className={cn("w-full flex items-center gap-1.5 py-2 px-2 text-[12px]", selectedId === f.id ? "bg-[#0079F2]/15 text-[#0079F2]" : "text-[var(--ide-text)] hover:bg-[var(--ide-hover)] active:bg-[var(--ide-active)]")}
                  style={{ paddingLeft: (depth + 1) * 16 + 12 }}>
                  <span className="text-[10px] shrink-0">{getFileEmoji(name)}</span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="h-full bg-[var(--ide-panel)] flex items-center justify-center"><RefreshCw className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>;

  return (
    <div className="h-full bg-[var(--ide-panel)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">Files</span>
        <button onClick={fetchFiles} className="w-6 h-6 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"><RefreshCw className="w-3 h-3" /></button>
      </div>
      <div className="flex-1 overflow-y-auto mobile-scroll">
        {tree && files.length > 0 ? renderNode(tree) : <p className="p-4 text-[11px] text-[var(--ide-text-muted)] text-center">No files</p>}
      </div>
    </div>
  );
}
