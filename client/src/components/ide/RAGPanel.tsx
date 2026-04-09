import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database, Search, RefreshCw, Play, Square, FileCode, Zap,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle, Loader2,
  Brain, Layers, BarChart3, Eye, Settings2, Globe,
} from 'lucide-react';

interface RAGStats {
  embeddingsCount: number;
  nodesCount: number;
  totalChunks: number;
  totalFiles: number;
  isAvailable: boolean;
  embeddingModel: string;
  searchModes: string[];
  providers: { openai: boolean; anthropic: boolean; gemini: boolean };
}

interface RAGStatus {
  indexingInProgress: boolean;
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  lastIndexedAt: string | null;
  errorCount: number;
  lastError: string | null;
}

interface ProjectStats {
  totalChunks: number;
  embeddedChunks: number;
  totalFiles: number;
  languages: Record<string, number>;
  chunkTypes: Record<string, number>;
}

interface SearchResultItem {
  id: string;
  filePath: string;
  content: string;
  language: string;
  chunkType: string;
  symbolName: string | null;
  startLine: number | null;
  endLine: number | null;
  score: number;
  matchType: string;
}

export default function RAGPanel({ projectId }: { projectId?: number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'vector' | 'fts'>('hybrid');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['status', 'search']));
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<RAGStats>({
    queryKey: ['/api/rag/stats'],
    refetchInterval: 10000,
  });

  const { data: statusData } = useQuery<{ status: RAGStatus; stats: ProjectStats; embeddingAvailable: boolean; watcherActive: boolean }>({
    queryKey: [`/api/rag/status/${projectId}`],
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  const indexMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await fetch('/api/rag/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, force }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rag/status/${projectId}`] });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/rag/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rag/status/${projectId}`] });
    },
  });

  const watcherMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      const res = await fetch(`/api/rag/watcher/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rag/status/${projectId}`] });
    },
  });

  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !projectId) return;
    setSearching(true);
    try {
      const res = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery, projectId, mode: searchMode, limit: 15 }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, projectId, searchMode]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleResult = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const status = statusData?.status;
  const projectStats = statusData?.stats;
  const isIndexing = status?.indexingInProgress || indexMutation.isPending || reindexMutation.isPending;
  const progress = status && status.totalFiles > 0 ? Math.round((status.indexedFiles / status.totalFiles) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary,#1e1e1e)] text-[var(--text-primary,#cccccc)] text-[13px]" data-testid="rag-panel">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-primary,#333)]">
        <Brain className="w-4 h-4 text-purple-400" />
        <span className="font-semibold text-sm">RAG Engine</span>
        {stats?.isAvailable && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-green-400">
            <Zap className="w-3 h-3" /> Active
          </span>
        )}
        {!stats?.isAvailable && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-yellow-500">
            <AlertCircle className="w-3 h-3" /> No API Key
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status Section */}
        <div className="border-b border-[var(--border-primary,#333)]">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-hover,#2a2a2a)] transition-colors"
            onClick={() => toggleSection('status')}
            data-testid="rag-status-toggle"
          >
            {expandedSections.has('status') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium">Index Status</span>
          </button>

          {expandedSections.has('status') && (
            <div className="px-3 pb-3 space-y-2">
              {/* Progress Bar */}
              {isIndexing && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[var(--text-secondary,#888)]">
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Indexing...
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-secondary,#333)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Files" value={projectStats?.totalFiles || status?.indexedFiles || 0} icon={<FileCode className="w-3.5 h-3.5" />} />
                <StatCard label="Chunks" value={projectStats?.totalChunks || status?.totalChunks || 0} icon={<Layers className="w-3.5 h-3.5" />} />
                <StatCard label="Embeddings" value={stats?.embeddingsCount || projectStats?.embeddedChunks || 0} icon={<Brain className="w-3.5 h-3.5" />} />
                <StatCard label="Knowledge" value={stats?.nodesCount || 0} icon={<Globe className="w-3.5 h-3.5" />} />
              </div>

              {/* Languages */}
              {projectStats?.languages && Object.keys(projectStats.languages).length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary,#888)] font-medium">Languages</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(projectStats.languages)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([lang, count]) => (
                        <span key={lang} className="px-1.5 py-0.5 bg-[var(--bg-secondary,#2a2a2a)] rounded text-[10px]">
                          {lang} <span className="text-[var(--text-secondary,#666)]">{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Watcher Status */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--text-secondary,#888)]">File Watcher:</span>
                <span className={statusData?.watcherActive ? 'text-green-400' : 'text-[var(--text-secondary,#666)]'}>
                  {statusData?.watcherActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Last Indexed */}
              {status?.lastIndexedAt && (
                <div className="text-[11px] text-[var(--text-secondary,#888)]">
                  Last indexed: {new Date(status.lastIndexedAt).toLocaleString()}
                </div>
              )}

              {/* Errors */}
              {status?.errorCount ? (
                <div className="flex items-center gap-1 text-[11px] text-yellow-500">
                  <AlertCircle className="w-3 h-3" />
                  {status.errorCount} indexing error{status.errorCount > 1 ? 's' : ''}
                  {status.lastError && <span className="text-[var(--text-secondary,#666)] truncate max-w-[150px]"> — {status.lastError}</span>}
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex gap-1.5 pt-1">
                <button
                  className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] transition-colors disabled:opacity-50"
                  onClick={() => indexMutation.mutate(false)}
                  disabled={isIndexing || !projectId}
                  data-testid="btn-index-project"
                >
                  {isIndexing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Index
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary,#333)] hover:bg-[var(--bg-hover,#444)] rounded text-[11px] transition-colors disabled:opacity-50"
                  onClick={() => reindexMutation.mutate()}
                  disabled={isIndexing || !projectId}
                  data-testid="btn-reindex-project"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reindex
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary,#333)] hover:bg-[var(--bg-hover,#444)] rounded text-[11px] transition-colors disabled:opacity-50"
                  onClick={() => watcherMutation.mutate(statusData?.watcherActive ? 'stop' : 'start')}
                  disabled={!projectId}
                  data-testid="btn-toggle-watcher"
                >
                  {statusData?.watcherActive ? <Square className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {statusData?.watcherActive ? 'Stop Watch' : 'Watch'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Semantic Search Section */}
        <div className="border-b border-[var(--border-primary,#333)]">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-hover,#2a2a2a)] transition-colors"
            onClick={() => toggleSection('search')}
            data-testid="rag-search-toggle"
          >
            {expandedSections.has('search') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Search className="w-3.5 h-3.5 text-green-400" />
            <span className="font-medium">Semantic Search</span>
          </button>

          {expandedSections.has('search') && (
            <div className="px-3 pb-3 space-y-2">
              <div className="flex gap-1">
                <input
                  className="flex-1 bg-[var(--bg-secondary,#2a2a2a)] border border-[var(--border-primary,#444)] rounded px-2 py-1.5 text-[12px] placeholder-[var(--text-secondary,#666)] focus:border-purple-500 focus:outline-none"
                  placeholder="Search codebase semantically..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  data-testid="input-rag-search"
                />
                <button
                  className="px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] transition-colors disabled:opacity-50"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  data-testid="btn-rag-search"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Search Mode Selector */}
              <div className="flex gap-1">
                {(['hybrid', 'vector', 'fts'] as const).map(mode => (
                  <button
                    key={mode}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      searchMode === mode
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                        : 'bg-[var(--bg-secondary,#2a2a2a)] text-[var(--text-secondary,#888)] hover:text-[var(--text-primary,#ccc)]'
                    }`}
                    onClick={() => setSearchMode(mode)}
                    data-testid={`btn-search-mode-${mode}`}
                  >
                    {mode === 'hybrid' ? 'Hybrid' : mode === 'vector' ? 'Vector' : 'Full-Text'}
                  </button>
                ))}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  <div className="text-[11px] text-[var(--text-secondary,#888)]">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  {searchResults.map(result => (
                    <div
                      key={result.id}
                      className="bg-[var(--bg-secondary,#2a2a2a)] rounded border border-[var(--border-primary,#333)] overflow-hidden"
                    >
                      <button
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-[var(--bg-hover,#333)] transition-colors"
                        onClick={() => toggleResult(result.id)}
                        data-testid={`search-result-${result.id}`}
                      >
                        {expandedResults.has(result.id) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <FileCode className="w-3 h-3 shrink-0 text-blue-400" />
                        <span className="truncate text-[11px]">{result.filePath}</span>
                        {result.symbolName && (
                          <span className="text-[10px] text-purple-400 truncate">→ {result.symbolName}</span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-[var(--text-secondary,#666)]">
                          {(result.score * 100).toFixed(0)}%
                        </span>
                        <span className={`shrink-0 text-[9px] px-1 rounded ${
                          result.matchType === 'hybrid' ? 'bg-purple-600/20 text-purple-400' :
                          result.matchType === 'vector' ? 'bg-blue-600/20 text-blue-400' :
                          'bg-green-600/20 text-green-400'
                        }`}>
                          {result.matchType}
                        </span>
                      </button>

                      {expandedResults.has(result.id) && (
                        <div className="border-t border-[var(--border-primary,#333)]">
                          <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-[var(--text-secondary,#888)] bg-[var(--bg-primary,#1e1e1e)]">
                            <span>{result.language}</span>
                            <span>•</span>
                            <span>{result.chunkType}</span>
                            {result.startLine && result.endLine && (
                              <>
                                <span>•</span>
                                <span>L{result.startLine}–{result.endLine}</span>
                              </>
                            )}
                          </div>
                          <pre className="px-2 py-1.5 text-[11px] overflow-x-auto max-h-[200px] overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                            {result.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Embedding Info Section */}
        <div className="border-b border-[var(--border-primary,#333)]">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-hover,#2a2a2a)] transition-colors"
            onClick={() => toggleSection('config')}
            data-testid="rag-config-toggle"
          >
            {expandedSections.has('config') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Settings2 className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-medium">Configuration</span>
          </button>

          {expandedSections.has('config') && (
            <div className="px-3 pb-3 space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-[var(--text-secondary,#888)]">Model</span>
                <span>{stats?.embeddingModel || 'text-embedding-3-small'}</span>
                <span className="text-[var(--text-secondary,#888)]">Dimensions</span>
                <span>1536</span>
                <span className="text-[var(--text-secondary,#888)]">Search</span>
                <span>Hybrid (Vector + FTS)</span>
                <span className="text-[var(--text-secondary,#888)]">Vector DB</span>
                <span>pgvector (cosine)</span>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[var(--text-secondary,#888)] font-medium">Providers</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: 'OpenAI', active: stats?.providers?.openai },
                    { name: 'Anthropic', active: stats?.providers?.anthropic },
                    { name: 'Gemini', active: stats?.providers?.gemini },
                  ].map(p => (
                    <span
                      key={p.name}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                        p.active
                          ? 'bg-green-900/30 text-green-400 border border-green-800/50'
                          : 'bg-[var(--bg-secondary,#2a2a2a)] text-[var(--text-secondary,#666)]'
                      }`}
                    >
                      {p.active ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Chunk Types */}
              {projectStats?.chunkTypes && Object.keys(projectStats.chunkTypes).length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[var(--text-secondary,#888)] font-medium">Chunk Types</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(projectStats.chunkTypes)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span key={type} className="px-1.5 py-0.5 bg-[var(--bg-secondary,#2a2a2a)] rounded text-[10px]">
                          {type} <span className="text-[var(--text-secondary,#666)]">{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-secondary,#2a2a2a)] rounded border border-[var(--border-primary,#333)]">
      <div className="text-purple-400">{icon}</div>
      <div>
        <div className="text-[13px] font-semibold leading-none">{value.toLocaleString()}</div>
        <div className="text-[10px] text-[var(--text-secondary,#888)] mt-0.5">{label}</div>
      </div>
    </div>
  );
}
