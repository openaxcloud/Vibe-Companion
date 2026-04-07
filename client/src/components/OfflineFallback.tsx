import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineFallback() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 bg-background/95 flex items-center justify-center z-50" data-testid="offline-fallback">
      <div className="text-center p-6 max-w-md">
        <WifiOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold mb-2">You're offline</h2>
        <p className="text-muted-foreground mb-4">
          Your changes are saved locally and will sync when you're back online.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-retry-connection">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    </div>
  );
}
