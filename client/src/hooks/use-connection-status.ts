import { useState, useEffect } from 'react';

interface ConnectionStatus {
  isOnline: boolean;
  backendHealthy: boolean;
}

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    backendHealthy: true,
  });

  useEffect(() => {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic health check
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
        setStatus(prev => ({ ...prev, backendHealthy: res.ok }));
      } catch {
        setStatus(prev => ({ ...prev, backendHealthy: false }));
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
}
