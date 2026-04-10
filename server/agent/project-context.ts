/**
 * Project Context Provider
 * Gathers and injects project context into AI prompts
 * Provides file tree, package.json, errors, git status
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProjectContext {
  files: string[];
  packageJson?: any;
  structure: string; // Full tree (for tools that need complete file lists)
  structureSummary?: string; // Compact summary (for AI prompts to stay under token limits)
  recentFiles?: string[];
  errors?: string[];
  gitStatus?: string;
  projectType?: string;
  framework?: string;
}

export class ProjectContextProvider {
  private projectRoot: string;
  private ignorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'out',
    'coverage',
    '.DS_Store',
    '*.log',
    '.env',
    '.env.local'
  ];

  constructor(projectId: string) {
    // In production, map projectId to actual project directory
    this.projectRoot = process.cwd();
  }

  /**
   * Get complete project context
   */
  async getContext(): Promise<ProjectContext> {
    const [files, packageJson, gitStatus] = await Promise.all([
      this.getFileTree(),
      this.getPackageJson(),
      this.getGitStatus()
    ]);

    // Generate BOTH full structure (for tools) and compact summary (for AI prompts)
    const structure = this.generateStructureTree(files);
    const projectType = this.detectProjectType(packageJson);
    const framework = this.detectFramework(packageJson);

    return {
      files,
      packageJson,
      structure, // Full tree for tools that need it
      structureSummary: this.generateStructureSummary(files), // Compact for AI
      gitStatus,
      projectType,
      framework
    };
  }

  /**
   * Get file tree (recursive)
   */
  private async getFileTree(dir: string = '', result: string[] = []): Promise<string[]> {
    const currentPath = path.join(this.projectRoot, dir);
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = dir ? path.join(dir, entry.name) : entry.name;
        
        // Skip ignored patterns
        if (this.shouldIgnore(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan directory
          await this.getFileTree(relativePath, result);
        } else {
          // Add file to result
          result.push(relativePath);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
      return result;
    }
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnore(relativePath: string): boolean {
    return this.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(relativePath);
      }
      return relativePath.startsWith(pattern);
    });
  }

  /**
   * Get package.json content
   */
  private async getPackageJson(): Promise<any | undefined> {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get git status
   */
  private async getGitStatus(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git status --short', {
        cwd: this.projectRoot
      });
      return stdout.trim() || 'No changes';
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Generate visual structure tree
   */
  private generateStructureTree(files: string[]): string {
    const tree: Record<string, any> = {};
    
    // Build tree structure
    for (const file of files) {
      const parts = file.split(path.sep);
      let current = tree;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // File
          current[part] = null;
        } else {
          // Directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }

    // Convert to string representation
    return this.treeToString(tree);
  }

  /**
   * Generate compact hierarchical summary for AI context
   * Shows top-level directories with file counts + important files only
   * CRITICAL FIX (Nov 19, 2025): Prevents 4M+ token system prompts for large repos
   */
  private generateStructureSummary(files: string[]): string {
    const topLevel: Record<string, number> = {};
    const importantFiles: string[] = [];
    
    // Important file patterns to always include
    const importantPatterns = [
      'package.json', 'tsconfig.json', 'vite.config', 'README.md', 
      '.gitignore', 'Dockerfile', 'docker-compose', '.env.example',
      'drizzle.config', 'tailwind.config'
    ];
    
    for (const file of files) {
      const parts = file.split(path.sep);
      const topDir = parts[0];
      
      // Count files per top-level directory
      topLevel[topDir] = (topLevel[topDir] || 0) + 1;
      
      // Track important files
      if (importantPatterns.some(pattern => file.includes(pattern))) {
        importantFiles.push(file);
      }
    }
    
    let summary = '';
    
    // Top-level directories with counts
    Object.entries(topLevel)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dir, count]) => {
        summary += `├── ${dir}/ (${count} files)\n`;
      });
    
    // Important files section
    if (importantFiles.length > 0) {
      summary += '\nKey Configuration Files:\n';
      importantFiles.slice(0, 10).forEach(file => {
        summary += `  - ${file}\n`;
      });
    }
    
    summary += `\nTotal: ${files.length} files across ${Object.keys(topLevel).length} directories`;
    
    return summary;
  }

  /**
   * Convert tree object to string
   */
  private treeToString(tree: Record<string, any>, indent = ''): string {
    let result = '';
    const entries = Object.entries(tree);
    
    entries.forEach(([name, children], index) => {
      const isLast = index === entries.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const childIndent = isLast ? '    ' : '│   ';
      
      result += indent + prefix + name;
      
      if (children !== null) {
        result += '/\n';
        result += this.treeToString(children, indent + childIndent);
      } else {
        result += '\n';
      }
    });
    
    return result;
  }

  /**
   * Detect project type
   */
  private detectProjectType(packageJson?: any): string {
    if (!packageJson) return 'unknown';
    
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    if (deps['next']) return 'Next.js';
    if (deps['react']) return 'React';
    if (deps['vue']) return 'Vue.js';
    if (deps['express']) return 'Express';
    if (deps['@nestjs/core']) return 'NestJS';
    if (deps['typescript']) return 'TypeScript';
    
    return 'Node.js';
  }

  /**
   * Detect framework
   */
  private detectFramework(packageJson?: any): string {
    if (!packageJson) return 'none';
    
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    if (deps['next']) return 'Next.js';
    if (deps['vite']) return 'Vite';
    if (deps['webpack']) return 'Webpack';
    if (deps['parcel']) return 'Parcel';
    
    return 'none';
  }

  /**
   * Format context as system prompt
   */
  static formatAsSystemPrompt(context: ProjectContext): string {
    let prompt = `You are working on a ${context.projectType || 'web application'} project`;
    
    if (context.framework) {
      prompt += ` using ${context.framework}`;
    }
    
    prompt += '.\n\n';
    
    // Project structure (USE COMPACT SUMMARY for AI, full tree still available for tools)
    // CRITICAL FIX (Nov 19, 2025): Use hierarchical summary to prevent 4M+ token system prompts
    const structureToShow = context.structureSummary || context.structure;
    
    prompt += '## Project Structure (Summary)\n\n';
    prompt += '```\n';
    prompt += structureToShow;
    prompt += '```\n\n';
    
    // Key files
    if (context.packageJson) {
      prompt += '## Dependencies\n\n';
      prompt += 'Installed packages:\n';
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies
      };
      Object.keys(allDeps).slice(0, 20).forEach(dep => {
        prompt += `- ${dep}\n`;
      });
      prompt += '\n';
    }
    
    // Git status
    if (context.gitStatus && context.gitStatus !== 'No changes') {
      prompt += '## Git Status\n\n';
      prompt += '```\n';
      prompt += context.gitStatus;
      prompt += '```\n\n';
    }
    
    prompt += '## Your Capabilities\n\n';
    prompt += 'You have access to tools to:\n';
    prompt += '- Create, edit, read, and delete files\n';
    prompt += '- Run shell commands and install packages\n';
    prompt += '- Search the web for information\n';
    prompt += '- Search code in the project\n';
    prompt += '- Get project diagnostics\n\n';
    prompt += 'Use these tools autonomously to help the user build their application.\n';
    
    return prompt;
  }
}
