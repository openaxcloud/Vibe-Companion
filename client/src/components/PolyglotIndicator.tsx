import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Server, Cpu, Brain } from 'lucide-react';

interface ServiceStatus {
  status: 'active' | 'inactive' | 'loading';
  port: number;
  role: string;
  icon: React.FC<{ className?: string }>;
}

export const PolyglotIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const [services, setServices] = useState<{
    typescript: ServiceStatus;
    go: ServiceStatus;
    python: ServiceStatus;
  }>({
    typescript: {
      status: 'loading',
      port: 5000,
      role: 'Web API, User Management, Database',
      icon: Server
    },
    go: {
      status: 'loading',
      port: 8080,
      role: 'Container Orchestration, File Ops, WebSocket',
      icon: Cpu
    },
    python: {
      status: 'loading',
      port: 8081,
      role: 'AI/ML Workloads, Data Processing',
      icon: Brain
    }
  });

  useEffect(() => {
    const checkServices = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        setServices(prev => ({
          typescript: {
            ...prev.typescript,
            status: data.services?.typescript?.healthy ? 'active' : 'inactive'
          },
          go: {
            ...prev.go,
            status: data.services?.go?.healthy ? 'active' : 'inactive'
          },
          python: {
            ...prev.python,
            status: data.services?.python?.healthy ? 'active' : 'inactive'
          }
        }));
      } catch (error) {
        console.error('Failed to check service health:', error);
      }
    };

    // Check immediately and every 15 seconds
    checkServices();
    const interval = setInterval(checkServices, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      case 'loading': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 bg-background/50 rounded-lg border",
      className
    )}>
      <Badge variant="outline" className="text-[11px]">
        Polyglot Backend
      </Badge>
      
      {Object.entries(services).map(([name, service]) => {
        const Icon = service.icon;
        return (
          <TooltipProvider key={name}>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    getStatusColor(service.status)
                  )} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold capitalize">{name} Service</p>
                  <p className="text-[11px] text-muted-foreground">Port: {service.port}</p>
                  <p className="text-[11px] text-muted-foreground">{service.role}</p>
                  <p className="text-[11px]">
                    Status: <span className={cn(
                      "font-semibold",
                      service.status === 'active' ? 'text-green-500' : 
                      service.status === 'inactive' ? 'text-red-500' : 
                      'text-yellow-500'
                    )}>{service.status}</span>
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};