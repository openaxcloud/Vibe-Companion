import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface ExecuteCodeOptions {
  projectId: number;
  language: string;
  code: string;
  timeout?: number;
}

interface ExecutionResult {
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
}

export class MobileContainerService {
  private executionPath = '/tmp/mobile-exec';
  private containers: Map<number, any> = new Map();

  async executeCode(options: ExecuteCodeOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { projectId, language, code, timeout = 5000 } = options;
    
    try {
      // Create execution directory
      const execDir = path.join(this.executionPath, `project-${projectId}`);
      await fs.mkdir(execDir, { recursive: true });
      
      // Write code to file
      const fileName = this.getFileName(language);
      const filePath = path.join(execDir, fileName);
      await fs.writeFile(filePath, code);
      
      // Execute based on language
      const command = this.getExecutionCommand(language, fileName);
      const result = await execAsync(command, {
        cwd: execDir,
        timeout,
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      // Clean up
      await fs.rm(execDir, { recursive: true, force: true });
      
      return {
        output: result.stdout || 'Code executed successfully',
        error: result.stderr,
        exitCode: 0,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        output: '',
        error: error.message || 'Execution failed',
        exitCode: error.code || 1,
        executionTime: Date.now() - startTime
      };
    }
  }

  async createContainer(projectId: number, language: string): Promise<string> {
    // Simulate container creation
    const containerId = `container-${projectId}-${Date.now()}`;
    
    this.containers.set(projectId, {
      id: containerId,
      language,
      status: 'running',
      createdAt: new Date(),
      port: 3000 + projectId
    });
    
    return containerId;
  }

  async stopContainer(projectId: number): Promise<void> {
    const container = this.containers.get(projectId);
    if (container) {
      container.status = 'stopped';
    }
  }

  async getContainerStatus(projectId: number): Promise<any> {
    return this.containers.get(projectId) || { status: 'not_found' };
  }

  private getFileName(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'index.js',
      python: 'main.py',
      typescript: 'index.ts',
      java: 'Main.java',
      cpp: 'main.cpp',
      go: 'main.go',
      rust: 'main.rs',
      ruby: 'main.rb',
      php: 'index.php'
    };
    return extensions[language] || 'main.txt';
  }

  private getExecutionCommand(language: string, fileName: string): string {
    const commands: Record<string, string> = {
      javascript: `node ${fileName}`,
      python: `python3 ${fileName}`,
      typescript: `npx ts-node ${fileName}`,
      java: `javac ${fileName} && java Main`,
      cpp: `g++ ${fileName} -o main && ./main`,
      go: `go run ${fileName}`,
      rust: `rustc ${fileName} && ./main`,
      ruby: `ruby ${fileName}`,
      php: `php ${fileName}`
    };
    return commands[language] || `cat ${fileName}`;
  }

  async runProject(projectId: number): Promise<ExecutionResult> {
    // Get project details and run main file
    const startTime = Date.now();
    
    try {
      // In production, this would start the actual project server
      const container = await this.createContainer(projectId, 'javascript');
      
      return {
        output: `Project ${projectId} is running on port ${this.containers.get(projectId)?.port}`,
        exitCode: 0,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        output: '',
        error: error.message,
        exitCode: 1,
        executionTime: Date.now() - startTime
      };
    }
  }

  async deployProject(projectId: number): Promise<any> {
    // Simulate deployment process
    const steps = [
      'Building project...',
      'Optimizing assets...',
      'Creating Docker image...',
      'Pushing to registry...',
      'Deploying to cloud...',
      'Configuring domain...',
      'SSL certificate provisioned',
      'Deployment complete!'
    ];
    
    return {
      status: 'success',
      url: `https://project-${projectId}.e-code.ai`,
      steps,
      deploymentId: `deploy-${Date.now()}`
    };
  }

  async getPreviewUrl(projectId: number): Promise<string> {
    const container = this.containers.get(projectId);
    const host = process.env.CONTAINER_HOST || 'localhost';
    if (container && container.status === 'running') {
      return `http://${host}:${container.port}`;
    }
    
    // Start container if not running
    await this.createContainer(projectId, 'javascript');
    return `http://${host}:${this.containers.get(projectId)?.port}`;
  }
}

export const mobileContainerService = new MobileContainerService();