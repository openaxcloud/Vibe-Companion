interface LazyMobileCodeEditorProps {
  projectId: string;
  fileId: number | null;
  className?: string;
}

export function LazyMobileCodeEditor({ projectId, fileId, className }: LazyMobileCodeEditorProps) {
  return <div className={className || "h-full"}><p className="p-4 text-xs text-[var(--ide-text-muted)]">Code editor loading...</p></div>;
}
