export function getProcessInfo(projectId: string): {
  pid?: number;
  status: string;
  uptime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
} {
  return {
    status: "idle",
    memoryUsage: 0,
    cpuUsage: 0,
  };
}
