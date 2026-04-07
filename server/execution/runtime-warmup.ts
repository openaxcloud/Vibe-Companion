import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('runtime-warmup');

export interface LanguageRuntime {
  name: string;
  nixPackage: string;
  versionCmd: string;
  versionArgs: string[];
  binaryPath?: string;
}

export interface LanguageBundle {
  name: string;
  priority: number;
  languages: LanguageRuntime[];
}

const LANGUAGE_BUNDLES: LanguageBundle[] = [
  {
    name: 'core',
    priority: 1,
    languages: [
      { name: 'javascript', nixPackage: 'nodejs', versionCmd: 'node', versionArgs: ['--version'] },
      { name: 'typescript', nixPackage: 'nodejs', versionCmd: 'node', versionArgs: ['--version'] },
      { name: 'python', nixPackage: 'python3', versionCmd: 'python3', versionArgs: ['--version'] },
      { name: 'bash', nixPackage: 'bash', versionCmd: 'bash', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'systems',
    priority: 2,
    languages: [
      { name: 'c', nixPackage: 'gcc', versionCmd: 'gcc', versionArgs: ['--version'] },
      { name: 'cpp', nixPackage: 'gcc', versionCmd: 'g++', versionArgs: ['--version'] },
      { name: 'go', nixPackage: 'go', versionCmd: 'go', versionArgs: ['version'] },
      { name: 'rust', nixPackage: 'rustc', versionCmd: 'rustc', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'scripting',
    priority: 3,
    languages: [
      { name: 'ruby', nixPackage: 'ruby', versionCmd: 'ruby', versionArgs: ['--version'] },
      { name: 'php', nixPackage: 'php', versionCmd: 'php', versionArgs: ['--version'] },
      { name: 'perl', nixPackage: 'perl', versionCmd: 'perl', versionArgs: ['--version'] },
      { name: 'lua', nixPackage: 'lua', versionCmd: 'lua', versionArgs: ['-v'] },
    ]
  },
  {
    name: 'jvm',
    priority: 4,
    languages: [
      { name: 'java', nixPackage: 'jdk', versionCmd: 'java', versionArgs: ['--version'] },
      { name: 'kotlin', nixPackage: 'kotlin', versionCmd: 'kotlin', versionArgs: ['-version'] },
      { name: 'scala', nixPackage: 'scala', versionCmd: 'scala', versionArgs: ['-version'] },
      { name: 'clojure', nixPackage: 'clojure', versionCmd: 'clojure', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'functional',
    priority: 5,
    languages: [
      { name: 'haskell', nixPackage: 'ghc', versionCmd: 'ghc', versionArgs: ['--version'] },
      { name: 'ocaml', nixPackage: 'ocaml', versionCmd: 'ocaml', versionArgs: ['-version'] },
      { name: 'elixir', nixPackage: 'elixir', versionCmd: 'elixir', versionArgs: ['--version'] },
      { name: 'erlang', nixPackage: 'erlang', versionCmd: 'erl', versionArgs: ['-eval', 'io:format("~s~n", [erlang:system_info(otp_release)]), halt().', '-noshell'] },
    ]
  },
  {
    name: 'scientific',
    priority: 6,
    languages: [
      { name: 'r', nixPackage: 'R', versionCmd: 'R', versionArgs: ['--version'] },
      { name: 'julia', nixPackage: 'julia-bin', versionCmd: 'julia', versionArgs: ['--version'] },
      { name: 'fortran', nixPackage: 'gfortran', versionCmd: 'gfortran', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'modern',
    priority: 7,
    languages: [
      { name: 'deno', nixPackage: 'deno', versionCmd: 'deno', versionArgs: ['--version'] },
      { name: 'zig', nixPackage: 'zig', versionCmd: 'zig', versionArgs: ['version'] },
      { name: 'dart', nixPackage: 'dart', versionCmd: 'dart', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'dotnet',
    priority: 8,
    languages: [
      { name: 'csharp', nixPackage: 'dotnet-sdk_8', versionCmd: 'dotnet', versionArgs: ['--version'] },
      { name: 'fsharp', nixPackage: 'dotnet-sdk_8', versionCmd: 'dotnet', versionArgs: ['--version'] },
    ]
  },
  {
    name: 'nix',
    priority: 9,
    languages: [
      { name: 'nix', nixPackage: 'nix', versionCmd: 'nix', versionArgs: ['--version'] },
    ]
  }
];

class RuntimeWarmupManager {
  private readyLanguages: Set<string> = new Set();
  private warmupInProgress: boolean = false;
  private warmupComplete: boolean = false;
  private bundleStatus: Map<string, 'pending' | 'installing' | 'ready' | 'failed'> = new Map();

  constructor() {
    LANGUAGE_BUNDLES.forEach(bundle => {
      this.bundleStatus.set(bundle.name, 'pending');
    });
  }

  async checkLanguageAvailability(language: LanguageRuntime): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(language.versionCmd, language.versionArgs, {
          timeout: 10000,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        proc.stdout?.on('data', (data) => { output += data.toString(); });
        proc.stderr?.on('data', (data) => { output += data.toString(); });

        proc.on('close', (code) => {
          const available = code === 0 && output.length > 0;
          if (available) {
            this.readyLanguages.add(language.name);
          }
          resolve(available);
        });

        proc.on('error', () => {
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async warmupBundle(bundle: LanguageBundle): Promise<void> {
    this.bundleStatus.set(bundle.name, 'installing');
    logger.info(`[RuntimeWarmup] Starting bundle: ${bundle.name}`);

    const results = await Promise.all(
      bundle.languages.map(async (lang) => {
        const available = await this.checkLanguageAvailability(lang);
        return { lang, available };
      })
    );

    const ready = results.filter(r => r.available).map(r => r.lang.name);
    const notAvailable = results.filter(r => !r.available).map(r => r.lang.name);
    const allReady = notAvailable.length === 0;
    this.bundleStatus.set(bundle.name, allReady ? 'ready' : 'failed');

    if (allReady) {
      logger.info(`[RuntimeWarmup] Bundle ${bundle.name}: ✅ complete (${ready.join(', ')})`);
    } else if (ready.length > 0) {
      logger.info(`[RuntimeWarmup] Bundle ${bundle.name}: ⚠️ partial (ready: ${ready.join(', ')})`);
    } else {
      logger.info(`[RuntimeWarmup] Bundle ${bundle.name}: skipped (no runtimes installed)`);
    }
  }

  async warmup(): Promise<void> {
    if (this.warmupInProgress || this.warmupComplete) {
      return;
    }

    this.warmupInProgress = true;
    logger.info('[RuntimeWarmup] Starting language runtime warmup...');
    const startTime = Date.now();

    const sortedBundles = [...LANGUAGE_BUNDLES].sort((a, b) => a.priority - b.priority);

    for (const bundle of sortedBundles) {
      await this.warmupBundle(bundle);
    }

    this.warmupComplete = true;
    this.warmupInProgress = false;

    const duration = Date.now() - startTime;
    logger.info(`[RuntimeWarmup] Complete in ${duration}ms. Ready languages: ${this.readyLanguages.size}/29`);
    logger.info(`[RuntimeWarmup] Available: ${[...this.readyLanguages].sort().join(', ')}`);
  }

  isLanguageReady(language: string): boolean {
    const normalizedLang = language.toLowerCase().trim();
    const aliases: Record<string, string> = {
      'node': 'javascript',
      'nodejs': 'javascript',
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'python3': 'python',
      'c++': 'cpp',
      'cxx': 'cpp',
      'golang': 'go',
      'rb': 'ruby',
      'rs': 'rust',
      'hs': 'haskell',
      'ml': 'ocaml',
      'ex': 'elixir',
      'erl': 'erlang',
      'jl': 'julia',
      'cs': 'csharp',
      'fs': 'fsharp',
      'f90': 'fortran',
      'f95': 'fortran',
      'kt': 'kotlin',
      'sh': 'bash',
      'shell': 'bash',
    };

    const canonicalName = aliases[normalizedLang] || normalizedLang;
    return this.readyLanguages.has(canonicalName);
  }

  getReadyLanguages(): string[] {
    return [...this.readyLanguages].sort();
  }

  getStatus(): {
    warmupComplete: boolean;
    warmupInProgress: boolean;
    readyCount: number;
    totalCount: number;
    bundles: Record<string, string>;
    readyLanguages: string[];
  } {
    const bundles: Record<string, string> = {};
    this.bundleStatus.forEach((status, name) => {
      bundles[name] = status;
    });

    return {
      warmupComplete: this.warmupComplete,
      warmupInProgress: this.warmupInProgress,
      readyCount: this.readyLanguages.size,
      totalCount: 29,
      bundles,
      readyLanguages: this.getReadyLanguages()
    };
  }

  getAllLanguages(): LanguageRuntime[] {
    return LANGUAGE_BUNDLES.flatMap(bundle => bundle.languages);
  }
}

export const runtimeWarmup = new RuntimeWarmupManager();

export async function initializeRuntimes(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.WARMUP_RUNTIMES === 'true') {
    logger.info('[RuntimeWarmup] Production mode - starting warmup...');
    await runtimeWarmup.warmup();
  } else {
    logger.info('[RuntimeWarmup] Development mode - checking available runtimes...');
    await runtimeWarmup.warmup();
  }
}
