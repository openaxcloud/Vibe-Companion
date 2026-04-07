import { useState, useEffect } from 'react';

interface ConnectionStatus {
  isOnline: boolean;
  backendHealthy: boolean;
}

export function useConnectionStatus(): ConnectionStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendHealthy, setBackendHealthy] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check backend health
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { credentials: 'include' });
        setBackendHealthy(res.ok);
      } catch {
        setBackendHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, backendHealthy };
}
