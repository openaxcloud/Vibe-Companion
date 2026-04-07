import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import { codeExecutor } from './execution/executor';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DeploymentConfig {
  projectId: number;
  userId: number;
  environment: 'production' | 'staging' | 'preview';
  region?: string;
  customDomain?: string;
  envVars?: Record<string, string>;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
}

export interface DeploymentStatus {
  id: string;
  projectId: number;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  url?: string;
  customUrl?: string;
  logs: string[];
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export class DeploymentManager {
  private deployments: Map<string, DeploymentStatus> = new Map();
  private deploymentsPath: string;

  constructor() {
    this.deploymentsPath = path.join(process.cwd(), '.deployments');
    this.initializeDeployments();
  }

  private async initializeDeployments() {
    try {
      await fs.mkdir(this.deploymentsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize deployments directory:', error);
    }
  }

  async deploy(config: DeploymentConfig): Promise<DeploymentStatus> {
    const deploymentId = uuidv4();
    const deployment: DeploymentStatus = {
      id: deploymentId,
      projectId: config.projectId,
      status: 'pending',
      logs: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.deployments.set(deploymentId, deployment);

    // Start deployment process asynchronously
    this.performDeployment(deploymentId, config).catch(error => {
      console.error('Deployment failed:', error);
      this.updateDeploymentStatus(deploymentId, 'failed', error.message);
    });

    return deployment;
  }

  private async performDeployment(deploymentId: string, config: DeploymentConfig): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return;

    try {
      // Update status to building
      this.updateDeploymentStatus(deploymentId, 'building');
      this.addLog(deploymentId, 'Starting build process...');

      // Get project details
      const project = await storage.getProject(config.projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Create deployment directory
      const deploymentPath = path.join(this.deploymentsPath, deploymentId);
      await fs.mkdir(deploymentPath, { recursive: true });

      // Copy project files
      const files = await storage.getFilesByProject(config.projectId);
      await this.copyProjectFiles(files, deploymentPath);

      // Write environment variables
      if (config.envVars) {
        const envContent = Object.entries(config.envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        await fs.writeFile(path.join(deploymentPath, '.env'), envContent);
      }

      // Run build command if specified
      if (config.buildCommand) {
        this.addLog(deploymentId, `Running build command: ${config.buildCommand}`);
        const buildResult = await codeExecutor.execute({
          projectId: config.projectId,
          userId: config.userId,
          language: project.language || 'nodejs',
          mainFile: config.buildCommand,
          timeout: 300000 // 5 minutes for build
        });

        if (buildResult.exitCode !== 0) {
          throw new Error(`Build failed: ${buildResult.stderr}`);
        }
        this.addLog(deploymentId, 'Build completed successfully');
      }

      // Update status to deploying
      this.updateDeploymentStatus(deploymentId, 'deploying');
      this.addLog(deploymentId, 'Deploying application...');

      // Generate deployment URL
      const baseUrl = process.env.DEPLOYMENT_BASE_URL || 'https://replit-clone.app';
      const deploymentUrl = `${baseUrl}/${project.name}-${deploymentId.substring(0, 8)}`;

      // In a real implementation, this would:
      // 1. Create container/serverless function
      // 2. Configure routing
      // 3. Set up SSL
      // 4. Configure custom domain if provided

      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update deployment status
      deployment.status = 'running';
      deployment.url = deploymentUrl;
      deployment.customUrl = config.customDomain;
      deployment.updatedAt = new Date();
      
      this.addLog(deploymentId, `Deployment successful! URL: ${deploymentUrl}`);

      // Save deployment to database
      await storage.createDeployment({
        projectId: config.projectId,
        status: 'running',
        url: deploymentUrl,
        version: `v${Date.now()}`
      });

    } catch (error) {
      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    return this.deployments.get(deploymentId) || null;
  }

  async getProjectDeployments(projectId: number): Promise<DeploymentStatus[]> {
    const deployments = Array.from(this.deployments.values())
      .filter(d => d.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return deployments;
  }

  async stopDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'running') {
      return false;
    }

    this.updateDeploymentStatus(deploymentId, 'stopped');
    this.addLog(deploymentId, 'Deployment stopped');

    // In real implementation, would stop the actual deployment
    return true;
  }

  async restartDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return false;
    }

    this.updateDeploymentStatus(deploymentId, 'pending');
    this.addLog(deploymentId, 'Restarting deployment...');

    // Re-deploy with same config
    // In real implementation, would restart the deployment
    
    setTimeout(() => {
      this.updateDeploymentStatus(deploymentId, 'running');
      this.addLog(deploymentId, 'Deployment restarted successfully');
    }, 2000);

    return true;
  }

  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    const deployment = this.deployments.get(deploymentId);
    return deployment?.logs || [];
  }

  async promoteDeployment(deploymentId: string, environment: 'production' | 'staging'): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'running') {
      return false;
    }

    this.addLog(deploymentId, `Promoting to ${environment}...`);

    // In real implementation, would update routing and DNS
    
    return true;
  }

  async rollbackDeployment(projectId: number, version: string): Promise<DeploymentStatus | null> {
    // Find previous deployment with specified version
    const previousDeployment = Array.from(this.deployments.values())
      .find(d => d.projectId === projectId && d.id.includes(version));

    if (!previousDeployment) {
      return null;
    }

    // Create new deployment based on previous version
    return this.deploy({
      projectId,
      userId: 0, // Would need to track this
      environment: 'production'
    });
  }

  async getDeploymentMetrics(deploymentId: string): Promise<{
    requests: number;
    errors: number;
    avgResponseTime: number;
    uptime: number;
    bandwidth: number;
  }> {
    // In real implementation, would fetch from monitoring service
    return {
      requests: Math.floor(Math.random() * 10000),
      errors: Math.floor(Math.random() * 100),
      avgResponseTime: Math.random() * 500,
      uptime: 99.9,
      bandwidth: Math.random() * 1000 // MB
    };
  }

  private updateDeploymentStatus(deploymentId: string, status: DeploymentStatus['status'], error?: string) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      deployment.status = status;
      deployment.updatedAt = new Date();
      if (error) {
        deployment.error = error;
      }
    }
  }

  private addLog(deploymentId: string, message: string) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      const timestamp = new Date().toISOString();
      deployment.logs.push(`[${timestamp}] ${message}`);
    }
  }

  private async copyProjectFiles(files: any[], targetPath: string): Promise<void> {
    for (const file of files) {
      if (!file.isFolder && file.content) {
        const filePath = path.join(targetPath, file.name);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content);
      }
    }
  }
}

export const deploymentManager = new DeploymentManager();