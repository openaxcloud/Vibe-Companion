import * as fs from 'fs/promises';
import * as path from 'path';
import { nixPackageManager } from './nix-package-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('nix-environment-builder');

export interface BuildEnvironmentOptions {
  projectId: string;
  language: string;
  packages?: string[];
  customShellNix?: string;
}

export interface BuiltEnvironment {
  profilePath: string;
  envVars: Record<string, string>;
  binPaths: string[];
  libPaths: string[];
  includePaths: string[];
}

export class NixEnvironmentBuilder {
  private buildCache: Map<string, BuiltEnvironment> = new Map();

  async buildEnvironment(options: BuildEnvironmentOptions): Promise<BuiltEnvironment> {
    const { projectId, language, packages = [], customShellNix } = options;
    
    logger.info(`Building Nix environment for project ${projectId}, language: ${language}`);
    
    // Check cache
    const cacheKey = `${projectId}-${language}-${packages.join(',')}`;
    const cached = this.buildCache.get(cacheKey);
    if (cached) {
      logger.info('Using cached environment');
      return cached;
    }
    
    // Get base packages for language
    const basePackages = await this.getBasePackagesForLanguage(language);
    const allPackages = Array.from(new Set([...basePackages, ...packages]));
    
    // Create Nix environment
    const env = await nixPackageManager.createEnvironment(projectId, allPackages);
    
    // Get profile path
    const profilePath = `/var/lib/ecode/nix-profiles/${projectId}`;
    
    // Extract paths from environment
    const binPaths = this.extractPaths(env.env.PATH || '', '/bin');
    const libPaths = this.extractPaths(env.env.LD_LIBRARY_PATH || '', '/lib');
    const includePaths = this.extractPaths(env.env.C_INCLUDE_PATH || '', '/include');
    
    const builtEnv: BuiltEnvironment = {
      profilePath,
      envVars: env.env,
      binPaths,
      libPaths,
      includePaths
    };
    
    // Cache the result
    this.buildCache.set(cacheKey, builtEnv);
    
    return builtEnv;
  }

  async getLanguageRuntime(language: string): Promise<string> {
    const runtimeCommands: Record<string, string> = {
      javascript: 'node',
      typescript: 'node',
      nodejs: 'node',
      python: 'python3',
      python3: 'python3',
      ruby: 'ruby',
      go: 'go run',
      rust: 'cargo run',
      java: 'java',
      c: 'gcc',
      cpp: 'g++',
      csharp: 'dotnet run',
      php: 'php',
      perl: 'perl',
      r: 'Rscript',
      julia: 'julia',
      swift: 'swift',
      kotlin: 'kotlin',
      scala: 'scala',
      haskell: 'runhaskell',
      elixir: 'elixir',
      clojure: 'clojure',
      lua: 'lua',
      bash: 'bash',
      sh: 'sh'
    };
    
    return runtimeCommands[language.toLowerCase()] || 'echo "Unknown language"';
  }

  private async getBasePackagesForLanguage(language: string): Promise<string[]> {
    const languagePackages: Record<string, string[]> = {
      javascript: ['nodejs_20', 'nodePackages.npm'],
      typescript: ['nodejs_20', 'nodePackages.npm', 'nodePackages.typescript'],
      nodejs: ['nodejs_20', 'nodePackages.npm'],
      python: ['python311', 'python311Packages.pip'],
      python3: ['python311', 'python311Packages.pip'],
      ruby: ['ruby_3_2', 'bundler'],
      go: ['go_1_21'],
      rust: ['rustc', 'cargo'],
      java: ['jdk17', 'maven', 'gradle'],
      c: ['gcc', 'gnumake', 'pkg-config'],
      cpp: ['gcc', 'gnumake', 'pkg-config', 'cmake'],
      csharp: ['dotnet-sdk_8'],
      php: ['php82', 'php82Packages.composer'],
      perl: ['perl538'],
      r: ['R', 'rPackages.tidyverse'],
      julia: ['julia_19'],
      swift: ['swift'],
      kotlin: ['kotlin'],
      scala: ['scala_3', 'sbt'],
      haskell: ['ghc', 'cabal-install'],
      elixir: ['elixir_1_15', 'erlang'],
      clojure: ['clojure', 'leiningen'],
      lua: ['lua5_4'],
      bash: ['bash', 'coreutils', 'gnugrep', 'gnused'],
      sh: ['bash', 'coreutils']
    };
    
    return languagePackages[language.toLowerCase()] || [];
  }

  private extractPaths(pathString: string, suffix: string): string[] {
    if (!pathString) return [];
    
    return pathString
      .split(':')
      .filter(p => p.includes('/nix/store') && p.endsWith(suffix))
      .filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates
  }

  async createContainerBindMounts(environment: BuiltEnvironment): Promise<Map<string, string>> {
    const mounts = new Map<string, string>();
    
    // Mount the Nix store (read-only)
    mounts.set('/nix/store', '/nix/store:ro');
    
    // Mount the profile
    mounts.set(environment.profilePath, `/ecode/profile:ro`);
    
    // Mount specific paths to avoid mounting entire store
    for (const binPath of environment.binPaths) {
      const nixStorePath = binPath.match(/\/nix\/store\/[^/]+/)?.[0];
      if (nixStorePath) {
        mounts.set(nixStorePath, `${nixStorePath}:ro`);
      }
    }
    
    return mounts;
  }

  clearCache(): void {
    this.buildCache.clear();
  }
}

export const nixEnvironmentBuilder = new NixEnvironmentBuilder();