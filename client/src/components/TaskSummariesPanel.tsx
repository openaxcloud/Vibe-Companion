import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { FileText, FileEdit, GitCommit, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface TaskSummariesPanelProps {
  projectId: number;
}

export function TaskSummariesPanel({ projectId }: TaskSummariesPanelProps) {
  // Fetch task summaries
  const { data: summaries, isLoading } = useQuery({
    queryKey: ['/api/task-summaries', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/task-summaries/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch task summaries');
      return res.json();
    }
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="p-4">
      <h3 className="text-[15px] font-semibold mb-4">Task Summaries</h3>
      
      {isLoading ? (
        <p>Loading task summaries...</p>
      ) : (
        <div className="space-y-3">
          {summaries?.map((summary: any) => (
            <Card key={summary.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{summary.taskDescription}</h4>
                <Badge variant={summary.completed ? 'default' : 'secondary'}>
                  {summary.completed ? 'Completed' : 'In Progress'}
                </Badge>
              </div>
              
              <p className="text-[13px] text-muted-foreground mb-3">{summary.summary}</p>
              
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="flex items-center gap-1">
                  <FileEdit className="h-3 w-3 text-muted-foreground" />
                  <span>{summary.filesChanged || 0} files changed</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDuration(summary.timeSpent)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">+{summary.linesAdded || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">-{summary.linesDeleted || 0}</span>
                </div>
              </div>
              
              <p className="text-[11px] text-muted-foreground mt-2">
                {format(new Date(summary.createdAt), 'PPpp')}
              </p>
            </Card>
          ))}
          
          {summaries?.length === 0 && (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No task summaries yet</p>
              <p className="text-[13px] text-muted-foreground">
                Task summaries will appear here as you complete work
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}