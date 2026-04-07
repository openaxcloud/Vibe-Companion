import * as path from "path";
import * as fs from "fs";

export async function exportAnimationToMp4(options: any): Promise<{ success: boolean; filePath?: string; error?: string }> {
  return { success: false, error: "Video export not available" };
}

export async function cleanupExportDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
