export function ReplitThemesPanel({ projectId }: { projectId: string }) {
  return (
    <div className="h-full overflow-auto p-4">
      <h2 className="text-[15px] font-semibold mb-4 text-[var(--ide-text)]">Themes</h2>
      <p className="text-[var(--ide-text-muted)] text-xs">Customize your editor theme</p>
    </div>
  );
}
