/**
 * Repository Overview Service
 * Analyzes project structure and provides context to AI Agent
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import type {
  RepoOverview,
  RepoContext,
  RepoAnalysisResult,
  RepoStructure,
  DirectoryInfo,
  FileInfo,
  ConfigFileInfo,
  LanguageInfo,
  FrameworkInfo,
  DependenciesInfo,
  EntryPoints,
  RepoMetrics,
  PackageInfo
} from '@shared/agent/repo-overview';

export class RepoOverviewService {
  private cache = new Map<string, RepoAnalysisResult>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private maxFiles = 5000; // ✅ PERFORMANCE: Limit to 5000 files max
  private scanTimeout = 25000; // ✅ PERFORMANCE: 25 second scan limit

  /**
   * Generate complete repository overview
   */
  async generateOverview(projectPath: string): Promise<RepoAnalysisResult> {
    const cached = this.cache.get(projectPath);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached;
    }

    const structure = await this.analyzeStructure(projectPath);
    const languages = this.detectLanguages(structure);
    const frameworks = await this.detectFrameworks(projectPath, structure);
    const dependencies = await this.parseDependencies(projectPath);
    const entryPoints = this.detectEntryPoints(structure);
    const metrics = this.calculateMetrics(structure, languages);

    const name = await this.getProjectName(projectPath);
    const description = await this.getProjectDescription(projectPath);

    const overview: RepoOverview = {
      name,
      description,
      structure,
      languages,
      frameworks,
      dependencies,
      entryPoints,
      metrics
    };

    const context = this.extractContext(overview);
    const recommendations = this.generateRecommendations(overview);
    const warnings = this.detectWarnings(overview);

    const result: RepoAnalysisResult = {
      overview,
      context,
      recommendations,
      warnings,
      timestamp: Date.now()
    };

    this.cache.set(projectPath, result);
    return result;
  }

  /**
   * Analyze directory structure with performance guards
   * ✅ PERFORMANCE: Add file count limit and early termination
   */
  private async analyzeStructure(path: string): Promise<RepoStructure> {
    const directories: DirectoryInfo[] = [];
    const mainFiles: FileInfo[] = [];
    const configFiles: ConfigFileInfo[] = [];
    let totalFiles = 0;
    let totalDirectories = 0;
    let isLimitReached = false;
    const startTime = Date.now();

    const scan = async (dir: string, depth = 0): Promise<void> => {
      // ✅ PERFORMANCE: Check limits
      if (depth > 5) return; // Limit recursion depth
      if (totalFiles >= this.maxFiles) {
        isLimitReached = true;
        return;
      }
      if (Date.now() - startTime > this.scanTimeout) {
        isLimitReached = true;
        return;
      }

      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          // ✅ PERFORMANCE: Check limits in loop
          if (totalFiles >= this.maxFiles || isLimitReached) break;
          
          const fullPath = join(dir, entry.name);

          // Skip common ignore patterns
          if (this.shouldIgnore(entry.name)) continue;

          if (entry.isDirectory()) {
            totalDirectories++;
            
            // ✅ PERFORMANCE: Skip counting files if near limit
            const fileCount = totalFiles < this.maxFiles ? await this.countFiles(fullPath) : 0;
            
            directories.push({
              name: entry.name,
              path: fullPath.replace(path, '').replace(/^\//, ''),
              fileCount,
              purpose: this.inferDirectoryPurpose(entry.name)
            });

            await scan(fullPath, depth + 1);
          } else {
            totalFiles++;

            if (this.isConfigFile(entry.name)) {
              const stats = await stat(fullPath);
              configFiles.push({
                name: entry.name,
                path: fullPath.replace(path, '').replace(/^\//, ''),
                size: stats.size,
                language: this.detectLanguageFromExtension(entry.name),
                type: this.getConfigType(entry.name)
              });
            } else if (this.isMainFile(entry.name, fullPath)) {
              const stats = await stat(fullPath);
              mainFiles.push({
                name: entry.name,
                path: fullPath.replace(path, '').replace(/^\//, ''),
                size: stats.size,
                language: this.detectLanguageFromExtension(entry.name)
              });
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scan(path);

    return {
      directories,
      mainFiles,
      configFiles,
      totalFiles: isLimitReached ? this.maxFiles : totalFiles,
      totalDirectories
    };
  }

  /**
   * Detect programming languages used
   */
  private detectLanguages(structure: RepoStructure): LanguageInfo[] {
    const languageCounts = new Map<string, number>();
    const languageLines = new Map<string, number>();

    structure.mainFiles.forEach(file => {
      const count = languageCounts.get(file.language) || 0;
      languageCounts.set(file.language, count + 1);

      const lines = file.linesOfCode || 0;
      const totalLines = languageLines.get(file.language) || 0;
      languageLines.set(file.language, totalLines + lines);
    });

    const totalLines = Array.from(languageLines.values()).reduce((sum, lines) => sum + lines, 0);

    return Array.from(languageCounts.entries())
      .map(([name, fileCount]) => ({
        name,
        fileCount,
        linesOfCode: languageLines.get(name) || 0,
        percentage: totalLines > 0 ? ((languageLines.get(name) || 0) / totalLines) * 100 : 0
      }))
      .sort((a, b) => b.linesOfCode - a.linesOfCode);
  }

  /**
   * Detect frameworks and tools
   */
  private async detectFrameworks(
    projectPath: string,
    structure: RepoStructure
  ): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    const configFileMap: Record<string, FrameworkInfo> = {
      'vite.config.ts': { name: 'Vite', type: 'build', configFile: 'vite.config.ts' },
      'vite.config.js': { name: 'Vite', type: 'build', configFile: 'vite.config.js' },
      'next.config.js': { name: 'Next.js', type: 'fullstack', configFile: 'next.config.js' },
      'nuxt.config.ts': { name: 'Nuxt.js', type: 'fullstack', configFile: 'nuxt.config.ts' },
      'drizzle.config.ts': { name: 'Drizzle ORM', type: 'backend', configFile: 'drizzle.config.ts' },
      'tsconfig.json': { name: 'TypeScript', type: 'build', configFile: 'tsconfig.json' },
      'playwright.config.ts': { name: 'Playwright', type: 'testing', configFile: 'playwright.config.ts' },
      'vitest.config.ts': { name: 'Vitest', type: 'testing', configFile: 'vitest.config.ts' }
    };

    structure.configFiles.forEach(file => {
      const framework = configFileMap[file.name];
      if (framework) {
        frameworks.push(framework);
      }
    });

    // Detect from package.json
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react) {
        frameworks.push({ name: 'React', version: deps.react, type: 'frontend', configFile: 'package.json' });
      }
      if (deps.express) {
        frameworks.push({ name: 'Express.js', version: deps.express, type: 'backend', configFile: 'package.json' });
      }
      if (deps['@tanstack/react-query']) {
        frameworks.push({ name: 'TanStack Query', version: deps['@tanstack/react-query'], type: 'frontend', configFile: 'package.json' });
      }
    } catch (error) {
      // No package.json or error reading
    }

    return frameworks;
  }

  /**
   * Parse dependencies from package.json
   */
  private async parseDependencies(projectPath: string): Promise<DependenciesInfo> {
    const frontend: PackageInfo[] = [];
    const backend: PackageInfo[] = [];
    const dev: PackageInfo[] = [];

    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      const addDeps = (deps: Record<string, string>, type: 'dependency' | 'devDependency') => {
        Object.entries(deps || {}).forEach(([name, version]) => {
          const pkg: PackageInfo = { name, version, type };

          if (this.isFrontendPackage(name)) {
            frontend.push(pkg);
          } else if (this.isBackendPackage(name)) {
            backend.push(pkg);
          } else if (type === 'devDependency') {
            dev.push(pkg);
          }
        });
      };

      addDeps(packageJson.dependencies, 'dependency');
      addDeps(packageJson.devDependencies, 'devDependency');
    } catch (error) {
      // No package.json
    }

    return {
      frontend: { packages: frontend, count: frontend.length },
      backend: { packages: backend, count: backend.length },
      dev: { packages: dev, count: dev.length },
      total: frontend.length + backend.length + dev.length
    };
  }

  /**
   * Detect entry points
   */
  private detectEntryPoints(structure: RepoStructure): EntryPoints {
    const entryPoints: EntryPoints = {
      scripts: {}
    };

    structure.mainFiles.forEach(file => {
      const name = file.name.toLowerCase();
      
      if (['index.html', 'app.html'].includes(name)) {
        entryPoints.frontend = { file: file.path };
      }
      
      if (['index.ts', 'index.js', 'server.ts', 'server.js', 'main.ts', 'main.js'].includes(name)) {
        if (file.path.includes('server') || file.path.includes('backend')) {
          entryPoints.backend = { file: file.path, port: 5000 };
        } else if (!entryPoints.frontend) {
          entryPoints.frontend = { file: file.path };
        }
      }
    });

    return entryPoints;
  }

  /**
   * Calculate repository metrics
   */
  private calculateMetrics(structure: RepoStructure, languages: LanguageInfo[]): RepoMetrics {
    const totalLinesOfCode = languages.reduce((sum, lang) => sum + lang.linesOfCode, 0);
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (totalLinesOfCode > 50000 || languages.length > 5) {
      complexity = 'high';
    } else if (totalLinesOfCode > 10000 || languages.length > 3) {
      complexity = 'medium';
    }

    const hasTests = structure.directories.some(dir => 
      ['test', 'tests', '__tests__', 'spec'].includes(dir.name)
    ) || structure.configFiles.some(file => 
      ['vitest.config.ts', 'jest.config.js', 'playwright.config.ts'].includes(file.name)
    );

    return {
      totalLinesOfCode,
      codeComplexity: complexity,
      hasTests,
      estimatedBuildTime: Math.ceil(totalLinesOfCode / 1000) * 2 // Rough estimate: 2s per 1000 lines
    };
  }

  /**
   * Extract lightweight context
   */
  private extractContext(overview: RepoOverview): RepoContext {
    const mainLanguage = overview.languages[0]?.name || 'JavaScript';
    const framework = overview.frameworks.find(f => f.type === 'frontend' || f.type === 'fullstack')?.name || 'Unknown';
    
    let type: 'frontend' | 'backend' | 'fullstack' = 'fullstack';
    const hasFrontend = overview.frameworks.some(f => f.type === 'frontend' || f.type === 'fullstack');
    const hasBackend = overview.frameworks.some(f => f.type === 'backend' || f.type === 'fullstack');
    
    if (hasFrontend && !hasBackend) type = 'frontend';
    else if (hasBackend && !hasFrontend) type = 'backend';

    const hasDatabase = overview.frameworks.some(f => f.name.toLowerCase().includes('drizzle') || f.name.toLowerCase().includes('prisma'));
    const hasAuth = overview.dependencies.backend.packages.some(p => 
      p.name.includes('passport') || p.name.includes('auth') || p.name.includes('jwt')
    );

    return {
      name: overview.name,
      mainLanguage,
      framework,
      type,
      hasDatabase,
      hasAuth
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(overview: RepoOverview): string[] {
    const recommendations: string[] = [];

    if (!overview.metrics.hasTests) {
      recommendations.push('Add test coverage (Vitest, Jest, or Playwright) to improve code quality');
    }

    if (overview.languages.length > 5) {
      recommendations.push('Consider consolidating languages to reduce complexity');
    }

    if (overview.dependencies.total > 100) {
      recommendations.push('Review dependencies and remove unused packages to reduce bundle size');
    }

    if (!overview.frameworks.some(f => f.name.includes('TypeScript'))) {
      recommendations.push('Consider migrating to TypeScript for better type safety');
    }

    return recommendations;
  }

  /**
   * Detect warnings
   */
  private detectWarnings(overview: RepoOverview): string[] {
    const warnings: string[] = [];

    if (overview.metrics.codeComplexity === 'high') {
      warnings.push('High code complexity detected - consider refactoring');
    }

    if (overview.dependencies.total > 200) {
      warnings.push('Very large number of dependencies - may impact performance');
    }

    return warnings;
  }

  // Helper methods

  private shouldIgnore(name: string): boolean {
    return [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.cache',
      '.vscode',
      '.idea',
      '__pycache__'
    ].includes(name) || name.startsWith('.');
  }

  private isConfigFile(name: string): boolean {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'drizzle.config.ts',
      'playwright.config.ts',
      'vitest.config.ts',
      '.env',
      '.env.example'
    ];
    return configFiles.includes(name) || name.endsWith('.config.ts') || name.endsWith('.config.js');
  }

  private isMainFile(name: string, fullPath: string): boolean {
    const important = ['index', 'app', 'main', 'server'];
    const baseName = basename(name, extname(name));
    return important.includes(baseName.toLowerCase());
  }

  private getConfigType(name: string): ConfigFileInfo['type'] {
    if (name.includes('vite') || name.includes('webpack')) return 'build';
    if (name.includes('package')) return 'package';
    if (name.includes('drizzle') || name.includes('prisma')) return 'database';
    if (name.includes('tsconfig')) return 'typescript';
    if (name.includes('.env')) return 'env';
    return 'other';
  }

  private inferDirectoryPurpose(name: string): string | undefined {
    const purposes: Record<string, string> = {
      'src': 'source',
      'client': 'frontend',
      'server': 'backend',
      'components': 'ui-components',
      'pages': 'routes',
      'api': 'api-routes',
      'lib': 'utilities',
      'utils': 'utilities',
      'styles': 'styling',
      'public': 'static-assets',
      'test': 'testing',
      'tests': 'testing',
      '__tests__': 'testing'
    };
    return purposes[name.toLowerCase()];
  }

  private detectLanguageFromExtension(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const map: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust',
      '.java': 'Java',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.html': 'HTML',
      '.json': 'JSON'
    };
    return map[ext] || 'Unknown';
  }

  private isFrontendPackage(name: string): boolean {
    return name.startsWith('react') ||
           name.startsWith('@tanstack') ||
           name === 'vite' ||
           name === 'wouter' ||
           name.includes('tailwind') ||
           name.includes('shadcn');
  }

  private isBackendPackage(name: string): boolean {
    return name === 'express' ||
           name.startsWith('drizzle') ||
           name === 'postgres' ||
           name.includes('passport') ||
           name.includes('bcrypt');
  }

  private async countFiles(dir: string): Promise<number> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      let count = 0;
      
      for (const entry of entries) {
        if (entry.isFile()) count++;
        else if (entry.isDirectory() && !this.shouldIgnore(entry.name)) {
          count += await this.countFiles(join(dir, entry.name));
        }
      }
      
      return count;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return 0;
    }
  }

  private async getProjectName(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return packageJson.name || basename(projectPath);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return basename(projectPath);
    }
  }

  private async getProjectDescription(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return packageJson.description || 'No description available';
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return 'No description available';
    }
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      this.cache.delete(projectPath);
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton
export const repoOverviewService = new RepoOverviewService();
