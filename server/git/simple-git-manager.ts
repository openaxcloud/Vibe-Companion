import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('simple-git-manager');

export interface GitStatus {
  branch: string;
  changes: Array<{
    file: string;
    status: 'new' | 'modified' | 'deleted';
  }>;
  isClean: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export class SimpleGitManager {
  private async getProjectDir(projectId: string): Promise<string> {
    return path.join(process.cwd(), 'projects', projectId);
  }
  
  async initRepository(projectId: string): Promise<void> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      // Check if already a Git repository
      try {
        await execAsync(`cd ${projectDir} && git rev-parse --git-dir`);
        logger.info('Git repository already exists, skipping init');
        return;
      } catch {
        // Not a Git repo, continue with init
      }
      
      await execAsync(`cd ${projectDir} && git init`);
      await execAsync(`cd ${projectDir} && git config user.name "E-Code User"`);
      await execAsync(`cd ${projectDir} && git config user.email "user@e-code.ai"`);
      
      // Create initial commit
      await execAsync(`cd ${projectDir} && git add . || true`);
      await execAsync(`cd ${projectDir} && git commit -m "Initial commit" || true`);
      
      logger.info(`Git repository initialized for project ${projectId}`);
    } catch (error: any) {
      logger.error('Git init error:', error);
      throw new Error(`Failed to initialize Git repository: ${error.message}`);
    }
  }
  
  async getStatus(projectId: string): Promise<GitStatus> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      // Initialize git if not already initialized
      await this.initRepository(projectId);
      
      // Get current branch
      const { stdout: branch } = await execAsync(
        `cd ${projectDir} && git branch --show-current`
      );
      
      // Get status
      const { stdout: statusOutput } = await execAsync(
        `cd ${projectDir} && git status --porcelain`
      );
      
      const changes: GitStatus['changes'] = [];
      const lines = statusOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        if (status.includes('?')) {
          changes.push({ file, status: 'new' });
        } else if (status.includes('M')) {
          changes.push({ file, status: 'modified' });
        } else if (status.includes('D')) {
          changes.push({ file, status: 'deleted' });
        }
      }
      
      return {
        branch: branch.trim() || 'main',
        changes,
        isClean: changes.length === 0
      };
    } catch (error) {
      logger.error('Git status error:', error);
      return {
        branch: 'main',
        changes: [],
        isClean: true
      };
    }
  }
  
  async commit(projectId: string, message: string): Promise<string> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      // Add all changes
      await execAsync(`cd ${projectDir} && git add .`);
      
      // Commit
      const { stdout } = await execAsync(
        `cd ${projectDir} && git commit -m "${message.replace(/"/g, '\\"')}"`
      );
      
      // Get commit hash
      const { stdout: hash } = await execAsync(
        `cd ${projectDir} && git rev-parse HEAD`
      );
      
      return hash.trim();
    } catch (error) {
      logger.error('Git commit error:', error);
      throw new Error('Failed to commit changes');
    }
  }
  
  async getHistory(projectId: string, limit: number = 10): Promise<GitCommit[]> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      const { stdout } = await execAsync(
        `cd ${projectDir} && git log --pretty=format:"%H|%an|%ad|%s" --date=iso -n ${limit}`
      );
      
      const commits: GitCommit[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const [hash, author, date, message] = line.split('|');
        commits.push({ hash, author, date, message });
      }
      
      return commits;
    } catch (error) {
      logger.error('Git history error:', error);
      return [];
    }
  }
  
  async getBranches(projectId: string): Promise<string[]> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      const { stdout } = await execAsync(
        `cd ${projectDir} && git branch -a`
      );
      
      return stdout
        .split('\n')
        .map(branch => branch.trim().replace('* ', ''))
        .filter(branch => branch);
    } catch (error) {
      logger.error('Git branches error:', error);
      return ['main'];
    }
  }
  
  async createBranch(projectId: string, branchName: string): Promise<void> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      await execAsync(
        `cd ${projectDir} && git checkout -b ${branchName}`
      );
    } catch (error) {
      logger.error('Git create branch error:', error);
      throw new Error('Failed to create branch');
    }
  }
  
  async switchBranch(projectId: string, branchName: string): Promise<void> {
    const projectDir = await this.getProjectDir(projectId);
    
    try {
      await execAsync(
        `cd ${projectDir} && git checkout ${branchName}`
      );
    } catch (error) {
      logger.error('Git switch branch error:', error);
      throw new Error('Failed to switch branch');
    }
  }
}

export const simpleGitManager = new SimpleGitManager();