// @ts-nocheck
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { storage } from './storage';

interface PackageInstallOptions {
  projectId: number;
  packages: string[];
  dev?: boolean;
  global?: boolean;
}

interface PackageInstallResult {
  success: boolean;
  output: string;
  error?: string;
  installedPackages?: string[];
}

export class PackageInstaller {
  private runningInstalls: Map<number, any> = new Map();

  async installPackages(options: PackageInstallOptions): Promise<PackageInstallResult> {
    const { projectId, packages, dev = false, global = false } = options;

    // Check if install is already running for this project
    if (this.runningInstalls.has(projectId)) {
      return {
        success: false,
        output: '',
        error: 'Installation already in progress'
      };
    }

    try {
      // Get project directory
      const projectDir = await this.getProjectDirectory(projectId);
      
      // Get project info to determine package manager
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Determine package manager based on project language
      let command: string;
      let args: string[] = [];
      
      switch (project.language) {
        case 'nodejs':
        case 'typescript':
          command = 'npm';
          args = ['install'];
          if (dev) args.push('--save-dev');
          if (global) args.push('-g');
          args.push(...packages);
          break;
          
        case 'python':
          command = 'pip';
          args = ['install'];
          if (global) args.push('--user');
          args.push(...packages);
          break;
          
        case 'ruby':
          command = 'gem';
          args = ['install'];
          args.push(...packages);
          break;
          
        case 'go':
          command = 'go';
          args = ['get'];
          args.push(...packages);
          break;
          
        case 'rust':
          command = 'cargo';
          args = ['add'];
          args.push(...packages);
          break;
          
        case 'php':
          command = 'composer';
          args = ['require'];
          if (dev) args.push('--dev');
          args.push(...packages);
          break;
          
        default:
          throw new Error(`Unsupported language for package installation: ${project.language}`);
      }

      // Run the installation
      const result = await this.runCommand(command, args, projectDir, projectId);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        installedPackages: result.exitCode === 0 ? packages : undefined
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.runningInstalls.delete(projectId);
    }
  }

  async uninstallPackages(projectId: number, packages: string[]): Promise<PackageInstallResult> {
    try {
      const projectDir = await this.getProjectDirectory(projectId);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }

      let command: string;
      let args: string[] = [];
      
      switch (project.language) {
        case 'nodejs':
        case 'typescript':
          command = 'npm';
          args = ['uninstall', ...packages];
          break;
          
        case 'python':
          command = 'pip';
          args = ['uninstall', '-y', ...packages];
          break;
          
        case 'ruby':
          command = 'gem';
          args = ['uninstall', ...packages];
          break;
          
        case 'rust':
          command = 'cargo';
          args = ['remove', ...packages];
          break;
          
        case 'php':
          command = 'composer';
          args = ['remove', ...packages];
          break;
          
        default:
          throw new Error(`Unsupported language for package uninstallation: ${project.language}`);
      }

      const result = await this.runCommand(command, args, projectDir, projectId);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.exitCode !== 0 ? result.stderr : undefined
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listPackages(projectId: number): Promise<any> {
    try {
      const projectDir = await this.getProjectDirectory(projectId);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }

      let packageFile: string;
      let content: string;
      
      switch (project.language) {
        case 'nodejs':
        case 'typescript':
          packageFile = path.join(projectDir, 'package.json');
          content = await fs.readFile(packageFile, 'utf-8');
          const packageJson = JSON.parse(content);
          return {
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {}
          };
          
        case 'python':
          packageFile = path.join(projectDir, 'requirements.txt');
          try {
            content = await fs.readFile(packageFile, 'utf-8');
            const packages = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            return { dependencies: packages };
          } catch {
            return { dependencies: [] };
          }
          
        case 'ruby':
          packageFile = path.join(projectDir, 'Gemfile');
          try {
            content = await fs.readFile(packageFile, 'utf-8');
            return { dependencies: content };
          } catch {
            return { dependencies: '' };
          }
          
        case 'rust':
          packageFile = path.join(projectDir, 'Cargo.toml');
          try {
            content = await fs.readFile(packageFile, 'utf-8');
            return { dependencies: content };
          } catch {
            return { dependencies: '' };
          }
          
        case 'php':
          packageFile = path.join(projectDir, 'composer.json');
          try {
            content = await fs.readFile(packageFile, 'utf-8');
            const composerJson = JSON.parse(content);
            return {
              dependencies: composerJson.require || {},
              devDependencies: composerJson['require-dev'] || {}
            };
          } catch {
            return { dependencies: {}, devDependencies: {} };
          }
          
        default:
          return { dependencies: {} };
      }
    } catch (error) {
      throw error;
    }
  }

  private async getProjectDirectory(projectId: number): Promise<string> {
    const baseDir = path.join(process.cwd(), 'projects');
    const projectDir = path.join(baseDir, `project-${projectId}`);
    
    // Ensure directory exists
    await fs.mkdir(projectDir, { recursive: true });
    
    return projectDir;
  }

  private async runCommand(
    command: string, 
    args: string[], 
    cwd: string,
    projectId: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      const process = spawn(command, args, { cwd, shell: true });
      
      let stdout = '';
      let stderr = '';
      
      this.runningInstalls.set(projectId, process);
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });
      
      process.on('error', (error) => {
        stderr += error.message;
        resolve({ stdout, stderr, exitCode: 1 });
      });
    });
  }
}

export const packageInstaller = new PackageInstaller();