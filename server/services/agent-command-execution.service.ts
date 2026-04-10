import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as path from 'path';
import { EventEmitter } from 'events';
import { db } from '../db';
import {
  commandExecutions,
  agentSessions,
  agentAuditTrail,
  type CommandExecution,
  type InsertCommandExecution,
  type AgentSession
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import kill from 'tree-kill';

// Command execution event for real-time streaming
export interface CommandExecutionEvent {
  type: 'start' | 'stdout' | 'stderr' | 'complete' | 'error' | 'killed';
  sessionId: string;
  command: string;
  data?: string;
  exitCode?: number;
  error?: string;
}

// Resource limits for command execution
export interface ResourceLimits {
  maxMemory?: number; // In MB
  maxCpu?: number; // CPU percentage (0-100)
  maxDiskIo?: number; // In MB/s
  timeout?: number; // In milliseconds
}

export class AgentCommandExecutionService extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB
  
  // Sandboxed commands whitelist for security
  // ✅ FIX (Nov 30, 2025): Added 'bash' and 'sh' for composite command execution
  private readonly ALLOWED_COMMANDS = [
    'npm', 'npx', 'node', 'yarn', 'pnpm', 'git', 'tsc', 'tsx',
    'python', 'python3', 'pip', 'pip3',
    'go', 'cargo', 'rustc',
    'gcc', 'g++', 'make', 'cmake',
    'java', 'javac', 'mvn', 'gradle',
    'ruby', 'gem', 'bundle',
    'php', 'composer',
    'dotnet', 'nuget',
    'docker', 'docker-compose',
    'bash', 'sh', // Shell wrappers for composite commands (e.g., "npm install && npm build")
    'curl', 'wget', 'grep', 'sed', 'awk', 'find',
    'ls', 'cat', 'echo', 'pwd', 'cd', 'mkdir', 'rm', 'cp', 'mv',
    'test', 'jest', 'mocha', 'vitest', 'pytest',
    'eslint', 'prettier', 'tslint',
    'webpack', 'vite', 'parcel', 'rollup',
    'psql', 'mysql', 'mongo', 'redis-cli'
  ];
  
  // Dangerous command patterns to block
  private readonly BLOCKED_PATTERNS = [
    /rm\s+-rf\s+\//, // Prevent rm -rf /
    /:(){ :|:& };:/, // Fork bomb
    /dd\s+if=\/dev\/zero/, // Disk filling
    />\/dev\/sda/, // Direct disk access
    /sudo/, // No sudo allowed
    /su\s+/, // No user switching
    /chmod\s+777/, // Dangerous permissions
    /\/etc\/passwd/, // System file access
    /\/etc\/shadow/,
    /\.ssh\//, // SSH key access
    /eval\s*\(/, // Code injection
    /exec\s*\(/, // Code execution
  ];

  constructor() {
    super();
  }

  // Execute a command with sandboxing and streaming
  async executeCommand(
    sessionId: string,
    command: string,
    args: string[] = [],
    options: {
      workingDirectory?: string;
      environment?: Record<string, string>;
      stdin?: string;
      timeout?: number;
      resourceLimits?: ResourceLimits;
    } = {},
    userId: string
  ): Promise<CommandExecution> {
    try {
      // Validate session
      const session = await this.validateSession(sessionId);
      
      // Security checks
      this.validateCommand(command, args);
      
      // Prepare execution environment
      const workingDirectory = this.resolveWorkingDirectory(
        options.workingDirectory || session.context?.workingDirectory || '.'
      );
      
      // ✅ FIX (Nov 30, 2025): Separate execution env (full) from stored env (filtered)
      // Full environment for actual command execution
      const fullEnvironment = {
        ...process.env,
        NODE_ENV: 'development',
        CI: 'true', // Run in CI mode to avoid interactive prompts
        ...session.context?.environment,
        ...options.environment
      } as Record<string, string>;
      
      // Filtered environment for database storage
      // Include essential keys + PATH (truncated) + npm_config_* for replay capability
      const ESSENTIAL_ENV_KEYS = [
        'NODE_ENV', 'CI', 'PWD', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM'
      ];
      const storedEnvironment: Record<string, string> = {};
      
      // Add essential keys
      for (const key of ESSENTIAL_ENV_KEYS) {
        if (fullEnvironment[key]) {
          storedEnvironment[key] = fullEnvironment[key];
        }
      }
      
      // Add PATH (truncated to first 2000 chars to avoid DB bloat from Nix paths)
      if (fullEnvironment['PATH']) {
        const pathValue = fullEnvironment['PATH'];
        storedEnvironment['PATH'] = pathValue.length > 2000 
          ? pathValue.substring(0, 2000) + '...[truncated]'
          : pathValue;
      }
      
      // Add npm_config_* keys for Node.js reproducibility
      for (const [key, value] of Object.entries(fullEnvironment)) {
        if (key.startsWith('npm_config_') && value) {
          storedEnvironment[key] = value;
        }
      }
      
      const timeout = options.timeout || this.DEFAULT_TIMEOUT;
      
      // Create command execution record with minimal stored environment
      const [cmdExec] = await db.insert(commandExecutions).values({
        sessionId,
        command,
        arguments: args,
        workingDirectory,
        environment: storedEnvironment, // Store only essential env vars
        stdin: options.stdin,
        status: 'pending',
        timeout,
        resourceLimits: options.resourceLimits,
        startedAt: new Date()
      }).returning();
      
      // Emit start event
      this.emitEvent({
        type: 'start',
        sessionId,
        command: `${command} ${args.join(' ')}`
      });
      
      // Execute command with FULL environment
      const result = await this.runCommand(
        cmdExec.id,
        command,
        args,
        {
          cwd: workingDirectory,
          env: fullEnvironment, // Use full env for actual execution
          timeout,
          stdin: options.stdin,
          resourceLimits: options.resourceLimits
        },
        sessionId
      );
      
      // Update execution record
      await db.update(commandExecutions)
        .set({
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          status: result.status,
          completedAt: new Date(),
          error: result.error
        })
        .where(eq(commandExecutions.id, cmdExec.id));
      
      // Audit trail
      await this.createAuditEntry(
        sessionId,
        userId,
        'command_execute',
        `${command} ${args.join(' ')}`
      );
      
      // Emit completion event
      this.emitEvent({
        type: 'complete',
        sessionId,
        command: `${command} ${args.join(' ')}`,
        exitCode: result.exitCode
      });
      
      const [updated] = await db.select()
        .from(commandExecutions)
        .where(eq(commandExecutions.id, cmdExec.id));
      
      return updated;
    } catch (error: any) {
      this.emitEvent({
        type: 'error',
        sessionId,
        command,
        error: error.message
      });
      throw error;
    }
  }

  // Kill a running command
  async killCommand(executionId: string, sessionId: string): Promise<void> {
    const process = this.activeProcesses.get(executionId);
    
    if (!process) {
      throw new Error('Process not found or already terminated');
    }
    
    try {
      // Use tree-kill to kill process and all children
      await new Promise<void>((resolve, reject) => {
        kill(process.pid!, 'SIGTERM', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      this.activeProcesses.delete(executionId);
      
      // Update execution record
      await db.update(commandExecutions)
        .set({
          status: 'cancelled',
          killedAt: new Date(),
          error: 'Command killed by user'
        })
        .where(eq(commandExecutions.id, executionId));
      
      this.emitEvent({
        type: 'killed',
        sessionId,
        command: executionId
      });
    } catch (error: any) {
      throw new Error(`Failed to kill process: ${error.message}`);
    }
  }

  // Get command execution history
  async getExecutionHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<CommandExecution[]> {
    return await db.select()
      .from(commandExecutions)
      .where(eq(commandExecutions.sessionId, sessionId))
      .orderBy(commandExecutions.startedAt)
      .limit(limit);
  }

  // Get running commands for a session
  async getRunningCommands(sessionId: string): Promise<CommandExecution[]> {
    return await db.select()
      .from(commandExecutions)
      .where(and(
        eq(commandExecutions.sessionId, sessionId),
        eq(commandExecutions.status, 'in_progress')
      ));
  }

  // Private helper methods
  private async runCommand(
    executionId: string,
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string>;
      timeout: number;
      stdin?: string;
      resourceLimits?: ResourceLimits;
    },
    sessionId: string
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    status: 'completed' | 'failed' | 'cancelled';
    error?: string;
  }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      
      // Spawn options with resource limits
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd,
        env: options.env as NodeJS.ProcessEnv,
        shell: false, // Don't use shell for security
        windowsHide: true
      };
      
      // Apply resource limits on Linux
      if (process.platform === 'linux' && options.resourceLimits) {
        const limits = options.resourceLimits;
        if (limits.maxMemory) {
          spawnOptions.env!.NODE_OPTIONS = `--max-old-space-size=${limits.maxMemory}`;
        }
      }
      
      // Spawn process
      const child = spawn(command, args, spawnOptions);
      this.activeProcesses.set(executionId, child);
      
      // Update status to in_progress
      db.update(commandExecutions)
        .set({ status: 'in_progress' })
        .where(eq(commandExecutions.id, executionId))
        .then(() => {});
      
      // Handle stdin
      if (options.stdin) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      }
      
      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize <= this.MAX_OUTPUT_SIZE) {
          stdout += chunk;
          this.emitEvent({
            type: 'stdout',
            sessionId,
            command: `${command} ${args.join(' ')}`,
            data: chunk
          });
        }
      });
      
      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize <= this.MAX_OUTPUT_SIZE) {
          stderr += chunk;
          this.emitEvent({
            type: 'stderr',
            sessionId,
            command: `${command} ${args.join(' ')}`,
            data: chunk
          });
        }
      });
      
      // Handle timeout
      const timer = setTimeout(() => {
        kill(child.pid!, 'SIGTERM');
        resolve({
          stdout,
          stderr,
          exitCode: -1,
          status: 'failed',
          error: `Command timed out after ${options.timeout}ms`
        });
      }, options.timeout);
      
      // Handle process exit
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        this.activeProcesses.delete(executionId);
        
        if (signal) {
          resolve({
            stdout,
            stderr,
            exitCode: -1,
            status: 'cancelled',
            error: `Process killed by signal ${signal}`
          });
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
            status: code === 0 ? 'completed' : 'failed',
            error: code !== 0 ? `Process exited with code ${code}` : undefined
          });
        }
      });
      
      // Handle errors
      child.on('error', (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(executionId);
        
        resolve({
          stdout,
          stderr,
          exitCode: -1,
          status: 'failed',
          error: err.message
        });
      });
    });
  }

  private validateCommand(command: string, args: string[]) {
    // Check if command is in whitelist
    const baseCommand = path.basename(command);
    if (!this.ALLOWED_COMMANDS.includes(baseCommand)) {
      throw new Error(`Command not allowed: ${baseCommand}`);
    }
    
    // Check for dangerous patterns
    const fullCommand = `${command} ${args.join(' ')}`;
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(fullCommand)) {
        throw new Error('Potentially dangerous command pattern detected');
      }
    }
    
    // Additional checks for specific commands
    if (command === 'rm') {
      // Block recursive force delete of root or important directories
      if (args.includes('-rf') && (args.includes('/') || args.includes('*'))) {
        throw new Error('Dangerous rm command blocked');
      }
    }
    
    if (command === 'git') {
      // Allow git but block certain operations
      if (args[0] === 'push' && args.includes('--force')) {
        throw new Error('Force push not allowed');
      }
    }
  }

  private resolveWorkingDirectory(dir: string): string {
    const projectRoot = process.cwd();
    const resolved = path.resolve(projectRoot, dir);
    
    // Ensure working directory is within project bounds
    if (!resolved.startsWith(projectRoot)) {
      throw new Error('Working directory outside project boundaries');
    }
    
    return resolved;
  }

  private async validateSession(sessionId: string): Promise<AgentSession> {
    const [session] = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.isActive, true)
      ));
    
    if (!session) {
      throw new Error('Invalid or inactive session');
    }
    
    return session;
  }

  private async createAuditEntry(
    sessionId: string,
    userId: string,
    action: string,
    command: string
  ) {
    await db.insert(agentAuditTrail).values({
      sessionId,
      userId: parseInt(userId, 10) || 0,
      action,
      resourceType: 'command',
      resourceId: command,
      severity: 'info',
      details: { timestamp: new Date().toISOString() }
    });
  }

  private emitEvent(event: CommandExecutionEvent) {
    this.emit('command:event', event);
  }

  // Cleanup on service shutdown
  async cleanup() {
    // Kill all active processes
    for (const [id, process] of this.activeProcesses) {
      try {
        await new Promise<void>((resolve) => {
          kill(process.pid!, 'SIGTERM', () => resolve());
        });
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    this.activeProcesses.clear();
  }
}

// Export singleton instance
export const agentCommandExecution = new AgentCommandExecutionService();