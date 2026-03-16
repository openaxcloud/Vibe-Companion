import { storage } from "./storage";
import * as gitService from "./git";
import zlib from "zlib";
import { promisify } from "util";
import type { BackupTrigger, GitBackup } from "@shared/schema";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const DEFAULT_RETENTION = 10;

export async function createBackup(
  projectId: string,
  trigger: BackupTrigger
): Promise<GitBackup | null> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const packed = gitService.getSerializedGitState(projectId);
      if (!packed || packed.length === 0) return null;

      const rawBuffer = Buffer.from(packed, "utf-8");
      const compressed = await gzip(rawBuffer);
      const compressedBase64 = compressed.toString("base64");

      const latestVersion = await storage.getLatestGitBackupVersion(projectId);
      const nextVersion = latestVersion + 1;

      const backup = await storage.createGitBackup({
        projectId,
        version: nextVersion,
        compressedData: compressedBase64,
        sizeBytes: compressed.length,
        trigger,
      });

      await pruneOldBackups(projectId, DEFAULT_RETENTION);

      return backup;
    } catch (err) {
      const dbErr = err as { code?: string };
      if (dbErr.code === "23505" && attempt < MAX_RETRIES - 1) {
        continue;
      }
      console.error(`[backup] Failed to create backup for project ${projectId}:`, err);
      return null;
    }
  }
  return null;
}

export async function restoreFromBackup(
  projectId: string,
  version?: number
): Promise<boolean> {
  try {
    const backup = version
      ? await storage.getGitBackupByVersion(projectId, version)
      : await storage.getLatestGitBackup(projectId);

    if (!backup) return false;

    const compressed = Buffer.from(backup.compressedData, "base64");
    const decompressed = await gunzip(compressed);
    const packed = decompressed.toString("utf-8");

    gitService.restoreGitStateFromPack(projectId, packed);
    return true;
  } catch (err) {
    console.error(`[backup] Failed to restore backup for project ${projectId}:`, err);
    return false;
  }
}

export async function getBackupStatus(projectId: string): Promise<{
  lastBackupAt: string | null;
  backupCount: number;
  totalSizeBytes: number;
  health: "green" | "yellow" | "red";
}> {
  const backups = await storage.getGitBackups(projectId);
  if (backups.length === 0) {
    return { lastBackupAt: null, backupCount: 0, totalSizeBytes: 0, health: "red" };
  }

  const latest = backups[0];
  const totalSizeBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
  const lastBackupAt = latest.createdAt instanceof Date
    ? latest.createdAt.toISOString()
    : String(latest.createdAt);

  const ageMs = Date.now() - new Date(lastBackupAt).getTime();
  const FIVE_MIN = 5 * 60 * 1000;
  const ONE_HOUR = 60 * 60 * 1000;

  let health: "green" | "yellow" | "red" = "red";
  if (ageMs < FIVE_MIN) health = "green";
  else if (ageMs < ONE_HOUR) health = "yellow";

  return {
    lastBackupAt,
    backupCount: backups.length,
    totalSizeBytes,
    health,
  };
}

export async function pruneOldBackups(
  projectId: string,
  keepCount: number = DEFAULT_RETENTION
): Promise<number> {
  return storage.pruneGitBackups(projectId, keepCount);
}

export async function verifyBackupIntegrity(
  projectId: string
): Promise<boolean> {
  try {
    const backup = await storage.getLatestGitBackup(projectId);
    if (!backup) return false;

    const compressed = Buffer.from(backup.compressedData, "base64");
    const decompressed = await gunzip(compressed);
    const packed = decompressed.toString("utf-8");
    const entries = JSON.parse(packed);

    return Array.isArray(entries) && entries.length > 0 && entries.every(
      (e: unknown) => {
        const entry = e as Record<string, unknown>;
        return typeof entry.p === "string" && typeof entry.d === "string";
      }
    );
  } catch {
    return false;
  }
}

export function triggerBackupAsync(projectId: string, trigger: BackupTrigger): void {
  createBackup(projectId, trigger).catch((err) => {
    console.error(`[backup] Async backup failed for ${projectId}:`, err);
  });
}
