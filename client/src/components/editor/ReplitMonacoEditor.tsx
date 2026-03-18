import CodeEditor from '@/components/CodeEditor';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ReplitMonacoEditorProps {
  projectId: string;
  fileId: number | null;
}

export function ReplitMonacoEditor({ projectId, fileId }: ReplitMonacoEditorProps) {
  const fileQuery = useQuery({
    queryKey: ['/api/projects', projectId, 'files', fileId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/files`);
      const files = await res.json();
      return files.find((f: any) => f.id === fileId);
    },
    enabled: !!projectId && !!fileId,
  });

  if (!fileId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ide-text-muted)] text-xs">
        Select a file to edit
      </div>
    );
  }

  if (fileQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#0079F2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const file = fileQuery.data;
  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ide-text-muted)] text-xs">
        File not found
      </div>
    );
  }

  return (
    <div className="h-full">
      <CodeEditor
        value={file.content || ''}
        language={file.language || 'javascript'}
        onChange={() => {}}
        filename={file.filename || file.name}
        projectId={parseInt(projectId, 10)}
      />
    </div>
  );
}
