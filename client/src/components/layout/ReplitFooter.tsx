import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

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

  const itemClass = "replit-footer__item";
  const valueClass = "replit-footer__value";
  const statusDotClass = "replit-footer__status-dot";

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
    if (value >= threshold.danger) return "text-[var(--ecode-danger)]";
    if (value >= threshold.warning) return "text-[var(--ecode-warning)]";
    return "text-[var(--ecode-green)]";
  };

  return (
    <TooltipProvider>
      <footer className="replit-footer">
        <div className="replit-footer__inner">
          {/* Section gauche - Status système */}
          <div className="replit-footer__section">
            {/* Status de connexion */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  {status.connection === "online" ? (
                    <Wifi className="h-3 w-3 text-[var(--ecode-green)]" />
                  ) : status.connection === "offline" ? (
                    <WifiOff className="h-3 w-3 text-[var(--ecode-danger)]" />
                  ) : (
                    <Wifi className="h-3 w-3 text-[var(--ecode-warning)] animate-pulse" />
                  )}
                  <span className={valueClass}>
                    {status.connection === "online"
                      ? "Online"
                      : status.connection === "offline"
                      ? "Offline"
                      : "Connecting..."}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Connection Status</TooltipContent>
            </Tooltip>

            {/* Utilisateurs actifs */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <Users className="h-3 w-3 text-[var(--ecode-blue)]" />
                  <span className={valueClass}>{status.activeUsers}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Active Users</TooltipContent>
            </Tooltip>

            {/* Git branch */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <GitBranch className="h-3 w-3 text-[var(--ecode-purple)]" />
                  <span className={valueClass}>{status.gitBranch}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Current Branch</TooltipContent>
            </Tooltip>

            {/* Statut de sauvegarde */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  {status.hasErrors ? (
                    <AlertCircle className="h-3 w-3 text-[var(--ecode-danger)]" />
                  ) : (
                    <CheckCircle className="h-3 w-3 text-[var(--ecode-green)]" />
                  )}
                  <span className={valueClass}>{formatLastSaved(status.lastSaved)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Last Saved</TooltipContent>
            </Tooltip>
          </div>

          {/* Section centre - Métriques système */}
          <div className="replit-footer__section">
            {/* CPU */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <Cpu className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                  <span className={cn(valueClass, getStatusColor(status.cpu, "cpu"))}>
                    {status.cpu}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>CPU Usage</TooltipContent>
            </Tooltip>

            {/* Memory */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <Activity className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                  <span className={cn(valueClass, getStatusColor(status.memory, "memory"))}>
                    {status.memory}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Memory Usage</TooltipContent>
            </Tooltip>

            {/* Storage */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <HardDrive className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                  <span className={cn(valueClass, getStatusColor(status.storage, "storage"))}>
                    {status.storage}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Storage Usage</TooltipContent>
            </Tooltip>
          </div>

          {/* Section droite - Actions et info */}
          <div className="replit-footer__section">
            {/* Plan actuel */}
            <Badge variant="outline" className="replit-footer__plan">
              <Zap className="h-3 w-3 mr-1" />
              Free Plan
            </Badge>

            {/* Heure actuelle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={itemClass}>
                  <Clock className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                  <span className={cn(valueClass, "replit-footer__value--mono")}>
                    {formatTime(currentTime)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Current Time</TooltipContent>
            </Tooltip>

            {/* Status général */}
            <div className={itemClass}>
              <div
                className={cn(
                  statusDotClass,
                  status.hasErrors
                    ? "bg-[var(--ecode-danger)]"
                    : status.connection === "online"
                    ? "bg-[var(--ecode-green)]"
                    : "bg-[var(--ecode-warning)]",
                  "animate-pulse"
                )}
              ></div>
              <span className={valueClass}>{status.hasErrors ? "Error" : "Ready"}</span>
            </div>
          </div>
        </div>
      </footer>
    </TooltipProvider>
  );
}