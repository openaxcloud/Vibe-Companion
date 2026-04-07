import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wifi,
  WifiOff,
  Zap,
  Users,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";

interface SystemStatus {
  connection: "online" | "offline" | "connecting";
  cpu: number;
  memory: number;
  storage: number;
  activeUsers: number;
  gitBranch: string;
  lastSaved: Date | null;
  hasErrors: boolean;
}

export function ReplitFooter() {
  const [status, setStatus] = useState<SystemStatus>({
    connection: "online",
    cpu: 45,
    memory: 67,
    storage: 23,
    activeUsers: 1,
    gitBranch: "main",
    lastSaved: new Date(),
    hasErrors: false,
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusColor = (value: number, type: "cpu" | "memory" | "storage") => {
    const thresholds = {
      cpu: { warning: 70, danger: 90 },
      memory: { warning: 80, danger: 95 },
      storage: { warning: 85, danger: 95 },
    };
    
    const threshold = thresholds[type];
    if (value >= threshold.danger) return "text-[var(--replit-danger)]";
    if (value >= threshold.warning) return "text-[var(--replit-warning)]";
    return "text-[var(--replit-green)]";
  };

  return (
    <TooltipProvider>
      <footer className="h-6 bg-[var(--replit-surface)] border-t border-[var(--replit-border)] flex items-center justify-between px-3 text-xs">
        {/* Section gauche - Status système */}
        <div className="flex items-center space-x-4">
          {/* Status de connexion */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                {status.connection === "online" ? (
                  <Wifi className="h-3 w-3 text-[var(--replit-green)]" />
                ) : status.connection === "offline" ? (
                  <WifiOff className="h-3 w-3 text-[var(--replit-danger)]" />
                ) : (
                  <Wifi className="h-3 w-3 text-[var(--replit-warning)] animate-pulse" />
                )}
                <span className="text-[var(--replit-text-secondary)]">
                  {status.connection === "online" ? "Online" : 
                   status.connection === "offline" ? "Offline" : "Connecting..."}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Connection Status</TooltipContent>
          </Tooltip>

          {/* Utilisateurs actifs */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <Users className="h-3 w-3 text-[var(--replit-blue)]" />
                <span className="text-[var(--replit-text-secondary)]">
                  {status.activeUsers}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Active Users</TooltipContent>
          </Tooltip>

          {/* Git branch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <GitBranch className="h-3 w-3 text-[var(--replit-purple)]" />
                <span className="text-[var(--replit-text-secondary)]">
                  {status.gitBranch}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Current Branch</TooltipContent>
          </Tooltip>

          {/* Statut de sauvegarde */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                {status.hasErrors ? (
                  <AlertCircle className="h-3 w-3 text-[var(--replit-danger)]" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-[var(--replit-green)]" />
                )}
                <span className="text-[var(--replit-text-secondary)]">
                  {formatLastSaved(status.lastSaved)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Last Saved</TooltipContent>
          </Tooltip>
        </div>

        {/* Section centre - Métriques système */}
        <div className="flex items-center space-x-4">
          {/* CPU */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <Cpu className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                <span className={getStatusColor(status.cpu, "cpu")}>
                  {status.cpu}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>CPU Usage</TooltipContent>
          </Tooltip>

          {/* Memory */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <Activity className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                <span className={getStatusColor(status.memory, "memory")}>
                  {status.memory}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Memory Usage</TooltipContent>
          </Tooltip>

          {/* Storage */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <HardDrive className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                <span className={getStatusColor(status.storage, "storage")}>
                  {status.storage}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Storage Usage</TooltipContent>
          </Tooltip>
        </div>

        {/* Section droite - Actions et info */}
        <div className="flex items-center space-x-4">
          {/* Plan actuel */}
          <Badge
            variant="outline"
            className="text-xs border-[var(--replit-warning)] text-[var(--replit-warning)] bg-[var(--replit-warning)]/10"
          >
            <Zap className="h-3 w-3 mr-1" />
            Free Plan
          </Badge>

          {/* Heure actuelle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-1 cursor-default">
                <Clock className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                <span className="text-[var(--replit-text-secondary)] font-mono">
                  {formatTime(currentTime)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Current Time</TooltipContent>
          </Tooltip>

          {/* Status général */}
          <div className="flex items-center space-x-1">
            <div className={`h-2 w-2 rounded-full ${
              status.hasErrors 
                ? "bg-[var(--replit-danger)]" 
                : status.connection === "online"
                ? "bg-[var(--replit-green)]"
                : "bg-[var(--replit-warning)]"
            } animate-pulse`}></div>
            <span className="text-[var(--replit-text-secondary)]">
              {status.hasErrors ? "Error" : "Ready"}
            </span>
          </div>
        </div>
      </footer>
    </TooltipProvider>
  );
}