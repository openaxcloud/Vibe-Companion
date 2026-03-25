import { useState } from "react";

export interface ServerLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
}

export function useServerLogs(projectId?: number) {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const clearLogs = () => setLogs([]);
  return { logs, clearLogs };
}
