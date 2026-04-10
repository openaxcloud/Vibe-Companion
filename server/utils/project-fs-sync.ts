import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';

const logger = createLogger('project-fs-sync');

const PROJECTS_BASE_DIR = '/tmp/projects';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateProjectId(projectId: string | number): string {
  const id = String(projectId);
  if (!PROJECT_ID_PATTERN.test(id)) {
    throw new Error(`Invalid project ID format: ${id}`);
  }
  return id;
}

function resolveAndContain(projectDir: string, filePath: string): string | null {
  if (path.isAbsolute(filePath)) {
    return null;
  }
  const resolved = path.resolve(projectDir, filePath);
  const relative = path.relative(projectDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

export function getProjectWorkspacePath(projectId: string | number): string {
  const id = validateProjectId(projectId);
  return path.join(PROJECTS_BASE_DIR, id);
}

export async function ensureProjectDirectory(projectId: string | number): Promise<string> {
  const dir = getProjectWorkspacePath(projectId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

export async function syncFileToDisc(
  projectId: string | number,
  filePath: string,
  content: string,
  isDirectory: boolean = false
): Promise<void> {
  try {
    const projectDir = await ensureProjectDirectory(projectId);
    const fullPath = resolveAndContain(projectDir, filePath);

    if (!fullPath) {
      logger.warn(`Blocked path escape attempt: ${filePath}`);
      return;
    }

    if (isDirectory) {
      await fs.promises.mkdir(fullPath, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, content || '', 'utf8');
    }
  } catch (error) {
    logger.error(`Failed to sync file to disk: ${filePath} for project ${projectId}`, error);
  }
}

export async function removeFileFromDisk(
  projectId: string | number,
  filePath: string
): Promise<void> {
  try {
    const projectDir = getProjectWorkspacePath(projectId);
    const fullPath = resolveAndContain(projectDir, filePath);

    if (!fullPath) {
      logger.warn(`Blocked path escape attempt: ${filePath}`);
      return;
    }

    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  } catch (error) {
    logger.error(`Failed to remove file from disk: ${filePath} for project ${projectId}`, error);
  }
}

export async function bulkSyncProjectFiles(
  projectId: string | number,
  files: Array<{ path: string; name: string; content: string | null; isDirectory: boolean | null }>
): Promise<string> {
  const projectDir = await ensureProjectDirectory(projectId);

  const validPaths = new Set<string>();

  for (const file of files) {
    const filePath = file.path || file.name;
    const fullPath = resolveAndContain(projectDir, filePath);

    if (!fullPath) {
      logger.warn(`Skipping file with invalid path: ${filePath}`);
      continue;
    }

    validPaths.add(fullPath);

    try {
      if (file.isDirectory) {
        await fs.promises.mkdir(fullPath, { recursive: true });
      } else {
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, file.content || '', 'utf8');
      }
    } catch (error) {
      logger.warn(`Failed to sync file ${filePath}: ${error}`);
    }
  }

  await reconcileStaleFiles(projectDir, projectDir, validPaths);

  logger.info(`Bulk synced ${files.length} files to ${projectDir} for project ${projectId}`);
  return projectDir;
}

async function reconcileStaleFiles(
  baseDir: string,
  currentDir: string,
  validPaths: Set<string>
): Promise<void> {
  try {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await reconcileStaleFiles(baseDir, fullPath, validPaths);
        try {
          const remaining = await fs.promises.readdir(fullPath);
          if (remaining.length === 0) {
            await fs.promises.rmdir(fullPath);
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
      } else {
        if (!validPaths.has(fullPath)) {
          try {
            await fs.promises.unlink(fullPath);
          } catch (err: any) { console.error("[catch]", err?.message || err);}
        }
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      logger.warn(`Error reconciling stale files in ${currentDir}: ${err}`);
    }
  }
}
