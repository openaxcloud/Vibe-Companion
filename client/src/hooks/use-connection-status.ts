import { useState, useEffect, useRef } from 'react';

interface ConnectionStatus {
  isOnline: boolean;
  backendHealthy: boolean;
}

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    backendHealthy: true,
  });
  const checkedRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET', cache: 'no-store', credentials: 'include' });
        setStatus(prev => ({ ...prev, backendHealthy: res.ok }));
        checkedRef.current = true;
      } catch {
        if (checkedRef.current) {
          setStatus(prev => ({ ...prev, backendHealthy: false }));
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
}
