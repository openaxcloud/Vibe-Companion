import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Video,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  Loader2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TimelineMarker {
  timestamp: number;
  label: string;
  type: 'event' | 'error' | 'milestone';
}

interface SessionRecording {
  id: string;
  sessionId: string;
  status: 'recording' | 'stopped' | 'processing' | 'ready' | 'error';
  startedAt: Date;
  stoppedAt?: Date;
  duration?: number;
  videoPath?: string;
  videoUrl?: string;
  markers?: TimelineMarker[];
  metadata?: {
    browserType?: string;
    viewport?: { width: number; height: number };
    totalFrames?: number;
  };
}

interface SessionRecordingProps {
  sessionId: string;
  projectId: string;
  className?: string;
}

export function SessionRecording({ sessionId, projectId, className }: SessionRecordingProps) {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [openRecordings, setOpenRecordings] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch session recordings
  const { data: recordingsData, isLoading: isLoadingRecordings } = useQuery({
    queryKey: ['/api/admin/agent/recording/session', sessionId],
  });

  const recordings: SessionRecording[] = recordingsData?.recordings || [];
  const activeRecording = activeRecordingId 
    ? recordings.find(r => r.id === activeRecordingId)
    : null;

  // Start recording mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/agent/recording/start`, {
        sessionId,
        projectId,
        options: {
          recordingType: 'browser',
          resolution: { width: 1920, height: 1080 }
        }
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Recording Started',
        description: `Recording ID: ${data.recordingId}`,
      });
      setActiveRecordingId(data.recordingId);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agent/recording/session', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Recording Failed',
        description: error.message || 'Failed to start recording',
        variant: 'destructive',
      });
    },
  });

  // Stop recording mutation
  const stopMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const res = await apiRequest('POST', `/api/admin/agent/recording/stop/${recordingId}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Recording Stopped',
        description: 'Processing video...',
      });
      setActiveRecordingId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agent/recording/session', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Stop Failed',
        description: error.message || 'Failed to stop recording',
        variant: 'destructive',
      });
    },
  });

  // Add marker mutation
  const addMarkerMutation = useMutation({
    mutationFn: async ({ recordingId, label, type }: { recordingId: string; label: string; type: string }) => {
      const res = await apiRequest('POST', `/api/admin/agent/recording/marker/${recordingId}`, {
        timestamp: currentTime,
        label,
        type
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Marker Added',
        description: 'Timeline marker saved',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agent/recording/session', sessionId] });
    },
  });

  const toggleRecording = (recordingId: string) => {
    setOpenRecordings(prev => {
      const next = new Set(prev);
      if (next.has(recordingId)) {
        next.delete(recordingId);
      } else {
        next.add(recordingId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (openRecordings.size === recordings.length) {
      setOpenRecordings(new Set());
    } else {
      setOpenRecordings(new Set(recordings.map(r => r.id)));
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: SessionRecording['status']) => {
    switch (status) {
      case 'recording':
        return <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'ready':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'milestone':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      default:
        return <Bookmark className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs defaultValue="recorder" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recorder" data-testid="tab-recorder">
            Recorder
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">
            Sessions ({recordings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="flex-1 flex flex-col gap-4 mt-4">
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold">Session Recorder</h3>
                  <p className="text-[13px] text-muted-foreground">
                    Record browser sessions with timeline markers
                  </p>
                </div>
                {activeRecordingId && (
                  <Badge variant="destructive" className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Recording
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                {!activeRecordingId ? (
                  <Button
                    onClick={() => startMutation.mutate(undefined)}
                    disabled={startMutation.isPending}
                    className="flex-1"
                    data-testid="button-start-recording"
                  >
                    {startMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Video className="mr-2 h-4 w-4" />
                        Start Recording
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => stopMutation.mutate(activeRecordingId)}
                      disabled={stopMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                      data-testid="button-stop-recording"
                    >
                      {stopMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Stopping...
                        </>
                      ) : (
                        <>
                          <Square className="mr-2 h-4 w-4" />
                          Stop Recording
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => addMarkerMutation.mutate({ 
                        recordingId: activeRecordingId, 
                        label: 'Event', 
                        type: 'event' 
                      })}
                      disabled={addMarkerMutation.isPending}
                      variant="outline"
                      data-testid="button-add-marker"
                    >
                      <Bookmark className="mr-2 h-4 w-4" />
                      Add Marker
                    </Button>
                  </>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-[13px] text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">How it works</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Session recording captures browser interactions with video replay and
                      timeline markers. Add markers during recording to highlight important
                      events, errors, or milestones for later review.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="flex-1 flex flex-col mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Recorded Sessions</h3>
            {recordings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                data-testid="button-toggle-all-recordings"
              >
                {openRecordings.size === recordings.length ? 'Collapse All' : 'Expand All'}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoadingRecordings ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </Card>
                ))}
              </div>
            ) : recordings.length === 0 ? (
              <Card className="p-8 text-center">
                <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No recordings yet</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Start a recording to capture browser sessions
                </p>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="container-recordings">
                {recordings.map((recording) => (
                  <Collapsible
                    key={recording.id}
                    open={openRecordings.has(recording.id)}
                    onOpenChange={() => toggleRecording(recording.id)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <button 
                          className="w-full p-4 text-left hover:bg-accent/50 transition-colors rounded-lg"
                          data-testid={`button-toggle-recording-${recording.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {getStatusIcon(recording.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium">
                                    Recording #{recording.id}
                                  </span>
                                  <Badge
                                    variant={
                                      recording.status === 'ready'
                                        ? 'default'
                                        : recording.status === 'error'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                  >
                                    {recording.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {new Date(recording.startedAt).toLocaleString()}
                                  </span>
                                  {recording.duration && (
                                    <>
                                      <span>•</span>
                                      <span>{formatDuration(recording.duration)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                openRecordings.has(recording.id) && "rotate-180"
                              )}
                            />
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-4">
                          {/* Video Player Placeholder */}
                          {recording.status === 'ready' && recording.videoUrl && (
                            <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
                              <video
                                src={recording.videoUrl}
                                controls
                                className="w-full h-full rounded-lg"
                                data-testid="video-player"
                              >
                                Your browser does not support video playback.
                              </video>
                            </div>
                          )}

                          {/* Timeline Markers */}
                          {recording.markers && recording.markers.length > 0 && (
                            <div>
                              <h4 className="text-[13px] font-semibold mb-2">Timeline Markers</h4>
                              <div className="space-y-1">
                                {recording.markers.map((marker, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors"
                                    data-testid={`marker-${idx}`}
                                  >
                                    {getMarkerIcon(marker.type)}
                                    <span className="text-[13px] flex-1">{marker.label}</span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatDuration(marker.timestamp)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {recording.metadata && (
                            <div className="flex gap-4 text-[13px] border-t pt-4">
                              {recording.metadata.browserType && (
                                <div>
                                  <span className="text-muted-foreground">Browser:</span>{' '}
                                  <span className="font-medium capitalize">
                                    {recording.metadata.browserType}
                                  </span>
                                </div>
                              )}
                              {recording.metadata.viewport && (
                                <div>
                                  <span className="text-muted-foreground">Viewport:</span>{' '}
                                  <span className="font-medium">
                                    {recording.metadata.viewport.width}x{recording.metadata.viewport.height}
                                  </span>
                                </div>
                              )}
                              {recording.metadata.totalFrames && (
                                <div>
                                  <span className="text-muted-foreground">Frames:</span>{' '}
                                  <span className="font-medium">
                                    {recording.metadata.totalFrames}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
