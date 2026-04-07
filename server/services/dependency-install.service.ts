import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('DependencyInstallService');

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface InstallOptions {
  packageManager?: PackageManager;
  timeout?: number;
  frozen?: boolean;
  silent?: boolean;
  production?: boolean;
  cwd?: string;
  ignoreScripts?: boolean;
}

export interface InstallResult {
  success: boolean;
  durationMs: number;
  packagesInstalled: string[];
  stdout: string;
  stderr: string;
  error?: string;
}

export interface InstallProgressEvent {
  type: 'start' | 'stdout' | 'stderr' | 'complete' | 'error' | 'timeout';
  projectPath: string;
  packageManager: PackageManager;
  data?: string;
  result?: InstallResult;
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export class DependencyInstallService extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private readonly MAX_OUTPUT_SIZE = 2 * 1024 * 1024; // 2MB

  constructor() {
    super();
  }

  async detectPackageManager(projectPath: string): Promise<PackageManager> {
    const resolvedPath = path.resolve(projectPath);

    const lockFiles: { file: string; manager: PackageManager }[] = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' },
    ];

    for (const { file, manager } of lockFiles) {
      const lockPath = path.join(resolvedPath, file);
      if (fs.existsSync(lockPath)) {
        logger.info(`Detected package manager from lockfile`, { manager, lockFile: file });
        return manager;
      }
    }

    logger.info('No lockfile found, defaulting to npm');
    return 'npm';
  }

  async installDependencies(
    projectPath: string,
    options: InstallOptions = {}
  ): Promise<InstallResult> {
    const startTime = Date.now();
    const resolvedPath = path.resolve(options.cwd || projectPath);
    
    const packageJsonPath = path.join(resolvedPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const error = `package.json not found at ${packageJsonPath}`;
      logger.error(error);
      return {
        success: false,
        durationMs: Date.now() - startTime,
        packagesInstalled: [],
        stdout: '',
        stderr: '',
        error,
      };
    }

    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch (err: any) {
      const error = `Failed to parse package.json: ${err.message}`;
      logger.error(error);
      return {
        success: false,
        durationMs: Date.now() - startTime,
        packagesInstalled: [],
        stdout: '',
        stderr: '',
        error,
      };
    }

    const packageManager = options.packageManager || (await this.detectPackageManager(resolvedPath));
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    const { command, args } = this.buildInstallCommand(packageManager, options);

    logger.info('Starting dependency installation', {
      projectPath: resolvedPath,
      packageManager,
      command: `${command} ${args.join(' ')}`,
      timeout,
    });

    this.emitProgress({
      type: 'start',
      projectPath: resolvedPath,
      packageManager,
      data: `Running ${command} ${args.join(' ')}`,
    });

    const result = await this.runInstallProcess(
      resolvedPath,
      command,
      args,
      timeout,
      packageManager
    );

    const packagesInstalled = this.extractInstalledPackages(packageJson);

    const finalResult: InstallResult = {
      success: result.success,
      durationMs: Date.now() - startTime,
      packagesInstalled: result.success ? packagesInstalled : [],
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    };

    this.emitProgress({
      type: result.success ? 'complete' : 'error',
      projectPath: resolvedPath,
      packageManager,
      result: finalResult,
    });

    if (result.success) {
      logger.info('Dependency installation completed', {
        projectPath: resolvedPath,
        durationMs: finalResult.durationMs,
        packagesCount: packagesInstalled.length,
      });
    } else {
      logger.error('Dependency installation failed', {
        projectPath: resolvedPath,
        error: result.error,
      });
    }

    return finalResult;
  }

  private buildInstallCommand(
    packageManager: PackageManager,
    options: InstallOptions
  ): { command: string; args: string[] } {
    const args: string[] = [];

    switch (packageManager) {
      case 'npm':
        if (options.frozen) {
          args.push('ci');
        } else {
          args.push('install');
        }
        if (options.silent) args.push('--silent');
        if (options.production) args.push('--production');
        if (options.ignoreScripts) args.push('--ignore-scripts');
        args.push('--no-fund', '--no-audit');
        return { command: 'npm', args };

      case 'yarn':
        if (options.frozen) {
          args.push('--frozen-lockfile');
        }
        if (options.silent) args.push('--silent');
        if (options.production) args.push('--production');
        return { command: 'yarn', args };

      case 'pnpm':
        args.push('install');
        if (options.frozen) args.push('--frozen-lockfile');
        if (options.silent) args.push('--silent');
        if (options.production) args.push('--prod');
        return { command: 'pnpm', args };

      default:
        return { command: 'npm', args: ['install'] };
    }
  }

  private async runInstallProcess(
    cwd: string,
    command: string,
    args: string[],
    timeout: number,
    packageManager: PackageManager
  ): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      let killed = false;

      const child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          CI: 'true',
          npm_config_yes: 'true',
          FORCE_COLOR: '0',
        },
        shell: process.platform === 'win32',
        windowsHide: true,
      });

      const processId = `${cwd}-${Date.now()}`;
      this.activeProcesses.set(processId, child);

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);

        this.emitProgress({
          type: 'timeout',
          projectPath: cwd,
          packageManager,
          data: `Installation timed out after ${timeout}ms`,
        });
      }, timeout);

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (outputSize + chunk.length <= this.MAX_OUTPUT_SIZE) {
          stdout += chunk;
          outputSize += chunk.length;
        }

        this.emitProgress({
          type: 'stdout',
          projectPath: cwd,
          packageManager,
          data: chunk,
        });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (outputSize + chunk.length <= this.MAX_OUTPUT_SIZE) {
          stderr += chunk;
          outputSize += chunk.length;
        }

        this.emitProgress({
          type: 'stderr',
          projectPath: cwd,
          packageManager,
          data: chunk,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(processId);
        
        resolve({
          success: false,
          stdout,
          stderr,
          error: `Failed to spawn process: ${err.message}`,
        });
      });

      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        this.activeProcesses.delete(processId);

        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr,
            error: `Installation timed out after ${timeout}ms`,
          });
          return;
        }

        if (signal) {
          resolve({
            success: false,
            stdout,
            stderr,
            error: `Process killed by signal: ${signal}`,
          });
          return;
        }

        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          resolve({
            success: false,
            stdout,
            stderr,
            error: `Process exited with code ${code}`,
          });
        }
      });
    });
  }

  private extractInstalledPackages(
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  ): string[] {
    const packages: string[] = [];

    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        packages.push(`${name}@${version}`);
      }
    }

    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        packages.push(`${name}@${version}`);
      }
    }

    return packages;
  }

  private emitProgress(event: InstallProgressEvent): void {
    this.emit('progress', event);
  }

  async killInstallation(projectPath: string): Promise<void> {
    const resolvedPath = path.resolve(projectPath);
    
    for (const [id, process] of this.activeProcesses) {
      if (id.startsWith(resolvedPath)) {
        process.kill('SIGTERM');
        
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        
        this.activeProcesses.delete(id);
        logger.info('Installation killed', { projectPath: resolvedPath });
      }
    }
  }

  async cleanup(): Promise<void> {
    for (const [id, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (err) {
        logger.debug('Error killing process during cleanup', { id });
      }
    }
    this.activeProcesses.clear();
  }
}

const dependencyInstallService = new DependencyInstallService();

export async function installDependencies(
  projectPath: string,
  options?: InstallOptions
): Promise<InstallResult> {
  return dependencyInstallService.installDependencies(projectPath, options);
}

export async function detectPackageManager(
  projectPath: string
): Promise<PackageManager> {
  return dependencyInstallService.detectPackageManager(projectPath);
}

export { dependencyInstallService };
