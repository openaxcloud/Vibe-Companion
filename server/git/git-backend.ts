import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  lastCommit: string;
}

export interface GitRemote {
  name: string;
  url: string;
}

export class GitBackend {
  private reposDir: string;

  constructor() {
    this.reposDir = path.join(process.cwd(), 'git-repos');
  }

  async init() {
    await fs.mkdir(this.reposDir, { recursive: true });
  }

  async initializeRepo(projectId: number): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    await fs.mkdir(repoPath, { recursive: true });
    
    await this.execGit(repoPath, 'init');
    await this.execGit(repoPath, 'config user.name "E-Code Platform"');
    await this.execGit(repoPath, 'config user.email "git@e-code.ai"');
    
    // Create initial commit
    const readmePath = path.join(repoPath, 'README.md');
    await fs.writeFile(readmePath, `# Project ${projectId}\n\nCreated with E-Code Platform`);
    await this.execGit(repoPath, 'add README.md');
    await this.execGit(repoPath, 'commit -m "Initial commit"');
  }

  async cloneRepository(projectId: number, repoUrl: string, token?: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    
    // Add token to URL if provided
    let cloneUrl = repoUrl;
    if (token && repoUrl.includes('github.com')) {
      cloneUrl = repoUrl.replace('https://', `https://${token}@`);
    }
    
    await execAsync(`git clone ${cloneUrl} ${repoPath}`);
    
    // Configure user
    await this.execGit(repoPath, 'config user.name "E-Code Platform"');
    await this.execGit(repoPath, 'config user.email "git@e-code.ai"');
  }

  async getCommitHistory(projectId: number, limit: number = 50): Promise<GitCommit[]> {
    const repoPath = this.getRepoPath(projectId);
    
    const format = '%H|%an|%ae|%ad|%s';
    const { stdout } = await this.execGit(
      repoPath, 
      `log --format="${format}" --date=iso -n ${limit}`
    );
    
    const commits: GitCommit[] = [];
    const lines = stdout.trim().split('\n').filter(line => line);
    
    for (const line of lines) {
      const [hash, author, email, date, message] = line.split('|');
      
      // Get files changed in commit
      const { stdout: filesOutput } = await this.execGit(
        repoPath,
        `diff-tree --no-commit-id --name-only -r ${hash}`
      );
      
      const files = filesOutput.trim().split('\n').filter(f => f);
      
      commits.push({
        hash,
        author,
        email,
        date: new Date(date),
        message,
        files,
      });
    }
    
    return commits;
  }

  async getBranches(projectId: number): Promise<GitBranch[]> {
    const repoPath = this.getRepoPath(projectId);
    
    const { stdout } = await this.execGit(repoPath, 'branch -v');
    const lines = stdout.trim().split('\n').filter(line => line);
    
    const branches: GitBranch[] = [];
    
    for (const line of lines) {
      const current = line.startsWith('*');
      const parts = line.replace('*', '').trim().split(/\s+/);
      const name = parts[0];
      const lastCommit = parts[1];
      
      branches.push({
        name,
        current,
        lastCommit,
      });
    }
    
    return branches;
  }

  async createBranch(projectId: number, branchName: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    await this.execGit(repoPath, `checkout -b ${branchName}`);
  }

  async switchBranch(projectId: number, branchName: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    await this.execGit(repoPath, `checkout ${branchName}`);
  }

  async getStatus(projectId: number): Promise<{
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
  }> {
    const repoPath = this.getRepoPath(projectId);
    const { stdout } = await this.execGit(repoPath, 'status --porcelain');
    
    const status = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      untracked: [] as string[],
    };
    
    const lines = stdout.trim().split('\n').filter(line => line);
    
    for (const line of lines) {
      const statusCode = line.substring(0, 2);
      const filename = line.substring(3);
      
      if (statusCode === ' M' || statusCode === 'M ') {
        status.modified.push(filename);
      } else if (statusCode === 'A ' || statusCode === 'AM') {
        status.added.push(filename);
      } else if (statusCode === ' D' || statusCode === 'D ') {
        status.deleted.push(filename);
      } else if (statusCode === '??') {
        status.untracked.push(filename);
      }
    }
    
    return status;
  }

  async stageFiles(projectId: number, files: string[]): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    
    for (const file of files) {
      await this.execGit(repoPath, `add "${file}"`);
    }
  }

  async unstageFiles(projectId: number, files: string[]): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    
    for (const file of files) {
      await this.execGit(repoPath, `reset HEAD "${file}"`);
    }
  }

  async commit(projectId: number, message: string, author?: { name: string; email: string }): Promise<string> {
    const repoPath = this.getRepoPath(projectId);
    
    if (author) {
      await this.execGit(repoPath, `config user.name "${author.name}"`);
      await this.execGit(repoPath, `config user.email "${author.email}"`);
    }
    
    const { stdout } = await this.execGit(repoPath, `commit -m "${message}"`);
    
    // Extract commit hash
    const match = stdout.match(/\[[\w\s]+\s+([a-f0-9]+)\]/);
    return match ? match[1] : '';
  }

  async push(projectId: number, remote: string = 'origin', branch?: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    const pushCmd = branch ? `push ${remote} ${branch}` : `push ${remote}`;
    await this.execGit(repoPath, pushCmd);
  }

  async pull(projectId: number, remote: string = 'origin', branch?: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    const pullCmd = branch ? `pull ${remote} ${branch}` : `pull ${remote}`;
    await this.execGit(repoPath, pullCmd);
  }

  async addRemote(projectId: number, name: string, url: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    await this.execGit(repoPath, `remote add ${name} ${url}`);
  }

  async getRemotes(projectId: number): Promise<GitRemote[]> {
    const repoPath = this.getRepoPath(projectId);
    const { stdout } = await this.execGit(repoPath, 'remote -v');
    
    const remotes: GitRemote[] = [];
    const lines = stdout.trim().split('\n').filter(line => line);
    const seen = new Set<string>();
    
    for (const line of lines) {
      const [name, url] = line.split(/\s+/);
      const key = `${name}:${url}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        remotes.push({ name, url });
      }
    }
    
    return remotes;
  }

  async getDiff(projectId: number, file?: string): Promise<string> {
    const repoPath = this.getRepoPath(projectId);
    const diffCmd = file ? `diff "${file}"` : 'diff';
    const { stdout } = await this.execGit(repoPath, diffCmd);
    return stdout;
  }

  async getFileDiff(projectId: number, file: string, commitHash?: string): Promise<string> {
    const repoPath = this.getRepoPath(projectId);
    const diffCmd = commitHash 
      ? `show ${commitHash}:"${file}"`
      : `diff HEAD "${file}"`;
    const { stdout } = await this.execGit(repoPath, diffCmd);
    return stdout;
  }

  async revertFile(projectId: number, file: string): Promise<void> {
    const repoPath = this.getRepoPath(projectId);
    await this.execGit(repoPath, `checkout -- "${file}"`);
  }

  async syncProjectFiles(projectId: number): Promise<void> {
    // Sync files between project directory and git repository
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const projectDir = path.join(process.cwd(), 'projects', String(projectId));
    const repoPath = this.getRepoPath(projectId);
    
    // Copy files from project to repo (excluding .git)
    await this.copyDirectory(projectDir, repoPath, ['.git']);
  }

  private async copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, exclude);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private getRepoPath(projectId: number): string {
    return path.join(this.reposDir, String(projectId));
  }

  private async execGit(repoPath: string, command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(`git ${command}`, { cwd: repoPath });
      return result;
    } catch (error: any) {
      // Check for common Git errors
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('index.lock')) {
        throw new Error('Git repository is locked. Please try again in a moment or remove the .git/index.lock file.');
      }
      
      if (errorMessage.includes('not a git repository')) {
        throw new Error('This directory is not a Git repository. Please initialize Git first.');
      }
      
      if (errorMessage.includes('merge conflict')) {
        throw new Error('There are merge conflicts that need to be resolved.');
      }
      
      if (errorMessage.includes('Permission denied')) {
        throw new Error('Permission denied. Check your Git credentials and repository access.');
      }
      
      // Generic error with more context
      throw new Error(`Git command failed (${command}): ${errorMessage}`);
    }
  }
}

export const gitBackend = new GitBackend();