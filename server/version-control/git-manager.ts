import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { storage } from '../storage';

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: string[];
}

export class GitManager {
  private projectsPath: string;

  constructor() {
    this.projectsPath = path.join(process.cwd(), 'projects');
  }

  async initRepository(projectId: number): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      await this.execGit(['init'], projectPath);
      
      // Create default .gitignore
      const gitignoreContent = `
# Dependencies
node_modules/
*.lock
package-lock.json

# Build outputs
dist/
build/
out/
.next/

# Environment files
.env
.env.local
.env.*.local

# IDE files
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
.cache/
`;
      
      await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
      await this.execGit(['add', '.gitignore'], projectPath);
      await this.execGit(['commit', '-m', 'Initial commit'], projectPath);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize git repository:', error);
      return false;
    }
  }

  async getStatus(projectId: number): Promise<GitStatus> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      // Get current branch
      const branch = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
      
      // Get status
      const statusOutput = await this.execGit(['status', '--porcelain'], projectPath);
      const statusLines = statusOutput.split('\n').filter(line => line.trim());
      
      const status: GitStatus = {
        branch: branch.trim(),
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        ahead: 0,
        behind: 0
      };
      
      // Parse status lines
      statusLines.forEach(line => {
        const statusCode = line.substring(0, 2);
        const file = line.substring(3);
        
        if (statusCode === ' M' || statusCode === 'M ') {
          status.modified.push(file);
        } else if (statusCode === 'A ' || statusCode === 'AM') {
          status.added.push(file);
        } else if (statusCode === 'D ' || statusCode === ' D') {
          status.deleted.push(file);
        } else if (statusCode === '??') {
          status.untracked.push(file);
        }
      });
      
      // Get ahead/behind count
      try {
        const aheadBehind = await this.execGit(
          ['rev-list', '--left-right', '--count', 'HEAD...@{u}'],
          projectPath
        );
        const [ahead, behind] = aheadBehind.trim().split('\t').map(n => parseInt(n, 10));
        status.ahead = ahead || 0;
        status.behind = behind || 0;
      } catch {
        // No upstream branch
      }
      
      return status;
    } catch (error) {
      console.error('Failed to get git status:', error);
      throw error;
    }
  }

  async commit(projectId: number, message: string, files?: string[]): Promise<string> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      // Stage files
      if (files && files.length > 0) {
        await this.execGit(['add', ...files], projectPath);
      } else {
        await this.execGit(['add', '.'], projectPath);
      }
      
      // Commit
      await this.execGit(['commit', '-m', message], projectPath);
      
      // Get commit hash
      const hash = await this.execGit(['rev-parse', 'HEAD'], projectPath);
      return hash.trim();
    } catch (error) {
      console.error('Failed to commit:', error);
      throw error;
    }
  }

  async getCommits(projectId: number, limit = 50): Promise<GitCommit[]> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const format = '%H|%an|%ai|%s';
      const output = await this.execGit(
        ['log', `--pretty=format:${format}`, `-${limit}`],
        projectPath
      );
      
      const lines = output.split('\n').filter(line => line.trim());
      return lines.map(line => {
        const [hash, author, date, message] = line.split('|');
        return {
          hash,
          author,
          date: new Date(date),
          message
        };
      });
    } catch (error) {
      console.error('Failed to get commits:', error);
      return [];
    }
  }

  async getDiff(projectId: number, file?: string): Promise<GitDiff[]> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const args = ['diff', '--numstat'];
      if (file) {
        args.push('--', file);
      }
      
      const numstatOutput = await this.execGit(args, projectPath);
      const diffArgs = ['diff'];
      if (file) {
        diffArgs.push('--', file);
      }
      
      const diffOutput = await this.execGit(diffArgs, projectPath);
      
      // Parse numstat output
      const diffs: GitDiff[] = [];
      const numstatLines = numstatOutput.split('\n').filter(line => line.trim());
      
      for (const line of numstatLines) {
        const [additions, deletions, fileName] = line.split('\t');
        
        // Extract hunks for this file from the full diff
        const fileRegex = new RegExp(`diff --git a/${fileName} b/${fileName}[\\s\\S]*?(?=diff --git|$)`);
        const fileDiff = diffOutput.match(fileRegex)?.[0] || '';
        const hunkRegex = /@@[^@]+@@[\s\S]*?(?=@@|$)/g;
        const hunks = fileDiff.match(hunkRegex) || [];
        
        diffs.push({
          file: fileName,
          additions: parseInt(additions, 10) || 0,
          deletions: parseInt(deletions, 10) || 0,
          hunks
        });
      }
      
      return diffs;
    } catch (error) {
      console.error('Failed to get diff:', error);
      return [];
    }
  }

  async createBranch(projectId: number, branchName: string): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      await this.execGit(['checkout', '-b', branchName], projectPath);
      return true;
    } catch (error) {
      console.error('Failed to create branch:', error);
      return false;
    }
  }

  async switchBranch(projectId: number, branchName: string): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      await this.execGit(['checkout', branchName], projectPath);
      return true;
    } catch (error) {
      console.error('Failed to switch branch:', error);
      return false;
    }
  }

  async getBranches(projectId: number): Promise<string[]> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const output = await this.execGit(['branch'], projectPath);
      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\*?\s+/, ''));
    } catch (error) {
      console.error('Failed to get branches:', error);
      return [];
    }
  }

  async push(projectId: number, remote = 'origin', branch?: string): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const args = ['push', remote];
      if (branch) {
        args.push(branch);
      }
      
      await this.execGit(args, projectPath);
      return true;
    } catch (error) {
      console.error('Failed to push:', error);
      return false;
    }
  }

  async pull(projectId: number, remote = 'origin', branch?: string): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const args = ['pull', remote];
      if (branch) {
        args.push(branch);
      }
      
      await this.execGit(args, projectPath);
      return true;
    } catch (error) {
      console.error('Failed to pull:', error);
      return false;
    }
  }

  async addRemote(projectId: number, name: string, url: string): Promise<boolean> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      await this.execGit(['remote', 'add', name, url], projectPath);
      return true;
    } catch (error) {
      console.error('Failed to add remote:', error);
      return false;
    }
  }

  async getRemotes(projectId: number): Promise<Record<string, string>> {
    const projectPath = await this.getProjectPath(projectId);
    
    try {
      const output = await this.execGit(['remote', '-v'], projectPath);
      const remotes: Record<string, string> = {};
      
      output.split('\n').forEach(line => {
        const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
        if (match) {
          remotes[match[1]] = match[2];
        }
      });
      
      return remotes;
    } catch (error) {
      console.error('Failed to get remotes:', error);
      return {};
    }
  }

  private async getProjectPath(projectId: number): Promise<string> {
    await fs.mkdir(this.projectsPath, { recursive: true });
    return path.join(this.projectsPath, `project-${projectId}`);
  }

  private execGit(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('git', args, { cwd });
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('exit', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Git command failed with code ${code}`));
        }
      });
      
      process.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export const gitManager = new GitManager();