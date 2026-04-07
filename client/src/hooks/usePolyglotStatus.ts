import { useState, useEffect } from 'react';

interface ServiceStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
}

interface PolyglotStatus {
  typescript: ServiceStatus & { port: number; role: string };
  go: ServiceStatus & { port: number; role: string };
  python: ServiceStatus & { port: number; role: string };
}

export const usePolyglotStatus = () => {
  const [status, setStatus] = useState<PolyglotStatus>({
    typescript: {
      healthy: false,
      port: 5000,
      role: 'Web API, User Management, Database Operations'
    },
    go: {
      healthy: false,
      port: 8080,
      role: 'Container Orchestration, File Operations, WebSocket'
    },
    python: {
      healthy: false,
      port: 8081,
      role: 'AI/ML Workloads, Data Processing, Code Analysis'
    }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.services) {
          setStatus({
            typescript: {
              healthy: data.services.typescript?.healthy || false,
              latency: data.services.typescript?.latency,
              port: 5000,
              role: 'Web API, User Management, Database Operations'
            },
            go: {
              healthy: data.services.go?.healthy || false,
              latency: data.services.go?.latency,
              port: 8080,
              role: 'Container Orchestration, File Operations, WebSocket'
            },
            python: {
              healthy: data.services.python?.healthy || false,
              latency: data.services.python?.latency,
              port: 8081,
              role: 'AI/ML Workloads, Data Processing, Code Analysis'
            }
          });
        }
      } catch (error) {
        console.error('Failed to check polyglot health:', error);
      } finally {
        setLoading(false);
      }
    };

    // Check immediately and then every 20 seconds
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    
    return () => clearInterval(interval);
  }, []);

  return { status, loading };
};