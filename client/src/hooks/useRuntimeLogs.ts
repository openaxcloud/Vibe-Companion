import { useState, useEffect } from "react";

export interface RuntimeLog {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
}

export function useRuntimeLogs(projectId?: number) {
  const [logs, setLogs] = useState<RuntimeLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const clearLogs = () => setLogs([]);

  return { logs, isConnected, clearLogs };
}
