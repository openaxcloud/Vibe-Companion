/**
 * MCP Router Service
 * Routes deterministic tasks to MCP executors instead of AI providers
 * Saves tokens by using local code execution for build/test/format operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { TaskType } from './task-classifier.service';

const execAsync = promisify(exec);

export interface McpExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  exitCode?: number;
}

export class McpRouterService {
  // SECURITY: Strict allowlist of permitted npm commands (prevents RCE)
  private static readonly ALLOWED_NPM_COMMANDS = new Set([
    'npm run build',
    'npm run dev',
    'npm run test',
    'npm run test:unit',
    'npm run test:e2e',
    'npm run lint',
    'npm run format',
    'npm run typecheck',
    'npm run db:push',
    'npm run db:migrate',
    'npm test',
    'npx prettier --write .',
    'npx eslint .',
  ]);

  /**
   * Execute a task using MCP (local execution)
   */
  async executeTask(params: {
    taskType: TaskType;
    operation: string;
    projectPath?: string;
    timeout?: number;
  }): Promise<McpExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Route to appropriate MCP executor based on task type
      const command = this.buildCommand(params.taskType, params.operation, params.projectPath);
      
      if (!command) {
        return {
          success: false,
          output: '',
          error: `No MCP executor available for task type: ${params.taskType}`,
          duration: Date.now() - startTime,
        };
      }

      // SECURITY: Validate command against allowlist
      if (!McpRouterService.ALLOWED_NPM_COMMANDS.has(command)) {
        return {
          success: false,
          output: '',
          error: `Command not in allowlist (security): ${command}`,
          duration: Date.now() - startTime,
        };
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: params.timeout || 300000, // 5 minutes default
        cwd: params.projectPath || process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
        duration: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        duration: Date.now() - startTime,
        exitCode: error.code,
      };
    }
  }

  /**
   * Check if a task can be routed to MCP
   */
  canExecuteLocally(taskType: TaskType): boolean {
    const mcpCapable: TaskType[] = [
      'build',
      'test',
      'format',
      'typecheck',
      'lint',
      'migration',
      'file_operation',
    ];
    
    return mcpCapable.includes(taskType);
  }

  /**
   * Build command for MCP execution
   */
  private buildCommand(
    taskType: TaskType,
    operation: string,
    projectPath?: string
  ): string | null {
    // SECURITY: Never directly use operation string - always map to safe commands
    // Map task types to commands
    switch (taskType) {
      case 'build':
        return this.getBuildCommand(operation);
      
      case 'test':
        return this.getTestCommand(operation);
      
      case 'format':
        return this.getFormatCommand(operation);
      
      case 'typecheck':
        return this.getTypecheckCommand();
      
      case 'lint':
        return this.getLintCommand();
      
      case 'migration':
        return this.getMigrationCommand(operation);
      
      case 'file_operation':
        // File operations should use Node.js APIs, not shell commands
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Get build command
   */
  private getBuildCommand(operation: string): string {
    if (operation.includes('vite')) {
      return 'npm run build';
    }
    if (operation.includes('webpack')) {
      return 'npm run build';
    }
    if (operation.includes('esbuild')) {
      return 'npm run build';
    }
    return 'npm run build';
  }

  /**
   * Get test command
   */
  private getTestCommand(operation: string): string {
    if (operation.includes('playwright')) {
      return 'npm run test:e2e';
    }
    if (operation.includes('jest')) {
      return 'npm test';
    }
    if (operation.includes('vitest')) {
      return 'npm run test:unit';
    }
    return 'npm test';
  }

  /**
   * Get format command
   */
  private getFormatCommand(operation: string): string {
    if (operation.includes('prettier')) {
      return 'npx prettier --write .';
    }
    return 'npm run format';
  }

  /**
   * Get typecheck command
   */
  private getTypecheckCommand(): string {
    return 'npm run typecheck';
  }

  /**
   * Get lint command
   */
  private getLintCommand(): string {
    return 'npm run lint';
  }

  /**
   * Get migration command
   */
  private getMigrationCommand(operation: string): string {
    if (operation.includes('db:push')) {
      return 'npm run db:push';
    }
    if (operation.includes('migrate')) {
      return 'npm run db:migrate';
    }
    return 'npm run db:push';
  }

  /**
   * Execute file operation (read/write/delete)
   */
  async executeFileOperation(params: {
    operation: 'read' | 'write' | 'delete' | 'list';
    path: string;
    content?: string;
  }): Promise<McpExecutionResult> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      switch (params.operation) {
        case 'read':
          const content = await fs.readFile(params.path, 'utf-8');
          return {
            success: true,
            output: content,
            duration: Date.now() - startTime,
          };
        
        case 'write':
          if (!params.content) {
            throw new Error('Content required for write operation');
          }
          await fs.writeFile(params.path, params.content, 'utf-8');
          return {
            success: true,
            output: `File written: ${params.path}`,
            duration: Date.now() - startTime,
          };
        
        case 'delete':
          await fs.unlink(params.path);
          return {
            success: true,
            output: `File deleted: ${params.path}`,
            duration: Date.now() - startTime,
          };
        
        case 'list':
          const files = await fs.readdir(params.path);
          return {
            success: true,
            output: JSON.stringify(files, null, 2),
            duration: Date.now() - startTime,
          };
        
        default:
          throw new Error(`Unknown operation: ${params.operation}`);
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}

export const mcpRouter = new McpRouterService();
