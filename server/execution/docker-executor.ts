import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionOptions, ExecutionResult } from './executor';

interface DockerImage {
  language: string;
  image: string;
  workDir: string;
  buildCmd?: string;
  runCmd: string;
}

export class DockerExecutor {
  private dockerImages: Record<string, DockerImage> = {
    nodejs: {
      language: 'nodejs',
      image: 'node:18-alpine',
      workDir: '/app',
      runCmd: 'node'
    },
    python: {
      language: 'python',
      image: 'python:3.11-alpine',
      workDir: '/app',
      runCmd: 'python'
    },
    java: {
      language: 'java',
      image: 'openjdk:17-alpine',
      workDir: '/app',
      buildCmd: 'javac',
      runCmd: 'java'
    },
    go: {
      language: 'go',
      image: 'golang:1.21-alpine',
      workDir: '/go/src/app',
      buildCmd: 'go build -o main',
      runCmd: './main'
    },
    rust: {
      language: 'rust',
      image: 'rust:alpine',
      workDir: '/app',
      buildCmd: 'rustc -o main',
      runCmd: './main'
    },
    ruby: {
      language: 'ruby',
      image: 'ruby:3.2-alpine',
      workDir: '/app',
      runCmd: 'ruby'
    },
    php: {
      language: 'php',
      image: 'php:8.2-cli-alpine',
      workDir: '/app',
      runCmd: 'php'
    },
    c: {
      language: 'c',
      image: 'gcc:alpine',
      workDir: '/app',
      buildCmd: 'gcc -o main',
      runCmd: './main'
    },
    cpp: {
      language: 'cpp',
      image: 'gcc:alpine',
      workDir: '/app',
      buildCmd: 'g++ -o main',
      runCmd: './main'
    }
  };

  async execute(options: ExecutionOptions, files: any[]): Promise<ExecutionResult> {
    const { language, mainFile, stdin, timeout = 30000, env = {} } = options;
    const containerName = `exec-${uuidv4()}`;
    const startTime = Date.now();

    const dockerConfig = this.dockerImages[language];
    if (!dockerConfig) {
      return {
        stdout: '',
        stderr: `Unsupported language for Docker execution: ${language}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        error: `Unsupported language: ${language}`
      };
    }

    try {
      // Create temporary directory for files
      const tempDir = await this.createTempDirectory();
      await this.writeFilesToDirectory(files, tempDir);

      // Build Docker run command
      const dockerCmd = this.buildDockerCommand(
        containerName,
        dockerConfig,
        tempDir,
        mainFile || 'main',
        env,
        timeout
      );

      // Execute in Docker
      const result = await this.runDockerCommand(dockerCmd, stdin, timeout);

      // Cleanup
      await this.cleanupContainer(containerName);
      await this.cleanupTempDirectory(tempDir);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildDockerCommand(
    containerName: string,
    config: DockerImage,
    hostPath: string,
    mainFile: string,
    env: Record<string, string>,
    timeout: number
  ): string[] {
    const cmd = [
      'docker', 'run',
      '--name', containerName,
      '--rm',
      '-v', `${hostPath}:${config.workDir}`,
      '-w', config.workDir,
      '--network', 'none', // No network access for security
      '--memory', '512m', // Memory limit
      '--cpus', '0.5', // CPU limit
      '--read-only', // Read-only filesystem
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m', // Temp directory
    ];

    // Add environment variables
    Object.entries(env).forEach(([key, value]) => {
      cmd.push('-e', `${key}=${value}`);
    });

    // Add image
    cmd.push(config.image);

    // Add timeout command
    cmd.push('timeout', `${Math.ceil(timeout / 1000)}s`);

    // Add build command if needed
    if (config.buildCmd) {
      cmd.push('sh', '-c', `${config.buildCmd} ${mainFile} && ${config.runCmd}`);
    } else {
      cmd.push(config.runCmd, mainFile);
    }

    return cmd;
  }

  private async runDockerCommand(
    command: string[],
    stdin?: string,
    timeout?: number
  ): Promise<Omit<ExecutionResult, 'executionTime'>> {
    return new Promise((resolve) => {
      const output: string[] = [];
      const errors: string[] = [];

      const process = spawn(command[0], command.slice(1));

      // Handle stdin
      if (stdin) {
        process.stdin.write(stdin);
        process.stdin.end();
      }

      // Collect stdout
      process.stdout.on('data', (data) => {
        output.push(data.toString());
      });

      // Collect stderr
      process.stderr.on('data', (data) => {
        errors.push(data.toString());
      });

      // Set timeout
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGTERM');
        }, timeout);
      }

      // Handle process exit
      process.on('exit', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          stdout: output.join(''),
          stderr: errors.join(''),
          exitCode: code,
          timedOut: false
        });
      });

      // Handle process error
      process.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          stdout: output.join(''),
          stderr: error.message,
          exitCode: 1,
          error: error.message
        });
      });
    });
  }

  private async createTempDirectory(): Promise<string> {
    const tempBase = path.join(process.cwd(), '.docker-executions');
    await fs.mkdir(tempBase, { recursive: true });
    
    const tempDir = path.join(tempBase, uuidv4());
    await fs.mkdir(tempDir, { recursive: true });
    
    return tempDir;
  }

  private async writeFilesToDirectory(files: any[], directory: string): Promise<void> {
    for (const file of files) {
      if (!file.isFolder) {
        const filePath = path.join(directory, file.name);
        await fs.writeFile(filePath, file.content || '');
      }
    }
  }

  private async cleanupContainer(containerName: string): Promise<void> {
    try {
      await new Promise((resolve) => {
        const process = spawn('docker', ['rm', '-f', containerName]);
        process.on('exit', resolve);
      });
    } catch (error) {
      console.error('Failed to cleanup container:', error);
    }
  }

  private async cleanupTempDirectory(directory: string): Promise<void> {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error);
    }
  }
}

export const dockerExecutor = new DockerExecutor();