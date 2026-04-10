import { useEffect, useRef } from 'react';
import { AgentEventBus } from '@/lib/agentEvents';
import { useToast } from './use-toast';

const RATE_LIMIT_MS = 2000;

export function useAgentDockNotifications() {
  const { toast } = useToast();
  const lastNotificationRef = useRef<Record<string, number>>({});

  const shouldNotify = (type: string): boolean => {
    const now = Date.now();
    const lastTime = lastNotificationRef.current[type] || 0;
    if (now - lastTime < RATE_LIMIT_MS) {
      return false;
    }
    lastNotificationRef.current[type] = now;
    return true;
  };

  useEffect(() => {
    const unsubComplete = AgentEventBus.on('agent:complete', (event) => {
      if (!shouldNotify('complete')) return;
      
      toast({
        title: 'Build Complete',
        description: 'Your app is ready to preview',
        duration: 5000,
      });
    });

    const unsubError = AgentEventBus.on('agent:error', (event) => {
      if (!shouldNotify('error')) return;
      
      const message = (event.payload.message as string) || 'An error occurred during build';
      toast({
        title: 'Build Error',
        description: message,
        variant: 'destructive',
        duration: 8000,
      });
    });

    const unsubDatabase = AgentEventBus.on('agent:database-created', (event) => {
      if (!shouldNotify('database')) return;
      
      toast({
        title: 'Database Added',
        description: 'A database has been added to your project',
        duration: 5000,
      });
    });

    const unsubFile = AgentEventBus.on('agent:file-created', (event) => {
      if (!shouldNotify('file')) return;
      
      const filename = (event.payload.filename as string) || 'New file';
      toast({
        title: 'File Created',
        description: filename,
        duration: 3000,
      });
    });

    return () => {
      unsubComplete();
      unsubError();
      unsubDatabase();
      unsubFile();
    };
  }, [toast]);
}
