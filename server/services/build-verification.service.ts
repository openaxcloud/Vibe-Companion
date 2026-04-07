import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('BuildVerificationService');

export interface BuildOptions {
  timeout?: number;
  buildCommand?: string;
  env?: Record<string, string>;
}

export interface BuildResult {
  success: boolean;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
  artifactsDir?: string;
}

export interface BuildEvent {
  type: 'start' | 'stdout' | 'stderr' | 'complete' | 'error' | 'timeout';
  timestamp: Date;
  data?: string;
  result?: BuildResult;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

type FrameworkType = 'nextjs' | 'vite' | 'react-cra' | 'express' | 'typescript' | 'python' | 'unknown';

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const MAX_OUTPUT_SIZE = 5 * 1024 * 1024; // 5MB

export class BuildVerificationService extends EventEmitter {
  private activeProcess: ChildProcess | null = null;

  constructor() {
    super();
  }

  async verifyBuild(projectPath: string, options: BuildOptions = {}): Promise<BuildResult> {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    
    let buildCommand: string;
    try {
      buildCommand = options.buildCommand || await detectBuildCommand(projectPath);
    } catch (err: any) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: `Failed to detect build command: ${err.message}`,
      };
    }

    logger.info('Starting build verification', { projectPath, buildCommand, timeout });

    this.emit('build', {
      type: 'start',
      timestamp: new Date(),
      data: `Running: ${buildCommand}`,
    } as BuildEvent);

    return new Promise<BuildResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let stdoutSize = 0;
      let stderrSize = 0;
      let timedOut = false;

      const [cmd, ...args] = this.parseCommand(buildCommand);
      
      const env = {
        ...process.env,
        ...options.env,
        CI: 'true',
        NODE_ENV: 'production',
      };

      const child = spawn(cmd, args, {
        cwd: projectPath,
        env: env as NodeJS.ProcessEnv,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcess = child;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        logger.warn('Build timed out', { projectPath, timeout });
        
        this.emit('build', {
          type: 'timeout',
          timestamp: new Date(),
          data: `Build timed out after ${timeout}ms`,
        } as BuildEvent);

        if (child.pid) {
          process.kill(-child.pid, 'SIGTERM');
          setTimeout(() => {
            try {
              process.kill(-child.pid!, 'SIGKILL');
            } catch {
              // Expected: process may have already exited after SIGTERM
            }
          }, 5000);
        }
      }, timeout);

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdoutSize < MAX_OUTPUT_SIZE) {
          stdout += chunk;
          stdoutSize += chunk.length;
        }
        
        this.emit('build', {
          type: 'stdout',
          timestamp: new Date(),
          data: chunk,
        } as BuildEvent);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stderrSize < MAX_OUTPUT_SIZE) {
          stderr += chunk;
          stderrSize += chunk.length;
        }
        
        this.emit('build', {
          type: 'stderr',
          timestamp: new Date(),
          data: chunk,
        } as BuildEvent);
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;
        
        const result: BuildResult = {
          success: false,
          durationMs: Date.now() - startTime,
          exitCode: -1,
          stdout,
          stderr,
          error: err.message,
        };

        logger.error('Build process error', { projectPath, error: err.message });
        
        this.emit('build', {
          type: 'error',
          timestamp: new Date(),
          data: err.message,
          result,
        } as BuildEvent);

        resolve(result);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;

        const exitCode = code ?? (signal ? -1 : 0);
        const success = exitCode === 0 && !timedOut;
        
        let artifactsDir: string | undefined;
        if (success) {
          artifactsDir = this.detectArtifactsDir(projectPath);
        }

        const result: BuildResult = {
          success,
          durationMs: Date.now() - startTime,
          exitCode,
          stdout,
          stderr,
          error: timedOut ? `Build timed out after ${timeout}ms` : (exitCode !== 0 ? `Build failed with exit code ${exitCode}` : undefined),
          artifactsDir,
        };

        logger.info('Build verification completed', { 
          projectPath, 
          success, 
          exitCode, 
          durationMs: result.durationMs,
          artifactsDir,
        });

        this.emit('build', {
          type: 'complete',
          timestamp: new Date(),
          result,
        } as BuildEvent);

        resolve(result);
      });
    });
  }

  cancelBuild(): boolean {
    if (this.activeProcess && this.activeProcess.pid) {
      try {
        process.kill(-this.activeProcess.pid, 'SIGTERM');
        logger.info('Build cancelled');
        return true;
      } catch (err: any) {
        logger.error('Failed to cancel build', { error: err.message });
        return false;
      }
    }
    return false;
  }

  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of command) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) {
      parts.push(current);
    }

    return parts.length > 0 ? parts : ['npm', 'run', 'build'];
  }

  private detectArtifactsDir(projectPath: string): string | undefined {
    const possibleDirs = ['.next', 'dist', 'build', 'out', '.output', 'public'];
    
    for (const dir of possibleDirs) {
      const fullPath = path.join(projectPath, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        const files = fs.readdirSync(fullPath);
        if (files.length > 0) {
          return dir;
        }
      }
    }
    
    return undefined;
  }
}

export async function detectBuildCommand(projectPath: string): Promise<string> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const requirementsPath = path.join(projectPath, 'requirements.txt');
  const setupPyPath = path.join(projectPath, 'setup.py');
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = packageJson.scripts || {};
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const framework = detectFramework(deps, scripts);
      logger.debug('Detected framework', { framework, projectPath });

      if (scripts.build) {
        return 'npm run build';
      }

      switch (framework) {
        case 'nextjs':
          return 'npx next build';
        case 'vite':
          return 'npx vite build';
        case 'react-cra':
          return 'npx react-scripts build';
        case 'typescript':
          return 'npx tsc';
        case 'express':
          if (deps.typescript || deps['@types/node']) {
            return 'npx tsc';
          }
          return 'echo "No build step required for Express"';
        default:
          if (scripts.compile) {
            return 'npm run compile';
          }
          return 'npm run build';
      }
    } catch (err: any) {
      logger.warn('Failed to parse package.json', { error: err.message });
      return 'npm run build';
    }
  }

  if (fs.existsSync(requirementsPath) || fs.existsSync(setupPyPath) || fs.existsSync(pyprojectPath)) {
    logger.debug('Detected Python project', { projectPath });
    
    if (fs.existsSync(setupPyPath)) {
      return 'pip install -e .';
    }
    if (fs.existsSync(pyprojectPath)) {
      return 'pip install -e .';
    }
    return 'echo "No build step required for Python"';
  }

  const cargoPath = path.join(projectPath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    return 'cargo build --release';
  }

  const goModPath = path.join(projectPath, 'go.mod');
  if (fs.existsSync(goModPath)) {
    return 'go build ./...';
  }

  logger.warn('Could not detect build command, using default', { projectPath });
  return 'npm run build';
}

function detectFramework(
  deps: Record<string, string>,
  scripts: Record<string, string>
): FrameworkType {
  if (deps.next) {
    return 'nextjs';
  }
  
  if (deps.vite || scripts.dev?.includes('vite') || scripts.build?.includes('vite')) {
    return 'vite';
  }
  
  if (deps['react-scripts']) {
    return 'react-cra';
  }
  
  if (deps.express) {
    return 'express';
  }
  
  if (deps.typescript) {
    return 'typescript';
  }

  return 'unknown';
}

export async function verifyBuild(projectPath: string, options?: BuildOptions): Promise<BuildResult> {
  const service = new BuildVerificationService();
  return service.verifyBuild(projectPath, options);
}

export const buildVerificationService = new BuildVerificationService();
