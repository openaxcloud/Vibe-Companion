/**
 * VideoReplayViewer - Modal viewer for test session video replays
 * Integrates with AgentTools backend to fetch and display test recordings
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, Play, Clock, CheckCircle2, XCircle, AlertCircle, 
  Video, ChevronRight, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { VideoReplayPlayer } from './VideoReplayPlayer';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface VideoReplay {
  id: string;
  testSessionId: string;
  projectId: number;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  duration: number;
  status: 'recording' | 'processing' | 'ready' | 'failed';
  steps?: Array<{
    id: string;
    timestamp: number;
    type: 'navigation' | 'click' | 'input' | 'assertion' | 'screenshot';
    description: string;
    status: 'passed' | 'failed' | 'pending';
    screenshot?: string;
  }>;
  createdAt: string;
}

interface VideoReplayViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  selectedReplayId?: string;
}

export function VideoReplayViewer({
  open,
  onOpenChange,
  projectId,
  selectedReplayId
}: VideoReplayViewerProps) {
  const [activeReplayId, setActiveReplayId] = useState<string | null>(selectedReplayId || null);

  const { data: replaysData, isLoading } = useQuery({
    queryKey: ['/api/agent/tools/testing/replays', projectId],
    queryFn: async () => {
      return apiRequest<{ replays: VideoReplay[]; count: number }>(
        "GET", 
        `/api/agent/tools/testing/replays?projectId=${projectId}`
      );
    },
    enabled: open && !!projectId,
    staleTime: 30000,
  });

  const replays = replaysData?.replays || [];
  const activeReplay = replays.find(r => r.id === activeReplayId);

  useEffect(() => {
    if (selectedReplayId) {
      setActiveReplayId(selectedReplayId);
    }
  }, [selectedReplayId]);

  useEffect(() => {
    if (!activeReplayId && replays.length > 0) {
      setActiveReplayId(replays[0].id);
    }
  }, [replays, activeReplayId]);

  const getStatusBadge = (status: VideoReplay['status']) => {
    switch (status) {
      case 'ready':
        return <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ready</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Processing</Badge>;
      case 'recording':
        return <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Recording</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
      default:
        return null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col" data-testid="video-replay-viewer">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <DialogTitle>Test Session Recordings</DialogTitle>
              <Badge variant="secondary" className="text-[10px]">
                {replays.length} {replays.length === 1 ? 'recording' : 'recordings'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : replays.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <Video className="h-16 w-16 mb-4 opacity-20" />
              <h3 className="font-medium text-[15px]">No recordings yet</h3>
              <p className="text-[13px] mt-1 text-center max-w-md">
                Test session recordings will appear here when you run tests with App Testing enabled.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="w-64 border-r">
                <div className="p-2 space-y-1">
                  {replays.map((replay) => (
                    <button
                      key={replay.id}
                      onClick={() => setActiveReplayId(replay.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-colors",
                        activeReplayId === replay.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted"
                      )}
                      data-testid={`replay-item-${replay.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          {replay.thumbnailUrl ? (
                            <img 
                              src={replay.thumbnailUrl} 
                              alt="" 
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Play className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium truncate">
                              {replay.filename || 'Test Session'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(replay.status)}
                            {replay.duration > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {formatDuration(replay.duration)}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(replay.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          activeReplayId === replay.id ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex-1 p-4">
                {activeReplay ? (
                  <VideoReplayPlayer
                    videoUrl={activeReplay.url}
                    testSteps={activeReplay.steps || []}
                    duration={activeReplay.duration}
                    testName={activeReplay.filename || 'Test Session'}
                    testStatus={activeReplay.status === 'ready' ? 'passed' : activeReplay.status === 'failed' ? 'failed' : 'running'}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Select a recording to view</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VideoReplayViewer;
