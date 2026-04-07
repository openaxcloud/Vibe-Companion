/**
 * Agent Tool Executor
 * Executes tool calls from the AI agent autonomously
 * 
 * ✅ FIXED Jan 2026: Now saves files to BOTH filesystem AND database
 * This ensures files appear in the UI Files panel immediately
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import winston from 'winston';
import { storage } from '../storage';

const ALLOWED_COMMANDS = new Set([
  'npm', 'npx', 'node', 'git', 'grep', 'find', 'ls', 'cat', 'echo', 
  'mkdir', 'rm', 'cp', 'mv', 'touch', 'head', 'tail', 'wc', 'sort',
  'yarn', 'pnpm', 'python', 'python3', 'pip', 'pip3', 'cargo', 'rustc',
  'go', 'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'tsx'
]);

function parseCommand(commandString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  
  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];
    
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current) {
    args.push(current);
  }
  
  return args;
}

/**
 * Secure command sanitization for use with spawn() (shell: false)
 * Even though spawn without shell prevents shell injection, we add defense-in-depth
 */
function sanitizeCommand(cmd: string): string {
  // Remove all shell metacharacters and potential injection vectors
  const sanitized = cmd.replace(/[;&|`$(){}[\]<>\\!#~'"*?\n\r\t]/g, '');
  
  // Block path traversal attempts in arguments
  if (sanitized.includes('../') || sanitized.includes('..\\')) {
    throw new Error('Path traversal not allowed in command arguments');
  }
  
  return sanitized;
}

/**
 * Validate that a command argument doesn't contain path traversal
 */
function sanitizeArgument(arg: string): string {
  // Allow quoted strings to pass through but check for dangerous patterns
  const unquoted = arg.replace(/^["']|["']$/g, '');
  
  // Block path traversal in non-path arguments
  if (arg.startsWith('-') && (unquoted.includes('../') || unquoted.includes('..\\'))) {
    throw new Error('Path traversal not allowed in command flags');
  }
  
  // Remove null bytes and other control characters
  return arg.split('').filter(char => {
    const code = char.charCodeAt(0);
    return !(code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d);
  }).join('');
}

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
});

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    filesChanged?: string[];
    commandOutput?: string;
  };
}

/**
 * Base executor class
 */
export class ToolExecutor {
  private projectRoot: string;
  private projectId: string;
  private userId: string | null;
  private ownershipVerified: boolean = false;

  constructor(projectId: string, userId?: string) {
    this.projectId = projectId;
    this.userId = userId || null;
    // In production, map projectId to actual project directory
    // For now, use current working directory
    this.projectRoot = process.cwd();
  }

  private async verifyProjectOwnership(): Promise<void> {
    if (this.ownershipVerified || !this.userId || this.projectId === 'default') return;
    try {
      const project = await storage.getProject(this.projectId);
      if (!project) {
        throw new Error(`Project ${this.projectId} not found`);
      }
      if (project.userId !== this.userId) {
        throw new Error(`User ${this.userId} does not own project ${this.projectId}`);
      }
      this.ownershipVerified = true;
    } catch (err: any) {
      logger.error(`[AgentExecutor] Ownership verification failed: ${err.message}`);
      throw err;
    }
  }

  private validatePath(filePath: string): string {
    const resolvedPath = path.resolve(this.projectRoot, filePath);
    const normalizedRoot = path.resolve(this.projectRoot);
    
    if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
      throw new Error(`Path traversal detected: ${filePath} resolves outside project root`);
    }
    
    return resolvedPath;
  }

  /**
   * Execute a tool call
   */
  async execute(toolName: string, parameters: any): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      await this.verifyProjectOwnership();
      logger.info(`[AgentExecutor] Executing tool: ${toolName}`, { parameters });

      let result: ToolExecutionResult;

      switch (toolName) {
        case 'create_file':
          result = await this.createFile(parameters);
          break;
        
        case 'edit_file':
          result = await this.editFile(parameters);
          break;
        
        case 'read_file':
          result = await this.readFile(parameters);
          break;
        
        case 'delete_file':
          result = await this.deleteFile(parameters);
          break;
        
        case 'list_directory':
          result = await this.listDirectory(parameters);
          break;
        
        case 'run_command':
          result = await this.runCommand(parameters);
          break;
        
        case 'install_package':
          result = await this.installPackage(parameters);
          break;
        
        case 'web_search':
          result = await this.webSearch(parameters);
          break;
        
        case 'search_code':
          result = await this.searchCode(parameters);
          break;
        
        case 'get_project_structure':
          result = await this.getProjectStructure(parameters);
          break;
        
        case 'get_diagnostics':
          result = await this.getDiagnostics(parameters);
          break;
        
        default:
          result = {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }

      const executionTime = Date.now() - startTime;
      result.metadata = { ...result.metadata, executionTime };

      logger.info(`[AgentExecutor] Tool execution completed: ${toolName}`, {
        success: result.success,
        executionTime
      });

      return result;

    } catch (error: any) {
      // ✅ Issue #37 FIX: Preserve error stack with cause for better debugging
      const wrappedError = new Error(`Tool execution failed: ${toolName} - ${error.message}`, {
        cause: error // Preserve original error with stack trace
      });
      
      logger.error(`[AgentExecutor] Tool execution failed: ${toolName}`, { 
        error: error.message,
        stack: error.stack,
        cause: error.cause?.message
      });
      
      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * File Operations
   * ✅ FIXED Jan 2026: Now saves files to BOTH filesystem AND database
   */
  private async createFile(params: { path: string; content: string; description?: string }): Promise<ToolExecutionResult> {
    const filePath = this.validatePath(params.path);
    const dir = path.dirname(filePath);

    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });

    // Write file to filesystem
    await fs.writeFile(filePath, params.content, 'utf-8');

    // ✅ CRITICAL: Also save to database so file appears in UI Files panel
    const projectIdStr = this.projectId;
    if (projectIdStr && projectIdStr !== 'default') {
      try {
        // Use getFileByPath for efficient lookup
        const existingFile = await storage.getFileByPath(projectIdStr, params.path);
        
        if (existingFile) {
          // Update existing file
          await storage.updateFile(existingFile.id, { content: params.content });
          logger.info(`[AgentExecutor] Updated file in database: ${params.path} (project ${projectIdStr})`);
        } else {
          // Create new file in database (simple signature: projectId/path/content)
          await storage.createFile({
            projectId: projectIdStr,
            path: params.path,
            content: params.content
          });
          logger.info(`[AgentExecutor] Created file in database: ${params.path} (project ${projectIdStr})`);
        }
      } catch (dbError: any) {
        // Log but don't fail - filesystem write already succeeded
        logger.warn(`[AgentExecutor] Failed to save file to database: ${dbError.message}`);
      }
    }

    return {
      success: true,
      output: {
        path: params.path,
        description: params.description || 'File created successfully',
        size: params.content.length
      },
      metadata: {
        filesChanged: [params.path]
      }
    };
  }

  private async editFile(params: { path: string; old_content: string; new_content: string; description?: string }): Promise<ToolExecutionResult> {
    const filePath = this.validatePath(params.path);

    // Read current content
    const currentContent = await fs.readFile(filePath, 'utf-8');

    // Replace old content with new content
    if (!currentContent.includes(params.old_content)) {
      return {
        success: false,
        error: 'Old content not found in file. File may have changed.'
      };
    }

    const newContent = currentContent.replace(params.old_content, params.new_content);
    await fs.writeFile(filePath, newContent, 'utf-8');

    // ✅ FIXED Jan 2026: Also update in database (create if not exists)
    const projectIdStr = this.projectId;
    if (projectIdStr && projectIdStr !== 'default') {
      try {
        // Use getFileByPath for efficient lookup
        const existingFile = await storage.getFileByPath(projectIdStr, params.path);
        
        if (existingFile) {
          await storage.updateFile(existingFile.id, { content: newContent });
          logger.info(`[AgentExecutor] Updated file in database: ${params.path} (project ${projectIdStr})`);
        } else {
          // File exists on FS but not in DB - create it to keep UI in sync
          await storage.createFile({
            projectId: projectIdStr,
            path: params.path,
            content: newContent
          });
          logger.info(`[AgentExecutor] Created file in database (via edit): ${params.path} (project ${projectIdStr})`);
        }
      } catch (dbError: any) {
        logger.warn(`[AgentExecutor] Failed to update file in database: ${dbError.message}`);
      }
    }

    return {
      success: true,
      output: {
        path: params.path,
        description: params.description || 'File edited successfully',
        linesChanged: params.new_content.split('\n').length
      },
      metadata: {
        filesChanged: [params.path]
      }
    };
  }

  private async readFile(params: { path: string }): Promise<ToolExecutionResult> {
    const filePath = this.validatePath(params.path);
    const content = await fs.readFile(filePath, 'utf-8');

    return {
      success: true,
      output: {
        path: params.path,
        content,
        lines: content.split('\n').length
      }
    };
  }

  private async deleteFile(params: { path: string; reason: string }): Promise<ToolExecutionResult> {
    const filePath = this.validatePath(params.path);
    await fs.unlink(filePath);

    return {
      success: true,
      output: {
        path: params.path,
        reason: params.reason
      },
      metadata: {
        filesChanged: [params.path]
      }
    };
  }

  /**
   * List directory contents with protection against resource exhaustion
   * ✅ A-H6 FIX (Dec 16, 2025): Added maxDepth and maxFiles limits to prevent DoS attacks
   */
  private async listDirectory(params: { path: string; recursive?: boolean; maxDepth?: number; maxFiles?: number }): Promise<ToolExecutionResult> {
    const dirPath = this.validatePath(params.path || '.');
    
    // ✅ A-H6: Configurable limits with safe defaults to prevent memory exhaustion
    const MAX_DEPTH = params.maxDepth ?? 10;   // Default: 10 levels deep
    const MAX_FILES = params.maxFiles ?? 5000; // Default: 5000 files max
    
    let totalFiles = 0;
    let limitReached = false;
    let limitType: 'depth' | 'files' | null = null;
    
    const listFiles = async (dir: string, prefix = '', currentDepth = 0): Promise<string[]> => {
      // ✅ A-H6: Check depth limit
      if (currentDepth > MAX_DEPTH) {
        limitReached = true;
        limitType = 'depth';
        return [];
      }
      
      // ✅ A-H6: Check file count limit before proceeding
      if (totalFiles >= MAX_FILES) {
        limitReached = true;
        limitType = 'files';
        return [];
      }
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let files: string[] = [];

      for (const entry of entries) {
        // ✅ A-H6: Check file limit during iteration
        if (totalFiles >= MAX_FILES) {
          limitReached = true;
          limitType = 'files';
          break;
        }
        
        const relativePath = path.join(prefix, entry.name);
        
        if (entry.isDirectory()) {
          files.push(`${relativePath}/`);
          totalFiles++;
          
          if (params.recursive && !limitReached) {
            const subFiles = await listFiles(path.join(dir, entry.name), relativePath, currentDepth + 1);
            files.push(...subFiles);
          }
        } else {
          files.push(relativePath);
          totalFiles++;
        }
      }

      return files;
    };

    const files = await listFiles(dirPath);

    const output: any = {
      path: params.path || '.',
      files,
      count: files.length
    };
    
    // ✅ A-H6: Report if limits were reached
    if (limitReached) {
      output.truncated = true;
      output.truncationReason = limitType === 'depth' 
        ? `Maximum recursion depth of ${MAX_DEPTH} reached`
        : `Maximum file count of ${MAX_FILES} reached`;
      output.limits = { maxDepth: MAX_DEPTH, maxFiles: MAX_FILES };
    }

    return {
      success: true,
      output
    };
  }

  /**
   * Command Execution
   * Uses spawn() without shell to prevent command injection attacks
   */
  private async runCommand(params: { command: string; description: string; timeout?: number }): Promise<ToolExecutionResult> {
    const timeout = params.timeout || 30000;

    return new Promise((resolve) => {
      try {
        const parsedArgs = parseCommand(params.command);
        if (parsedArgs.length === 0) {
          resolve({
            success: false,
            error: 'Empty command provided'
          });
          return;
        }

        const [cmd, ...args] = parsedArgs;
        const sanitizedCmd = sanitizeCommand(cmd);
        
        if (!ALLOWED_COMMANDS.has(sanitizedCmd)) {
          resolve({
            success: false,
            error: `Command not allowed: ${sanitizedCmd}. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
          });
          return;
        }

        const sanitizedArgs = args.map(arg => sanitizeArgument(arg));
        
        let stdout = '';
        let stderr = '';
        
        const childProcess = spawn(sanitizedCmd, sanitizedArgs, {
          cwd: this.projectRoot,
          shell: false,
          timeout
        });

        childProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        childProcess.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            output: {
              command: params.command,
              stdout: stdout.trim(),
              stderr: stderr.trim() || error.message
            }
          });
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              output: {
                command: params.command,
                description: params.description,
                stdout: stdout.trim(),
                stderr: stderr.trim()
              },
              metadata: {
                commandOutput: stdout.trim()
              }
            });
          } else {
            resolve({
              success: false,
              error: `Command exited with code ${code}`,
              output: {
                command: params.command,
                stdout: stdout.trim(),
                stderr: stderr.trim()
              }
            });
          }
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: error.message,
          output: {
            command: params.command,
            stdout: '',
            stderr: error.message
          }
        });
      }
    });
  }

  private async installPackage(params: { package_name: string; dev?: boolean; version?: string }): Promise<ToolExecutionResult> {
    const versionSpec = params.version ? `@${params.version}` : '';
    const packageSpec = `${params.package_name}${versionSpec}`;
    const devFlag = params.dev ? '--save-dev' : '';
    const command = `npm install ${packageSpec} ${devFlag}`.trim();

    return await this.runCommand({
      command,
      description: `Installing package: ${packageSpec}${params.dev ? ' (dev dependency)' : ''}`
    });
  }

  /**
   * Search Tools
   */
  private async webSearch(params: { query: string; max_results?: number }): Promise<ToolExecutionResult> {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    // If Tavily API key is configured, use it
    if (tavilyApiKey) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: params.query,
            max_results: params.max_results || 5,
            include_answer: true,
            include_raw_content: false
          })
        });
        
        const data = await response.json();
        
        return {
          success: true,
          output: {
            query: params.query,
            answer: data.answer,
            results: data.results?.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score
            }))
          }
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Tavily API error: ${error.message}`
        };
      }
    }
    
    // Fallback: Indicate web search is available but needs configuration
    return {
      success: true,
      output: {
        query: params.query,
        message: 'Web search capability is available but requires API key configuration. Please add TAVILY_API_KEY to your secrets for real-time web search.',
        results: [],
        suggestion: 'You can get a free API key from https://tavily.com'
      }
    };
  }

  /**
   * Search code with protection against regex injection and output flooding
   * ✅ A-H10 FIX (Dec 16, 2025): Use spawn() directly with sanitized patterns
   */
  private async searchCode(params: { pattern: string; file_pattern?: string; max_results?: number }): Promise<ToolExecutionResult> {
    // ✅ A-H10: Configurable result limit to prevent huge output
    const MAX_RESULTS = params.max_results ?? 100;
    
    // ✅ A-H10: Escape regex metacharacters to prevent injection attacks
    // This converts user input to a literal string search (safer default)
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    const sanitizedPattern = escapeRegex(params.pattern);
    
    // ✅ A-H10: Build args array for spawn() instead of shell command string
    const args: string[] = [
      '-r',           // recursive
      '-n',           // line numbers
      '-l',           // only show filenames (for initial scan)
      '--color=never' // no ANSI codes in output
    ];
    
    // Add file pattern filter if specified (also sanitized)
    if (params.file_pattern) {
      // Sanitize file pattern - only allow safe glob characters
      const safeFilePattern = params.file_pattern.replace(/[;&|`$(){}[\]<>\\]/g, '');
      args.push(`--include=${safeFilePattern}`);
    }
    
    // Add pattern and search path
    args.push(sanitizedPattern);
    args.push('.');
    
    return new Promise((resolve) => {
      try {
        let stdout = '';
        let stderr = '';
        let resultCount = 0;
        let truncated = false;
        
        // ✅ A-H10: Use spawn() directly without shell to prevent injection
        const childProcess = spawn('grep', args, {
          cwd: this.projectRoot,
          shell: false,  // CRITICAL: Never use shell for user-provided input
          timeout: 30000
        });

        childProcess.stdout?.on('data', (data) => {
          const lines = data.toString().split('\n').filter((l: string) => l.trim());
          
          // ✅ A-H10: Limit output to prevent memory exhaustion
          for (const line of lines) {
            if (resultCount >= MAX_RESULTS) {
              truncated = true;
              break;
            }
            stdout += line + '\n';
            resultCount++;
          }
          
          // Kill process if we've reached the limit
          if (truncated && childProcess.pid) {
            childProcess.kill('SIGTERM');
          }
        });

        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        childProcess.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            output: {
              pattern: params.pattern,
              sanitizedPattern,
              matches: [],
              error: error.message
            }
          });
        });

        childProcess.on('close', (code) => {
          // grep returns 1 if no matches found (not an error)
          const matches = stdout.trim().split('\n').filter(l => l);
          
          const output: any = {
            pattern: params.pattern,
            sanitizedPattern,
            matches,
            matchCount: matches.length
          };
          
          // ✅ A-H10: Report if results were truncated
          if (truncated) {
            output.truncated = true;
            output.truncationReason = `Maximum result count of ${MAX_RESULTS} reached`;
            output.maxResults = MAX_RESULTS;
          }
          
          if (params.file_pattern) {
            output.filePattern = params.file_pattern;
          }
          
          resolve({
            success: true,
            output
          });
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: error.message,
          output: {
            pattern: params.pattern,
            matches: [],
            error: error.message
          }
        });
      }
    });
  }

  /**
   * Project Context
   */
  private async getProjectStructure(params: { include_content?: boolean }): Promise<ToolExecutionResult> {
    const structure = await this.listDirectory({ path: '.', recursive: true });
    
    let packageJson: any = null;
    if (params.include_content) {
      try {
        const content = await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf-8');
        packageJson = JSON.parse(content);
      } catch (error) {
        // package.json doesn't exist or is invalid
      }
    }

    return {
      success: true,
      output: {
        files: structure.output?.files || [],
        packageJson,
        projectRoot: this.projectRoot
      }
    };
  }

  private async getDiagnostics(params: { file_path?: string }): Promise<ToolExecutionResult> {
    const ts = await import('typescript');

    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

    if (params.file_path) {
      this.validatePath(params.file_path);

      const ext = path.extname(params.file_path).toLowerCase();
      if (!supportedExtensions.includes(ext)) {
        return {
          success: true,
          output: {
            message: `Diagnostics not supported for "${ext}" files. Supported: ${supportedExtensions.join(', ')}`,
            diagnostics: [],
            errors: [],
            warnings: []
          }
        };
      }
    }

    try {
      const tsconfigPath = ts.findConfigFile(
        this.projectRoot,
        ts.sys.fileExists,
        'tsconfig.json'
      );

      let compilerOptions: any = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: ts.JsxEmit.Preserve,
      };

      let rootFileNames: string[] = [];

      if (tsconfigPath) {
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        if (!configFile.error) {
          const parsed = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(tsconfigPath)
          );
          compilerOptions = parsed.options;
          rootFileNames = parsed.fileNames;
        }
      }

      let targetResolvedFile: string | undefined;
      if (params.file_path) {
        targetResolvedFile = path.resolve(this.projectRoot, params.file_path);
        if (!rootFileNames.includes(targetResolvedFile)) {
          rootFileNames.push(targetResolvedFile);
        }
      }

      if (rootFileNames.length === 0) {
        return {
          success: true,
          output: {
            message: 'No TypeScript/JavaScript files found to check',
            diagnostics: [],
            errors: [],
            warnings: []
          }
        };
      }

      const program = ts.createProgram(rootFileNames, {
        ...compilerOptions,
        noEmit: true,
        skipLibCheck: true,
      });

      let allDiagnostics: readonly any[];
      if (targetResolvedFile) {
        const sourceFile = program.getSourceFile(targetResolvedFile);
        if (!sourceFile) {
          return {
            success: true,
            output: {
              message: `File not found in program: ${params.file_path}`,
              diagnostics: [],
              errors: [],
              warnings: []
            }
          };
        }
        allDiagnostics = [
          ...program.getSyntacticDiagnostics(sourceFile),
          ...program.getSemanticDiagnostics(sourceFile),
        ];
      } else {
        allDiagnostics = [
          ...program.getSyntacticDiagnostics(),
          ...program.getSemanticDiagnostics(),
        ];
      }

      const diagnostics: Array<{
        file: string;
        line: number;
        column: number;
        severity: 'error' | 'warning' | 'info';
        message: string;
        code: string;
        source: string;
      }> = [];

      for (const diag of allDiagnostics) {
        if (!diag.file || diag.start === undefined) continue;

        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
        const filePath = path.relative(this.projectRoot, diag.file.fileName);

        let severity: 'error' | 'warning' | 'info' = 'info';
        if (diag.category === ts.DiagnosticCategory.Error) {
          severity = 'error';
        } else if (diag.category === ts.DiagnosticCategory.Warning) {
          severity = 'warning';
        }

        diagnostics.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          severity,
          message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
          code: `TS${diag.code}`,
          source: 'typescript',
        });
      }

      const errors = diagnostics.filter(d => d.severity === 'error');
      const warnings = diagnostics.filter(d => d.severity === 'warning');

      const fileLabel = params.file_path || 'project';
      let message: string;
      if (errors.length === 0 && warnings.length === 0) {
        message = `No diagnostics found for ${fileLabel}`;
      } else {
        message = `Found ${errors.length} error(s) and ${warnings.length} warning(s) in ${fileLabel}`;
      }

      return {
        success: true,
        output: {
          message,
          diagnostics,
          errors,
          warnings
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to run diagnostics: ${err.message}`
      };
    }
  }
}
