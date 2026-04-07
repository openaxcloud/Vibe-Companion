import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecode-'));
  try {
    return await fn(tmpDir);
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup temp dir ${tmpDir}:`, error);
    }
  }
}

export async function cleanupOldTempDirs(maxAgeMs = 3600000): Promise<number> {
  const tmpBase = os.tmpdir();
  let cleaned = 0;
  
  try {
    const entries = await fs.readdir(tmpBase);
    for (const entry of entries) {
      if (entry.startsWith('ecode-')) {
        const fullPath = path.join(tmpBase, entry);
        const stats = await fs.stat(fullPath);
        if (Date.now() - stats.mtimeMs > maxAgeMs) {
          await fs.rm(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning temp dirs:', error);
  }
  
  return cleaned;
}
