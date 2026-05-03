/**
 * Port Management Service
 * Shared business logic for port CRUD and scanning.
 * Used by both the networking REST router and the AI agent tool executor,
 * ensuring consistent behaviour and a single source of truth.
 */

import { db } from '../db';
import { networkingPorts } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import {
  getNextAvailableExternalPort,
  isPortBlocked,
  probePort,
  getWorkflowListeningPorts,
  autoDetectPorts,
} from '../portDetection';

const logger = createLogger('port-management-service');

export interface PortRecord {
  id: string;
  projectId: string;
  internalPort: number;
  externalPort: number;
  label: string | null;
  protocol: string | null;
  isPublic: boolean | null;
  exposeLocalhost: boolean | null;
  listening: boolean;
}

export interface PortScanResult {
  port: number;
  listening: boolean;
  source: 'proc' | 'tcp-probe';
}

const PORTS_TO_SCAN = [3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081];

export async function listPorts(projectId: number): Promise<PortRecord[]> {
  // ORDER BY id ASC gives deterministic ordering: the first row is always the
  // "primary" port (lowest serial id = earliest registered), matching the
  // Primary badge logic in NetworkingPanel (idx === 0).
  const rows = await db.select().from(networkingPorts)
    .where(eq(networkingPorts.projectId, projectId))
    .orderBy(asc(networkingPorts.id));
  return rows.map((p) => ({
    ...p,
    id: p.id.toString(),
    projectId: p.projectId.toString(),
    listening: false,
  }));
}

export async function listPortsWithLiveness(projectId: number): Promise<PortRecord[]> {
  // ORDER BY id ASC: deterministic primary-port semantics (first registered = primary)
  const rows = await db.select().from(networkingPorts)
    .where(eq(networkingPorts.projectId, projectId))
    .orderBy(asc(networkingPorts.id));
  return Promise.all(rows.map(async (p) => {
    const listening = await probePort(p.internalPort, '127.0.0.1').catch(() => false);
    return {
      ...p,
      id: p.id.toString(),
      projectId: p.projectId.toString(),
      listening,
    };
  }));
}

export async function createPort(
  projectId: number,
  port: number,
  label?: string,
  protocol?: string
): Promise<{ ok: true; port: PortRecord } | { ok: false; status: number; error: string }> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, status: 400, error: `Invalid port number: ${port}. Must be 1–65535.` };
  }
  if (isPortBlocked(port)) {
    return { ok: false, status: 400, error: `Port ${port} is blocked and cannot be used.` };
  }

  const existing = await db.select().from(networkingPorts).where(eq(networkingPorts.projectId, projectId));
  if (existing.some((p) => p.internalPort === port)) {
    return { ok: false, status: 409, error: `Port ${port} is already configured for this project.` };
  }

  const usedExternal = existing.map((p) => p.externalPort).filter(Boolean) as number[];
  const isFirst = existing.length === 0;
  const externalPort = isFirst && !usedExternal.includes(80)
    ? 80
    : getNextAvailableExternalPort(usedExternal);

  if (externalPort === null) {
    return { ok: false, status: 409, error: 'No available external ports. Remove an existing mapping first.' };
  }

  // Probe real liveness before persisting — no optimistic mock state
  const isListening = await probePort(port, '127.0.0.1').catch(() => false);

  const [created] = await db.insert(networkingPorts).values({
    projectId,
    port,
    internalPort: port,
    externalPort,
    label: label || `Port ${port}`,
    protocol: protocol || 'http',
    isPublic: false,
    exposeLocalhost: false,
    listening: isListening,
  }).returning();

  return {
    ok: true,
    port: {
      ...created,
      id: created.id.toString(),
      projectId: created.projectId.toString(),
      listening: isListening,
    },
  };
}

export async function updatePort(
  projectId: number,
  portId: number,
  updates: Partial<{ isPublic: boolean; exposeLocalhost: boolean; label: string; protocol: string }>
): Promise<{ ok: true; port: PortRecord } | { ok: false; status: number; error: string }> {
  const [updated] = await db.update(networkingPorts)
    .set(updates)
    .where(and(eq(networkingPorts.id, portId), eq(networkingPorts.projectId, projectId)))
    .returning();

  if (!updated) {
    return { ok: false, status: 404, error: `Port ${portId} not found.` };
  }

  return {
    ok: true,
    port: {
      ...updated,
      id: updated.id.toString(),
      projectId: updated.projectId.toString(),
      listening: false,
    },
  };
}

export async function deletePort(
  projectId: number,
  portId: number
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const deleted = await db.delete(networkingPorts)
    .where(and(eq(networkingPorts.id, portId), eq(networkingPorts.projectId, projectId)))
    .returning();

  if (deleted.length === 0) {
    return { ok: false, status: 404, error: `Port ${portId} not found.` };
  }

  return { ok: true };
}

/**
 * Persist a set of detected listening ports to networkingPorts for projectId.
 * Unlike autoDetectPorts(), this accepts any port number (not just COMMON_PORTS)
 * so scan results from /proc are fully saved regardless of port number.
 */
async function persistDetectedPorts(projectId: string, ports: number[]): Promise<void> {
  const numericProjectId = parseInt(projectId, 10);
  if (isNaN(numericProjectId)) {
    logger.warn(`persistDetectedPorts: non-numeric projectId "${projectId}" — skipping persist`);
    return;
  }

  const existing = await db.select().from(networkingPorts).where(eq(networkingPorts.projectId, numericProjectId));
  const existingInternalPorts = new Set(existing.map((p) => p.internalPort));
  const usedExternal = existing.map((p) => p.externalPort).filter(Boolean) as number[];
  let isFirst = existing.length === 0;

  for (const port of ports) {
    if (isPortBlocked(port) || existingInternalPorts.has(port)) continue;

    const externalPort = isFirst && !usedExternal.includes(80)
      ? 80
      : getNextAvailableExternalPort(usedExternal);

    if (externalPort === null) {
      logger.warn(`persistDetectedPorts: no external ports available — skipping port ${port}`);
      continue;
    }

    try {
      await db.insert(networkingPorts).values({
        projectId: numericProjectId,
        port,
        internalPort: port,
        externalPort,
        label: `Port ${port}`,
        protocol: 'http',
        isPublic: false,
        exposeLocalhost: false,
      });
      usedExternal.push(externalPort);
      existingInternalPorts.add(port);
      isFirst = false;
    } catch (err: any) {
      if (err.code === '23505') continue; // unique constraint — already exists
      logger.warn(`persistDetectedPorts: failed to persist port ${port}:`, err.message);
    }
  }
}

/** Check whether /proc/net/tcp is available (Linux). */
async function isProcNetAvailable(): Promise<boolean> {
  try {
    const { readFile } = await import('fs/promises');
    await readFile('/proc/net/tcp', 'utf8');
    return true;
  } catch {
    return false;
  }
}

export async function scanPorts(projectId: string): Promise<PortScanResult[]> {
  const results: PortScanResult[] = [];

  // Primary: workflow-aware scan — inspect child process sockets via
  // /proc/{pid}/fd inode cross-reference with /proc/net/tcp.
  // Returns only the ports that are ACTUALLY listening (not a fixed candidate list
  // with booleans). Source of truth: kernel socket state.
  const procAvailable = await isProcNetAvailable();

  if (procAvailable) {
    // Workflow-aware proc scan: returns only child-process-owned listening ports.
    const workflowPorts = await getWorkflowListeningPorts();

    if (workflowPorts.size > 0) {
      // Workflow is running and owns listening sockets — use proc as source of truth.
      for (const port of workflowPorts) {
        if (port > 0 && port <= 65535) {
          results.push({ port, listening: true, source: 'proc' });
        }
      }
    } else {
      // Workflow not up yet or no child sockets found.
      // Fall back to BOUNDED common-port TCP probes — safe, bounded, no host-wide
      // /proc dump that would leak internal platform/service sockets.
      await Promise.all(
        PORTS_TO_SCAN.map(async (port) => {
          const listening = await probePort(port, '127.0.0.1').catch(() => false);
          if (listening) results.push({ port, listening: true, source: 'tcp-probe' });
        })
      );
    }
  } else {
    // Non-Linux: bounded TCP probe on candidate list (proc unavailable)
    await Promise.all(
      PORTS_TO_SCAN.map(async (port) => {
        const listening = await probePort(port, '127.0.0.1').catch(() => false);
        if (listening) results.push({ port, listening: true, source: 'tcp-probe' });
      })
    );
  }

  // Persist newly discovered listening ports to the database.
  // We persist directly from the scan results so non-COMMON_PORTS are included.
  // autoDetectPorts() only iterates COMMON_PORTS — bypassing it here ensures
  // ports discovered via /proc scan (any port) are saved.
  try {
    const listeningPorts = results.filter((r) => r.listening).map((r) => r.port);
    if (listeningPorts.length > 0) {
      await persistDetectedPorts(projectId, listeningPorts);
    }
  } catch (e: any) {
    logger.warn('persistDetectedPorts partial failure (non-fatal):', e.message);
  }

  return results.sort((a, b) => a.port - b.port);
}
