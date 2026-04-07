import { useEffect } from 'react';
import { AgentEventBus } from '@/lib/agentEvents';
import { FaviconManager, type FaviconStatus } from '@/lib/faviconManager';

export function useAgentFavicon() {
  useEffect(() => {
    const unsubStatus = AgentEventBus.on('agent:status', (event) => {
      const status = event.payload.status as string;
      
      let faviconStatus: FaviconStatus = 'idle';
      
      if (['working', 'building', 'thinking', 'vibing', 'styling', 'testing', 'deploying'].includes(status)) {
        faviconStatus = 'working';
      } else if (status === 'complete') {
        faviconStatus = 'complete';
      } else if (status === 'error') {
        faviconStatus = 'error';
      }
      
      FaviconManager.setStatus(faviconStatus);
    });

    const unsubComplete = AgentEventBus.on('agent:complete', () => {
      FaviconManager.setStatus('complete');
    });

    const unsubError = AgentEventBus.on('agent:error', () => {
      FaviconManager.setStatus('error');
    });

    const unsubDisconnected = AgentEventBus.on('agent:disconnected', () => {
      FaviconManager.reset();
    });

    return () => {
      unsubStatus();
      unsubComplete();
      unsubError();
      unsubDisconnected();
      FaviconManager.reset();
    };
  }, []);
}
