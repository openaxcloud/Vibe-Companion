import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projectExtensions, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage';

const router = Router();
const logger = createLogger('extensions');

interface ExtensionDefinition {
  extensionId: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
  npmPackage: string | null;
  configFile: string | null;
  configContent: string | null;
  type: 'npm' | 'native' | 'unavailable';
  nativeFeature?: string;
}

const EXTENSIONS_CATALOG: ExtensionDefinition[] = [
  {
    extensionId: "prettier", name: "Prettier",
    description: "Automatic code formatting for JS, TS, CSS, HTML, JSON, and more",
    author: "Prettier", version: "3.2.5", category: "Formatting", icon: "file-code",
    npmPackage: "prettier", type: "npm",
    configFile: ".prettierrc",
    configContent: JSON.stringify({ semi: true, singleQuote: true, tabWidth: 2, trailingComma: "es5", printWidth: 100 }, null, 2),
  },
  {
    extensionId: "eslint", name: "ESLint",
    description: "Find and fix problems in your JavaScript/TypeScript code",
    author: "ESLint", version: "9.1.0", category: "Linting", icon: "shield",
    npmPackage: "eslint", type: "npm",
    configFile: "eslint.config.mjs",
    configContent: `import js from "@eslint/js";\nexport default [\n  js.configs.recommended,\n  {\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: {\n        console: "readonly",\n        process: "readonly",\n        __dirname: "readonly",\n        __filename: "readonly",\n        module: "readonly",\n        require: "readonly",\n        exports: "readonly",\n        window: "readonly",\n        document: "readonly",\n        fetch: "readonly",\n        setTimeout: "readonly",\n        setInterval: "readonly",\n        clearTimeout: "readonly",\n        clearInterval: "readonly",\n        URL: "readonly",\n        Buffer: "readonly",\n      },\n    },\n    rules: {},\n  },\n];\n`,
  },
  {
    extensionId: "tailwind-intellisense", name: "Tailwind CSS IntelliSense",
    description: "Intelligent autocomplete for Tailwind CSS classes",
    author: "Tailwind Labs", version: "0.12.0", category: "CSS", icon: "palette",
    npmPackage: null, type: "native", nativeFeature: "Built-in CSS class suggestions",
    configFile: null, configContent: null,
  },
  {
    extensionId: "git-lens", name: "GitLens",
    description: "Supercharge Git - visualize code authorship, history, and changes",
    author: "GitKraken", version: "15.0.4", category: "Git", icon: "git-branch",
    npmPackage: null, type: "native", nativeFeature: "Use the Git panel in the sidebar",
    configFile: null, configContent: null,
  },
  {
    extensionId: "docker", name: "Docker",
    description: "Build, manage and deploy containerized applications",
    author: "Microsoft", version: "1.29.0", category: "DevOps", icon: "layers",
    npmPackage: null, type: "unavailable",
    configFile: null, configContent: null,
  },
  {
    extensionId: "live-server", name: "Live Server",
    description: "Launch a local development server with hot reload for static pages",
    author: "Ritwick Dey", version: "5.7.9", category: "Tools", icon: "globe",
    npmPackage: "live-server", type: "npm",
    configFile: null, configContent: null,
  },
  {
    extensionId: "db-client", name: "Database Client",
    description: "Browse and query PostgreSQL, MySQL, SQLite databases",
    author: "cweijan", version: "4.5.2", category: "Database", icon: "database",
    npmPackage: null, type: "native", nativeFeature: "Use the Database panel in the sidebar",
    configFile: null, configContent: null,
  },
  {
    extensionId: "thunder-client", name: "Thunder Client",
    description: "Lightweight REST API client for testing HTTP requests",
    author: "Thunder Client", version: "2.22.0", category: "API", icon: "zap",
    npmPackage: null, type: "unavailable",
    configFile: null, configContent: null,
  },
  {
    extensionId: "terminal-tabs", name: "Terminal Tabs",
    description: "Enhanced terminal with tabs, split panes, and custom profiles",
    author: "E-Code", version: "1.8.0", category: "Tools", icon: "terminal",
    npmPackage: null, type: "native", nativeFeature: "Use the Terminal panel",
    configFile: null, configContent: null,
  },
  {
    extensionId: "import-cost", name: "Import Cost",
    description: "Display size of imported packages inline in the editor",
    author: "Wix", version: "3.3.0", category: "Performance", icon: "package",
    npmPackage: null, type: "unavailable",
    configFile: null, configContent: null,
  },
  {
    extensionId: "code-runner", name: "Code Runner",
    description: "Run code snippets in any language with a single click",
    author: "Jun Han", version: "0.12.1", category: "Tools", icon: "code",
    npmPackage: null, type: "native", nativeFeature: "Use the Terminal to run code",
    configFile: null, configContent: null,
  },
  {
    extensionId: "auto-rename", name: "Auto Rename Tag",
    description: "Automatically rename paired HTML/XML tags",
    author: "Jun Han", version: "0.1.10", category: "HTML", icon: "file-code",
    npmPackage: null, type: "native", nativeFeature: "Built into the editor",
    configFile: null, configContent: null,
  },
  {
    extensionId: "typescript-hero", name: "TypeScript Hero",
    description: "Auto-organize imports and manage TypeScript declarations",
    author: "E-Code", version: "3.0.0", category: "Linting", icon: "code",
    npmPackage: "typescript", type: "npm",
    configFile: null, configContent: null,
  },
];

function getProjectWorkspacePath(projectId: string | number): string {
  const id = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(process.cwd(), 'project-workspaces', id);
}

async function verifyProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  try {
    if (!userId || !projectId) return false;
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, String(projectId)), eq(projects.userId, String(userId)))
    });
    return !!project;
  } catch (error) {
    logger.error('Project ownership verification failed', { userId, projectId, error });
    return false;
  }
}

function runNpmCommand(args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('npm', args, { cwd, shell: false, env: { ...process.env, HOME: cwd } });
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve({ success: false, output: 'Timeout after 60s' }); }, 60000);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, output: stdout + stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, output: err.message });
    });
  });
}

const installSchema = z.object({ extensionId: z.string().min(1).max(100) });

router.get('/marketplace', (_req, res) => {
  res.json({
    extensions: EXTENSIONS_CATALOG.map(({ configFile, configContent, ...ext }) => ext),
    categories: [...new Set(EXTENSIONS_CATALOG.map(e => e.category))],
  });
});

router.get('/:projectId/installed', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    const installed = await db.query.projectExtensions.findMany({
      where: eq(projectExtensions.projectId, String(projectId))
    });

    res.json(installed.map(e => ({
      id: e.id,
      extensionId: e.extensionId,
      name: e.name,
      version: e.version,
      enabled: e.enabled,
      category: e.category,
      npmPackage: e.npmPackage,
    })));
  } catch (error: any) {
    logger.error('Failed to get installed extensions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/install', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = installSchema.parse(req.body);

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    const catalogEntry = EXTENSIONS_CATALOG.find(e => e.extensionId === data.extensionId);
    if (!catalogEntry) return res.status(404).json({ error: 'Extension not found in catalog' });
    if (catalogEntry.type === 'unavailable') return res.status(400).json({ error: `${catalogEntry.name} is not available on E-Code` });

    const existing = await db.query.projectExtensions.findFirst({
      where: and(
        eq(projectExtensions.projectId, String(projectId)),
        eq(projectExtensions.extensionId, data.extensionId)
      )
    });
    if (existing) return res.status(409).json({ error: 'Extension already installed' });

    let npmResult: { success: boolean; output: string } | null = null;
    if (catalogEntry.npmPackage) {
      const wsDir = getProjectWorkspacePath(projectId);
      try { await fs.access(wsDir); } catch {
        await fs.mkdir(wsDir, { recursive: true });
      }

      const pkgJsonPath = path.join(wsDir, 'package.json');
      try { await fs.access(pkgJsonPath); } catch {
        await fs.writeFile(pkgJsonPath, JSON.stringify({ name: "project", version: "1.0.0", private: true }, null, 2));
      }

      const packages = [catalogEntry.npmPackage];
      if (catalogEntry.extensionId === 'eslint') packages.push('@eslint/js');
      npmResult = await runNpmCommand(['install', '--save-dev', ...packages], wsDir);
      if (!npmResult.success) {
        logger.error('npm install failed', { extensionId: data.extensionId, output: npmResult.output });
        return res.status(500).json({ error: 'Failed to install npm package', details: npmResult.output.slice(-500) });
      }

      if (catalogEntry.configFile && catalogEntry.configContent) {
        const configPath = path.join(wsDir, catalogEntry.configFile);
        try { await fs.access(configPath); } catch {
          await fs.writeFile(configPath, catalogEntry.configContent, 'utf-8');
          logger.info('Created config file', { file: catalogEntry.configFile, projectId });
        }
        try {
          const { files } = await import('@shared/schema');
          const existing = await db.query.files.findFirst({
            where: and(eq(files.projectId, String(projectId)), eq(files.filename, catalogEntry.configFile))
          });
          if (!existing) {
            await db.insert(files).values({
              projectId: String(projectId),
              filename: catalogEntry.configFile,
              content: catalogEntry.configContent,
              isDirectory: false,
            });
            logger.info('Config file added to project tree', { file: catalogEntry.configFile, projectId });
          }
        } catch (dbErr: any) {
          logger.warn('Could not add config to file tree', { error: dbErr.message });
        }
      }

      if (catalogEntry.extensionId === 'prettier') {
        try {
          const { files } = await import('@shared/schema');
          const pkgFile = await db.query.files.findFirst({
            where: and(eq(files.projectId, String(projectId)), eq(files.filename, 'package.json'))
          });
          if (pkgFile && pkgFile.content) {
            const pkg = JSON.parse(pkgFile.content);
            if (!pkg.scripts) pkg.scripts = {};
            if (!pkg.scripts.format) {
              pkg.scripts.format = 'prettier --write .';
              const updated = JSON.stringify(pkg, null, 2);
              await storage.updateFileContent(pkgFile.id, updated);
              logger.info('Added format script to package.json', { projectId });
            }
          }
        } catch (pkgErr: any) {
          logger.warn('Could not update package.json with format script', { error: pkgErr.message });
        }
      }
    }

    const [created] = await db.insert(projectExtensions).values({
      projectId: String(projectId),
      extensionId: data.extensionId,
      name: catalogEntry.name,
      description: catalogEntry.description,
      author: catalogEntry.author,
      version: catalogEntry.version,
      category: catalogEntry.category,
      icon: catalogEntry.icon,
      npmPackage: catalogEntry.npmPackage,
      enabled: true,
      config: catalogEntry.configFile ? { configFile: catalogEntry.configFile } : null,
    }).returning();

    logger.info('Extension installed', {
      projectId, extensionId: data.extensionId,
      type: catalogEntry.type,
      npmInstalled: !!npmResult?.success,
    });

    res.status(201).json({
      ...created,
      npmOutput: npmResult?.output?.slice(-200),
    });
  } catch (error: any) {
    logger.error('Failed to install extension:', error);
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/uninstall', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = installSchema.parse(req.body);

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    const existing = await db.query.projectExtensions.findFirst({
      where: and(
        eq(projectExtensions.projectId, String(projectId)),
        eq(projectExtensions.extensionId, data.extensionId)
      )
    });
    if (!existing) return res.status(404).json({ error: 'Extension not installed' });

    const catalogEntry = EXTENSIONS_CATALOG.find(e => e.extensionId === data.extensionId);
    if (catalogEntry?.npmPackage) {
      const wsDir = getProjectWorkspacePath(projectId);
      try {
        await fs.access(wsDir);
        const result = await runNpmCommand(['uninstall', catalogEntry.npmPackage], wsDir);
        if (!result.success) {
          logger.warn('npm uninstall failed (continuing)', { extensionId: data.extensionId, output: result.output });
        }
        if (catalogEntry.configFile) {
          const configPath = path.join(wsDir, catalogEntry.configFile);
          try { await fs.unlink(configPath); } catch {}
        }
      } catch {}
    }

    await db.delete(projectExtensions).where(
      and(
        eq(projectExtensions.projectId, String(projectId)),
        eq(projectExtensions.extensionId, data.extensionId)
      )
    );

    logger.info('Extension uninstalled', { projectId, extensionId: data.extensionId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to uninstall extension:', error);
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/:extensionId', ensureAuthenticated, csrfProtection, async (req, res) => {
  req.body = { extensionId: req.params.extensionId };
  const projectId = req.params.projectId;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const isOwner = await verifyProjectOwnership(userId, projectId);
  if (!isOwner) return res.status(403).json({ error: 'Access denied' });

  const existing = await db.query.projectExtensions.findFirst({
    where: and(
      eq(projectExtensions.projectId, String(projectId)),
      eq(projectExtensions.extensionId, req.params.extensionId)
    )
  });
  if (!existing) return res.status(404).json({ error: 'Extension not installed' });

  const catalogEntry = EXTENSIONS_CATALOG.find(e => e.extensionId === req.params.extensionId);
  if (catalogEntry?.npmPackage) {
    const wsDir = getProjectWorkspacePath(projectId);
    try {
      await fs.access(wsDir);
      await runNpmCommand(['uninstall', catalogEntry.npmPackage], wsDir);
      if (catalogEntry.configFile) {
        try { await fs.unlink(path.join(wsDir, catalogEntry.configFile)); } catch {}
      }
    } catch {}
  }

  await db.delete(projectExtensions).where(
    and(
      eq(projectExtensions.projectId, String(projectId)),
      eq(projectExtensions.extensionId, req.params.extensionId)
    )
  );
  res.json({ success: true });
});

async function isExtensionInstalled(projectId: string, extensionId: string): Promise<boolean> {
  const ext = await db.query.projectExtensions.findFirst({
    where: and(eq(projectExtensions.projectId, String(projectId)), eq(projectExtensions.extensionId, extensionId), eq(projectExtensions.enabled, true))
  });
  return !!ext;
}

function resolveNpxBin(pkg: string, wsDir: string): string {
  const localBin = path.join(wsDir, 'node_modules', '.bin', pkg);
  return localBin;
}

router.post('/:projectId/format', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    const { content, filename } = req.body;
    if (typeof content !== 'string' || typeof filename !== 'string') {
      return res.status(400).json({ error: 'content and filename are required' });
    }

    const hasPrettier = await isExtensionInstalled(projectId, 'prettier');
    if (!hasPrettier) {
      return res.json({ formatted: content, changed: false, message: 'Prettier not installed' });
    }

    const wsDir = getProjectWorkspacePath(projectId);
    const prettierBin = resolveNpxBin('prettier', wsDir);
    try { await fs.access(prettierBin); } catch {
      return res.json({ formatted: content, changed: false, message: 'Prettier binary not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const supportedExts = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.less', '.html', '.json', '.md', '.yaml', '.yml', '.graphql', '.vue', '.svelte'];
    if (!supportedExts.includes(ext)) {
      return res.json({ formatted: content, changed: false, message: 'File type not supported by Prettier' });
    }

    const tmpFile = path.join(wsDir, `.prettier-tmp-${Date.now()}${ext}`);
    await fs.writeFile(tmpFile, content, 'utf-8');

    try {
      const result = await runNpmCommand(['exec', '--', 'prettier', '--write', tmpFile], wsDir);
      const formatted = await fs.readFile(tmpFile, 'utf-8');
      await fs.unlink(tmpFile).catch(() => {});
      res.json({ formatted, changed: formatted !== content });
    } catch (err: any) {
      await fs.unlink(tmpFile).catch(() => {});
      res.json({ formatted: content, changed: false, error: err.message });
    }
  } catch (error: any) {
    logger.error('Format error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/lint', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });

    const { content, filename } = req.body;
    if (typeof content !== 'string' || typeof filename !== 'string') {
      return res.status(400).json({ error: 'content and filename are required' });
    }

    const hasEslint = await isExtensionInstalled(projectId, 'eslint');
    if (!hasEslint) {
      return res.json({ diagnostics: [], message: 'ESLint not installed' });
    }

    const ext = path.extname(filename).toLowerCase();
    const supportedExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    if (!supportedExts.includes(ext)) {
      return res.json({ diagnostics: [], message: 'File type not supported by ESLint' });
    }

    const wsDir = getProjectWorkspacePath(projectId);
    const tmpFile = path.join(wsDir, `.eslint-tmp-${Date.now()}${ext}`);
    await fs.writeFile(tmpFile, content, 'utf-8');

    try {
      const result = await runNpmCommand(['exec', '--', 'eslint', '--format', 'json', '--no-error-on-unmatched-pattern', tmpFile], wsDir);
      await fs.unlink(tmpFile).catch(() => {});

      const diagnostics: Array<{ line: number; column: number; endLine?: number; endColumn?: number; message: string; severity: 'error' | 'warning' | 'info'; ruleId: string | null }> = [];
      try {
        const eslintOutput = JSON.parse(result.output);
        if (Array.isArray(eslintOutput) && eslintOutput[0]?.messages) {
          for (const msg of eslintOutput[0].messages) {
            diagnostics.push({
              line: msg.line || 1,
              column: msg.column || 1,
              endLine: msg.endLine,
              endColumn: msg.endColumn,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning',
              ruleId: msg.ruleId || null,
            });
          }
        }
      } catch {
        logger.warn('Failed to parse ESLint output', { output: result.output.slice(0, 500) });
      }
      res.json({ diagnostics });
    } catch (err: any) {
      await fs.unlink(tmpFile).catch(() => {});
      res.json({ diagnostics: [], error: err.message });
    }
  } catch (error: any) {
    logger.error('Lint error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:projectId/check/:extensionId', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const isOwner = await verifyProjectOwnership(userId, req.params.projectId);
    if (!isOwner) return res.status(403).json({ error: 'Access denied' });
    const installed = await isExtensionInstalled(req.params.projectId, req.params.extensionId);
    res.json({ installed });
  } catch {
    res.json({ installed: false });
  }
});

router.get('/', (_req, res) => {
  res.status(404).json({ error: 'Project ID required. Use /api/extensions/marketplace or /api/extensions/:projectId/installed' });
});

export default router;
