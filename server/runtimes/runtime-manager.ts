/**
 * Runtime manager for PLOT
 * This module coordinates all runtime components including containers and Nix environments
 * With fallback to direct execution when Docker is unavailable
 */

import * as fs from 'fs';
import * as path from 'path';
import { Language, languageConfigs, getLanguageByExtension, getDefaultFiles } from './languages';
import * as containerManager from './container-manager';
import * as nixManager from './nix-manager';
import { createLogger } from '../utils/logger';
import { Project, File } from '@shared/schema';

const logger = createLogger('runtime');

// Map to track active project runtimes
const activeRuntimes: Map<number, {
  projectId: number;
  language: Language;
  containerId?: string;
  port?: number;
  status: 'starting' | 'running' | 'error';
  logs: string[];
  error?: string;
}> = new Map();

// Interface for starting a project
export interface StartProjectOptions {
  environmentVariables?: Record<string, string>;
  port?: number;
  useNix?: boolean;
  nixOptions?: {
    packages?: string[];
    buildInputs?: string[];
    shellHook?: string;
    environmentVariables?: Record<string, string>;
  };
  executionId?: string;
}

function streamLog(projectId: string, executionId: string | undefined, type: 'stdout' | 'stderr' | 'system', message: string): void {
  const runtimeLogsService = getRuntimeLogsService();
  if (runtimeLogsService && executionId) {
    runtimeLogsService.streamOutput(projectId, executionId, type, message);
  }
}

/**
 * Start a project runtime
 */
export async function startProject(
  project: Project,
  files: File[],
  options: StartProjectOptions = {}
): Promise<{
  success: boolean;
  port?: number;
  containerId?: string;
  status: 'starting' | 'running' | 'error';
  logs: string[];
  error?: string;
}> {
  try {
    const projectId = project.id;
    
    // Check if project is already running
    if (activeRuntimes.has(projectId)) {
      const runtime = activeRuntimes.get(projectId)!;
      
      // If it's already running, return the current status
      if (runtime.status === 'running') {
        return {
          success: true,
          port: runtime.port,
          containerId: runtime.containerId,
          status: runtime.status,
          logs: runtime.logs
        };
      }
      
      // If it's in an error state, clean it up and restart
      if (runtime.status === 'error' && runtime.containerId) {
        await containerManager.stopContainer(runtime.containerId);
        activeRuntimes.delete(projectId);
      }
    }
    
    // Create project directory
    const projectDir = await createProjectDir(project, files);
    
    // Detect language from files
    const language = detectProjectLanguage(files);
    
    if (!language) {
      const error = 'Could not detect language for project';
      logger.error(error);
      
      log(error, 'runtime', 'error');
      
      return {
        success: false,
        status: 'error',
        logs: [error],
        error
      };
    }
    
    log(`Starting project ${projectId} with language ${language}`, 'runtime');
    
    // Initialize runtime logs
    const logs: string[] = [`Starting ${languageConfigs[language].displayName} project...`];
    
    // Check if Docker is available
    // NOTE: On Replit Cloud Run, Docker daemon is not exposed, so we always use direct execution mode.
    // The Docker path below is kept for compatibility with other environments but is never executed on Replit.
    // Real-time streaming is fully implemented for the direct execution path, which is the production path.
    const useDocker = await isDockerAvailable();
    
    if (!useDocker) {
      // Use direct execution mode (no Docker) - this is the primary path for Replit Cloud Run
      logs.push('Using direct execution mode (Docker not available)');
      
      // Get language config for run command
      const config = languageConfigs[language];
      const executionIdForSetup = options.executionId;

      // Resolve the actual run command based on files present in the project directory
      // This handles mismatches (e.g., project has main.js but config expects index.js)
      const resolveRunCommand = (baseRunCmd: string, dir: string): string => {
        const parts = baseRunCmd.split(/\s+/);
        const targetFile = parts.find(p => /\.[a-z0-9]+$/i.test(p) && !p.startsWith('-'));
        if (!targetFile || !dir) return baseRunCmd;
        const targetPath = path.join(dir, targetFile);
        if (fs.existsSync(targetPath)) return baseRunCmd;
        // Fallbacks: common alternative entry point names by extension
        const ext = path.extname(targetFile);
        const alternatives: Record<string, string[]> = {
          '.js':  ['index.js', 'main.js', 'app.js', 'server.js'],
          '.ts':  ['index.ts', 'main.ts', 'app.ts', 'server.ts'],
          '.py':  ['main.py', 'app.py', 'index.py', 'run.py'],
          '.sh':  ['script.sh', 'main.sh', 'run.sh', 'start.sh'],
          '.php': ['index.php', 'main.php', 'app.php'],
          '.rb':  ['main.rb', 'app.rb', 'index.rb'],
          '.lua': ['main.lua', 'index.lua', 'app.lua'],
          '.pl':  ['main.pl', 'script.pl', 'index.pl'],
          '.R':   ['main.R', 'script.R', 'app.R'],
          '.jl':  ['main.jl', 'index.jl'],
          '.exs': ['main.exs', 'app.exs'],
          '.ml':  ['main.ml', 'index.ml'],
        };
        const candidates = alternatives[ext] || [];
        for (const alt of candidates) {
          if (fs.existsSync(path.join(dir, alt))) {
            const newCmd = baseRunCmd.replace(targetFile, alt);
            logger.info(`[Runtime] Entry point adapted: ${targetFile} → ${alt} (cmd: ${newCmd})`);
            return newCmd;
          }
        }
        return baseRunCmd;
      };

      const runCommand = resolveRunCommand(config.runCommand, projectDir || '');
      
      // Stream initial setup messages
      streamLog(projectId, executionIdForSetup, 'system', `Starting ${languageConfigs[language].displayName} project...`);
      streamLog(projectId, executionIdForSetup, 'system', 'Using direct execution mode');
      
      // Set up runtime first
      activeRuntimes.set(projectId, {
        projectId,
        language,
        status: 'running',
        logs,
        directExecutionMode: true,
        projectDir
      });
      
      // Auto-execute the main file
      logs.push(`Executing: ${runCommand}`);
      streamLog(projectId, executionIdForSetup, 'system', `Executing: ${runCommand}`);
      
      try {
        // Parse the run command
        const parts = runCommand.split(/\s+/);
        const baseCmd = parts[0];
        const args = parts.slice(1);
        
        // Comprehensive command mapping for all supported languages
        // Use full paths for Node.js tools from E-Code's node_modules
        const nodeModulesBin = '/home/runner/workspace/node_modules/.bin';
        const cmdMap: Record<string, string> = {
          // JavaScript/TypeScript ecosystem
          'node': 'node',
          'tsx': `${nodeModulesBin}/tsx`,
          'ts-node': `${nodeModulesBin}/tsx`,
          'tsc': `${nodeModulesBin}/tsc`,
          'npx': 'npx',
          'npm': 'npm',
          'serve': `${nodeModulesBin}/serve`,
          
          // Python
          'python': 'python3',
          'python3': 'python3',
          'pip': 'pip3',
          
          // Go
          'go': 'go',
          
          // Ruby
          'ruby': 'ruby',
          'bundle': 'bundle',
          
          // Rust
          'rustc': 'rustc',
          'cargo': 'cargo',
          
          // Java/Kotlin
          'java': 'java',
          'javac': 'javac',
          'kotlinc': 'kotlinc',
          
          // C/C++
          'gcc': 'gcc',
          'g++': 'g++',
          'clang': 'clang',
          'clang++': 'clang++',
          
          // C#/.NET
          'dotnet': 'dotnet',
          'csc': 'csc',
          
          // Swift
          'swift': 'swift',
          'swiftc': 'swiftc',
          
          // Dart/Flutter
          'dart': 'dart',
          'flutter': 'flutter',
          
          // Deno
          'deno': 'deno',
          
          // PHP
          'php': 'php',
          'composer': 'composer',
          
          // Shell/Bash
          'bash': 'bash',
          'sh': 'sh',
          'zsh': 'zsh',
          
          // Nix
          'nix-build': 'nix-build',
          'nix-shell': 'nix-shell',
          
          // Additional scripting languages
          'lua': 'lua',
          'perl': 'perl',
          'Rscript': 'Rscript',
          
          // Functional/Academic languages
          'ghc': 'ghc',           // Haskell compiler
          'runghc': 'runghc',     // Haskell interpreter
          'scalac': 'scalac',     // Scala compiler
          'scala': 'scala',       // Scala runner
          'clojure': 'clojure',   // Clojure
          'lein': 'lein',         // Leiningen (Clojure build tool)
          'elixir': 'elixir',     // Elixir
          'mix': 'mix',           // Elixir build tool
          'julia': 'julia',       // Julia
          'ocaml': 'ocaml',       // OCaml interpreter
          'ocamlopt': 'ocamlopt', // OCaml native compiler
          
          // Systems languages
          'gfortran': 'gfortran', // Fortran compiler
          'zig': 'zig',           // Zig
          
          // Executable files (compiled binaries)
          './main': './main',
          './a.out': './a.out'
        };
        
        const actualCmd = cmdMap[baseCmd] || baseCmd;
        
        // Commands that need shell for PATH resolution or complex arguments
        const needsShell = [
          // Node.js ecosystem
          'tsx', 'ts-node', 'tsc', 'npx', 'npm', 'serve',
          // .NET/Swift/Dart
          'dotnet', 'deno', 'swift', 'dart', 'flutter',
          // Nix
          'nix-build', 'nix-shell',
          // JVM languages
          'kotlinc', 'scala', 'scalac', 'clojure', 'lein',
          // Functional languages
          'ghc', 'runghc', 'elixir', 'mix', 'julia', 'ocaml', 'ocamlopt',
          // Systems languages
          'zig'
        ].includes(baseCmd);
        
        // Handle compilation for compiled languages with real-time streaming
        const executionId = options.executionId;
        
        // Get language-specific timeout (or default)
        const languageTimeout = RUNTIME_TIMEOUTS[language] || RUNTIME_TIMEOUTS['default'];
        const compileTimeout = Math.min(languageTimeout, 120000); // Cap compile at 2 minutes
        
        if (config.compilerCommand) {
          const compileParts = config.compilerCommand.split(/\s+/);
          const compileCmd = cmdMap[compileParts[0]] || compileParts[0];
          const compileArgs = compileParts.slice(1);
          
          logs.push(`Compiling: ${config.compilerCommand}`);
          streamLog(projectId, executionId, 'system', `Compiling: ${config.compilerCommand}`);
          
          const compileResult = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            let stdout = '';
            let stderr = '';
            
            const proc = spawn(compileCmd, compileArgs, {
              cwd: projectDir || undefined,
              shell: needsShell  // Use shell for compilers that need PATH
            });
            
            proc.stdout.on('data', (data) => { 
              const line = data.toString();
              stdout += line;
              streamLog(projectId, executionId, 'stdout', line);
            });
            proc.stderr.on('data', (data) => { 
              const line = data.toString();
              stderr += line;
              streamLog(projectId, executionId, 'stderr', line);
            });
            
            const timeout = setTimeout(() => {
              if (proc.pid) killProcessTree(proc.pid);
              else proc.kill('SIGTERM');
              const timeoutMsg = `Compilation timed out (${compileTimeout/1000}s limit)`;
              streamLog(projectId, executionId, 'stderr', timeoutMsg);
              resolve({ stdout, stderr: stderr + '\n' + timeoutMsg, exitCode: 124 });
            }, compileTimeout);
            
            proc.on('close', (code) => {
              clearTimeout(timeout);
              resolve({ stdout, stderr, exitCode: code || 0 });
            });
            
            proc.on('error', (err) => {
              clearTimeout(timeout);
              streamLog(projectId, executionId, 'stderr', err.message);
              resolve({ stdout, stderr: err.message, exitCode: 1 });
            });
          });
          
          if (compileResult.exitCode !== 0) {
            const friendlyError = getUserFriendlyError(compileResult.stderr, language);
            logs.push(`Compilation error: ${friendlyError}`);
            streamLog(projectId, executionId, 'stderr', `Compilation failed: ${friendlyError}`);
            
            // Notify exit for compilation failure
            const runtimeLogsService = getRuntimeLogsService();
            if (runtimeLogsService && executionId) {
              runtimeLogsService.streamExit(projectId, executionId, compileResult.exitCode, 0);
            }
            
            // CRITICAL FIX: Clean up on compilation failure to allow re-runs
            activeRuntimes.delete(projectId);
            
            // Clean up project directory even on compile failure
            try {
              if (fs.existsSync(projectDir)) {
                fs.rmSync(projectDir, { recursive: true, force: true });
                logger.info(`Cleaned up project directory after compile error: ${projectDir}`);
              }
            } catch (cleanupErr) {
              logger.warn(`Failed to cleanup project directory after compile error: ${projectDir}`);
            }
            
            return {
              success: false,
              status: 'error',
              logs,
              error: compileResult.stderr
            };
          }
          
          logs.push('Compilation successful');
          streamLog(projectId, executionId, 'system', 'Compilation successful');
        }
        
        // Execute the main file with real-time streaming
        const startTime = Date.now();
        
        streamLog(projectId, executionId, 'system', `Starting execution...`);
        
        const execResult = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          let stdout = '';
          let stderr = '';
          
          const proc = spawn(actualCmd, args, {
            cwd: projectDir || undefined,
            env: { ...process.env, SANDBOX_EXECUTION: 'true' },
            shell: needsShell  // Use shell for tsx/ts-node/npm commands for PATH resolution
          });
          
          // Store process in activeRuntimes for proper cleanup
          const runtime = activeRuntimes.get(projectId);
          if (runtime) {
            runtime.process = proc;
            runtime.pid = proc.pid;
            runtime.startTime = startTime;
          }
          
          proc.stdout.on('data', (data) => {
            const line = data.toString();
            stdout += line;
            logs.push(line.trim());
            streamLog(projectId, executionId, 'stdout', line);
          });
          
          proc.stderr.on('data', (data) => {
            const line = data.toString();
            stderr += line;
            logs.push(`[ERROR] ${line.trim()}`);
            streamLog(projectId, executionId, 'stderr', line);
          });
          
          // Use language-specific timeout
          const timeout = setTimeout(() => {
            if (proc.pid) killProcessTree(proc.pid);
            else proc.kill('SIGTERM');
            const timeoutMsg = `Execution timed out (${languageTimeout/1000}s limit)`;
            streamLog(projectId, executionId, 'stderr', timeoutMsg);
            resolve({ stdout, stderr: stderr + '\n' + timeoutMsg, exitCode: 124 });
          }, languageTimeout);
          
          proc.on('close', (code) => {
            clearTimeout(timeout);
            const executionTime = Date.now() - startTime;
            const runtimeLogsService = getRuntimeLogsService();
            if (runtimeLogsService && executionId) {
              runtimeLogsService.streamExit(projectId, executionId, code || 0, executionTime);
            }
            resolve({ stdout, stderr, exitCode: code || 0 });
          });
          
          proc.on('error', (err) => {
            clearTimeout(timeout);
            const friendlyError = getUserFriendlyError(err.message, language);
            streamLog(projectId, executionId, 'stderr', friendlyError);
            resolve({ stdout, stderr: friendlyError, exitCode: 1 });
          });
        });
        
        if (execResult.exitCode === 0) {
          logs.push(`\n--- Execution completed successfully ---`);
        } else {
          const friendlyError = getUserFriendlyError(execResult.stderr, language);
          logs.push(`\n--- Execution failed (exit code: ${execResult.exitCode}) ---`);
          if (friendlyError) {
            logs.push(friendlyError);
          }
        }
        
        // CRITICAL FIX: Clear runtime after execution completes to allow re-runs
        // For direct execution mode (single-shot scripts), we don't keep "running" state
        // because the process has already finished. This allows subsequent Run clicks to work.
        activeRuntimes.delete(projectId);
        
        // Clean up project directory after execution
        try {
          if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
            logger.info(`Cleaned up project directory: ${projectDir}`);
          }
        } catch (cleanupErr) {
          logger.warn(`Failed to cleanup project directory: ${projectDir}`);
        }
        
        return {
          success: execResult.exitCode === 0,
          status: 'running', // Return running to indicate it just ran successfully
          logs
        };
        
      } catch (execError: any) {
        const rawError = execError.message || 'Execution failed';
        const friendlyError = getUserFriendlyError(rawError, language);
        logs.push(`Execution error: ${friendlyError}`);
        
        // Stream the error to connected clients
        streamLog(projectId, executionIdForSetup, 'stderr', `Execution error: ${friendlyError}`);
        
        // Notify exit with error
        const runtimeLogsService = getRuntimeLogsService();
        if (runtimeLogsService && executionIdForSetup) {
          runtimeLogsService.streamExit(projectId, executionIdForSetup, 1, 0);
        }
        
        // Clear runtime even on error to allow retries
        activeRuntimes.delete(projectId);
        
        // Clean up project directory
        try {
          if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
        
        return {
          success: false,
          status: 'error',
          logs,
          error: friendlyError
        };
      }
    }
    
    // Set up initial runtime entry
    activeRuntimes.set(projectId, {
      projectId,
      language,
      status: 'starting',
      logs
    });
    
    // Set up Nix environment if requested
    if (options.useNix) {
      logs.push('Setting up Nix environment...');
      
      const nixResult = await nixManager.generateNixConfig(
        projectDir,
        language,
        options.nixOptions
      );
      
      if (!nixResult) {
        const error = 'Failed to generate Nix configuration';
        logs.push(`ERROR: ${error}`);
        logger.error(error);
        
        log(error, 'runtime', 'error');
        
        activeRuntimes.set(projectId, {
          projectId,
          language,
          status: 'error',
          logs,
          error
        });
        
        return {
          success: false,
          status: 'error',
          logs,
          error
        };
      }
      
      logs.push('Applying Nix environment...');
      
      const applyResult = await nixManager.applyNixEnvironment(projectDir);
      
      if (!applyResult.success) {
        const error = 'Failed to apply Nix environment';
        logs.push(`ERROR: ${error}`);
        logger.error(error);
        
        log(error, 'runtime', 'error');
        
        activeRuntimes.set(projectId, {
          projectId,
          language,
          status: 'error',
          logs,
          error
        });
        
        return {
          success: false,
          status: 'error',
          logs,
          error
        };
      }
      
      logs.push('Nix environment set up successfully');
    }
    
    // Start container
    logs.push(`Starting ${languageConfigs[language].displayName} container...`);
    
    const containerResult = await containerManager.createContainer({
      projectId,
      language,
      projectDir,
      environmentVariables: options.environmentVariables,
      port: options.port
    });
    
    if (containerResult.status === 'error') {
      const error = containerResult.error || 'Failed to start container';
      logs.push(...containerResult.logs);
      logger.error(error);
      
      log(error, 'runtime', 'error');
      
      activeRuntimes.set(projectId, {
        projectId,
        language,
        status: 'error',
        logs,
        error
      });
      
      return {
        success: false,
        status: 'error',
        logs,
        error
      };
    }
    
    logs.push(...containerResult.logs);
    logs.push('Container started successfully');
    
    // Install dependencies
    logs.push('Installing dependencies...');
    
    const installResult = await containerManager.installDependencies(
      containerResult.containerId,
      language
    );
    
    if (!installResult) {
      logs.push('WARNING: Dependency installation may not have completed successfully');
      log('Dependency installation may not have completed successfully', 'runtime', 'warn');
    } else {
      logs.push('Dependencies installed successfully');
    }
    
    // Update runtime status
    activeRuntimes.set(projectId, {
      projectId,
      language,
      containerId: containerResult.containerId,
      port: containerResult.port,
      status: 'running',
      logs
    });
    
    return {
      success: true,
      port: containerResult.port,
      containerId: containerResult.containerId,
      status: 'running',
      logs
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error starting project: ${errorMessage}`);
    
    log(`Error starting project: ${errorMessage}`, 'runtime', 'error');
    
    return {
      success: false,
      status: 'error',
      logs: [`ERROR: ${errorMessage}`],
      error: errorMessage
    };
  }
}

/**
 * Stop a project runtime with proper process cleanup
 */
export async function stopProject(projectId: number): Promise<boolean> {
  try {
    logger.info(`Stopping project ${projectId}`);
    
    if (!activeRuntimes.has(projectId)) {
      logger.warn(`Project ${projectId} is not running`);
      return false;
    }
    
    const runtime = activeRuntimes.get(projectId)!;
    
    if (runtime.directExecutionMode || !runtime.containerId) {
      logger.info(`Cleaning up direct execution mode for project ${projectId}`);
      
      // Kill the process tree if we have a PID
      if (runtime.pid) {
        try {
          await killProcessTree(runtime.pid);
          logger.info(`Killed process tree for PID ${runtime.pid}`);
        } catch (killError) {
          logger.warn(`Failed to kill process tree for PID ${runtime.pid}: ${killError}`);
        }
      }
      
      // Also try to kill via process reference
      if (runtime.process && !runtime.process.killed) {
        try {
          runtime.process.kill('SIGTERM');
          // Give it a moment then force kill if needed
          setTimeout(() => {
            if (runtime.process && !runtime.process.killed) {
              runtime.process.kill('SIGKILL');
            }
          }, 1000);
        } catch (e) {
          // Process may already be dead
        }
      }
      
      // Clean up temp directory if it exists
      if (runtime.projectDir) {
        try {
          fs.rmSync(runtime.projectDir, { recursive: true, force: true });
          logger.info(`Cleaned up temp directory: ${runtime.projectDir}`);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp dir: ${runtime.projectDir}`);
        }
      }
      
      activeRuntimes.delete(projectId);
      return true;
    }
    
    if (!runtime.containerId) {
      logger.warn(`Project ${projectId} does not have a container ID`);
      activeRuntimes.delete(projectId);
      return false;
    }
    
    const result = await containerManager.stopContainer(runtime.containerId);
    
    if (result) {
      logger.info(`Project ${projectId} stopped successfully`);
      activeRuntimes.delete(projectId);
      return true;
    } else {
      logger.error(`Failed to stop project ${projectId}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error stopping project: ${errorMessage}`);
    return false;
  }
}

/**
 * Get the status of a project runtime
 */
export function getProjectStatus(projectId: number): {
  isRunning: boolean;
  language?: Language;
  containerId?: string;
  port?: number;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'unknown';
  logs: string[];
  error?: string;
} {
  if (!activeRuntimes.has(projectId)) {
    return {
      isRunning: false,
      status: 'unknown',
      logs: []
    };
  }
  
  const runtime = activeRuntimes.get(projectId)!;
  
  return {
    isRunning: runtime.status === 'running',
    language: runtime.language,
    containerId: runtime.containerId,
    port: runtime.port,
    status: runtime.status,
    logs: runtime.logs,
    error: runtime.error
  };
}

/**
 * Execute a command in a project runtime
 */
export async function executeCommand(projectId: number, command: string): Promise<{
  success: boolean;
  output: string;
}> {
  try {
    log(`Executing command in project ${projectId}: ${command}`, 'runtime');
    
    if (!activeRuntimes.has(projectId)) {
      const errorMessage = `Project ${projectId} is not running`;
      log(errorMessage, 'runtime', 'error');
      
      return {
        success: false,
        output: `ERROR: ${errorMessage}`
      };
    }
    
    const runtime = activeRuntimes.get(projectId)!;
    
    // Use direct execution mode if Docker is not available
    if (runtime.directExecutionMode) {
      logger.info(`Using direct execution for project ${projectId}`);
      
      // Parse command into base command and args
      const parts = command.trim().split(/\s+/);
      const baseCommand = parts[0];
      const args = parts.slice(1);
      
      // Validate command against strict whitelist of safe terminal commands
      const SAFE_COMMANDS: Record<string, string> = {
        'node': 'node',
        'python3': 'python3',
        'python': 'python3',
        'go': 'go',
        'npm': 'npm',
        'npx': 'npx',
        'ls': 'ls',
        'cat': 'cat',
        'pwd': 'pwd',
        'echo': 'echo',
        'mkdir': 'mkdir',
        'touch': 'touch'
      };
      
      const safeCmd = SAFE_COMMANDS[baseCommand];
      if (!safeCmd) {
        logger.warn(`Blocked unsafe command: ${baseCommand}`);
        return {
          success: false,
          output: `Command '${baseCommand}' is not allowed. Allowed: ${Object.keys(SAFE_COMMANDS).join(', ')}`
        };
      }
      
      try {
        // Use spawn directly for terminal commands (not code execution)
        const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
          let stdout = '';
          let stderr = '';
          
          const proc = spawn(safeCmd, args, {
            cwd: runtime.projectDir || process.cwd(),
            env: {
              ...process.env,
              SANDBOX_EXECUTION: 'true'
            },
            shell: false // CRITICAL: No shell interpretation
          });
          
          proc.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          // Timeout after 30 seconds
          const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
            resolve({
              success: false,
              output: 'Command timed out'
            });
          }, 30000);
          
          proc.on('close', (code) => {
            clearTimeout(timeout);
            resolve({
              success: code === 0,
              output: stdout + (stderr ? '\n' + stderr : '')
            });
          });
          
          proc.on('error', (err) => {
            clearTimeout(timeout);
            resolve({
              success: false,
              output: err.message
            });
          });
        });
        
        return result;
      } catch (execError: any) {
        return {
          success: false,
          output: execError.message || 'Execution failed'
        };
      }
    }
    
    if (!runtime.containerId) {
      const errorMessage = `Project ${projectId} does not have a container ID`;
      logger.error(errorMessage);
      
      return {
        success: false,
        output: `ERROR: ${errorMessage}`
      };
    }
    
    // Execute the command in the container
    const result = await containerManager.executeCommand(
      runtime.containerId,
      command
    );
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error executing command: ${errorMessage}`, 'runtime', 'error');
    
    return {
      success: false,
      output: `ERROR: ${errorMessage}`
    };
  }
}

/**
 * Stream project logs
 */
export function streamProjectLogs(projectId: number, callback: (log: string) => void): () => void {
  if (!activeRuntimes.has(projectId)) {
    callback(`ERROR: Project ${projectId} is not running`);
    return () => {};
  }
  
  const runtime = activeRuntimes.get(projectId)!;
  
  // Send existing logs
  runtime.logs.forEach(log => callback(log));
  
  if (!runtime.containerId) {
    callback(`ERROR: Project ${projectId} does not have a container ID`);
    return () => {};
  }
  
  // Stream container logs
  return containerManager.streamContainerLogs(runtime.containerId, callback);
}

/**
 * Check if runtime dependencies are available
 */
export async function checkRuntimeDependencies(): Promise<{
  docker: {
    available: boolean;
    version?: string;
    error?: string;
  };
  nix: {
    available: boolean;
    version?: string;
    error?: string;
  };
  languages: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }>;
}> {
  try {
    logger.info('Checking runtime dependencies');
    
    // Try to get Docker version info
    let dockerInfo = {
      available: false as boolean,
      version: undefined as string | undefined,
      error: undefined as string | undefined
    };
    
    try {
      const dockerAvailable = await containerManager.checkDockerAvailability();
      if (dockerAvailable) {
        try {
          const dockerVersion = await containerManager.getDockerVersion();
          dockerInfo = {
            available: true,
            version: dockerVersion,
            error: undefined
          };
          logger.info(`Docker is available, version: ${dockerVersion}`);
        } catch (err) {
          dockerInfo = {
            available: true,
            version: undefined,
            error: err instanceof Error ? err.message : 'Failed to get Docker version'
          };
          logger.warn(`Docker is available but couldn't get version: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        dockerInfo = {
          available: false,
          version: undefined,
          error: 'Docker is not available'
        };
        logger.warn('Docker is not available on the system');
      }
    } catch (err) {
      dockerInfo = {
        available: false,
        version: undefined,
        error: err instanceof Error ? err.message : 'Error checking Docker availability'
      };
      logger.error(`Error checking Docker: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Try to get Nix version info
    let nixInfo = {
      available: false as boolean,
      version: undefined as string | undefined,
      error: undefined as string | undefined
    };
    
    try {
      const nixAvailable = await nixManager.checkNixAvailability();
      if (nixAvailable) {
        try {
          const nixVersion = await nixManager.getNixVersion();
          nixInfo = {
            available: true,
            version: nixVersion,
            error: undefined
          };
          logger.info(`Nix is available, version: ${nixVersion}`);
        } catch (err) {
          nixInfo = {
            available: true,
            version: undefined,
            error: err instanceof Error ? err.message : 'Failed to get Nix version'
          };
          logger.warn(`Nix is available but couldn't get version: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        nixInfo = {
          available: false,
          version: undefined,
          error: 'Nix is not available'
        };
        logger.warn('Nix is not available on the system');
      }
    } catch (err) {
      nixInfo = {
        available: false,
        version: undefined,
        error: err instanceof Error ? err.message : 'Error checking Nix availability'
      };
      logger.error(`Error checking Nix: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Check language availability
    // For now, we'll just return a map of language configs and their assumed availability
    // In a full implementation, we would actually check each language runtime
    const languages: Record<string, {
      available: boolean;
      version?: string;
      error?: string;
    }> = {};
    
    // Gather language info based on docker and nix availability
    if (dockerInfo.available || nixInfo.available) {
      logger.info('Checking language availability');
      
      // Get all language codes
      const languageCodes = Object.keys(languageConfigs);
      
      // For each language, check availability
      for (const code of languageCodes) {
        try {
          const config = languageConfigs[code as Language];
          if (!config) continue;
          
          // In a real implementation, we'd test each language runtime here
          // For now, we'll just say they're available if Docker or Nix is available
          languages[code] = {
            available: true,
            version: config.version || 'Unknown version',
            error: undefined
          };
        } catch (err) {
          languages[code] = {
            available: false,
            version: undefined,
            error: err instanceof Error ? err.message : `Error checking ${code}`
          };
          logger.warn(`Error checking language ${code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      logger.info(`Detected ${Object.keys(languages).length} available languages`);
    } else {
      logger.warn('No container environments available, languages will not be available');
    }
    
    return { 
      docker: dockerInfo,
      nix: nixInfo,
      languages
    };
  } catch (error) {
    logger.error(`Error checking runtime dependencies: ${error instanceof Error ? error.message : String(error)}`);
    return { 
      docker: { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      nix: { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      languages: {}
    };
  }
}

/**
 * Create a project directory with all files
 */
async function createProjectDir(project: Project, files: File[]): Promise<string> {
  const projectDir = path.join(process.cwd(), 'projects', `project-${project.id}`);
  
  logger.info(`Creating project directory for project ${project.id}`);
  
  // Create project directory if it doesn't exist
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    logger.info(`Created new project directory: ${projectDir}`);
  }
  
  // Write all files to the project directory
  const { bulkSyncProjectFiles } = await import('../utils/project-fs-sync');
  return bulkSyncProjectFiles(String(project.id), files as any);
}

/**
 * Detect the primary language of a project
 */
function detectProjectLanguage(files: File[]): Language | undefined {
  logger.info(`Detecting project language from ${files.length} files`);
  
  // Filter out folder entries
  const nonFolderFiles = files.filter(file => !file.isFolder);
  
  // If no files, return undefined
  if (nonFolderFiles.length === 0) {
    logger.warn('No files found for language detection');
    return undefined;
  }
  
  // Check for common main files
  const mainFileChecks: [string, Language][] = [
    ['tsconfig.json', 'typescript'],
    ['requirements.txt', 'python'],
    ['Cargo.toml', 'rust'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['go.mod', 'go'],
    ['Gemfile', 'ruby'],
    ['composer.json', 'php'],
    ['*.csproj', 'csharp'],
    ['CMakeLists.txt', 'cpp'],
    ['pubspec.yaml', 'dart'],
    ['*.kt', 'kotlin'],
    ['*.swift', 'swift'],
    ['index.html', 'html-css-js'],
    ['replit.nix', 'nix'],
    ['package.json', 'nodejs']
  ];
  
  for (const [pattern, language] of mainFileChecks) {
    // Handle glob patterns
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      for (const file of nonFolderFiles) {
        if (regex.test(file.name)) {
          return language;
        }
      }
    } else {
      // Direct match
      for (const file of nonFolderFiles) {
        if (file.name === pattern) {
          return language;
        }
      }
    }
  }
  
  // Count file extensions
  const extensionCounts: Record<string, number> = {};
  
  for (const file of nonFolderFiles) {
    const language = getLanguageByExtension(file.name);
    
    if (language) {
      extensionCounts[language] = (extensionCounts[language] || 0) + 1;
    }
  }
  
  // Find the most common language
  let maxCount = 0;
  let detectedLanguage: Language | undefined;
  
  for (const [language, count] of Object.entries(extensionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedLanguage = language as Language;
    }
  }
  
  return detectedLanguage;
}

/**
 * Create a new project with default files for a language
 */
export function createDefaultProject(language: Language): { name: string, content: string, isFolder: boolean }[] {
  return getDefaultFiles(language);
}