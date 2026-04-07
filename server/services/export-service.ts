// @ts-nocheck
import { DatabaseStorage } from '../storage';
import { GitManager } from '../git/git-manager';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExportJob {
  id: number;
  projectId: number;
  type: 'github' | 'docker' | 'zip' | 'gitlab' | 'bitbucket';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
  metadata?: {
    repositoryUrl?: string;
    imageTag?: string;
    includeNodeModules?: boolean;
    includeEnvVars?: boolean;
  };
  createdAt: Date;
  completedAt?: Date;
}

export class ExportService {
  constructor(
    private storage: DatabaseStorage,
    private gitManager: GitManager
  ) {}

  async exportToGitHub(projectId: number, data: {
    repositoryName: string;
    isPrivate: boolean;
    githubToken: string;
    description?: string;
  }): Promise<ExportJob> {
    const project = await this.storage.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const exportJob = {
      projectId,
      type: 'github' as const,
      status: 'pending' as const,
      metadata: {
        repositoryUrl: `https://github.com/${data.repositoryName}`
      },
      createdAt: new Date()
    };
    
    const id = await this.storage.createExportJob(exportJob);
    
    // Process export asynchronously
    this.processGitHubExport(id, project, data);
    
    return { ...exportJob, id };
  }

  private async processGitHubExport(
    jobId: number, 
    project: any, 
    data: any
  ): Promise<void> {
    try {
      await this.storage.updateExportJob(jobId, { status: 'processing' });
      
      const projectPath = `./projects/${project.id}`;
      
      // Create GitHub repository using API
      const createRepoCmd = `curl -H "Authorization: token ${data.githubToken}" \
        -d '{"name":"${data.repositoryName}","private":${data.isPrivate},"description":"${data.description || ''}"}' \
        https://api.github.com/user/repos`;
      
      await execAsync(createRepoCmd);
      
      // Add GitHub remote and push
      await this.gitManager.addRemote(
        projectPath, 
        'github', 
        `https://github.com/${data.repositoryName}.git`
      );
      
      await this.gitManager.push(projectPath, 'github', 'main');
      
      await this.storage.updateExportJob(jobId, {
        status: 'completed',
        completedAt: new Date()
      });
    } catch (error: any) {
      await this.storage.updateExportJob(jobId, {
        status: 'failed',
        error: error.message
      });
    }
  }

  async exportToDocker(projectId: number, data: {
    imageName: string;
    imageTag: string;
    baseImage?: string;
    includeEnvVars: boolean;
  }): Promise<ExportJob> {
    const project = await this.storage.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const exportJob = {
      projectId,
      type: 'docker' as const,
      status: 'pending' as const,
      metadata: {
        imageTag: `${data.imageName}:${data.imageTag}`,
        includeEnvVars: data.includeEnvVars
      },
      createdAt: new Date()
    };
    
    const id = await this.storage.createExportJob(exportJob);
    
    // Process export asynchronously
    this.processDockerExport(id, project, data);
    
    return { ...exportJob, id };
  }

  private async processDockerExport(
    jobId: number,
    project: any,
    data: any
  ): Promise<void> {
    try {
      await this.storage.updateExportJob(jobId, { status: 'processing' });
      
      const projectPath = `./projects/${project.id}`;
      const dockerfile = this.generateDockerfile(project, data);
      
      // Write Dockerfile
      fs.writeFileSync(path.join(projectPath, 'Dockerfile'), dockerfile);
      
      // Build Docker image
      await execAsync(`docker build -t ${data.imageName}:${data.imageTag} ${projectPath}`);
      
      // Create tar of the image
      const exportPath = `./exports/${jobId}-docker.tar`;
      await execAsync(`docker save -o ${exportPath} ${data.imageName}:${data.imageTag}`);
      
      await this.storage.updateExportJob(jobId, {
        status: 'completed',
        downloadUrl: `/api/exports/download/${jobId}`,
        completedAt: new Date()
      });
    } catch (error: any) {
      await this.storage.updateExportJob(jobId, {
        status: 'failed',
        error: error.message
      });
    }
  }

  private generateDockerfile(project: any, data: any): string {
    const baseImage = data.baseImage || this.getBaseImageForLanguage(project.language);
    
    let dockerfile = `FROM ${baseImage}\n\n`;
    dockerfile += `WORKDIR /app\n\n`;
    
    // Copy package files first for better caching
    if (project.language === 'nodejs') {
      dockerfile += `COPY package*.json ./\n`;
      dockerfile += `RUN npm ci --only=production\n\n`;
    } else if (project.language === 'python') {
      dockerfile += `COPY requirements.txt ./\n`;
      dockerfile += `RUN pip install -r requirements.txt\n\n`;
    }
    
    dockerfile += `COPY . .\n\n`;
    
    if (data.includeEnvVars) {
      dockerfile += `# Environment variables will be injected at runtime\n`;
    }
    
    // Set appropriate CMD based on language
    if (project.language === 'nodejs') {
      dockerfile += `CMD ["npm", "start"]\n`;
    } else if (project.language === 'python') {
      dockerfile += `CMD ["python", "main.py"]\n`;
    }
    
    return dockerfile;
  }

  private getBaseImageForLanguage(language: string): string {
    const images: Record<string, string> = {
      nodejs: 'node:18-alpine',
      python: 'python:3.11-slim',
      go: 'golang:1.21-alpine',
      rust: 'rust:1.73-slim',
      java: 'openjdk:17-slim',
      ruby: 'ruby:3.2-slim',
      php: 'php:8.2-apache'
    };
    return images[language] || 'ubuntu:22.04';
  }

  async exportAsZip(projectId: number, data: {
    includeNodeModules: boolean;
    includeEnvVars: boolean;
    includeGitHistory: boolean;
  }): Promise<ExportJob> {
    const project = await this.storage.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const exportJob = {
      projectId,
      type: 'zip' as const,
      status: 'pending' as const,
      metadata: data,
      createdAt: new Date()
    };
    
    const id = await this.storage.createExportJob(exportJob);
    
    // Process export asynchronously
    this.processZipExport(id, project, data);
    
    return { ...exportJob, id };
  }

  private async processZipExport(
    jobId: number,
    project: any,
    data: any
  ): Promise<void> {
    try {
      await this.storage.updateExportJob(jobId, { status: 'processing' });
      
      const projectPath = `./projects/${project.id}`;
      const outputPath = `./exports/${jobId}-export.zip`;
      
      // Create zip archive
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', async () => {
        await this.storage.updateExportJob(jobId, {
          status: 'completed',
          downloadUrl: `/api/exports/download/${jobId}`,
          completedAt: new Date()
        });
      });
      
      archive.on('error', async (err) => {
        await this.storage.updateExportJob(jobId, {
          status: 'failed',
          error: err.message
        });
      });
      
      archive.pipe(output);
      
      // Add project files
      archive.directory(projectPath, false, {
        globOptions: {
          ignore: this.getIgnorePatterns(data)
        }
      });
      
      // Add environment variables if requested
      if (data.includeEnvVars) {
        const envVars = await this.storage.getEnvironmentVariables(project.id);
        const envContent = Object.entries(envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        archive.append(envContent, { name: '.env.example' });
      }
      
      archive.finalize();
    } catch (error: any) {
      await this.storage.updateExportJob(jobId, {
        status: 'failed',
        error: error.message
      });
    }
  }

  private getIgnorePatterns(data: any): string[] {
    const patterns = [];
    
    if (!data.includeNodeModules) {
      patterns.push('**/node_modules/**');
    }
    
    if (!data.includeGitHistory) {
      patterns.push('**/.git/**');
    }
    
    // Always ignore these
    patterns.push('**/.env', '**/dist/**', '**/build/**', '**/.cache/**');
    
    return patterns;
  }

  async getExportJobs(projectId: number): Promise<ExportJob[]> {
    return this.storage.getProjectExportJobs(projectId);
  }

  async getExportJob(jobId: number): Promise<ExportJob | null> {
    return this.storage.getExportJob(jobId);
  }

  async downloadExport(jobId: number): Promise<string> {
    const job = await this.storage.getExportJob(jobId);
    if (!job || job.status !== 'completed') {
      throw new Error('Export not ready');
    }
    
    return `./exports/${jobId}-${job.type === 'docker' ? 'docker.tar' : 'export.zip'}`;
  }
}