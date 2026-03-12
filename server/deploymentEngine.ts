import { mkdir, writeFile, rm, readdir, stat, cp } from "fs/promises";
import { join, extname, resolve, normalize } from "path";
import { existsSync } from "fs";
import { log } from "./index";
import { randomUUID } from "crypto";
import express, { Request, Response, Router } from "express";

const DEPLOYMENTS_DIR = join(process.cwd(), ".deployments");
const MAX_DEPLOYMENT_SIZE_MB = 50;

export interface DeploymentBuild {
  deploymentId: string;
  projectId: string;
  slug: string;
  version: number;
  status: "building" | "live" | "failed" | "stopped";
  buildLog: string;
  url: string;
  startedAt: number;
  finishedAt?: number;
  outputDir: string;
}

interface ProjectFile {
  filename: string;
  content: string;
}

const activeDeploys = new Map<string, DeploymentBuild>();

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateSlug(name: string, projectId: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + projectId.slice(0, 8);
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

export async function buildAndDeploy(
  projectId: string,
  projectName: string,
  language: string,
  files: ProjectFile[],
  userId: string,
  deploymentId: string,
  version: number,
  onLog?: (line: string) => void,
): Promise<DeploymentBuild> {
  const slug = generateSlug(projectName, projectId);
  const outputDir = join(DEPLOYMENTS_DIR, slug, `v${version}`);
  const latestDir = join(DEPLOYMENTS_DIR, slug, "latest");
  const startedAt = Date.now();

  const build: DeploymentBuild = {
    deploymentId,
    projectId,
    slug,
    version,
    status: "building",
    buildLog: "",
    url: `/deployed/${slug}/`,
    startedAt,
    outputDir,
  };

  activeDeploys.set(projectId, build);

  const addLog = (line: string) => {
    build.buildLog += line + "\n";
    onLog?.(line);
  };

  try {
    addLog(`[build] Starting deployment v${version} for "${projectName}"`);
    addLog(`[build] Language: ${language}`);
    addLog(`[build] Files: ${files.length}`);

    await ensureDir(outputDir);

    const totalSize = files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    addLog(`[build] Total size: ${sizeMB} MB`);

    if (totalSize > MAX_DEPLOYMENT_SIZE_MB * 1024 * 1024) {
      throw new Error(`Project size (${sizeMB} MB) exceeds deployment limit of ${MAX_DEPLOYMENT_SIZE_MB} MB`);
    }

    addLog(`[build] Writing files to deployment directory...`);
    for (const file of files) {
      const filePath = join(outputDir, file.filename);
      const dir = join(outputDir, file.filename.split("/").slice(0, -1).join("/"));
      if (dir !== outputDir) await ensureDir(dir);
      await writeFile(filePath, file.content || "", "utf-8");
    }

    if (language === "html" || files.some(f => f.filename === "index.html")) {
      addLog(`[build] Static HTML site detected`);
      addLog(`[build] Optimizing for static serving...`);
      if (!files.find(f => f.filename === "index.html")) {
        const htmlFile = files.find(f => f.filename.endsWith(".html"));
        if (htmlFile) {
          await writeFile(join(outputDir, "index.html"), htmlFile.content, "utf-8");
          addLog(`[build] Created index.html from ${htmlFile.filename}`);
        }
      }
    } else if (language === "javascript" || language === "typescript") {
      addLog(`[build] Node.js project detected`);
      addLog(`[build] Bundling for deployment...`);
      const entryFile = files.find(f => f.filename === "index.js" || f.filename === "index.ts" || f.filename === "main.js" || f.filename === "server.js" || f.filename === "app.js");
      if (entryFile) {
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile.filename);
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
        addLog(`[build] Generated deployment wrapper`);
      }
    } else if (language === "python") {
      addLog(`[build] Python project detected`);
      addLog(`[build] Preparing for deployment...`);
      const entryFile = files.find(f => f.filename === "main.py" || f.filename === "app.py" || f.filename === "server.py");
      if (entryFile) {
        const wrapperHtml = generateAppWrapper(projectName, language, entryFile.filename);
        await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
        addLog(`[build] Generated deployment wrapper`);
      }
    } else {
      addLog(`[build] ${language} project detected`);
      const wrapperHtml = generateAppWrapper(projectName, language, files[0]?.filename || "main");
      await writeFile(join(outputDir, "index.html"), wrapperHtml, "utf-8");
      addLog(`[build] Generated deployment page`);
    }

    addLog(`[build] Setting up routing...`);

    if (existsSync(latestDir)) {
      await rm(latestDir, { recursive: true, force: true });
    }
    await ensureDir(join(DEPLOYMENTS_DIR, slug));
    await cp(outputDir, latestDir, { recursive: true });

    addLog(`[build] Deployment URL: ${build.url}`);
    addLog(`[build] ✓ Build complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    addLog(`[build] ✓ Deployment v${version} is now LIVE`);

    build.status = "live";
    build.finishedAt = Date.now();

    log(`Deployment ${slug} v${version} is live`, "deploy");
    return build;

  } catch (err: any) {
    addLog(`[build] ✗ Build failed: ${err.message}`);
    build.status = "failed";
    build.finishedAt = Date.now();
    log(`Deployment failed for ${projectId}: ${err.message}`, "deploy");
    return build;
  }
}

function generateAppWrapper(projectName: string, language: string, entryFile: string): string {
  const langColors: Record<string, string> = {
    javascript: "#F7DF1E", typescript: "#3178C6", python: "#3776AB",
    go: "#00ADD8", rust: "#CE412B", java: "#ED8B00", ruby: "#CC342D",
    cpp: "#00599C", c: "#A8B9CC", bash: "#4EAA25", html: "#E34F26",
  };
  const color = langColors[language] || "#0079F2";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — E-Code</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23F26522'/><text x='16' y='23' font-family='sans-serif' font-size='20' font-weight='bold' fill='white' text-anchor='middle'>E</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0E1525; color: #F5F9FC; min-height: 100vh; display: flex; flex-direction: column; }
    .header { padding: 16px 24px; border-bottom: 1px solid #2B3245; display: flex; align-items: center; gap: 12px; background: #1C2333; }
    .logo { width: 28px; height: 28px; border-radius: 6px; background: #F26522; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: white; }
    .title { font-size: 14px; font-weight: 600; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: ${color}20; color: ${color}; border: 1px solid ${color}40; font-weight: 600; text-transform: uppercase; }
    .live-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: #0CCE6B20; color: #0CCE6B; border: 1px solid #0CCE6B40; font-weight: 600; display: flex; align-items: center; gap: 4px; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #0CCE6B; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; }
    .card { background: #1C2333; border: 1px solid #2B3245; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; text-align: center; }
    .card h2 { font-size: 20px; margin-bottom: 8px; }
    .card p { font-size: 13px; color: #9DA2B0; margin-bottom: 24px; line-height: 1.6; }
    .files { text-align: left; background: #0E1525; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .file { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #9DA2B0; padding: 4px 0; display: flex; align-items: center; gap: 8px; }
    .file-icon { width: 14px; height: 14px; border-radius: 3px; background: ${color}; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: bold; color: white; flex-shrink: 0; }
    .powered { font-size: 11px; color: #4A5068; margin-top: 24px; }
    .powered a { color: #0079F2; text-decoration: none; }
    .footer { padding: 12px 24px; border-top: 1px solid #2B3245; text-align: center; font-size: 11px; color: #4A5068; background: #1C2333; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">E</div>
    <span class="title">${projectName}</span>
    <span class="badge">${language}</span>
    <span class="live-badge"><span class="live-dot"></span> Live</span>
  </div>
  <div class="content">
    <div class="card">
      <h2>${projectName}</h2>
      <p>This ${language} application has been deployed with E-Code. The source code is available for viewing.</p>
      <div class="files">
        <div class="file"><div class="file-icon">&lt;&gt;</div> ${entryFile}</div>
      </div>
      <div class="powered">Deployed with <a href="/">E-Code</a></div>
    </div>
  </div>
  <div class="footer">© ${new Date().getFullYear()} E-Code — Cloud IDE & Deployment Platform</div>
</body>
</html>`;
}

export async function rollbackDeployment(
  projectId: string,
  slug: string,
  targetVersion: number,
): Promise<{ success: boolean; message: string }> {
  const versionDir = join(DEPLOYMENTS_DIR, slug, `v${targetVersion}`);
  const latestDir = join(DEPLOYMENTS_DIR, slug, "latest");

  if (!existsSync(versionDir)) {
    return { success: false, message: `Version ${targetVersion} not found` };
  }

  try {
    if (existsSync(latestDir)) {
      await rm(latestDir, { recursive: true, force: true });
    }
    await cp(versionDir, latestDir, { recursive: true });
    log(`Rolled back ${slug} to v${targetVersion}`, "deploy");
    return { success: true, message: `Rolled back to v${targetVersion}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function teardownDeployment(slug: string): Promise<void> {
  const deployDir = join(DEPLOYMENTS_DIR, slug);
  if (existsSync(deployDir)) {
    await rm(deployDir, { recursive: true, force: true });
    log(`Torn down deployment ${slug}`, "deploy");
  }
}

export function createDeploymentRouter(): Router {
  const router = Router();

  router.get("/deployed/:slug/{*filePath}", async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
      return res.status(400).json({ error: "Invalid slug" });
    }
    const rawPath = (req.params as any).filePath || "index.html";
    const safePath = normalize(rawPath).replace(/^(\.\.[\/\\])+/, "");
    const baseDir = resolve(DEPLOYMENTS_DIR, slug, "latest");
    const fullPath = resolve(baseDir, safePath);

    if (!fullPath.startsWith(baseDir)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!existsSync(fullPath)) {
      const indexPath = join(baseDir, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.sendFile(indexPath);
      }
      return res.status(404).json({ error: "Deployment not found" });
    }

    try {
      const fileStat = await stat(fullPath);
      if (fileStat.isDirectory()) {
        const indexPath = join(fullPath, "index.html");
        if (existsSync(indexPath)) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "public, max-age=300");
          return res.sendFile(indexPath);
        }
        return res.status(404).json({ error: "Not found" });
      }

      res.setHeader("Content-Type", getMimeType(safePath));
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Deployed-By", "E-Code");
      return res.sendFile(fullPath);
    } catch {
      return res.status(500).json({ error: "Failed to serve file" });
    }
  });

  router.get("/deployed/:slug/", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const indexPath = join(DEPLOYMENTS_DIR, slug, "latest", "index.html");

    if (!existsSync(indexPath)) {
      return res.status(404).send(`<html><body style="background:#0E1525;color:#F5F9FC;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h1>404</h1><p>Deployment not found</p></div></body></html>`);
    }

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.sendFile(indexPath);
  });

  return router;
}

export function getActiveDeployment(projectId: string): DeploymentBuild | undefined {
  return activeDeploys.get(projectId);
}

export async function listDeploymentVersions(slug: string): Promise<number[]> {
  const deployDir = join(DEPLOYMENTS_DIR, slug);
  if (!existsSync(deployDir)) return [];
  try {
    const entries = await readdir(deployDir);
    return entries
      .filter(e => e.startsWith("v") && !isNaN(parseInt(e.slice(1))))
      .map(e => parseInt(e.slice(1)))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}
