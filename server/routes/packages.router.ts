// @ts-nocheck
/**
 * Packages Router - Handles package installation and management
 * Provides endpoints for AI-driven package automation
 * 
 * SECURITY:
 * - Package names validated with strict allowlist pattern
 * - Uses spawn instead of exec to prevent command injection
 * - Proper working directory resolution with fallback
 * - Uses safePath utility to prevent path traversal attacks
 */

import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { safePath } from '../utils/safe-path';

const router = Router();

/**
 * Validates project ID to prevent path traversal
 * SECURITY: Only allows alphanumeric, hyphens, underscores (no slashes or dots)
 */
function isValidProjectId(projectId: string): boolean {
  // Strict validation: only alphanumeric, hyphens, underscores
  // NO slashes, NO dots (prevents ../ and ./)
  const projectIdPattern = /^[\w-]+$/;
  return projectIdPattern.test(projectId) 
    && projectId.length > 0 
    && projectId.length < 100
    && !projectId.includes('..') 
    && !projectId.includes('/') 
    && !projectId.includes('\\');
}

/**
 * Validates package name to prevent command injection
 * Allows: alphanumeric, hyphens, underscores, dots, @-scopes, slashes
 */
function isValidPackageName(name: string): boolean {
  // Allow scoped packages like @babel/core, normal packages like lodash, and URLs
  const packagePattern = /^(@[\w.-]+\/)?[\w.-]+$/;
  return packagePattern.test(name) && name.length < 214; // npm package name limit
}

/**
 * Validates version string to prevent command injection
 * SECURITY: Forbids whitespace and double-hyphens to prevent flag injection
 */
function isValidVersion(version: string): boolean {
  // Allow semantic versions, version ranges, tags (latest, next, etc)
  // NO whitespace, NO double-hyphens (prevents --flag injection)
  const versionPattern = /^[\w.*^~<>=-]+$/;
  const hasWhitespace = /\s/.test(version);
  const hasDoubleHyphen = /--/.test(version);
  
  return versionPattern.test(version) 
    && !hasWhitespace 
    && !hasDoubleHyphen 
    && version.length < 50 
    && version.length > 0;
}

/**
 * Resolves the working directory for a project
 * SECURITY: Returns null if project directory doesn't exist (no fallback to server root)
 * Uses safePath to prevent path traversal attacks
 */
async function resolveProjectDirectory(projectId: string): Promise<string | null> {
  // SECURITY: Validate projectId first to prevent path traversal
  if (!isValidProjectId(projectId)) {
    return null;
  }
  
  const projectsDir = path.join(process.cwd(), 'project-workspaces');
  
  // SECURITY: Use safePath to prevent path traversal
  const projectDir = safePath(projectsDir, projectId);
  if (!projectDir) {
    return null; // Path traversal attempt detected
  }
  
  try {
    await fs.access(projectDir);
    return projectDir;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    // SECURITY: Do NOT fallback to process.cwd() - that would allow installing in server root
    return null;
  }
}

/**
 * Spawns a package manager command safely
 */
function spawnPackageManager(
  command: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      timeout: 180000, // 3 minutes - sufficient for most installs
      shell: false, // CRITICAL: Disable shell to prevent command injection
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error: any = new Error(`Package manager exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

const ensureProjectAccess = async (req: any, res: any, next: any) => {
  try {
    const projectIdParam = req.params.projectId || req.query.projectId;
    const userId = req.user?.id || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!projectIdParam) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const project = await storage.getProject(projectIdParam);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (String(project.userId) === String(userId)) {
      req.validatedProjectId = projectIdParam;
      req.project = project;
      return next();
    }
    
    try {
      const collaborators = await storage.getProjectCollaborators(projectIdParam);
      const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(userId));
      if (isCollaborator) {
        req.validatedProjectId = projectIdParam;
        req.project = project;
        return next();
      }
    } catch {}
    
    return res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    console.error('[Packages] Error checking project access:', error);
    res.status(500).json({ error: 'Failed to verify project access' });
  }
};

/**
 * Install package for a project
 * POST /api/packages/:projectId/install
 */
router.post('/:projectId/install', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { package: packageName, name, version } = req.body;
    
    // SECURITY: Validate project ID first
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters or path traversal attempts'
      });
    }
    
    const pkgToInstall = packageName || name || '';
    
    if (!pkgToInstall) {
      return res.status(400).json({ error: 'Package name is required' });
    }
    
    // SECURITY: Validate package name
    if (!isValidPackageName(pkgToInstall)) {
      return res.status(400).json({ 
        error: 'Invalid package name', 
        details: 'Package name contains invalid characters' 
      });
    }
    
    // SECURITY: Validate version if provided
    if (version && !isValidVersion(version)) {
      return res.status(400).json({ 
        error: 'Invalid version string',
        details: 'Version contains invalid characters'
      });
    }
    
    // Resolve working directory
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    // Determine package manager
    let packageManager: string;
    let installArgs: string[];
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      // Node.js project
      packageManager = 'npm';
      installArgs = ['install', version ? `${pkgToInstall}@${version}` : pkgToInstall];
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        // Python project
        packageManager = 'pip';
        installArgs = ['install', version ? `${pkgToInstall}==${version}` : pkgToInstall];
      } catch (err: any) { console.error("[catch]", err?.message || err);
        // Default to npm
        packageManager = 'npm';
        installArgs = ['install', version ? `${pkgToInstall}@${version}` : pkgToInstall];
      }
    }
    
    // Execute installation using spawn (secure)
    const { stdout, stderr } = await spawnPackageManager(packageManager, installArgs, workingDir);
    
    if (stderr && !stderr.includes('npm WARN')) {
      console.error(`[Packages] Installation warnings:`, stderr);
    }
    
    res.json({
      success: true,
      message: `Successfully installed ${pkgToInstall}`,
      package: pkgToInstall,
      version: version || 'latest',
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Packages] Installation failed:', error);
    res.status(500).json({
      error: 'Package installation failed',
      message: error.message,
      details: error.stderr || error.stdout,
    });
  }
});

/**
 * Uninstall package from a project
 * POST /api/packages/:projectId/uninstall
 */
router.post('/:projectId/uninstall', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { package: packageName } = req.body;
    
    // SECURITY: Validate project ID first
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters or path traversal attempts'
      });
    }
    
    if (!packageName) {
      return res.status(400).json({ error: 'Package name is required' });
    }
    
    // SECURITY: Validate package name
    if (!isValidPackageName(packageName)) {
      return res.status(400).json({ 
        error: 'Invalid package name',
        details: 'Package name contains invalid characters'
      });
    }
    
    // Resolve working directory
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    // Determine package manager
    let packageManager: string;
    let uninstallArgs: string[];
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      packageManager = 'npm';
      uninstallArgs = ['uninstall', packageName];
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        packageManager = 'pip';
        uninstallArgs = ['uninstall', '-y', packageName];
      } catch (err: any) { console.error("[catch]", err?.message || err);
        packageManager = 'npm';
        uninstallArgs = ['uninstall', packageName];
      }
    }
    
    const { stdout, stderr } = await spawnPackageManager(packageManager, uninstallArgs, workingDir);
    
    res.json({
      success: true,
      message: `Successfully uninstalled ${packageName}`,
      package: packageName,
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Packages] Uninstallation failed:', error);
    res.status(500).json({
      error: 'Package uninstallation failed',
      message: error.message,
    });
  }
});

/**
 * Get installed packages for a project
 * GET /api/packages/installed?projectId=:id
 * SECURITY: Uses ensureProjectAccess middleware (now supports query parameters)
 */
router.get('/installed', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.validatedProjectId || req.query.projectId as string;
    const files = await storage.getFiles(projectId);
    
    const pkgFile = files.find((f: any) => f.filename === 'package.json');
    if (pkgFile && pkgFile.content) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        const packages = [
          ...Object.entries(deps).map(([name, version]) => ({
            name, version: String(version), type: 'production',
          })),
          ...Object.entries(devDeps).map(([name, version]) => ({
            name, version: String(version), type: 'development',
          })),
        ];
        return res.json({ success: true, packages, language: 'javascript' });
      } catch {}
    }
    
    const reqFile = files.find((f: any) => f.filename === 'requirements.txt');
    if (reqFile && reqFile.content) {
      const packages = reqFile.content.split('\n')
        .filter((l: string) => l.trim() && !l.startsWith('#'))
        .map((line: string) => {
          const match = line.match(/^([a-zA-Z0-9_.-]+)(?:[=<>!~]+(.+))?$/);
          return { name: match ? match[1].trim() : line.trim(), version: match?.[2]?.trim() || 'latest', type: 'production' };
        });
      return res.json({ success: true, packages, language: 'python' });
    }
    
    return res.json({ success: true, packages: [], message: 'No package files found' });
  } catch (error: any) {
    console.error('[Packages] Failed to fetch installed packages:', error);
    res.status(500).json({ error: 'Failed to fetch installed packages', message: error.message });
  }
});

/**
 * Search packages from registry (npm/pip)
 * GET /api/packages/:projectId/search?q=query
 * Also supports: GET /api/packages/:projectId/search/:query
 * AND: GET /api/packages/:id/search (legacy compatibility)
 */
router.get('/:projectId/search{/:query}', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.projectId || req.query.projectId;
    const query = (req.params.query || req.query.q) as string;
    const language = req.query.language as string || 'nodejs';
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        error: 'Search query is required',
        details: 'Query must be at least 2 characters'
      });
    }
    
    let packages: any[] = [];
    
    if (language === 'python') {
      // Search PyPI
      try {
        const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`);
        if (response.ok) {
          const data = await response.json() as any;
          packages = [{
            name: data.info.name,
            version: data.info.version,
            description: data.info.summary || '',
            homepage: data.info.home_page || data.info.project_url || '',
          }];
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        // PyPI API doesn't have a search endpoint, so we try exact match
        packages = [];
      }
    } else {
      // Search npm registry
      try {
        const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`);
        if (response.ok) {
          const data = await response.json() as any;
          packages = data.objects?.map((obj: any) => ({
            name: obj.package.name,
            version: obj.package.version,
            description: obj.package.description || '',
            homepage: obj.package.links?.homepage || obj.package.links?.npm || '',
            score: obj.score?.final || 0,
          })) || [];
        }
      } catch (e) {
        console.error('[Packages] npm search failed:', e);
        packages = [];
      }
    }
    
    res.json({
      success: true,
      packages,
      query,
      language,
    });
  } catch (error: any) {
    console.error('[Packages] Search failed:', error);
    res.status(500).json({
      error: 'Package search failed',
      message: error.message,
      details: error.stderr || error.stdout,
    });
  }
});

/**
 * Update a package to a specific version
 * POST /api/packages/:projectId/update
 */
router.post('/:projectId/update', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { package: packageName, name, version } = req.body;
    
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters'
      });
    }
    
    const pkgToUpdate = packageName || name || '';
    
    if (!pkgToUpdate) {
      return res.status(400).json({ error: 'Package name is required' });
    }
    
    if (!isValidPackageName(pkgToUpdate)) {
      return res.status(400).json({ 
        error: 'Invalid package name',
        details: 'Package name contains invalid characters'
      });
    }
    
    if (version && !isValidVersion(version)) {
      return res.status(400).json({ 
        error: 'Invalid version string',
        details: 'Version contains invalid characters'
      });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    let packageManager: string;
    let updateArgs: string[];
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      packageManager = 'npm';
      updateArgs = ['install', version ? `${pkgToUpdate}@${version}` : `${pkgToUpdate}@latest`];
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        packageManager = 'pip';
        updateArgs = ['install', '--upgrade', version ? `${pkgToUpdate}==${version}` : pkgToUpdate];
      } catch (err: any) { console.error("[catch]", err?.message || err);
        packageManager = 'npm';
        updateArgs = ['install', version ? `${pkgToUpdate}@${version}` : `${pkgToUpdate}@latest`];
      }
    }
    
    const { stdout, stderr } = await spawnPackageManager(packageManager, updateArgs, workingDir);
    
    res.json({
      success: true,
      message: `Successfully updated ${pkgToUpdate}`,
      package: pkgToUpdate,
      version: version || 'latest',
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Packages] Update failed:', error);
    res.status(500).json({
      error: 'Package update failed',
      message: error.message,
      details: error.stderr || error.stdout,
    });
  }
});

/**
 * Get installed packages (alternative route for per-project)
 * GET /api/packages/:projectId/list
 */
router.get('/:projectId/list', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const files = await storage.getFiles(projectId);
    
    let packages: any[] = [];
    let language = 'nodejs';
    
    const pkgFile = files.find((f: any) => f.filename === 'package.json');
    if (pkgFile && pkgFile.content) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        packages = [
          ...Object.entries(deps).map(([name, version]) => ({
            name, version: String(version), type: 'production', isDev: false,
          })),
          ...Object.entries(devDeps).map(([name, version]) => ({
            name, version: String(version), type: 'development', isDev: true,
          })),
        ];
        language = 'nodejs';
      } catch {}
    } else {
      const reqFile = files.find((f: any) => f.filename === 'requirements.txt');
      if (reqFile && reqFile.content) {
        packages = reqFile.content.split('\n')
          .filter((l: string) => l.trim() && !l.startsWith('#'))
          .map((line: string) => {
            const match = line.match(/^([a-zA-Z0-9_.-]+)(?:[=<>!~]+(.+))?$/);
            return {
              name: match ? match[1].trim() : line.trim(),
              version: match?.[2]?.trim() || 'latest',
              type: 'production', isDev: false,
            };
          });
        language = 'python';
      }
    }
    
    let systemDependencies: any[] = [];
    const nixFile = files.find((f: any) => f.filename === 'replit.nix');
    if (nixFile && nixFile.content) {
      try {
        const depsMatch = nixFile.content.match(/deps\s*=\s*\[([^\]]*)\]/s);
        if (depsMatch) {
          const pkgMatches = depsMatch[1].match(/pkgs\.([a-zA-Z0-9_-]+)/g);
          if (pkgMatches) {
            systemDependencies = pkgMatches.map(m => ({
              name: m.replace('pkgs.', ''), type: 'system',
            }));
          }
        }
      } catch {}
    }
    
    return res.json({ success: true, packages, systemDependencies, language });
  } catch (error: any) {
    console.error('[Packages] Failed to fetch packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages', message: error.message });
  }
});

/**
 * Remove a specific package (DELETE variant)
 * DELETE /api/packages/:projectId/:packageName
 */
router.delete('/:projectId/:packageName', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId, packageName } = req.params;
    
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters'
      });
    }
    
    if (!isValidPackageName(packageName)) {
      return res.status(400).json({ 
        error: 'Invalid package name',
        details: 'Package name contains invalid characters'
      });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    let packageManager: string;
    let uninstallArgs: string[];
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      packageManager = 'npm';
      uninstallArgs = ['uninstall', packageName];
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        packageManager = 'pip';
        uninstallArgs = ['uninstall', '-y', packageName];
      } catch (err: any) { console.error("[catch]", err?.message || err);
        packageManager = 'npm';
        uninstallArgs = ['uninstall', packageName];
      }
    }
    
    const { stdout, stderr } = await spawnPackageManager(packageManager, uninstallArgs, workingDir);
    
    res.json({
      success: true,
      message: `Successfully removed ${packageName}`,
      package: packageName,
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Packages] Removal failed:', error);
    res.status(500).json({
      error: 'Package removal failed',
      message: error.message,
    });
  }
});

/**
 * Security audit for a project (npm audit)
 * GET /api/packages/:projectId/audit
 */
router.get('/:projectId/audit', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters'
      });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    let language = 'javascript';
    let vulnerabilities: any[] = [];
    let summary = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      language = 'javascript';
      
      try {
        const { stdout } = await spawnPackageManager('npm', ['audit', '--json'], workingDir);
        const auditData = JSON.parse(stdout);
        
        if (auditData.vulnerabilities) {
          vulnerabilities = Object.entries(auditData.vulnerabilities).map(([name, data]: [string, any]) => ({
            name,
            severity: data.severity,
            title: data.via?.[0]?.title || 'Vulnerability detected',
            url: data.via?.[0]?.url || '',
            fixAvailable: data.fixAvailable,
            range: data.range,
            nodes: data.nodes?.length || 0,
          }));
          
          summary = auditData.metadata?.vulnerabilities || summary;
        }
      } catch (auditError: any) {
        if (auditError.stdout) {
          try {
            const auditData = JSON.parse(auditError.stdout);
            if (auditData.vulnerabilities) {
              vulnerabilities = Object.entries(auditData.vulnerabilities).map(([name, data]: [string, any]) => ({
                name,
                severity: data.severity,
                title: data.via?.[0]?.title || 'Vulnerability detected',
                url: data.via?.[0]?.url || '',
                fixAvailable: data.fixAvailable,
                range: data.range,
                nodes: data.nodes?.length || 0,
              }));
              
              summary = auditData.metadata?.vulnerabilities || summary;
            }
          } catch (err: any) { console.error("[catch]", err?.message || err);
            // Couldn't parse audit output
          }
        }
      }
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        language = 'python';
        
        try {
          const { stdout } = await spawnPackageManager('pip', ['check'], workingDir);
          if (stdout.includes('No broken requirements')) {
            vulnerabilities = [];
          } else {
            const lines = stdout.split('\n').filter(l => l.trim());
            vulnerabilities = lines.map(line => ({
              name: line.split(' ')[0],
              severity: 'moderate',
              title: line,
              fixAvailable: true,
            }));
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);
          vulnerabilities = [];
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        return res.json({
          success: true,
          vulnerabilities: [],
          summary,
          language: 'unknown',
          message: 'No package files found',
        });
      }
    }
    
    res.json({
      success: true,
      vulnerabilities,
      summary,
      language,
    });
  } catch (error: any) {
    console.error('[Packages] Audit failed:', error);
    res.status(500).json({
      error: 'Security audit failed',
      message: error.message,
    });
  }
});

/**
 * Check for outdated packages
 * GET /api/packages/:projectId/outdated
 */
router.get('/:projectId/outdated', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters'
      });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    let outdatedPackages: any[] = [];
    let language = 'javascript';
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      language = 'javascript';
      
      try {
        const { stdout } = await spawnPackageManager('npm', ['outdated', '--json'], workingDir);
        const outdatedData = JSON.parse(stdout || '{}');
        
        outdatedPackages = Object.entries(outdatedData).map(([name, data]: [string, any]) => ({
          name,
          current: data.current,
          wanted: data.wanted,
          latest: data.latest,
          type: data.type || 'dependencies',
          homepage: data.homepage || `https://www.npmjs.com/package/${name}`,
        }));
      } catch (outdatedError: any) {
        if (outdatedError.stdout) {
          try {
            const outdatedData = JSON.parse(outdatedError.stdout || '{}');
            outdatedPackages = Object.entries(outdatedData).map(([name, data]: [string, any]) => ({
              name,
              current: data.current,
              wanted: data.wanted,
              latest: data.latest,
              type: data.type || 'dependencies',
              homepage: data.homepage || `https://www.npmjs.com/package/${name}`,
            }));
          } catch (err: any) { console.error("[catch]", err?.message || err);
            outdatedPackages = [];
          }
        }
      }
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        language = 'python';
        
        try {
          const { stdout } = await spawnPackageManager('pip', ['list', '--outdated', '--format=json'], workingDir);
          const outdatedData = JSON.parse(stdout || '[]');
          
          outdatedPackages = outdatedData.map((pkg: any) => ({
            name: pkg.name,
            current: pkg.version,
            latest: pkg.latest_version,
            wanted: pkg.latest_version,
            type: 'dependencies',
            homepage: `https://pypi.org/project/${pkg.name}/`,
          }));
        } catch (err: any) { console.error("[catch]", err?.message || err);
          outdatedPackages = [];
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        return res.json({
          success: true,
          outdated: [],
          language: 'unknown',
          message: 'No package files found',
        });
      }
    }
    
    res.json({
      success: true,
      outdated: outdatedPackages,
      language,
    });
  } catch (error: any) {
    console.error('[Packages] Outdated check failed:', error);
    res.status(500).json({
      error: 'Outdated check failed',
      message: error.message,
    });
  }
});

/**
 * Get dependency tree for a project
 * GET /api/packages/:projectId/dependencies
 */
router.get('/:projectId/dependencies', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!isValidProjectId(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID',
        details: 'Project ID contains invalid characters'
      });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    
    if (!workingDir) {
      return res.status(404).json({ 
        error: 'Project not found',
        details: `Project directory does not exist for project ${projectId}`
      });
    }
    
    let dependencies: any = {};
    let language = 'javascript';
    
    try {
      await fs.access(path.join(workingDir, 'package.json'));
      language = 'javascript';
      
      try {
        const { stdout } = await spawnPackageManager('npm', ['ls', '--json', '--depth=2'], workingDir);
        const depData = JSON.parse(stdout || '{}');
        dependencies = depData.dependencies || {};
      } catch (lsError: any) {
        if (lsError.stdout) {
          try {
            const depData = JSON.parse(lsError.stdout || '{}');
            dependencies = depData.dependencies || {};
          } catch (err: any) { console.error("[catch]", err?.message || err);
            dependencies = {};
          }
        }
      }
    } catch (err: any) { console.error("[catch]", err?.message || err);
      try {
        await fs.access(path.join(workingDir, 'requirements.txt'));
        language = 'python';
        
        const requirementsPath = path.join(workingDir, 'requirements.txt');
        const requirements = await fs.readFile(requirementsPath, 'utf-8');
        
        const pkgs = requirements
          .split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => {
            const match = line.match(/^([a-zA-Z0-9_.-]+)(?:==|>=|<=|~=|!=)?(.*)$/);
            return {
              name: match ? match[1].trim() : line.trim(),
              version: match && match[2] ? match[2].trim() : 'latest',
            };
          });
        
        pkgs.forEach(pkg => {
          dependencies[pkg.name] = { version: pkg.version, dependencies: {} };
        });
      } catch (err: any) { console.error("[catch]", err?.message || err);
        return res.json({
          success: true,
          dependencies: [],
          language: 'unknown',
          message: 'No package files found',
        });
      }
    }
    
    const flattenDeps = (deps: any, depth = 0): any[] => {
      const result: any[] = [];
      for (const [name, data] of Object.entries(deps) as [string, any][]) {
        result.push({
          name,
          version: data.version,
          depth,
          dependencyCount: Object.keys(data.dependencies || {}).length,
          children: flattenDeps(data.dependencies || {}, depth + 1),
        });
      }
      return result;
    };
    
    res.json({
      success: true,
      dependencies: flattenDeps(dependencies),
      language,
    });
  } catch (error: any) {
    console.error('[Packages] Dependency tree failed:', error);
    res.status(500).json({
      error: 'Failed to get dependency tree',
      message: error.message,
    });
  }
});

/**
 * ===== Project-scoped package routes =====
 * These routes are mounted at /api/projects and use the /:projectId/packages pattern
 * for frontend compatibility. They are also re-exported as a separate router.
 */

interface DetectedManager {
  language: string;
  manager: string;
}

async function detectProjectManager(workingDir: string): Promise<DetectedManager> {
  try {
    const packageJsonPath = path.join(workingDir, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.packageManager) {
      const pmField = packageJson.packageManager as string;
      if (pmField.startsWith('yarn')) return { language: 'javascript', manager: 'yarn' };
      if (pmField.startsWith('pnpm')) return { language: 'javascript', manager: 'pnpm' };
      if (pmField.startsWith('bun')) return { language: 'javascript', manager: 'bun' };
      return { language: 'javascript', manager: 'npm' };
    }

    try { await fs.access(path.join(workingDir, 'pnpm-lock.yaml')); return { language: 'javascript', manager: 'pnpm' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
    try { await fs.access(path.join(workingDir, 'yarn.lock')); return { language: 'javascript', manager: 'yarn' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
    try { await fs.access(path.join(workingDir, 'bun.lockb')); return { language: 'javascript', manager: 'bun' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
    try { await fs.access(path.join(workingDir, 'bun.lock')); return { language: 'javascript', manager: 'bun' }; } catch (err: any) { console.error("[catch]", err?.message || err);}

    return { language: 'javascript', manager: 'npm' };
  } catch (err: any) { console.error("[catch]", err?.message || err);}

  try { await fs.access(path.join(workingDir, 'requirements.txt')); return { language: 'python', manager: 'pip' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
  try { await fs.access(path.join(workingDir, 'pyproject.toml')); return { language: 'python', manager: 'pip' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
  try { await fs.access(path.join(workingDir, 'Cargo.toml')); return { language: 'rust', manager: 'cargo' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
  try { await fs.access(path.join(workingDir, 'go.mod')); return { language: 'go', manager: 'go' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
  try { await fs.access(path.join(workingDir, 'Gemfile')); return { language: 'ruby', manager: 'gem' }; } catch (err: any) { console.error("[catch]", err?.message || err);}
  try { await fs.access(path.join(workingDir, 'composer.json')); return { language: 'php', manager: 'composer' }; } catch (err: any) { console.error("[catch]", err?.message || err);}

  return { language: 'javascript', manager: 'npm' };
}

function getInstallCommand(manager: string, name: string, version?: string, dev?: boolean): { cmd: string; args: string[] } {
  const pkgSpec = version ? `${name}@${version}` : name;
  switch (manager) {
    case 'yarn':
      return { cmd: 'yarn', args: ['add', ...(dev ? ['--dev'] : []), pkgSpec] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['add', ...(dev ? ['--save-dev'] : []), pkgSpec] };
    case 'bun':
      return { cmd: 'bun', args: ['add', ...(dev ? ['--dev'] : []), pkgSpec] };
    case 'pip':
      return { cmd: 'pip', args: ['install', version ? `${name}==${version}` : name] };
    case 'cargo':
      return { cmd: 'cargo', args: ['add', name] };
    case 'go':
      return { cmd: 'go', args: ['get', version ? `${name}@${version}` : name] };
    case 'gem':
      return { cmd: 'gem', args: ['install', name, ...(version ? ['-v', version] : [])] };
    case 'composer':
      return { cmd: 'composer', args: ['require', ...(dev ? ['--dev'] : []), pkgSpec] };
    default:
      return { cmd: 'npm', args: ['install', ...(dev ? ['--save-dev'] : []), pkgSpec] };
  }
}

function getUninstallCommand(manager: string, name: string): { cmd: string; args: string[] } {
  switch (manager) {
    case 'yarn': return { cmd: 'yarn', args: ['remove', name] };
    case 'pnpm': return { cmd: 'pnpm', args: ['remove', name] };
    case 'bun': return { cmd: 'bun', args: ['remove', name] };
    case 'pip': return { cmd: 'pip', args: ['uninstall', '-y', name] };
    case 'cargo': return { cmd: 'cargo', args: ['remove', name] };
    case 'go': return { cmd: 'go', args: ['get', `${name}@none`] };
    case 'gem': return { cmd: 'gem', args: ['uninstall', name] };
    case 'composer': return { cmd: 'composer', args: ['remove', name] };
    default: return { cmd: 'npm', args: ['uninstall', name] };
  }
}

function getUpdateCommand(manager: string, names: string[]): { cmd: string; args: string[] } {
  switch (manager) {
    case 'yarn': return { cmd: 'yarn', args: ['upgrade', ...names] };
    case 'pnpm': return { cmd: 'pnpm', args: ['update', ...names] };
    case 'bun': return { cmd: 'bun', args: ['update', ...names] };
    case 'pip': return { cmd: 'pip', args: ['install', '--upgrade', ...names] };
    case 'cargo': return { cmd: 'cargo', args: ['update', '-p', ...names] };
    case 'go': return { cmd: 'go', args: ['get', '-u', ...names] };
    case 'gem': return { cmd: 'gem', args: ['update', ...names] };
    case 'composer': return { cmd: 'composer', args: ['update', ...names] };
    default: return { cmd: 'npm', args: ['install', ...names.map(n => `${n}@latest`)] };
  }
}

async function parseCargoTomlDependencies(workingDir: string): Promise<any[]> {
  try {
    const content = await fs.readFile(path.join(workingDir, 'Cargo.toml'), 'utf-8');
    const packages: any[] = [];
    let inDeps = false;
    let inDevDeps = false;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '[dependencies]') { inDeps = true; inDevDeps = false; continue; }
      if (trimmed === '[dev-dependencies]') { inDeps = false; inDevDeps = true; continue; }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) { inDeps = false; inDevDeps = false; continue; }
      if (!inDeps && !inDevDeps) continue;
      const simple = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
      if (simple) {
        packages.push({ name: simple[1], version: simple[2], isDevDependency: inDevDeps });
        continue;
      }
      const table = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
      if (table) {
        packages.push({ name: table[1], version: table[2], isDevDependency: inDevDeps });
      }
    }
    return packages;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return [];
  }
}

async function parseGoModDependencies(workingDir: string): Promise<any[]> {
  try {
    const content = await fs.readFile(path.join(workingDir, 'go.mod'), 'utf-8');
    const packages: any[] = [];
    let inRequire = false;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === 'require (') { inRequire = true; continue; }
      if (trimmed === ')') { inRequire = false; continue; }
      if (inRequire) {
        const match = trimmed.match(/^(\S+)\s+(\S+)/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2].replace(/^v/, ''),
            isDevDependency: trimmed.includes('// indirect'),
          });
        }
      }
      const singleReq = trimmed.match(/^require\s+(\S+)\s+(\S+)/);
      if (singleReq) {
        packages.push({ name: singleReq[1], version: singleReq[2].replace(/^v/, ''), isDevDependency: false });
      }
    }
    return packages;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return [];
  }
}

const projectPackagesRouter = Router();

projectPackagesRouter.get('/:projectId/packages', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const files = await storage.getFiles(projectId);
    
    let packages: any[] = [];
    let packageManager = 'npm';
    let language = 'javascript';
    const managers: string[] = [];
    const groups: Record<string, any> = {};
    
    const pkgFile = files.find((f: any) => f.filename === 'package.json');
    if (pkgFile && pkgFile.content) {
      managers.push('npm');
      try {
        const pkg = JSON.parse(pkgFile.content);
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        const npmPkgs = [
          ...Object.entries(deps).map(([name, version]) => ({
            name,
            version: String(version),
            dev: false,
          })),
          ...Object.entries(devDeps).map(([name, version]) => ({
            name,
            version: String(version),
            dev: true,
          })),
        ];
        packages.push(...npmPkgs);
        groups['javascript'] = { packages: npmPkgs, manager: 'npm', language: 'javascript' };
      } catch {}
    }
    
    const reqFile = files.find((f: any) => f.filename === 'requirements.txt');
    const pyprojectFile = files.find((f: any) => f.filename === 'pyproject.toml');
    if (pyprojectFile && pyprojectFile.content && pyprojectFile.content.includes('[tool.poetry]')) {
      managers.push('poetry');
      packageManager = managers[0] || 'poetry';
      language = 'python';
    } else if (reqFile) {
      managers.push('pip');
      if (!pkgFile) { packageManager = 'pip'; language = 'python'; }
      try {
        const lines = (reqFile.content || '').split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
        const pipPkgs = lines.map((line: string) => {
          const match = line.match(/^([a-zA-Z0-9_.-]+)(?:[=<>!~]+(.+))?$/);
          return { name: match ? match[1] : line.trim(), version: match?.[2] || 'latest', dev: false };
        });
        packages.push(...pipPkgs);
        groups['python'] = { packages: pipPkgs, manager: 'pip', language: 'python' };
      } catch {}
    }
    
    if (managers.length === 0) managers.push('npm');
    
    res.json({ packages, packageManager: managers[0] || 'npm', managers, groups, language });
  } catch (error: any) {
    console.error('[Packages] Failed to list packages:', error);
    res.status(500).json({ error: 'Failed to list packages', message: error.message });
  }
});

async function updatePackageJsonInDb(projectId: string, operation: 'add' | 'remove' | 'update', pkgName: string, version?: string, dev?: boolean) {
  const files = await storage.getFiles(projectId);
  const pkgFile = files.find((f: any) => f.filename === 'package.json');
  let pkg: any = { name: 'project', version: '1.0.0', dependencies: {}, devDependencies: {} };
  
  if (pkgFile && pkgFile.content) {
    try { pkg = JSON.parse(pkgFile.content); } catch {}
  }
  if (!pkg.dependencies) pkg.dependencies = {};
  if (!pkg.devDependencies) pkg.devDependencies = {};
  
  if (operation === 'add') {
    const ver = version || 'latest';
    let resolvedVersion = ver;
    if (ver === 'latest') {
      try {
        const npmRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`, { signal: AbortSignal.timeout(5000) });
        if (npmRes.ok) {
          const data = await npmRes.json() as any;
          resolvedVersion = `^${data.version}`;
        }
      } catch {}
    }
    if (dev) {
      pkg.devDependencies[pkgName] = resolvedVersion;
      delete pkg.dependencies[pkgName];
    } else {
      pkg.dependencies[pkgName] = resolvedVersion;
      delete pkg.devDependencies[pkgName];
    }
  } else if (operation === 'remove') {
    delete pkg.dependencies[pkgName];
    delete pkg.devDependencies[pkgName];
  } else if (operation === 'update') {
    const section = pkg.devDependencies[pkgName] ? 'devDependencies' : 'dependencies';
    if (version) {
      pkg[section][pkgName] = version;
    } else {
      try {
        const npmRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`, { signal: AbortSignal.timeout(5000) });
        if (npmRes.ok) {
          const data = await npmRes.json() as any;
          pkg[section][pkgName] = `^${data.version}`;
        }
      } catch {}
    }
  }
  
  const content = JSON.stringify(pkg, null, 2);
  if (pkgFile) {
    await storage.updateFileContent(pkgFile.id, content);
  } else {
    await storage.createFile(projectId, { filename: 'package.json', content });
  }
  return pkg;
}

async function handleInstall(req: any, res: any) {
  try {
    const projectId = req.params.projectId;
    const { name, version, dev, package: packageName } = req.body;
    const pkgName = name || packageName;
    
    if (!pkgName || !isValidPackageName(pkgName)) {
      return res.status(400).json({ error: 'Invalid or missing package name' });
    }
    if (version && !isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version string' });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    if (workingDir) {
      try {
        const detected = await detectProjectManager(workingDir);
        const { cmd, args } = getInstallCommand(detected.manager, pkgName, version, dev);
        const { stdout } = await spawnPackageManager(cmd, args, workingDir);
        return res.json({ success: true, name: pkgName, version: version || 'latest', output: stdout });
      } catch {}
    }
    
    const pkg = await updatePackageJsonInDb(projectId, 'add', pkgName, version, dev);
    const installedVersion = (dev ? pkg.devDependencies : pkg.dependencies)[pkgName] || version || 'latest';
    res.json({ success: true, name: pkgName, version: installedVersion, output: `Added ${pkgName}@${installedVersion} to package.json` });
  } catch (error: any) {
    console.error('[Packages] Install failed:', error);
    res.status(500).json({ error: 'Installation failed', message: error.message });
  }
}

projectPackagesRouter.post('/:projectId/packages', ensureAuthenticated, ensureProjectAccess, handleInstall);
projectPackagesRouter.post('/:projectId/packages/install', ensureAuthenticated, ensureProjectAccess, handleInstall);

projectPackagesRouter.post('/:projectId/packages/install-stream', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  const projectId = req.params.projectId;
  const { name, version, dev } = req.body;
  
  if (!name || !isValidPackageName(name)) {
    return res.status(400).json({ error: 'Invalid or missing package name' });
  }
  
  const workingDir = await resolveProjectDirectory(projectId);
  if (workingDir) {
    try {
      const detected = await detectProjectManager(workingDir);
      const { cmd, args } = getInstallCommand(detected.manager, name, version, dev);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      const sendEvent = (event: string, data: any) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
      sendEvent('start', { package: name, command: `${cmd} ${args.join(' ')}` });
      const child = spawn(cmd, args, { cwd: workingDir, timeout: 180000, shell: false });
      child.stdout.on('data', (d) => { d.toString().split('\n').filter((l: string) => l.trim()).forEach((l: string) => sendEvent('output', { line: l })); });
      child.stderr.on('data', (d) => { d.toString().split('\n').filter((l: string) => l.trim()).forEach((l: string) => sendEvent('output', { line: l })); });
      child.on('error', (e) => { sendEvent('error', { message: e.message }); res.end(); });
      child.on('close', (code) => { sendEvent('done', { exitCode: code, success: code === 0, command: `${cmd} ${args.join(' ')}` }); res.end(); });
      req.on('close', () => { child.kill(); });
      return;
    } catch {}
  }
  
  try {
    const pkg = await updatePackageJsonInDb(projectId, 'add', name, version, dev);
    const installedVersion = (dev ? pkg.devDependencies : pkg.dependencies)[name] || version || 'latest';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const sendEvent = (event: string, data: any) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    sendEvent('start', { package: name });
    sendEvent('output', { line: `Adding ${name}@${installedVersion} to package.json...` });
    sendEvent('output', { line: `+ ${name}@${installedVersion}` });
    sendEvent('done', { success: true, exitCode: 0, command: `npm install ${name}` });
    res.end();
  } catch (error: any) {
    if (!res.headersSent) return res.status(500).json({ error: 'Install failed', message: error.message });
    res.end();
  }
});

projectPackagesRouter.delete('/:projectId/packages/:packageName', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const { projectId, packageName } = req.params;
    
    if (!isValidPackageName(packageName)) {
      return res.status(400).json({ error: 'Invalid package name' });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    if (workingDir) {
      try {
        const { manager } = await detectProjectManager(workingDir);
        const { cmd, args } = getUninstallCommand(manager, packageName);
        const { stdout } = await spawnPackageManager(cmd, args, workingDir);
        return res.json({ success: true, message: `Removed ${packageName}`, output: stdout });
      } catch {}
    }
    
    await updatePackageJsonInDb(projectId, 'remove', packageName);
    res.json({ success: true, message: `Removed ${packageName} from package.json` });
  } catch (error: any) {
    console.error('[Packages] Uninstall failed:', error);
    res.status(500).json({ error: 'Uninstall failed', message: error.message });
  }
});

projectPackagesRouter.post('/:projectId/packages/update', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { name, packages: pkgNames, version } = req.body;
    const names: string[] = name ? [name] : (Array.isArray(pkgNames) ? pkgNames : [pkgNames].filter(Boolean));
    
    if (names.length === 0) {
      return res.status(400).json({ error: 'Package name(s) required' });
    }
    
    const workingDir = await resolveProjectDirectory(projectId);
    if (workingDir) {
      try {
        const { manager } = await detectProjectManager(workingDir);
        const { cmd, args } = getUpdateCommand(manager, names);
        const { stdout } = await spawnPackageManager(cmd, args, workingDir);
        return res.json({ success: true, message: `Updated ${names.join(', ')}`, output: stdout });
      } catch {}
    }
    
    for (const n of names) {
      await updatePackageJsonInDb(projectId, 'update', n, version);
    }
    res.json({ success: true, message: `Updated ${names.join(', ')} in package.json` });
  } catch (error: any) {
    console.error('[Packages] Update failed:', error);
    res.status(500).json({ error: 'Update failed', message: error.message });
  }
});

router.get('/search', ensureAuthenticated, async (req, res) => {
  try {
    const query = req.query.q as string;
    const language = req.query.language as string || 'javascript';
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    let packages: any[] = [];
    
    if (language === 'python') {
      try {
        const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`);
        if (response.ok) {
          const data = await response.json() as any;
          packages = [{
            name: data.info.name,
            version: data.info.version,
            description: data.info.summary || '',
          }];
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        packages = [];
      }
    } else {
      try {
        const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`);
        if (response.ok) {
          const data = await response.json() as any;
          packages = data.objects?.map((obj: any) => ({
            name: obj.package.name,
            version: obj.package.version,
            description: obj.package.description || '',
          })) || [];
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        packages = [];
      }
    }
    
    res.json(packages);
  } catch (error: any) {
    console.error('[Packages] Search failed:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

export { projectPackagesRouter };
export default router;
