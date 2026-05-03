import net from "net";
import fs from "fs/promises";
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

/**
 * Read listening ports from /proc/net/tcp and /proc/net/tcp6.
 * Returns a map of inode -> port for LISTEN state sockets.
 * Falls back to empty map if the files are unavailable (non-Linux).
 */
async function buildInodeToPortMap(): Promise<Map<number, number>> {
  const inodeToPort = new Map<number, number>();
  for (const procFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      const content = await fs.readFile(procFile, 'utf8');
      for (const line of content.split('\n').slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const state = parts[3];
        // 0A = TCP_LISTEN
        if (state !== '0A') continue;
        const colonIdx = parts[1].lastIndexOf(':');
        if (colonIdx === -1) continue;
        const port = parseInt(parts[1].slice(colonIdx + 1), 16);
        const inode = parseInt(parts[9], 10);
        if (port > 0 && port <= 65535 && !isNaN(inode)) {
          inodeToPort.set(inode, port);
        }
      }
    } catch {
      // File not available (non-Linux or permission denied) — silent fallback
    }
  }
  return inodeToPort;
}

/**
 * Read listening ports from /proc/net/tcp and /proc/net/tcp6.
 * Returns the set of port numbers that are in LISTEN state (state=0A).
 * Falls back to empty set if the files are unavailable (non-Linux).
 */
export async function getListeningPortsFromProcNet(): Promise<Set<number>> {
  const inodeToPort = await buildInodeToPortMap();
  return new Set(inodeToPort.values());
}

/**
 * Get all PIDs that are children (direct or transitive) of a root PID.
 * Reads /proc/{pid}/status to find parent PID relationships.
 */
async function getChildPids(rootPid: number): Promise<Set<number>> {
  const children = new Set<number>();
  try {
    const allPids = (await fs.readdir('/proc'))
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    // Build parent map
    const parentOf = new Map<number, number>();
    for (const pid of allPids) {
      try {
        const status = await fs.readFile(`/proc/${pid}/status`, 'utf8');
        const ppidLine = status.split('\n').find((l) => l.startsWith('PPid:'));
        if (ppidLine) {
          const ppid = parseInt(ppidLine.split(/\s+/)[1], 10);
          parentOf.set(pid, ppid);
        }
      } catch {
        // PID may have exited
      }
    }

    // BFS to collect all descendants of rootPid
    const queue = [rootPid];
    const visited = new Set<number>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const [pid, ppid] of parentOf) {
        if (ppid === cur && !visited.has(pid)) {
          children.add(pid);
          queue.push(pid);
        }
      }
    }
  } catch {
    // /proc not available
  }
  return children;
}

/**
 * Get the listening ports owned by CHILD WORKFLOW processes only.
 * Cross-references /proc/{pid}/fd socket inodes with /proc/net/tcp.
 *
 * Deliberately excludes the server root PID to avoid reporting platform/server
 * sockets (e.g. port 5000) as workflow ports.
 *
 * Falls back to all host-level listening ports when:
 * - /proc is unavailable (non-Linux)
 * - No child processes exist yet (workflow not started)
 */
export async function getWorkflowListeningPorts(rootPid?: number): Promise<Set<number>> {
  try {
    const inodeToPort = await buildInodeToPortMap();
    if (inodeToPort.size === 0) {
      // /proc unavailable — fall back to all host-level listening ports
      return new Set<number>();
    }

    const serverPid = rootPid ?? process.pid;
    const childPids = await getChildPids(serverPid);

    // Only scan CHILD processes — the root PID (platform server) is excluded
    // intentionally to avoid false-positive platform socket attribution.
    if (childPids.size === 0) {
      // Workflow not started yet (no child processes): return empty set.
      // The caller (scanPorts) will fall back to bounded TCP probing.
      return new Set<number>();
    }

    const ports = new Set<number>();
    for (const pid of childPids) {
      try {
        const fdDir = `/proc/${pid}/fd`;
        const fds = await fs.readdir(fdDir);
        for (const fd of fds) {
          try {
            const link = await fs.readlink(`${fdDir}/${fd}`);
            const m = link.match(/^socket:\[(\d+)\]$/);
            if (m) {
              const inode = parseInt(m[1], 10);
              const port = inodeToPort.get(inode);
              if (port !== undefined) ports.add(port);
            }
          } catch {
            // fd may have closed
          }
        }
      } catch {
        // PID may have exited
      }
    }

    // Return only child-owned ports (may be empty if workflow ports not yet up).
    // Never fall back to host-wide /proc dump — that would surface unrelated
    // platform/system sockets. scanPorts() handles the bounded TCP fallback.
    return ports;
  } catch {
    // Unexpected error — return empty; caller uses bounded TCP probe fallback.
    return new Set<number>();
  }
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

    // Prefer workflow-aware port scan (child process sockets);
    // falls back to all host-level listening sockets, then TCP probing.
    const workflowPorts = await getWorkflowListeningPorts();
    const portsToCheck = workflowPorts.size > 0
      ? COMMON_PORTS.filter(p => workflowPorts.has(p))
      : COMMON_PORTS;

    for (const port of portsToCheck) {
      if (isPortBlocked(port) || existingInternalPorts.has(port)) continue;

      // Verify it's actually reachable (proc/net/tcp is authoritative but let's confirm)
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
