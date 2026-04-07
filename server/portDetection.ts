export function validatePortForDeployment(port: number): boolean {
  return port > 0 && port < 65536;
}

export async function startPortScanning(projectId: string) {
  return [];
}

export async function autoDetectPorts(projectId: string) {
  return [];
}

export function checkPortListening(port: number): boolean {
  return false;
}

export function isPortBlocked(port: number): boolean {
  return port < 1024 && port !== 80 && port !== 443;
}

export function isAllowedInternalPort(port: number): boolean {
  return port >= 3000 && port <= 9999;
}
