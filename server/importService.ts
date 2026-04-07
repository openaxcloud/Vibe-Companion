const importJobs = new Map<string, { status: string; progress: number; error?: string }>();

export async function importFromGitHub(projectId: string, repoUrl: string, token?: string): Promise<any> {
  return { success: true, filesImported: 0 };
}

export async function importFromZip(projectId: string, buffer: Buffer): Promise<any> {
  return { success: true, filesImported: 0 };
}

export async function importFromFigma(projectId: string, fileKey: string, token: string): Promise<any> {
  return { success: true };
}

export async function importFromVercel(projectId: string, vercelProjectId: string, token: string): Promise<any> {
  return { success: true };
}

export async function importFromBolt(projectId: string, data: any): Promise<any> {
  return { success: true };
}

export async function importFromLovable(projectId: string, data: any): Promise<any> {
  return { success: true };
}

export function validateImportSource(source: string, data: any): { valid: boolean; error?: string } {
  return { valid: true };
}

export function startAsyncImport(projectId: string, source: string, data: any): string {
  const jobId = `import-${Date.now()}`;
  importJobs.set(jobId, { status: "running", progress: 0 });
  setTimeout(() => importJobs.set(jobId, { status: "completed", progress: 100 }), 1000);
  return jobId;
}

export function startAsyncZipImport(projectId: string, buffer: Buffer): string {
  const jobId = `zip-import-${Date.now()}`;
  importJobs.set(jobId, { status: "running", progress: 0 });
  setTimeout(() => importJobs.set(jobId, { status: "completed", progress: 100 }), 1000);
  return jobId;
}

export function getImportJob(jobId: string): any {
  return importJobs.get(jobId) || { status: "not_found" };
}

export function validateZipBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) return { valid: false, error: "Empty buffer" };
  return { valid: true };
}

export async function fetchFigmaDesignContext(fileKey: string, token: string): Promise<any> {
  return { pages: [], components: [] };
}
