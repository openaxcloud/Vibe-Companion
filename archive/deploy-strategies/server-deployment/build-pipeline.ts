import * as fs from 'fs/promises';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';

const execAsync = promisify(exec);
const logger = createLogger('build-pipeline');

export interface BuildConfig {
  projectId: number;
  projectName: string;
  projectPath: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  framework?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  environmentVars?: Record<string, string>;
}

export interface BuildResult {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
  artifacts: string[];
  outputPath?: string;
  error?: string;
  framework?: string;
  buildTime?: number;
}

export interface ProjectDetection {
  type: 'react' | 'vue' | 'angular' | 'nextjs' | 'nodejs' | 'python' | 'static' | 'unknown';
  framework?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  entryPoint?: string;
}

export class BuildPipeline {
  private builds = new Map<string, BuildResult>();
  private buildQueue: Array<{ id: string; config: BuildConfig }> = [];
  private isProcessing = false;
  
  private readonly buildsPath = path.join(process.cwd(), 'builds');
  
  constructor() {
    this.initializeDirectories();
  }
  
  private async initializeDirectories() {
    await fs.mkdir(this.buildsPath, { recursive: true });
  }
  
  async build(config: BuildConfig): Promise<BuildResult> {
    const buildId = `build-${config.projectId}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Initialize build result
    const buildResult: BuildResult = {
      id: buildId,
      status: 'pending',
      startedAt: new Date(),
      logs: [],
      artifacts: []
    };
    
    this.builds.set(buildId, buildResult);
    
    // Add to queue
    this.buildQueue.push({ id: buildId, config });
    
    // Process queue
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return buildResult;
  }
  
  private async processQueue() {
    if (this.isProcessing || this.buildQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.buildQueue.length > 0) {
      const buildJob = this.buildQueue.shift()!;
      await this.processBuild(buildJob.id, buildJob.config);
    }
    
    this.isProcessing = false;
  }
  
  private async processBuild(buildId: string, config: BuildConfig) {
    const build = this.builds.get(buildId)!;
    build.status = 'running';
    
    try {
      // Detect project type if not specified
      const detection = await this.detectProjectType(config.projectPath);
      build.framework = detection.framework;
      
      const buildCommand = config.buildCommand || detection.buildCommand;
      const installCommand = config.installCommand || detection.installCommand;
      const outputDir = config.outputDir || detection.outputDir;
      
      build.logs.push(`Build started for ${detection.type} project`);
      if (detection.framework) {
        build.logs.push(`Framework detected: ${detection.framework}`);
      }
      
      // Install dependencies
      if (installCommand) {
        build.logs.push(`Installing dependencies: ${installCommand}`);
        await this.runCommand(installCommand, config.projectPath, build, config.environmentVars);
      }
      
      // Run build command
      if (buildCommand) {
        build.logs.push(`Running build command: ${buildCommand}`);
        await this.runCommand(buildCommand, config.projectPath, build, config.environmentVars);
      }
      
      // Collect build artifacts
      const artifactsPath = path.join(this.buildsPath, buildId);
      await fs.mkdir(artifactsPath, { recursive: true });
      
      if (outputDir) {
        const outputPath = path.join(config.projectPath, outputDir);
        try {
          await fs.access(outputPath);
          build.outputPath = outputPath;
          build.logs.push(`Build output directory: ${outputDir}`);
          
          // Copy artifacts
          await this.copyDirectory(outputPath, artifactsPath);
          build.artifacts.push(artifactsPath);
        } catch (error) {
          build.logs.push(`Warning: Output directory ${outputDir} not found`);
        }
      }
      
      // For static projects or projects without build output, use the entire project
      if (build.artifacts.length === 0) {
        await this.copyDirectory(config.projectPath, artifactsPath);
        build.artifacts.push(artifactsPath);
      }
      
      build.status = 'success';
      build.completedAt = new Date();
      build.buildTime = build.completedAt.getTime() - build.startedAt.getTime();
      build.logs.push(`Build completed successfully in ${build.buildTime}ms`);
      
    } catch (error: any) {
      build.status = 'failed';
      build.error = error.message;
      build.logs.push(`Build failed: ${error.message}`);
      build.completedAt = new Date();
    }
  }
  
  private async detectProjectType(projectPath: string): Promise<ProjectDetection> {
    // Check for package.json
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Detect framework
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Next.js
      if (dependencies['next']) {
        return {
          type: 'nextjs',
          framework: 'Next.js',
          buildCommand: packageJson.scripts?.build || 'npm run build',
          installCommand: 'npm install',
          outputDir: '.next'
        };
      }
      
      // React (Create React App or Vite)
      if (dependencies['react']) {
        if (dependencies['vite']) {
          return {
            type: 'react',
            framework: 'React (Vite)',
            buildCommand: packageJson.scripts?.build || 'npm run build',
            installCommand: 'npm install',
            outputDir: 'dist'
          };
        }
        return {
          type: 'react',
          framework: 'React',
          buildCommand: packageJson.scripts?.build || 'npm run build',
          installCommand: 'npm install',
          outputDir: 'build'
        };
      }
      
      // Vue
      if (dependencies['vue']) {
        return {
          type: 'vue',
          framework: 'Vue.js',
          buildCommand: packageJson.scripts?.build || 'npm run build',
          installCommand: 'npm install',
          outputDir: 'dist'
        };
      }
      
      // Angular
      if (dependencies['@angular/core']) {
        return {
          type: 'angular',
          framework: 'Angular',
          buildCommand: packageJson.scripts?.build || 'npm run build',
          installCommand: 'npm install',
          outputDir: 'dist'
        };
      }
      
      // Generic Node.js
      if (packageJson.scripts?.start) {
        return {
          type: 'nodejs',
          framework: 'Node.js',
          buildCommand: packageJson.scripts?.build,
          installCommand: 'npm install',
          entryPoint: packageJson.main || 'index.js'
        };
      }
      
    } catch (error) {
      // Not a Node.js project
    }
    
    // Check for Python
    try {
      await fs.access(path.join(projectPath, 'requirements.txt'));
      return {
        type: 'python',
        framework: 'Python',
        installCommand: 'pip install -r requirements.txt',
        entryPoint: 'main.py'
      };
    } catch (error) {
      // Not a Python project
    }
    
    // Check for static HTML
    try {
      await fs.access(path.join(projectPath, 'index.html'));
      return {
        type: 'static',
        framework: 'Static HTML'
      };
    } catch (error) {
      // Not a static project
    }
    
    return {
      type: 'unknown'
    };
  }
  
  private async runCommand(
    command: string, 
    cwd: string, 
    build: BuildResult,
    env?: Record<string, string>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      
      const child = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: true
      });
      
      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: string) => build.logs.push(line));
      });
      
      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: string) => build.logs.push(`[stderr] ${line}`));
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      // Skip node_modules and other large directories
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  
  async getBuildStatus(buildId: string): Promise<BuildResult | null> {
    return this.builds.get(buildId) || null;
  }
  
  async getBuildLogs(buildId: string): Promise<string[]> {
    const build = this.builds.get(buildId);
    return build ? build.logs : [];
  }
  
  async cancelBuild(buildId: string): Promise<boolean> {
    const buildIndex = this.buildQueue.findIndex(b => b.id === buildId);
    if (buildIndex >= 0) {
      this.buildQueue.splice(buildIndex, 1);
      const build = this.builds.get(buildId);
      if (build) {
        build.status = 'failed';
        build.error = 'Build cancelled';
        build.completedAt = new Date();
      }
      return true;
    }
    return false;
  }
}

export const buildPipeline = new BuildPipeline();