// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Play, Pause, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface TimeTrackingPanelProps {
  projectId: number;
  userId: number;
}

export function TimeTrackingPanel({ projectId, userId }: TimeTrackingPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch active tracking
  const { data: activeTracking } = useQuery({
    queryKey: ['/api/time-tracking', projectId, 'active'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/time-tracking/${projectId}/active`);
      if (!res.ok) return null;
      return res.json();
    }
  });

  // Fetch time tracking history
  const { data: trackingHistory } = useQuery({
    queryKey: ['/api/time-tracking', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/time-tracking/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch time tracking');
      return res.json();
    }
  });

  // Start tracking mutation
  const startTrackingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/time-tracking/${projectId}/start`);
      if (!res.ok) throw new Error('Failed to start tracking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking', projectId] });
      toast({
        title: 'Time tracking started',
        description: 'Your work time is now being tracked'
      });
    }
  });

  // Stop tracking mutation
  const stopTrackingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/time-tracking/${projectId}/stop`);
      if (!res.ok) throw new Error('Failed to stop tracking');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking', projectId] });
      toast({
        title: 'Time tracking stopped',
        description: 'Your work session has been recorded'
      });
    }
  });

  // Update elapsed time
  useEffect(() => {
    if (activeTracking) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeTracking.startTime).getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTracking]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold mb-2">Time Tracking</h3>
        
        {activeTracking ? (
          <Card className="p-4">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold mb-2">
                {formatDuration(elapsedTime)}
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">
                Started at {format(new Date(activeTracking.startTime), 'p')}
              </p>
              <Button
                onClick={() => stopTrackingMutation.mutate()}
                disabled={stopTrackingMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop Tracking
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            onClick={() => startTrackingMutation.mutate()}
            disabled={startTrackingMutation.isPending}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Tracking
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-[15px] font-semibold mb-2">Session History</h3>
        <div className="space-y-2">
          {trackingHistory?.map((session: any) => (
            <Card key={session.id} className="p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">
                    {format(new Date(session.startTime), 'PPp')}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Duration: {formatDuration(session.duration || 0)}
                  </p>
                  {session.taskDescription && (
                    <p className="text-[13px]">{session.taskDescription}</p>
                  )}
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}