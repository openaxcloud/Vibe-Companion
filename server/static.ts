import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function extractBuildTime(indexHtmlPath: string): string | null {
  try {
    const html = fs.readFileSync(indexHtmlPath, "utf-8");
    const match = html.match(/<meta\s+name="build-time"\s+content="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getNewestSourceMtime(dirs: string[]): Date | null {
  let newest: Date | null = null;
  const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json"]);
  const skipDirs = new Set(["node_modules", ".git", "dist", ".local", "project-workspaces", "attached_assets", ".deployments"]);

  function walk(dir: string, depth: number) {
    if (depth > 5) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (extensions.has(path.extname(entry.name))) {
        try {
          const stat = fs.statSync(full);
          if (!newest || stat.mtimeMs > newest.getTime()) {
            newest = new Date(stat.mtimeMs);
          }
        } catch {}
      }
    }
  }

  for (const d of dirs) {
    if (fs.existsSync(d)) walk(d, 0);
  }
  return newest;
}

export function serveStatic(app: Express) {
  const dir = typeof import.meta.dirname === "string" ? import.meta.dirname : __dirname;
  let distPath = path.resolve(dir, "public");
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(dir, "..", "dist", "public");
  }
  if (!fs.existsSync(distPath)) {
    console.warn(`[static] ⚠️  Build directory not found. Running: npx vite build`);
    try {
      const { execSync } = require("child_process");
      execSync("npx vite build", { stdio: "inherit", cwd: path.resolve(dir, "..") });
      distPath = path.resolve(dir, "..", "dist", "public");
    } catch (buildErr: any) {
      console.error(`[static] Build failed: ${buildErr.message}`);
    }
    if (!fs.existsSync(distPath)) {
      console.error(`[static] ✗ Could not find or build the client. Serving API only.`);
      app.get('/{*path}', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
        res.status(503).send('<!DOCTYPE html><html><body style="background:#1e1e2e;color:#cdd6f4;font-family:monospace;padding:40px"><h2>Build Required</h2><p>The frontend has not been built yet.</p><pre>rm -rf dist && npx vite build</pre><p>Then restart the server.</p></body></html>');
      });
      return;
    }
  }

  const indexHtmlPath = path.join(distPath, "index.html");
  const buildTime = extractBuildTime(indexHtmlPath);
  const buildDate = buildTime ? new Date(buildTime) : null;

  if (buildTime) {
    console.log(`[static] Build timestamp: ${buildTime}`);
  } else {
    console.warn(`[static] ⚠️  No build-time meta tag found in index.html`);
  }

  const rootDir = path.resolve(dir, "..");
  const sourceDirs = [
    path.join(rootDir, "client"),
    path.join(rootDir, "shared"),
  ];
  const newestSource = getNewestSourceMtime(sourceDirs);

  if (buildDate && newestSource && newestSource.getTime() > buildDate.getTime()) {
    const ageSec = Math.round((newestSource.getTime() - buildDate.getTime()) / 1000);
    console.warn(`[static] ⚠️  STALE BUILD DETECTED — source files are ${ageSec}s newer than build`);
    console.warn(`[static] ⚠️  Build: ${buildTime}  |  Newest source: ${newestSource.toISOString()}`);
    console.warn(`[static] ⚠️  Run: rm -rf dist && npx vite build`);
  } else if (buildDate) {
    console.log(`[static] ✓ Build is up-to-date`);
  }

  const manifestPath = path.join(distPath, ".vite", "manifest.json");
  const hasManifest = fs.existsSync(manifestPath);
  if (hasManifest) {
    console.log(`[static] ✓ Vite manifest present`);
  } else {
    console.warn(`[static] ⚠️  No Vite manifest — hashed filenames may not work`);
  }

  app.get("/api/build-info", (_req, res) => {
    const nowNewest = getNewestSourceMtime(sourceDirs);
    const isStale = buildDate && nowNewest && nowNewest.getTime() > buildDate.getTime();
    res.json({
      buildTime: buildTime || null,
      isStale: !!isStale,
      newestSource: nowNewest?.toISOString() || null,
      hasManifest,
    });
  });

  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));

  app.get('/{*path}', (req, res) => {
    const reqPath = req.originalUrl || req.path;
    if (reqPath.startsWith("/assets/") || /\.(js|css|map|woff2?|ttf|eot|svg|png|jpg|ico)$/.test(reqPath)) {
      return res.status(404).end();
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
