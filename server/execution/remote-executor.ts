/**
 * Remote Code Execution Service
 * Uses Piston API (https://github.com/engineer-man/piston) for production code execution
 * This allows the main deployment to be lightweight without language runtimes
 */

import { ExecutionResult, ExecutionOptions } from './executor';

const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{ name: string; content: string }>;
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
}

interface PistonExecuteResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  language: string;
  version: string;
}

const LANGUAGE_TO_PISTON: Record<string, { language: string; version?: string; entryFile: string }> = {
  'javascript': { language: 'javascript', entryFile: 'main.js' },
  'typescript': { language: 'typescript', entryFile: 'main.ts' },
  'python': { language: 'python', entryFile: 'main.py' },
  'go': { language: 'go', entryFile: 'main.go' },
  'rust': { language: 'rust', entryFile: 'main.rs' },
  'c': { language: 'c', entryFile: 'main.c' },
  'cpp': { language: 'c++', entryFile: 'main.cpp' },
  'java': { language: 'java', entryFile: 'Main.java' },
  'kotlin': { language: 'kotlin', entryFile: 'main.kt' },
  'scala': { language: 'scala', entryFile: 'main.scala' },
  'ruby': { language: 'ruby', entryFile: 'main.rb' },
  'php': { language: 'php', entryFile: 'main.php' },
  'perl': { language: 'perl', entryFile: 'main.pl' },
  'lua': { language: 'lua', entryFile: 'main.lua' },
  'r': { language: 'rscript', entryFile: 'main.r' },
  'bash': { language: 'bash', entryFile: 'main.sh' },
  'haskell': { language: 'haskell', entryFile: 'main.hs' },
  'elixir': { language: 'elixir', entryFile: 'main.exs' },
  'clojure': { language: 'clojure', entryFile: 'main.clj' },
  'fsharp': { language: 'fsharp.net', entryFile: 'main.fs' },
  'csharp': { language: 'csharp.net', entryFile: 'main.cs' },
  'dart': { language: 'dart', entryFile: 'main.dart' },
  'julia': { language: 'julia', entryFile: 'main.jl' },
  'ocaml': { language: 'ocaml', entryFile: 'main.ml' },
  'fortran': { language: 'fortran', entryFile: 'main.f90' },
  'zig': { language: 'zig', entryFile: 'main.zig' },
  'erlang': { language: 'erlang', entryFile: 'main.erl' },
};

// Languages that require local execution (not available in Piston)
// These will fall back to local process execution
export const LOCAL_ONLY_LANGUAGES = new Set(['deno', 'nix']);

let cachedRuntimes: PistonRuntime[] | null = null;
let runtimesCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export class RemoteCodeExecutor {
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || PISTON_API_URL;
  }

  async getRuntimes(): Promise<PistonRuntime[]> {
    if (cachedRuntimes && Date.now() - runtimesCacheTime < CACHE_TTL) {
      return cachedRuntimes;
    }

    try {
      const response = await fetch(`${this.apiUrl}/runtimes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch runtimes: ${response.statusText}`);
      }
      cachedRuntimes = await response.json();
      runtimesCacheTime = Date.now();
      return cachedRuntimes!;
    } catch (error) {
      console.error('[RemoteExecutor] Failed to fetch runtimes:', error);
      return [];
    }
  }

  async isLanguageSupported(language: string): Promise<boolean> {
    const mapping = LANGUAGE_TO_PISTON[language.toLowerCase()];
    if (!mapping) return false;

    const runtimes = await this.getRuntimes();
    return runtimes.some(r => 
      r.language === mapping.language || 
      r.aliases.includes(mapping.language)
    );
  }

  async getSupportedLanguages(): Promise<string[]> {
    const runtimes = await this.getRuntimes();
    const supported: string[] = [];
    
    for (const [lang, mapping] of Object.entries(LANGUAGE_TO_PISTON)) {
      if (runtimes.some(r => r.language === mapping.language || r.aliases.includes(mapping.language))) {
        supported.push(lang);
      }
    }
    
    return supported;
  }

  async execute(
    language: string,
    code: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const normalizedLang = language.toLowerCase().trim();
    const mapping = LANGUAGE_TO_PISTON[normalizedLang];

    if (!mapping) {
      return {
        output: '',
        error: `Unsupported language: ${language}`,
        executionTime: 0,
        memoryUsed: 0,
        exitCode: 1,
      };
    }

    try {
      const runtimes = await this.getRuntimes();
      const runtime = runtimes.find(r => 
        r.language === mapping.language || 
        r.aliases.includes(mapping.language)
      );

      if (!runtime) {
        return {
          output: '',
          error: `Runtime not available for ${language}. The remote execution service may not support this language.`,
          executionTime: Date.now() - startTime,
          memoryUsed: 0,
          exitCode: 1,
        };
      }

      const files = [{ name: mapping.entryFile, content: code }];
      
      if (options.files) {
        for (const [name, content] of Object.entries(options.files)) {
          files.push({ name, content });
        }
      }

      const request: PistonExecuteRequest = {
        language: runtime.language,
        version: runtime.version,
        files,
        stdin: options.input,
        run_timeout: options.timeout || 10000,
        run_memory_limit: options.maxMemory ? options.maxMemory * 1024 * 1024 : -1,
      };

      const response = await fetch(`${this.apiUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          output: '',
          error: `Execution failed: ${response.statusText} - ${errorText}`,
          executionTime: Date.now() - startTime,
          memoryUsed: 0,
          exitCode: 1,
        };
      }

      const result: PistonExecuteResponse = await response.json();
      const executionTime = Date.now() - startTime;

      let output = result.run.stdout || '';
      let error = result.run.stderr || '';

      if (result.compile) {
        if (result.compile.code !== 0) {
          error = result.compile.output || result.compile.stderr || 'Compilation failed';
        }
      }

      return {
        output: output.trim(),
        error: error.trim() || undefined,
        executionTime,
        memoryUsed: 0,
        exitCode: result.run.code,
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        exitCode: 1,
      };
    }
  }
}

export const remoteExecutor = new RemoteCodeExecutor();

export async function executeRemotely(
  language: string,
  code: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  return remoteExecutor.execute(language, code, options);
}
