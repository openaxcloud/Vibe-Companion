import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { dockerExecutor } from './docker-executor';
import { remoteExecutor, LOCAL_ONLY_LANGUAGES } from './remote-executor';
import { createLogger } from '../utils/logger';

const logger = createLogger('executor');

export interface ExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  input?: string;
  files?: Record<string, string>;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  exitCode: number;
}

// Execution mode: 'local' | 'docker' | 'remote' | 'auto'
// - local: Use local process execution (requires language runtimes installed)
// - docker: Use Docker containers (requires Docker)
// - remote: Use Piston API (no local runtimes needed)
// - auto: Try Docker -> Remote -> Local fallback chain
const EXECUTION_MODE = process.env.EXECUTION_MODE || (process.env.NODE_ENV === 'production' ? 'remote' : 'local');

// Check if Docker execution mode is enabled (production)
const USE_DOCKER_EXECUTION = EXECUTION_MODE === 'docker' || EXECUTION_MODE === 'auto';
const USE_REMOTE_EXECUTION = EXECUTION_MODE === 'remote' || EXECUTION_MODE === 'auto';

// Normalize language aliases to canonical names
// Full 29-language support for Fortune 500 production parity with Replit
const LANGUAGE_ALIASES: Record<string, string> = {
  // JavaScript/TypeScript/Node.js
  'js': 'javascript',
  'javascript': 'javascript',
  'nodejs': 'javascript',
  'node': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  // Python
  'python': 'python',
  'python3': 'python',
  'py': 'python',
  // Go
  'go': 'go',
  'golang': 'go',
  // C/C++
  'cpp': 'cpp',
  'c++': 'cpp',
  'c': 'c',
  // Java/JVM languages
  'java': 'java',
  'kotlin': 'kotlin',
  'kt': 'kotlin',
  'scala': 'scala',
  'clojure': 'clojure',
  'clj': 'clojure',
  // Rust
  'rust': 'rust',
  'rs': 'rust',
  // PHP
  'php': 'php',
  // Ruby
  'ruby': 'ruby',
  'rb': 'ruby',
  // C#/.NET/F#
  'csharp': 'csharp',
  'cs': 'csharp',
  'c#': 'csharp',
  'fsharp': 'fsharp',
  'fs': 'fsharp',
  'f#': 'fsharp',
  // Shell
  'bash': 'bash',
  'sh': 'bash',
  'shell': 'bash',
  // Other languages
  'deno': 'deno',
  'lua': 'lua',
  'perl': 'perl',
  'pl': 'perl',
  'r': 'r',
  'haskell': 'haskell',
  'hs': 'haskell',
  'elixir': 'elixir',
  'ex': 'elixir',
  'erlang': 'erlang',
  'erl': 'erlang',
  'julia': 'julia',
  'jl': 'julia',
  'ocaml': 'ocaml',
  'ml': 'ocaml',
  'fortran': 'fortran',
  'f90': 'fortran',
  'zig': 'zig',
  'dart': 'dart',
  'nix': 'nix',
  // HTML/CSS/JS (web preview)
  'html': 'html-css-js',
  'html-css-js': 'html-css-js',
};

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

// Per-language execution adapter - returns command and args without shell parsing
interface LanguageAdapter {
  cmd: string;
  args: string[];
  entryFile: string;
  compileCmd?: string;
  compileArgs?: string[];
  staticFiles?: Record<string, string>; // Extra files to write before execution (e.g., .csproj)
}

// Allowed languages for validation (includes all aliases)
const ALLOWED_LANGUAGES = new Set(Object.keys(LANGUAGE_ALIASES));

// Maximum code size (1MB)
const MAX_CODE_SIZE = 1024 * 1024;

export class CodeExecutor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'e-code-executor');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Validate execution request before processing
   */
  private validateRequest(language: string, code: string): { valid: boolean; error?: string } {
    // Validate language
    if (!language || typeof language !== 'string') {
      return { valid: false, error: 'Language is required' };
    }
    
    const normalizedLang = language.toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(normalizedLang)) {
      const supportedList = [...new Set(Object.values(LANGUAGE_ALIASES))].sort().join(', ');
      return { valid: false, error: `Unsupported language: ${language}. Supported: ${supportedList}` };
    }

    // Validate code
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Code is required' };
    }

    // Check code size
    if (code.length > MAX_CODE_SIZE) {
      return { valid: false, error: `Code size exceeds maximum (${MAX_CODE_SIZE} bytes)` };
    }

    return { valid: true };
  }

  async execute(language: string, code: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 30000; // 30 seconds default
    
    // Validate request first
    const validation = this.validateRequest(language, code);
    if (!validation.valid) {
      return {
        output: '',
        error: validation.error,
        executionTime: 0,
        memoryUsed: 0,
        exitCode: 1
      };
    }

    // Try Docker execution first in production for security
    if (USE_DOCKER_EXECUTION) {
      try {
        const normalizedLang = normalizeLanguage(language);
        const dockerResult = await dockerExecutor.executeCode(
          normalizedLang,
          code,
          options.input
        );
        return {
          output: dockerResult.output,
          error: dockerResult.error || undefined,
          executionTime: Date.now() - startTime,
          memoryUsed: 0,
          exitCode: dockerResult.exitCode
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('dockerode is not available') || 
            errorMsg.includes('Docker') || 
            errorMsg.includes('connect ENOENT')) {
          logger.info('Docker not available, trying remote execution');
        } else {
          return {
            output: '',
            error: errorMsg,
            executionTime: Date.now() - startTime,
            memoryUsed: 0,
            exitCode: 1
          };
        }
      }
    }

    // Try remote execution (Piston API) - ideal for production without local runtimes
    // Skip remote for languages that require local execution (deno, nix)
    const normalizedLang = normalizeLanguage(language);
    const requiresLocalExecution = LOCAL_ONLY_LANGUAGES.has(normalizedLang);
    
    if (USE_REMOTE_EXECUTION && !requiresLocalExecution) {
      try {
        const remoteResult = await remoteExecutor.execute(normalizedLang, code, options);
        if (!remoteResult.error?.includes('Unsupported language') && 
            !remoteResult.error?.includes('Runtime not available')) {
          return remoteResult;
        }
        logger.info('Remote execution failed, falling back to local:', remoteResult.error);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.info('Remote execution error, falling back to local:', errorMsg);
      }
    } else if (requiresLocalExecution) {
      logger.info(`${normalizedLang} requires local execution (not available in Piston)`);
    }

    // Process execution (development or production fallback when Docker unavailable)
    let execDir: string | null = null;

    try {
      // Create execution directory
      const execId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      execDir = path.join(this.tempDir, execId);
      mkdirSync(execDir, { recursive: true });

      // Write additional files if provided
      if (options.files) {
        for (const [fileName, content] of Object.entries(options.files)) {
          const filePath = path.join(execDir, fileName);
          const fileDir = path.dirname(filePath);
          if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
          }
          writeFileSync(filePath, content);
        }
      }

      // Get language adapter (cmd, args, entryFile)
      const adapter = this.getLanguageAdapter(language);

      // Write static files required by the language (e.g., .csproj for C#)
      if (adapter.staticFiles) {
        for (const [fileName, content] of Object.entries(adapter.staticFiles)) {
          writeFileSync(path.join(execDir, fileName), content);
        }
      }
      
      // Write main file
      writeFileSync(path.join(execDir, adapter.entryFile), code);

      // Compile if needed (for compiled languages)
      if (adapter.compileCmd && adapter.compileArgs) {
        const compileResult = await this.runProcess(
          adapter.compileCmd,
          adapter.compileArgs,
          execDir,
          { timeout: timeout / 2 }
        );
        
        if (compileResult.exitCode !== 0) {
          const executionTime = Date.now() - startTime;
          return {
            output: compileResult.stdout,
            error: compileResult.stderr || 'Compilation failed',
            executionTime,
            memoryUsed: 0,
            exitCode: compileResult.exitCode
          };
        }
      }

      // Execute code using spawn (no shell interpretation)
      const result = await this.runProcess(
        adapter.cmd,
        adapter.args,
        execDir,
        { timeout, input: options.input }
      );

      const executionTime = Date.now() - startTime;

      return {
        output: result.stdout,
        error: result.stderr || undefined,
        executionTime,
        memoryUsed: 0,
        exitCode: result.exitCode
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        output: '',
        error: error.message || 'Execution failed',
        executionTime,
        memoryUsed: 0,
        exitCode: 1
      };
    } finally {
      // Cleanup execution directory
      if (execDir && existsSync(execDir)) {
        try {
          rmSync(execDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Get language adapter with command and args array
   * Using args array prevents shell metacharacter injection
   */
  private getLanguageAdapter(language: string): LanguageAdapter {
    const normalizedLang = normalizeLanguage(language);
    
    switch (normalizedLang) {
      case 'javascript':
        return { cmd: 'node', args: ['main.js'], entryFile: 'main.js' };
      
      case 'typescript':
        return { cmd: 'npx', args: ['tsx', 'main.ts'], entryFile: 'main.ts' };
      
      case 'python':
        return { cmd: 'python3', args: ['main.py'], entryFile: 'main.py' };
      
      case 'java':
        return {
          cmd: 'java', args: ['Main'], entryFile: 'Main.java',
          compileCmd: 'javac', compileArgs: ['Main.java']
        };
      
      case 'kotlin':
        return {
          cmd: 'java', args: ['-jar', 'main.jar'], entryFile: 'Main.kt',
          compileCmd: 'kotlinc', compileArgs: ['Main.kt', '-include-runtime', '-d', 'main.jar']
        };
      
      case 'scala':
        return { cmd: 'scala', args: ['main.scala'], entryFile: 'main.scala' };
      
      case 'clojure':
        return { cmd: 'clojure', args: ['main.clj'], entryFile: 'main.clj' };
      
      case 'cpp':
        return {
          cmd: './main', args: [], entryFile: 'main.cpp',
          compileCmd: 'g++', compileArgs: ['-o', 'main', 'main.cpp']
        };
      
      case 'c':
        return {
          cmd: './main', args: [], entryFile: 'main.c',
          compileCmd: 'gcc', compileArgs: ['-o', 'main', 'main.c']
        };
      
      case 'csharp':
        return {
          cmd: 'dotnet',
          args: ['run', '--project', 'app.csproj'],
          entryFile: 'Program.cs',
          staticFiles: {
            'app.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>`
          }
        };
      
      case 'fsharp':
        return { cmd: 'dotnet', args: ['fsi', 'main.fsx'], entryFile: 'main.fsx' };
      
      case 'go':
        return { cmd: 'go', args: ['run', 'main.go'], entryFile: 'main.go' };
      
      case 'rust':
        return {
          cmd: './main', args: [], entryFile: 'main.rs',
          compileCmd: 'rustc', compileArgs: ['main.rs', '-o', 'main']
        };
      
      case 'php':
        return { cmd: 'php', args: ['main.php'], entryFile: 'main.php' };
      
      case 'ruby':
        return { cmd: 'ruby', args: ['main.rb'], entryFile: 'main.rb' };
      
      case 'bash':
        return { cmd: 'bash', args: ['main.sh'], entryFile: 'main.sh' };
      
      case 'deno':
        return { cmd: 'deno', args: ['run', '--allow-all', 'main.ts'], entryFile: 'main.ts' };
      
      case 'lua':
        return { cmd: 'lua', args: ['main.lua'], entryFile: 'main.lua' };
      
      case 'perl':
        return { cmd: 'perl', args: ['main.pl'], entryFile: 'main.pl' };
      
      case 'r':
        return { cmd: 'Rscript', args: ['main.R'], entryFile: 'main.R' };
      
      case 'haskell':
        return { cmd: 'runhaskell', args: ['main.hs'], entryFile: 'main.hs' };
      
      case 'elixir':
        return { cmd: 'elixir', args: ['main.exs'], entryFile: 'main.exs' };
      
      case 'erlang':
        return { cmd: 'escript', args: ['main.erl'], entryFile: 'main.erl' };
      
      case 'julia':
        return { cmd: 'julia', args: ['main.jl'], entryFile: 'main.jl' };
      
      case 'ocaml':
        return { cmd: 'ocaml', args: ['main.ml'], entryFile: 'main.ml' };
      
      case 'fortran':
        return {
          cmd: './main', args: [], entryFile: 'main.f90',
          compileCmd: 'gfortran', compileArgs: ['-o', 'main', 'main.f90']
        };
      
      case 'zig':
        return { cmd: 'zig', args: ['run', 'main.zig'], entryFile: 'main.zig' };
      
      case 'dart':
        return { cmd: 'dart', args: ['run', 'main.dart'], entryFile: 'main.dart' };
      
      case 'nix':
        return { cmd: 'nix-instantiate', args: ['--eval', 'main.nix'], entryFile: 'main.nix' };
      
      case 'html-css-js':
        return { cmd: 'node', args: ['preview.js'], entryFile: 'index.html' };
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Run a process using spawn (not exec) to prevent shell injection
   */
  private runProcess(
    cmd: string,
    args: string[],
    cwd: string,
    options: { timeout: number; input?: string }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      // Use spawn with shell: false to prevent shell metacharacter interpretation
      const proc = spawn(cmd, args, {
        cwd,
        env: {
          ...process.env,
          SANDBOX_EXECUTION: 'true',
          HOME: cwd, // Restrict HOME to execution directory
          TMPDIR: cwd
        },
        shell: false, // CRITICAL: Do not use shell - prevents injection
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        // Force kill after 5 seconds if SIGTERM doesn't work
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, options.timeout);

      // Collect stdout
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        // Limit output size to prevent memory issues
        if (stdout.length > 10 * 1024 * 1024) {
          killed = true;
          proc.kill('SIGTERM');
        }
      });

      // Collect stderr
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        // Limit error size
        if (stderr.length > 10 * 1024 * 1024) {
          killed = true;
          proc.kill('SIGTERM');
        }
      });

      // Handle process exit
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (killed && code === null) {
          resolve({
            stdout,
            stderr: stderr || 'Execution timed out or output exceeded limit',
            exitCode: 124 // Standard timeout exit code
          });
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 1
          });
        }
      });

      // Handle spawn errors
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });

      // Write input if provided
      if (options.input) {
        proc.stdin.write(options.input);
      }
      proc.stdin.end();
    });
  }
}

// Export singleton instance for convenience
export const codeExecutor = new CodeExecutor();
