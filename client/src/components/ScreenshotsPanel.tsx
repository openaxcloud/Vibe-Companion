// @ts-nocheck
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Camera, Download, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface ScreenshotsPanelProps {
  projectId: number;
}

export function ScreenshotsPanel({ projectId }: ScreenshotsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [screenshotTitle, setScreenshotTitle] = useState('');
  const [screenshotDescription, setScreenshotDescription] = useState('');

  // Fetch screenshots
  const { data: screenshots, isLoading } = useQuery({
    queryKey: ['/api/screenshots', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/screenshots/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch screenshots');
      return res.json();
    }
  });

  // Capture screenshot mutation
  const captureScreenshotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/screenshots/${projectId}/capture`, {
        title: screenshotTitle || `Screenshot ${new Date().toISOString()}`,
        description: screenshotDescription
      });
      if (!res.ok) throw new Error('Failed to capture screenshot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screenshots', projectId] });
      toast({
        title: 'Screenshot captured',
        description: 'Project preview has been saved'
      });
      setScreenshotTitle('');
      setScreenshotDescription('');
    }
  });

  // Delete screenshot mutation
  const deleteScreenshotMutation = useMutation({
    mutationFn: async (screenshotId: number) => {
      const res = await apiRequest('DELETE', `/api/screenshots/${screenshotId}`);
      if (!res.ok) throw new Error('Failed to delete screenshot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screenshots', projectId] });
      toast({
        title: 'Screenshot deleted',
        description: 'The screenshot has been removed'
      });
    }
  });

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold mb-2">Capture Screenshot</h3>
        <label htmlFor="screenshot-title" className="sr-only">Screenshot title</label>
        <input
          id="screenshot-title"
          type="text"
          placeholder="Screenshot title (optional)"
          value={screenshotTitle}
          onChange={(e) => setScreenshotTitle(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
          aria-label="Screenshot title"
        />
        <label htmlFor="screenshot-description" className="sr-only">Screenshot description</label>
        <textarea
          id="screenshot-description"
          placeholder="Description (optional)"
          value={screenshotDescription}
          onChange={(e) => setScreenshotDescription(e.target.value)}
          className="w-full p-2 mb-2 border rounded h-20"
          aria-label="Screenshot description"
        />
        <Button
          onClick={() => captureScreenshotMutation.mutate()}
          disabled={captureScreenshotMutation.isPending}
          className="w-full"
        >
          <Camera className="h-4 w-4 mr-2" />
          Capture Screenshot
        </Button>
      </div>

      <div>
        <h3 className="text-[15px] font-semibold mb-2">Screenshots Gallery</h3>
        {isLoading ? (
          <p>Loading screenshots...</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {screenshots?.map((screenshot: any) => (
              <Card key={screenshot.id} className="overflow-hidden">
                <img
                  src={screenshot.imageUrl}
                  alt={screenshot.title}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2">
                  <h4 className="font-medium text-[13px] truncate">{screenshot.title}</h4>
                  {screenshot.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{screenshot.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(screenshot.createdAt), 'PP')}
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(screenshot.imageUrl, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteScreenshotMutation.mutate(screenshot.id)}
                      disabled={deleteScreenshotMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}