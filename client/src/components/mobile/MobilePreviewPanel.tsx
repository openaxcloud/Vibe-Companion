import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Globe, RefreshCw, ExternalLink } from "lucide-react";

interface MobilePreviewPanelProps {
  projectId: string;
}

function computeFilesSignature(files: any[]): string {
  return files
    .map((f: any) => `${f.id || ''}:${f.filename || ''}:${f.updatedAt || f.content?.length || 0}`)
    .sort()
    .join('|');
}

export function MobilePreviewPanel({ projectId }: MobilePreviewPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const { data: project } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}`).then(r => r.json()),
  });

  const { data: filesData } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "files"],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/files`).then((r: any) => Array.isArray(r) ? r : (r.json ? r.json() : [])),
    refetchInterval: 3000,
    enabled: !!projectId,
  });

  const prevSignatureRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!filesData || !Array.isArray(filesData)) return;
    const sig = computeFilesSignature(filesData);
    if (prevSignatureRef.current !== null && sig !== prevSignatureRef.current) {
      setLoaded(false);
      setRefreshKey(k => k + 1);
    }
    if (!mountedRef.current && filesData.length === 0) {
      mountedRef.current = true;
    }
    prevSignatureRef.current = sig;
  }, [filesData]);

  const previewUrl = `/api/preview/projects/${projectId}/preview/`;

  const refresh = useCallback(() => {
    setLoaded(false);
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--ide-panel)]">
      <div className="flex items-center gap-1 px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <button onClick={refresh} className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" data-testid="button-mobile-refresh">
          <RefreshCw className={`w-3 h-3 ${!loaded && previewUrl ? "animate-spin" : ""}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 h-[22px] px-2 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
            <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate" data-testid="text-mobile-url">{previewUrl || "No preview"}</span>
          </div>
        </div>
        {previewUrl && (
          <button onClick={() => window.open(previewUrl, "_blank")} className="w-6 h-6 flex items-center justify-center rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" data-testid="button-mobile-external">
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          <iframe
            key={refreshKey}
            src={previewUrl}
            className="w-full h-full border-0 bg-white dark:bg-gray-900"
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            data-testid="iframe-mobile-preview"
          />
        ) : (
          <div className="text-center">
            <Globe className="w-8 h-8 text-[var(--ide-text-muted)]/30 mx-auto mb-2" />
            <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-no-mobile-preview">Run your app to see the preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
