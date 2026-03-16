import net from "net";
import { storage } from "./storage";
import { ALLOWED_EXTERNAL_PORTS, BLOCKED_PORTS } from "@shared/schema";
import type { PortConfig } from "@shared/schema";

const COMMON_PORTS = [3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081];
const SCAN_INTERVAL_MS = 15000;

const scanIntervals = new Map<string, NodeJS.Timeout>();

export function isPortBlocked(port: number): boolean {
  return (BLOCKED_PORTS as readonly number[]).includes(port);
}

export function isAllowedInternalPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
    && !isPortBlocked(port)
    && COMMON_PORTS.includes(port);
}

export function isValidExternalPort(port: number): boolean {
  return (ALLOWED_EXTERNAL_PORTS as readonly number[]).includes(port);
}

export function getNextAvailableExternalPort(usedPorts: number[]): number | null {
  for (const port of ALLOWED_EXTERNAL_PORTS) {
    if (!usedPorts.includes(port)) return port;
  }
  return null;
}

export async function probePort(port: number, host: string = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host, timeout: 1500 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function checkPortListening(port: number): Promise<{ listening: boolean; localhostOnly: boolean }> {
  const onLocalhost = await probePort(port, "127.0.0.1");
  if (!onLocalhost) {
    return { listening: false, localhostOnly: false };
  }
  let localhostOnly = true;
  try {
    const os = await import("os");
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          const reachable = await probePort(port, addr.address);
          if (reachable) {
            localhostOnly = false;
            break;
          }
        }
      }
      if (!localhostOnly) break;
    }
  } catch {
    localhostOnly = true;
  }
  return { listening: true, localhostOnly };
}

export async function autoDetectPorts(projectId: string): Promise<void> {
  try {
    const existingConfigs = await storage.getPortConfigs(projectId);
    const usedExternalPorts = [...existingConfigs.map(c => c.externalPort)];
    const existingInternalPorts = new Set(existingConfigs.map(c => c.internalPort));
    let isFirstPort = existingConfigs.length === 0;

    for (const port of COMMON_PORTS) {
      if (isPortBlocked(port) || existingInternalPorts.has(port)) continue;

      const { listening } = await checkPortListening(port);
      if (listening) {
        let externalPort: number | null;
        if (isFirstPort && !usedExternalPorts.includes(80)) {
          externalPort = 80;
          isFirstPort = false;
        } else {
          externalPort = getNextAvailableExternalPort(usedExternalPorts);
        }
        if (externalPort === null) continue;

        try {
          await storage.createPortConfig({
            projectId,
            port,
            internalPort: port,
            externalPort,
            label: `Port ${port}`,
            protocol: "http",
            isPublic: false,
            exposeLocalhost: false,
          });
          usedExternalPorts.push(externalPort);
          existingInternalPorts.add(port);
        } catch (err: any) {
          if (err.code === "23505") continue;
          throw err;
        }
      }
    }
  } catch (err) {
    console.error("[portDetection] Auto-detect failed:", err);
  }
}

export function startPortScanning(projectId: string): void {
  stopPortScanning(projectId);
  const interval = setInterval(() => autoDetectPorts(projectId), SCAN_INTERVAL_MS);
  scanIntervals.set(projectId, interval);
}

export function stopPortScanning(projectId: string): void {
  const interval = scanIntervals.get(projectId);
  if (interval) {
    clearInterval(interval);
    scanIntervals.delete(projectId);
  }
}

export async function validatePortForDeployment(
  configs: PortConfig[],
  deploymentType: string
): Promise<{ valid: boolean; error?: string }> {
  if (deploymentType === "autoscale" || deploymentType === "reserved-vm") {
    const typeName = deploymentType === "autoscale" ? "Autoscale" : "Reserved VM";
    const publicPorts = configs.filter(c => c.isPublic);
    if (publicPorts.length > 1) {
      return {
        valid: false,
        error: `${typeName} deployments support only one exposed port. Currently ${publicPorts.length} ports are public.`,
      };
    }
    for (const pc of publicPorts) {
      const { listening, localhostOnly } = await checkPortListening(pc.internalPort);
      if (listening && localhostOnly) {
        return {
          valid: false,
          error: `${typeName} deployment failed: port ${pc.internalPort} is bound to localhost only (127.0.0.1). ${typeName} deployments require the service to bind to 0.0.0.0 so it can accept external traffic.`,
        };
      }
    }
  }
  return { valid: true };
}
