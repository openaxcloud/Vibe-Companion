// @ts-nocheck
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { buildPipeline, BuildConfig, BuildResult } from './build-pipeline';
import { realDeploymentService, RealDeploymentConfig, RealDeploymentResult } from './real-deployment-service';
import { storage } from '../storage';
import { simplePackageInstaller } from '../package-management/simple-package-installer';
import { notifyDeployComplete } from '../services/notification-events';

const logger = createLogger('deployment-pipeline');

export interface DeploymentPipelineConfig {
  projectId: number;
  projectName: string;
  environment: 'development' | 'staging' | 'production';
  region: string[];
  type: 'static' | 'autoscale' | 'reserved-vm' | 'serverless' | 'scheduled';
  customDomain?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVars?: Record<string, string>;
  scaling?: {
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
  };
  resources?: {
    cpu: string;
    memory: string;
    disk: string;
  };
}

export interface DeploymentPipelineResult {
  id: string;
  buildId: string;
  deploymentId?: string;
  status: 'building' | 'deploying' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  buildResult?: BuildResult;
  deploymentResult?: RealDeploymentResult;
  logs: string[];
  error?: string;
  url?: string;
  previewUrl?: string;
}

export class DeploymentPipeline {
  private pipelines = new Map<string, DeploymentPipelineResult>();
  
  async deployWithBuild(config: DeploymentPipelineConfig): Promise<DeploymentPipelineResult> {
    const pipelineId = `pipeline-${config.projectId}-${Date.now()}`;
    
    // Initialize pipeline result
    const pipelineResult: DeploymentPipelineResult = {
      id: pipelineId,
      buildId: '',
      status: 'building',
      startedAt: new Date(),
      logs: [`Deployment pipeline started for ${config.projectName}`]
    };
    
    this.pipelines.set(pipelineId, pipelineResult);
    
    // Start pipeline asynchronously
    this.runPipeline(pipelineId, config).catch(error => {
      logger.error('Pipeline error:', error);
      pipelineResult.status = 'failed';
      pipelineResult.error = error.message;
      pipelineResult.completedAt = new Date();
    });
    
    return pipelineResult;
  }
  
  private async runPipeline(pipelineId: string, config: DeploymentPipelineConfig) {
    const pipeline = this.pipelines.get(pipelineId)!;
    
    try {
      // Get project path
      const projectPath = path.join(process.cwd(), 'projects', config.projectId.toString());
      
      // Phase 1: Build
      pipeline.logs.push('Starting build phase...');
      
      const buildConfig: BuildConfig = {
        projectId: config.projectId,
        projectName: config.projectName,
        projectPath,
        buildCommand: config.buildCommand,
        environmentVars: config.environmentVars
      };
      
      const buildResult = await buildPipeline.build(buildConfig);
      pipeline.buildId = buildResult.id;
      
      // Wait for build to complete
      await this.waitForBuild(buildResult.id);
      
      const finalBuildResult = await buildPipeline.getBuildStatus(buildResult.id);
      pipeline.buildResult = finalBuildResult!;
      
      if (finalBuildResult?.status !== 'success') {
        throw new Error(`Build failed: ${finalBuildResult?.error || 'Unknown error'}`);
      }
      
      pipeline.logs.push('Build completed successfully');
      
      // Phase 2: Deploy
      pipeline.status = 'deploying';
      pipeline.logs.push('Starting deployment phase...');
      
      const deploymentConfig: RealDeploymentConfig = {
        projectId: config.projectId,
        projectName: config.projectName,
        type: config.type,
        environment: config.environment,
        region: config.region,
        customDomain: config.customDomain,
        sslEnabled: true,
        environmentVars: config.environmentVars || {},
        buildCommand: config.buildCommand,
        startCommand: config.startCommand,
        scaling: config.scaling,
        resources: config.resources
      };
      
      const deploymentResult = await realDeploymentService.deploy(deploymentConfig);
      pipeline.deploymentId = deploymentResult.id;
      
      // Wait for deployment to complete
      await this.waitForDeployment(deploymentResult.id);
      
      const finalDeploymentResult = await realDeploymentService.getDeploymentStatus(deploymentResult.id);
      pipeline.deploymentResult = finalDeploymentResult!;
      
      if (finalDeploymentResult?.status !== 'active') {
        throw new Error(`Deployment failed: ${finalDeploymentResult?.build.logs.join('\n')}`);
      }
      
      pipeline.status = 'success';
      pipeline.url = finalDeploymentResult.url;
      pipeline.previewUrl = finalDeploymentResult.customUrl || finalDeploymentResult.url;
      pipeline.logs.push(`Deployment successful! Your app is live at: ${pipeline.url}`);
      pipeline.completedAt = new Date();
      
      // Update project deployment info
      const deploymentId = parseInt(deploymentResult.id.split('-')[1] || '0');
      await storage.updateDeployment(deploymentId, {
        status: 'active',
        url: pipeline.url,
        logs: pipeline.logs
      });

      try {
        const project = await storage.getProject(config.projectId);
        if (project) {
          notifyDeployComplete(project.ownerId, config.projectName, pipeline.url || '');
        }
      } catch (notifyErr) {
        logger.warn('Failed to send deploy-complete push notification:', notifyErr);
      }
      
    } catch (error: any) {
      pipeline.status = 'failed';
      pipeline.error = error.message;
      pipeline.logs.push(`Pipeline failed: ${error.message}`);
      pipeline.completedAt = new Date();
    }
  }
  
  private async waitForBuild(buildId: string, timeout = 600000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const build = await buildPipeline.getBuildStatus(buildId);
      
      if (!build) {
        throw new Error('Build not found');
      }
      
      if (build.status === 'success' || build.status === 'failed') {
        return;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Build timeout');
  }
  
  private async waitForDeployment(deploymentId: string, timeout = 600000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const deployment = await realDeploymentService.getDeploymentStatus(deploymentId);
      
      if (!deployment) {
        throw new Error('Deployment not found');
      }
      
      if (deployment.status === 'active' || deployment.status === 'failed') {
        return;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Deployment timeout');
  }
  
  async getPipelineStatus(pipelineId: string): Promise<DeploymentPipelineResult | null> {
    return this.pipelines.get(pipelineId) || null;
  }
  
  async getPipelineLogs(pipelineId: string): Promise<string[]> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return [];
    
    const logs = [...pipeline.logs];
    
    // Add build logs
    if (pipeline.buildId) {
      const buildLogs = await buildPipeline.getBuildLogs(pipeline.buildId);
      logs.push(...buildLogs.map(log => `[BUILD] ${log}`));
    }
    
    // Add deployment logs
    if (pipeline.deploymentId) {
      const deployment = await realDeploymentService.getDeploymentStatus(pipeline.deploymentId);
      if (deployment) {
        logs.push(...deployment.build.logs.map(log => `[DEPLOY] ${log}`));
      }
    }
    
    return logs;
  }
  
  async cancelPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;
    
    // Cancel build if in progress
    if (pipeline.buildId && pipeline.status === 'building') {
      await buildPipeline.cancelBuild(pipeline.buildId);
    }
    
    // Cancel deployment if in progress
    if (pipeline.deploymentId && pipeline.status === 'deploying') {
      // Mark deployment as cancelled
      const deployment = await realDeploymentService.getDeploymentStatus(pipeline.deploymentId);
      if (deployment) {
        deployment.status = 'failed';
        deployment.build.logs.push('Deployment cancelled by user');
      }
    }
    
    pipeline.status = 'failed';
    pipeline.error = 'Pipeline cancelled by user';
    pipeline.completedAt = new Date();
    
    return true;
  }
  
  async getProjectDeployments(projectId: number): Promise<DeploymentPipelineResult[]> {
    const deployments: DeploymentPipelineResult[] = [];
    
    this.pipelines.forEach((pipeline) => {
      if (pipeline.buildResult && 'projectId' in pipeline.buildResult && pipeline.buildResult.projectId === projectId) {
        deployments.push(pipeline);
      }
    });
    
    return deployments.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  
  // Quick deploy for simple projects (no build step)
  async quickDeploy(config: DeploymentPipelineConfig): Promise<DeploymentPipelineResult> {
    const pipelineId = `quick-${config.projectId}-${Date.now()}`;
    
    const pipelineResult: DeploymentPipelineResult = {
      id: pipelineId,
      buildId: 'quick-deploy',
      status: 'deploying',
      startedAt: new Date(),
      logs: [`Quick deployment started for ${config.projectName}`]
    };
    
    this.pipelines.set(pipelineId, pipelineResult);
    
    try {
      // Skip build phase and deploy directly
      const deploymentConfig: RealDeploymentConfig = {
        projectId: config.projectId,
        projectName: config.projectName,
        type: config.type,
        environment: config.environment,
        region: config.region,
        customDomain: config.customDomain,
        sslEnabled: true,
        environmentVars: config.environmentVars || {},
        startCommand: config.startCommand
      };
      
      const deploymentResult = await realDeploymentService.deploy(deploymentConfig);
      pipelineResult.deploymentId = deploymentResult.id;
      pipelineResult.deploymentResult = deploymentResult;
      
      pipelineResult.status = 'success';
      pipelineResult.url = deploymentResult.url;
      pipelineResult.previewUrl = deploymentResult.customUrl || deploymentResult.url;
      pipelineResult.logs.push(`Quick deployment successful! Your app is live at: ${pipelineResult.url}`);
      pipelineResult.completedAt = new Date();

      try {
        const project = await storage.getProject(config.projectId);
        if (project) {
          notifyDeployComplete(project.ownerId, config.projectName, pipelineResult.url || '');
        }
      } catch (notifyErr) {
        logger.warn('Failed to send deploy-complete push notification:', notifyErr);
      }
      
    } catch (error: any) {
      pipelineResult.status = 'failed';
      pipelineResult.error = error.message;
      pipelineResult.logs.push(`Quick deployment failed: ${error.message}`);
      pipelineResult.completedAt = new Date();
    }
    
    return pipelineResult;
  }
}

export const deploymentPipeline = new DeploymentPipeline();