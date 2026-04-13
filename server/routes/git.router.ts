import { Router, Request, Response } from 'express';
import { execa } from 'execa';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { githubOAuth } from '../services/github-oauth';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';
import { createLogger } from '../utils/logger';

const logger = createLogger('git-router');

const router = Router();

const PROJECT_ROOT = process.cwd();

const hasControlChars = (value: string): boolean =>
  [...value].some(char => {
    const code = char.charCodeAt(0);
    return code <= 0x1f;
  });

// SECURITY: Centralized file path validation to prevent command injection and path traversal
function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return { valid: false, error: 'Invalid file path' };
  }
  
  // Block path traversal
  if (filePath.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }
  
  // SECURITY: Block option injection - reject paths starting with "-" or "--"
  if (filePath.startsWith('-')) {
    return { valid: false, error: 'Invalid file path format' };
  }
  
  // Block dangerous shell characters (except spaces which are valid)
  const dangerousChars = /[;&|`$(){}[\]<>\\'"!#*?]/;
  if (dangerousChars.test(filePath) || hasControlChars(filePath)) {
    return { valid: false, error: 'Invalid characters in file path' };
  }
  
  // Ensure file is within project directory
  const resolvedPath = path.resolve(PROJECT_ROOT, filePath);
  const relativePath = path.relative(PROJECT_ROOT, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { valid: false, error: 'File path outside project directory' };
  }
  
  return { valid: true };
}

// Validate an array of file paths
function validateFilePaths(files: any[]): { valid: boolean; validatedFiles: string[]; error?: string } {
  const validatedFiles: string[] = [];
  for (const file of files) {
    const result = validateFilePath(file);
    if (!result.valid) {
      return { valid: false, validatedFiles: [], error: result.error };
    }
    validatedFiles.push(file);
  }
  return { valid: true, validatedFiles };
}

async function getGitCredentials(userId: number): Promise<{ username: string; password: string } | null> {
  return await githubOAuth.getGitCredentials(userId);
}

async function getAuthenticatedRemoteUrl(remoteUrl: string, userId: number): Promise<string> {
  const credentials = await getGitCredentials(userId);
  if (!credentials) {
    return remoteUrl;
  }
  
  try {
    const url = new URL(remoteUrl);
    url.username = credentials.username;
    url.password = credentials.password;
    return url.toString();
  } catch (err: any) { console.error("[catch]", err?.message || err);
    if (remoteUrl.includes('github.com')) {
      return remoteUrl.replace('https://github.com/', `https://${credentials.username}:${credentials.password}@github.com/`);
    }
    return remoteUrl;
  }
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

interface GitDiff {
  filePath: string;
  diff: string;
  staged: boolean;
}

async function ensureGitRepo(): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd: PROJECT_ROOT });
    return true;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

async function initGitRepo(): Promise<void> {
  try {
    await execa('git', ['init'], { cwd: PROJECT_ROOT });
    await execa('git', ['config', 'user.name', 'E-Code Platform'], { cwd: PROJECT_ROOT });
    await execa('git', ['config', 'user.email', 'noreply@e-code.ai'], { cwd: PROJECT_ROOT });
  } catch (error: any) {
    throw new Error(`Failed to initialize git repository: ${error.message}`);
  }
}

async function ensureGitRepoOrInit(): Promise<void> {
  const isRepo = await ensureGitRepo();
  if (!isRepo) {
    logger.info('[Git] Repository not initialized, auto-initializing...');
    await initGitRepo();
  }
}

router.get('/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    await ensureGitRepoOrInit();

    const [branchResult, statusResult, aheadBehind] = await Promise.all([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: PROJECT_ROOT }),
      execa('git', ['status', '--porcelain'], { cwd: PROJECT_ROOT }),
      execa('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd: PROJECT_ROOT }).catch(() => ({ stdout: '0\t0' })),
    ]);

    const branch = branchResult.stdout || 'main';
    const [ahead = 0, behind = 0] = aheadBehind.stdout.split('\t').map(Number);

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    statusResult.stdout.split('\n').forEach((line) => {
      if (!line) return;
      const status = line.substring(0, 2);
      const filePath = line.substring(3);

      if (status[0] !== ' ' && status[0] !== '?') {
        staged.push(filePath);
      }
      if (status[1] !== ' ' && status[1] !== '?') {
        unstaged.push(filePath);
      }
      if (status === '??') {
        untracked.push(filePath);
      }
    });

    const gitStatus: GitStatus = {
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
    };

    res.json(gitStatus);
  } catch (error: any) {
    logger.error('[Git] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/diff/{*filePath}', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.params;
    const { staged, stream } = req.query;

    // SECURITY: Validate file path
    const validation = validateFilePath(filePath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await ensureGitRepoOrInit();

    const args = staged === 'true' 
      ? ['diff', '--cached', '--', filePath]
      : ['diff', '--', filePath];

    if (stream === 'true') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
      
      const rl = createInterface({
        input: gitProcess.stdout,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      const MAX_LINES = 10000;

      for await (const line of rl) {
        lineCount++;
        if (lineCount > MAX_LINES) {
          res.write(JSON.stringify({ type: 'truncated', message: `Diff truncated at ${MAX_LINES} lines` }) + '\n');
          gitProcess.kill();
          break;
        }
        res.write(JSON.stringify({ type: 'line', content: line }) + '\n');
      }

      gitProcess.stderr.on('data', (data) => {
        res.write(JSON.stringify({ type: 'error', content: data.toString() }) + '\n');
      });

      await new Promise<void>((resolve, reject) => {
        gitProcess.on('close', (code) => {
          res.write(JSON.stringify({ type: 'done', exitCode: code }) + '\n');
          res.end();
          resolve();
        });
        gitProcess.on('error', reject);
      });
    } else {
      const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_SIZE = 5 * 1024 * 1024;
      let truncated = false;

      for await (const chunk of gitProcess.stdout) {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          truncated = true;
          gitProcess.kill();
          break;
        }
        chunks.push(chunk);
      }

      const stdout = Buffer.concat(chunks).toString('utf-8');
      
      const diff: GitDiff & { truncated?: boolean } = {
        filePath,
        diff: stdout,
        staged: staged === 'true',
      };
      
      if (truncated) {
        diff.truncated = true;
      }

      res.json(diff);
    }
  } catch (error: any) {
    logger.error('[Git] Diff error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/stage', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array required' });
    }

    // SECURITY: Use centralized file validation
    const validation = validateFilePaths(files);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await ensureGitRepoOrInit();

    // SECURITY: Use '--' to separate options from file paths to prevent option injection
    await execa('git', ['add', '--', ...validation.validatedFiles], { cwd: PROJECT_ROOT });

    res.json({ success: true, staged: files });
  } catch (error: any) {
    logger.error('[Git] Stage error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/unstage', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array required' });
    }

    // SECURITY: Use centralized file validation
    const validation = validateFilePaths(files);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await ensureGitRepoOrInit();

    // SECURITY: Use '--' to separate options from file paths to prevent option injection
    await execa('git', ['reset', 'HEAD', '--', ...validation.validatedFiles], { cwd: PROJECT_ROOT });

    res.json({ success: true, unstaged: files });
  } catch (error: any) {
    logger.error('[Git] Unstage error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/commit', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Commit message required' });
    }

    await ensureGitRepoOrInit();

    const { stdout: statusCheck } = await execa('git', ['diff', '--cached', '--name-only'], { cwd: PROJECT_ROOT });
    if (!statusCheck.trim()) {
      return res.status(422).json({ error: 'No staged changes to commit' });
    }

    const { stdout } = await execa('git', ['commit', '-m', message], { cwd: PROJECT_ROOT });

    res.json({ success: true, output: stdout });
  } catch (error: any) {
    logger.error('[Git] Commit error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/push', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await ensureGitRepoOrInit();

    const { stdout: remoteCheck } = await execa('git', ['remote', 'get-url', 'origin'], { 
      cwd: PROJECT_ROOT, 
      reject: false 
    });
    if (!remoteCheck.trim()) {
      return res.status(422).json({ error: 'No remote repository configured' });
    }

    const credentials = await getGitCredentials(userId);
    const originalUrl = remoteCheck.trim();
    
    if (credentials) {
      const authenticatedUrl = await getAuthenticatedRemoteUrl(originalUrl, userId);
      await execa('git', ['remote', 'set-url', 'origin', authenticatedUrl], { cwd: PROJECT_ROOT });
      
      try {
        const { stdout, stderr } = await execa('git', ['push', '-u', 'origin', 'HEAD'], { 
          cwd: PROJECT_ROOT,
          timeout: 60000,
          reject: false
        });
        
        res.json({ success: true, output: stdout || stderr || 'Pushed successfully' });
      } finally {
        // Always restore original URL to prevent credential leakage
        await execa('git', ['remote', 'set-url', 'origin', originalUrl], { cwd: PROJECT_ROOT }).catch((error) => {
          logger.error('[Git] Failed to restore original remote URL after push:', error.message || error);
        });
      }
    } else {
      const { stdout, stderr } = await execa('git', ['push'], { 
        cwd: PROJECT_ROOT,
        timeout: 30000,
        reject: false
      });
      
      if (stderr?.includes('Authentication failed') || stderr?.includes('could not read Username')) {
        return res.status(401).json({ 
          error: 'Authentication required. Please connect your GitHub account in Settings.',
          requiresAuth: true
        });
      }
      
      res.json({ success: true, output: stdout || stderr });
    }
  } catch (error: any) {
    logger.error('[Git] Push error:', error);
    if (error.timedOut) {
      return res.status(500).json({ error: 'Git push timed out - check your network connection' });
    }
    if (error.stderr?.includes('Authentication failed')) {
      return res.status(401).json({ 
        error: 'Authentication failed. Please reconnect your GitHub account.',
        requiresAuth: true
      });
    }
    res.status(500).json({ error: error.message || error.stderr || 'Push failed' });
  }
});

router.post('/pull', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await ensureGitRepoOrInit();

    const { stdout: remoteCheck } = await execa('git', ['remote', 'get-url', 'origin'], { 
      cwd: PROJECT_ROOT, 
      reject: false 
    });
    if (!remoteCheck.trim()) {
      return res.status(422).json({ error: 'No remote repository configured' });
    }

    const credentials = await getGitCredentials(userId);
    const originalUrl = remoteCheck.trim();
    
    if (credentials) {
      const authenticatedUrl = await getAuthenticatedRemoteUrl(originalUrl, userId);
      await execa('git', ['remote', 'set-url', 'origin', authenticatedUrl], { cwd: PROJECT_ROOT });
      
      try {
        const { stdout, stderr } = await execa('git', ['pull', '--rebase=false'], { 
          cwd: PROJECT_ROOT,
          timeout: 60000,
          reject: false
        });
        
        res.json({ success: true, output: stdout || stderr || 'Pulled successfully' });
      } finally {
        // Always restore original URL to prevent credential leakage
        await execa('git', ['remote', 'set-url', 'origin', originalUrl], { cwd: PROJECT_ROOT }).catch((error) => {
          logger.error('[Git] Failed to restore original remote URL after pull:', error.message || error);
        });
      }
    } else {
      const { stdout, stderr } = await execa('git', ['pull'], { 
        cwd: PROJECT_ROOT,
        timeout: 30000,
        reject: false
      });
      
      if (stderr?.includes('Authentication failed') || stderr?.includes('could not read Username')) {
        return res.status(401).json({ 
          error: 'Authentication required. Please connect your GitHub account in Settings.',
          requiresAuth: true
        });
      }
      
      res.json({ success: true, output: stdout || stderr });
    }
  } catch (error: any) {
    logger.error('[Git] Pull error:', error);
    if (error.timedOut) {
      return res.status(500).json({ error: 'Git pull timed out - check your network connection' });
    }
    if (error.stderr?.includes('Authentication failed')) {
      return res.status(401).json({ 
        error: 'Authentication failed. Please reconnect your GitHub account.',
        requiresAuth: true
      });
    }
    res.status(500).json({ error: error.message || 'Pull failed' });
  }
});

router.post('/fetch', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await ensureGitRepoOrInit();

    const { stdout: remoteCheck } = await execa('git', ['remote', 'get-url', 'origin'], { 
      cwd: PROJECT_ROOT, 
      reject: false 
    });
    if (!remoteCheck.trim()) {
      return res.status(422).json({ error: 'No remote repository configured' });
    }

    const credentials = await getGitCredentials(userId);
    const originalUrl = remoteCheck.trim();
    
    if (credentials) {
      const authenticatedUrl = await getAuthenticatedRemoteUrl(originalUrl, userId);
      await execa('git', ['remote', 'set-url', 'origin', authenticatedUrl], { cwd: PROJECT_ROOT });
      
      try {
        const { stdout, stderr } = await execa('git', ['fetch', '--all', '--prune'], { 
          cwd: PROJECT_ROOT,
          timeout: 60000,
          reject: false
        });
        
        res.json({ success: true, output: stdout || stderr || 'Fetched successfully' });
      } finally {
        // Always restore original URL to prevent credential leakage
        await execa('git', ['remote', 'set-url', 'origin', originalUrl], { cwd: PROJECT_ROOT }).catch((error) => {
          logger.error('[Git] Failed to restore original remote URL after fetch:', error.message || error);
        });
      }
    } else {
      const { stdout, stderr } = await execa('git', ['fetch', '--all', '--prune'], { 
        cwd: PROJECT_ROOT,
        timeout: 30000,
        reject: false
      });
      
      if (stderr?.includes('Authentication failed') || stderr?.includes('could not read Username')) {
        return res.status(401).json({ 
          error: 'Authentication required. Please connect your GitHub account in Settings.',
          requiresAuth: true
        });
      }
      
      res.json({ success: true, output: stdout || stderr || 'Fetched successfully' });
    }
  } catch (error: any) {
    logger.error('[Git] Fetch error:', error);
    if (error.timedOut) {
      return res.status(500).json({ error: 'Git fetch timed out - check your network connection' });
    }
    res.status(500).json({ error: error.message || 'Fetch failed' });
  }
});

router.get('/github/status', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ connected: false });
    }
    
    const status = await githubOAuth.getConnectionStatus(userId);
    res.json(status);
  } catch (error: any) {
    logger.error('[Git] GitHub status error:', error);
    res.json({ connected: false });
  }
});

router.get('/github/connect', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!githubOAuth.isConfigured()) {
      return res.status(501).json({ error: 'GitHub OAuth not configured' });
    }
    
    const authUrl = githubOAuth.getAuthorizationUrl('git_connect');
    res.json({ authUrl });
  } catch (error: any) {
    logger.error('[Git] GitHub connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GitHub connect URL' });
  }
});

router.post('/github/disconnect', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    await githubOAuth.disconnectUser(userId);
    res.json({ success: true, message: 'GitHub disconnected successfully' });
  } catch (error: any) {
    logger.error('[Git] GitHub disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect GitHub' });
  }
});

interface GitBranchInfo {
  name: string;
  current: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  ahead: number;
  behind: number;
  isRemote: boolean;
  trackingBranch?: string;
}

async function parseBranchInfo(branchLine: string, currentBranch: string): Promise<GitBranchInfo | null> {
  try {
    const isCurrent = branchLine.startsWith('*');
    const rawName = branchLine.replace(/^\*?\s+/, '').trim();
    
    if (!rawName || rawName.startsWith('(HEAD detached')) {
      return null;
    }
    
    const isRemote = rawName.startsWith('remotes/');
    const name = isRemote ? rawName.replace('remotes/', '') : rawName;
    
    const logResult = await execa('git', ['log', '-1', '--format=%H|%s|%an|%aI', name], { 
      cwd: PROJECT_ROOT,
      reject: false
    });
    
    const [hash = '', message = '', author = '', dateStr = ''] = (logResult.stdout || '').split('|');
    
    let ahead = 0, behind = 0;
    try {
      const countResult = await execa('git', ['rev-list', '--left-right', '--count', `${name}...origin/${name}`], {
        cwd: PROJECT_ROOT,
        reject: false
      });
      if (countResult.stdout) {
        const parts = countResult.stdout.split('\t');
        ahead = parseInt(parts[0], 10) || 0;
        behind = parseInt(parts[1], 10) || 0;
      }
    } catch (err: any) { console.error("[catch]", err?.message || err);
    }
    
    return {
      name,
      current: name === currentBranch,
      lastCommit: {
        hash: hash.substring(0, 7),
        message,
        author,
        date: dateStr
      },
      ahead,
      behind,
      isRemote,
      trackingBranch: isRemote ? undefined : `origin/${name}`
    };
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return null;
  }
}

router.get('/branches', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    await ensureGitRepoOrInit();

    const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: PROJECT_ROOT });
    
    const { stdout: branchOutput } = await execa('git', ['branch', '-a'], { cwd: PROJECT_ROOT });
    
    const branchLines = branchOutput.split('\n').filter(Boolean);
    
    const CONCURRENCY_LIMIT = 10;
    const results: GitBranchInfo[] = [];
    
    for (let i = 0; i < branchLines.length; i += CONCURRENCY_LIMIT) {
      const batch = branchLines.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(line => parseBranchInfo(line, currentBranch.trim()))
      );
      results.push(...batchResults.filter((info): info is GitBranchInfo => info !== null));
    }
    
    res.json({ branches: results });
  } catch (error: any) {
    console.error('[Git] Branches error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/branches', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { name, startPoint } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid branch name' });
    }
    
    await ensureGitRepoOrInit();
    
    const args = ['checkout', '-b', name];
    if (startPoint) {
      args.push(startPoint);
    }
    
    await execa('git', args, { cwd: PROJECT_ROOT });
    
    res.json({ success: true, branch: name });
  } catch (error: any) {
    logger.error('[Git] Create branch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/branches/{*name}', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { force } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    await ensureGitRepoOrInit();
    
    const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: PROJECT_ROOT });
    if (name === currentBranch.trim()) {
      return res.status(400).json({ error: 'Cannot delete current branch' });
    }
    
    const args = ['branch', force === 'true' ? '-D' : '-d', name];
    await execa('git', args, { cwd: PROJECT_ROOT });
    
    res.json({ success: true, deleted: name });
  } catch (error: any) {
    logger.error('[Git] Delete branch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/checkout', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { branch } = req.body;
    
    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    await ensureGitRepoOrInit();
    
    await execa('git', ['checkout', branch], { cwd: PROJECT_ROOT });
    
    res.json({ success: true, branch });
  } catch (error: any) {
    logger.error('[Git] Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/merge', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { branch, message } = req.body;
    
    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    await ensureGitRepoOrInit();
    
    const args = ['merge', branch];
    if (message) {
      args.push('-m', message);
    }
    
    const { stdout } = await execa('git', args, { cwd: PROJECT_ROOT });
    
    res.json({ success: true, output: stdout });
  } catch (error: any) {
    logger.error('[Git] Merge error:', error);
    if (error.message?.includes('CONFLICT')) {
      return res.status(409).json({ 
        error: 'Merge conflict', 
        conflicts: error.stdout?.match(/CONFLICT.*/g) || [],
        output: error.stdout 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/log', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { limit = '100', branch, stream } = req.query;
    
    await ensureGitRepoOrInit();

    const limitNum = Math.min(parseInt(limit as string, 10) || 100, 1000);
    const args = ['log', '--format=%H|%s|%an|%aI', `-n`, `${limitNum}`];
    if (branch && typeof branch === 'string') {
      args.push(branch);
    }
    
    if (stream === 'true') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
      
      const rl = createInterface({
        input: gitProcess.stdout,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line) continue;
        const [hash, message, author, date] = line.split('|');
        const commit = {
          hash,
          shortHash: hash?.substring(0, 7) || '',
          message: message || '',
          author: author || '',
          date: date || ''
        };
        res.write(JSON.stringify(commit) + '\n');
      }

      let stderrOutput = '';
      gitProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      await new Promise<void>((resolve, reject) => {
        gitProcess.on('close', (code) => {
          if (code !== 0 && stderrOutput) {
            res.write(JSON.stringify({ error: stderrOutput }) + '\n');
          }
          res.end();
          resolve();
        });
        gitProcess.on('error', reject);
      });
    } else {
      const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
      const commits: { hash: string; shortHash: string; message: string; author: string; date: string }[] = [];
      
      const rl = createInterface({
        input: gitProcess.stdout,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line) continue;
        const [hash, message, author, date] = line.split('|');
        commits.push({
          hash: hash || '',
          shortHash: hash?.substring(0, 7) || '',
          message: message || '',
          author: author || '',
          date: date || ''
        });
      }

      await new Promise<void>((resolve, reject) => {
        gitProcess.on('close', resolve);
        gitProcess.on('error', reject);
      });

      res.json({ commits });
    }
  } catch (error: any) {
    logger.error('[Git] Log error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/log/stream', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { limit = '100', branch } = req.query;
    
    await ensureGitRepoOrInit();

    const limitNum = Math.min(parseInt(limit as string, 10) || 100, 1000);
    const args = ['log', '--format=%H|%s|%an|%aI', `-n`, `${limitNum}`];
    if (branch && typeof branch === 'string') {
      args.push(branch);
    }

    // Set SSE headers with CORS security - reject invalid origins with 403
    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }
    
    const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
    
    const rl = createInterface({
      input: gitProcess.stdout,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line) continue;
      const [hash, message, author, date] = line.split('|');
      const commit = {
        hash,
        shortHash: hash?.substring(0, 7) || '',
        message: message || '',
        author: author || '',
        date: date || ''
      };
      res.write(`data: ${JSON.stringify(commit)}\n\n`);
    }

    gitProcess.stderr.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ error: data.toString() })}\n\n`);
    });

    await new Promise<void>((resolve) => {
      gitProcess.on('close', () => {
        res.write('data: [DONE]\n\n');
        res.end();
        resolve();
      });
    });
  } catch (error: any) {
    logger.error('[Git] Log stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/diff/stream/{*filePath}', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.params;
    const { staged } = req.query;

    // SECURITY: Validate file path
    const validation = validateFilePath(filePath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await ensureGitRepoOrInit();

    const args = staged === 'true' 
      ? ['diff', '--cached', '--', filePath]
      : ['diff', '--', filePath];

    // Set SSE headers with CORS security - reject invalid origins with 403
    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }
    
    const gitProcess = spawn('git', args, { cwd: PROJECT_ROOT });
    
    const rl = createInterface({
      input: gitProcess.stdout,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    const MAX_LINES = 10000;

    for await (const line of rl) {
      lineCount++;
      if (lineCount > MAX_LINES) {
        res.write(`data: ${JSON.stringify({ type: 'truncated', message: `Diff truncated at ${MAX_LINES} lines` })}\n\n`);
        gitProcess.kill();
        break;
      }
      res.write(`data: ${JSON.stringify({ type: 'line', content: line })}\n\n`);
    }

    gitProcess.stderr.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ type: 'error', content: data.toString() })}\n\n`);
    });

    await new Promise<void>((resolve) => {
      gitProcess.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'done', exitCode: code })}\n\n`);
        res.end();
        resolve();
      });
    });
  } catch (error: any) {
    logger.error('[Git] Diff stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/remotes', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    await ensureGitRepoOrInit();
    
    const { stdout } = await execa('git', ['remote', '-v'], { cwd: PROJECT_ROOT });
    
    const remotes: { name: string; url: string; type: 'fetch' | 'push' }[] = [];
    stdout.split('\n').filter(Boolean).forEach(line => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (match) {
        remotes.push({
          name: match[1],
          url: match[2],
          type: match[3] as 'fetch' | 'push'
        });
      }
    });
    
    res.json({ remotes });
  } catch (error: any) {
    logger.error('[Git] Remotes error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/remotes', ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { name, url } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'Remote name and URL required' });
    }
    
    await ensureGitRepoOrInit();
    
    await execa('git', ['remote', 'add', name, url], { cwd: PROJECT_ROOT });
    
    res.json({ success: true, remote: { name, url } });
  } catch (error: any) {
    logger.error('[Git] Add remote error:', error);
    res.status(500).json({ error: error.message });
  }
});

interface BlameEntry {
  line: number;
  commit: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  };
}

router.get('/blame/{*filePath}', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.params;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    // SECURITY: Validate file path
    const validation = validateFilePath(filePath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    await ensureGitRepoOrInit();
    
    const fullPath = path.join(PROJECT_ROOT, filePath);
    
    const { stdout } = await execa('git', ['blame', '--porcelain', filePath], { 
      cwd: PROJECT_ROOT,
      reject: false 
    });
    
    if (!stdout) {
      return res.json({ blame: [] });
    }
    
    const lines = stdout.split('\n');
    const blameData: BlameEntry[] = [];
    let currentCommit: any = {};
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (/^[0-9a-f]{40}/.test(line)) {
        const parts = line.split(' ');
        currentCommit = {
          hash: parts[0],
          shortHash: parts[0].substring(0, 7)
        };
        lineNumber = parseInt(parts[2], 10);
      } else if (line.startsWith('author ')) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12), 10);
        currentCommit.date = new Date(timestamp * 1000).toISOString();
      } else if (line.startsWith('summary ')) {
        currentCommit.message = line.substring(8);
      } else if (line.startsWith('\t')) {
        if (currentCommit.hash && lineNumber > 0) {
          blameData.push({
            line: lineNumber,
            commit: {
              hash: currentCommit.hash,
              shortHash: currentCommit.shortHash,
              message: currentCommit.message || '',
              author: currentCommit.author || 'Unknown',
              date: currentCommit.date || new Date().toISOString()
            }
          });
        }
        currentCommit = {};
      }
    }
    
    res.json({ blame: blameData });
  } catch (error: any) {
    logger.error('[Git] Blame error:', error);
    res.status(500).json({ error: error.message });
  }
});

export const GitRouter = router;
