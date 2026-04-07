import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './vite';
import { storage } from './storage';
import { Project, File } from '@shared/schema';

// Interface for Git operations result
interface GitResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// Interface for Git repository status
interface RepoStatus {
  isRepo: boolean;
  branch?: string;
  changes?: {
    staged: Array<{
      path: string;
      status: string;
    }>;
    unstaged: Array<{
      path: string;
      status: string;
    }>;
    untracked: string[];
  };
  remotes?: string[];
}

// Create project workspace directory
async function getProjectWorkspace(projectId: number): Promise<string> {
  const workspaceDir = path.join(os.tmpdir(), `plot-workspace-${projectId}`);
  
  try {
    await fs.promises.mkdir(workspaceDir, { recursive: true });
    return workspaceDir;
  } catch (error) {
    log(`Error creating workspace directory: ${error}`, 'git');
    throw error;
  }
}

// Initialize project files in workspace
async function initializeWorkspace(projectId: number, workspaceDir: string): Promise<void> {
  try {
    // Get all project files
    const files = await storage.getFilesByProject(projectId);
    
    // Process folders first to create directory structure
    const folders = files.filter(file => file.isFolder);
    for (const folder of folders) {
      const folderPath = path.join(workspaceDir, folder.name);
      await fs.promises.mkdir(folderPath, { recursive: true });
    }
    
    // Process files
    const nonFolders = files.filter(file => !file.isFolder);
    for (const file of nonFolders) {
      const filePath = path.join(workspaceDir, file.name);
      await fs.promises.writeFile(filePath, file.content || '', 'utf8');
    }
  } catch (error) {
    log(`Error initializing workspace: ${error}`, 'git');
    throw error;
  }
}

// Execute Git command and return promise with result
async function execGit(
  workspaceDir: string, 
  args: string[], 
  options?: { env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ...options?.env,
      GIT_TERMINAL_PROMPT: '0', // Disable prompting
    };
    
    const gitProcess = spawn('git', args, { 
      cwd: workspaceDir, 
      env 
    });
    
    let stdout = '';
    let stderr = '';
    
    gitProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    gitProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    gitProcess.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
    
    gitProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Initialize a Git repository in the project workspace
export async function initRepo(projectId: number): Promise<GitResult> {
  try {
    // Get project
    const project = await storage.getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    
    // Get or create workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Initialize workspace with project files
    await initializeWorkspace(projectId, workspaceDir);
    
    // Check if already a git repository
    const isRepo = await isGitRepo(projectId);
    if (isRepo.success && isRepo.data) {
      return { success: false, error: 'Repository already initialized' };
    }
    
    // Initialize git repository
    const result = await execGit(workspaceDir, ['init']);
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git init failed: ${result.stderr}` 
      };
    }
    
    // Create initial commit
    await execGit(workspaceDir, ['add', '.']);
    await execGit(workspaceDir, [
      'commit', 
      '-m', 
      'Initial commit',
      '--author="PLOT <plot@replit.clone>"'
    ]);
    
    return { 
      success: true, 
      message: 'Git repository initialized successfully' 
    };
  } catch (error) {
    log(`Error initializing git repository: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Check if the project is a Git repository
export async function isGitRepo(projectId: number): Promise<GitResult> {
  try {
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Check if .git directory exists
    const gitDir = path.join(workspaceDir, '.git');
    const exists = await fs.promises.access(gitDir)
      .then(() => true)
      .catch(() => false);
    
    if (!exists) {
      return { success: true, data: false };
    }
    
    // Verify it's a valid git repo
    try {
      const result = await execGit(workspaceDir, ['rev-parse', '--is-inside-work-tree']);
      const isRepo = result.stdout.trim() === 'true';
      return { success: true, data: isRepo };
    } catch (error) {
      return { success: true, data: false };
    }
  } catch (error) {
    log(`Error checking if git repository: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Get repository status (current branch, changes, etc.)
export async function getRepoStatus(projectId: number): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success) {
      return isRepo;
    }
    
    if (!isRepo.data) {
      return { 
        success: true, 
        data: { isRepo: false } as RepoStatus 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Get current branch
    const branchResult = await execGit(workspaceDir, [
      'rev-parse', '--abbrev-ref', 'HEAD'
    ]);
    
    const branch = branchResult.stdout.trim();
    
    // Get status (staged, unstaged, untracked)
    const statusResult = await execGit(workspaceDir, [
      'status', '--porcelain=v2', '--branch'
    ]);
    
    // Parse status
    const lines = statusResult.stdout.trim().split('\\n');
    
    const staged: { path: string; status: string }[] = [];
    const unstaged: { path: string; status: string }[] = [];
    const untracked: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('# ') || line === '') continue;
      
      if (line.startsWith('?')) {
        // Untracked file
        const file = line.substring(2).trim();
        untracked.push(file);
      } else if (line.startsWith('1')) {
        // Changed file
        const parts = line.split(' ');
        const xy = parts[1]; // xy status
        const path = parts.slice(8).join(' ');
        
        if (xy[0] !== '.') {
          staged.push({ path, status: mapStatus(xy[0]) });
        }
        
        if (xy[1] !== '.') {
          unstaged.push({ path, status: mapStatus(xy[1]) });
        }
      }
    }
    
    // Get remotes
    const remotesResult = await execGit(workspaceDir, ['remote']);
    const remotes = remotesResult.stdout.trim().split('\\n').filter(r => r !== '');
    
    const status: RepoStatus = {
      isRepo: true,
      branch,
      changes: {
        staged,
        unstaged,
        untracked
      },
      remotes
    };
    
    return { success: true, data: status };
  } catch (error) {
    log(`Error getting repository status: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Add files to staging area
export async function addFiles(
  projectId: number, 
  files: string[]
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Add files
    const result = await execGit(workspaceDir, ['add', ...files]);
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git add failed: ${result.stderr}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Files added to staging area' 
    };
  } catch (error) {
    log(`Error adding files: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Commit changes
export async function commit(
  projectId: number, 
  message: string,
  author?: { name: string; email: string }
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Prepare commit command
    const args = ['commit', '-m', message];
    
    // Add author if provided
    if (author) {
      args.push(`--author="${author.name} <${author.email}>"`);
    }
    
    // Commit
    const result = await execGit(workspaceDir, args);
    
    if (result.code !== 0 && !result.stderr.includes('nothing to commit')) {
      return { 
        success: false, 
        error: `Git commit failed: ${result.stderr}` 
      };
    }
    
    if (result.stderr.includes('nothing to commit')) {
      return {
        success: false,
        error: 'Nothing to commit'
      };
    }
    
    return { 
      success: true, 
      message: 'Changes committed successfully' 
    };
  } catch (error) {
    log(`Error committing changes: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Add remote repository
export async function addRemote(
  projectId: number, 
  name: string, 
  url: string
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Add remote
    const result = await execGit(workspaceDir, ['remote', 'add', name, url]);
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git remote add failed: ${result.stderr}` 
      };
    }
    
    return { 
      success: true, 
      message: `Remote '${name}' added successfully` 
    };
  } catch (error) {
    log(`Error adding remote: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Push to remote repository
export async function push(
  projectId: number, 
  remote: string = 'origin', 
  branch: string = 'main',
  credentials?: { username: string; password: string }
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Prepare env with credentials if provided
    let env: NodeJS.ProcessEnv = {};
    if (credentials) {
      env.GIT_ASKPASS = 'echo';
      env.GIT_USERNAME = credentials.username;
      env.GIT_PASSWORD = credentials.password;
    }
    
    // Push
    const result = await execGit(workspaceDir, [
      'push', 
      '--set-upstream', 
      remote, 
      branch
    ], { env });
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git push failed: ${result.stderr}` 
      };
    }
    
    return { 
      success: true, 
      message: `Changes pushed to ${remote}/${branch}` 
    };
  } catch (error) {
    log(`Error pushing changes: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Pull from remote repository
export async function pull(
  projectId: number, 
  remote: string = 'origin', 
  branch: string = 'main',
  credentials?: { username: string; password: string }
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Prepare env with credentials if provided
    let env: NodeJS.ProcessEnv = {};
    if (credentials) {
      env.GIT_ASKPASS = 'echo';
      env.GIT_USERNAME = credentials.username;
      env.GIT_PASSWORD = credentials.password;
    }
    
    // Pull
    const result = await execGit(workspaceDir, [
      'pull', 
      remote, 
      branch
    ], { env });
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git pull failed: ${result.stderr}` 
      };
    }
    
    // Update project files from workspace
    await syncWorkspaceToProject(projectId, workspaceDir);
    
    return { 
      success: true, 
      message: `Changes pulled from ${remote}/${branch}` 
    };
  } catch (error) {
    log(`Error pulling changes: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Clone a repository into a project
export async function cloneRepo(
  projectId: number,
  url: string,
  credentials?: { username: string; password: string }
): Promise<GitResult> {
  try {
    // Get project
    const project = await storage.getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Clear workspace
    await fs.promises.rm(workspaceDir, { recursive: true, force: true });
    await fs.promises.mkdir(workspaceDir, { recursive: true });
    
    // Prepare URL with credentials if provided
    let cloneUrl = url;
    if (credentials && url.startsWith('https://')) {
      const urlObj = new URL(url);
      urlObj.username = credentials.username;
      urlObj.password = credentials.password;
      cloneUrl = urlObj.toString();
    }
    
    // Clone repository
    const result = await execGit(workspaceDir, ['clone', cloneUrl, '.']);
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git clone failed: ${result.stderr}` 
      };
    }
    
    // Update project files from cloned repo
    await syncWorkspaceToProject(projectId, workspaceDir);
    
    return { 
      success: true, 
      message: 'Repository cloned successfully' 
    };
  } catch (error) {
    log(`Error cloning repository: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}

// Sync workspace files to project
async function syncWorkspaceToProject(projectId: number, workspaceDir: string): Promise<void> {
  try {
    // Get existing project files
    const existingFiles = await storage.getFilesByProject(projectId);
    
    // Delete all existing files
    for (const file of existingFiles) {
      await storage.deleteFile(file.id);
    }
    
    // Read all files from workspace recursively
    const allPaths: string[] = [];
    
    const readDirRecursive = async (dir: string, baseDir: string = '') => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);
        
        if (entry.name === '.git') continue; // Skip .git directory
        
        if (entry.isDirectory()) {
          // Create folder in project
          await storage.createFile({
            name: relativePath,
            content: '',
            isFolder: true,
            projectId,
            parentId: null
          });
          
          // Recursively process subdirectories
          await readDirRecursive(fullPath, relativePath);
        } else {
          allPaths.push(relativePath);
        }
      }
    };
    
    await readDirRecursive(workspaceDir);
    
    // Create all files
    for (const filePath of allPaths) {
      const fullPath = path.join(workspaceDir, filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      
      await storage.createFile({
        name: filePath,
        content,
        isFolder: false,
        projectId,
        parentId: null
      });
    }
  } catch (error) {
    log(`Error syncing workspace to project: ${error}`, 'git');
    throw error;
  }
}

// Helper function to map git status codes
function mapStatus(code: string): string {
  const statusMap: Record<string, string> = {
    'M': 'modified',
    'A': 'added',
    'D': 'deleted',
    'R': 'renamed',
    'C': 'copied',
    'U': 'updated',
    '?': 'untracked'
  };
  
  return statusMap[code] || 'unknown';
}

// Get commit history
export async function getCommitHistory(
  projectId: number, 
  limit: number = 20
): Promise<GitResult> {
  try {
    // Check if repo
    const isRepo = await isGitRepo(projectId);
    if (!isRepo.success || !isRepo.data) {
      return { 
        success: false, 
        error: 'Not a git repository' 
      };
    }
    
    // Get workspace
    const workspaceDir = await getProjectWorkspace(projectId);
    
    // Get log
    const result = await execGit(workspaceDir, [
      'log', 
      '--pretty=format:%H|%an|%ae|%at|%s', 
      `-${limit}`
    ]);
    
    if (result.code !== 0) {
      return { 
        success: false, 
        error: `Git log failed: ${result.stderr}` 
      };
    }
    
    // Parse commits
    const commits = result.stdout.trim().split('\\n').map(line => {
      const [hash, author, email, timestamp, subject] = line.split('|');
      
      return {
        hash,
        author,
        email,
        date: new Date(parseInt(timestamp) * 1000),
        subject
      };
    });
    
    return { 
      success: true, 
      data: commits 
    };
  } catch (error) {
    log(`Error getting commit history: ${error}`, 'git');
    return { success: false, error: String(error) };
  }
}