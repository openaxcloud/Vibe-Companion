import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('simple-deployer');

export interface DeploymentConfig {
  projectId: string;
  projectName: string;
  environment: string;
  region: string;
  customDomain?: string;
}

export interface DeploymentResult {
  id: string;
  url: string;
  status: 'deploying' | 'deployed' | 'failed';
  logs: string[];
}

export class SimpleDeployer {
  private deployments: Map<string, DeploymentResult> = new Map();
  
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = `dep-${config.projectId}-${Date.now()}`;
    const projectDir = path.join(process.cwd(), 'projects', config.projectId);
    
    // Initialize deployment
    const deployment: DeploymentResult = {
      id: deploymentId,
      url: `https://project-${config.projectId}.e-code.ai`,
      status: 'deploying',
      logs: ['Starting deployment...']
    };
    
    this.deployments.set(deploymentId, deployment);
    
    // Start deployment process asynchronously
    void (async () => {
      try {
        deployment.logs.push('Analyzing project...');
        
        // Check project type
        const projectType = await this.detectProjectType(projectDir);
        deployment.logs.push(`Detected project type: ${projectType}`);
        
        // Build project
        deployment.logs.push('Building project...');
        await this.buildProject(projectDir, projectType);
        deployment.logs.push('Build complete');
        
        // Deploy to hosting
        deployment.logs.push('Deploying to E-Code hosting...');
        deployment.logs.push(`Region: ${config.region}`);
        deployment.logs.push(`Environment: ${config.environment}`);
        
        // Set custom domain if provided
        if (config.customDomain) {
          deployment.url = `https://${config.customDomain}`;
          deployment.logs.push(`Custom domain configured: ${config.customDomain}`);
        }
        
        // Perform actual deployment operations
        const realDeploymentService = await import('./real-deployment-service').then(m => m.realDeploymentService);
        await realDeploymentService.deploy({
          projectId: parseInt(config.projectId),
          projectName: config.projectName,
          type: projectType === 'node.js' ? 'autoscale' : 'static',
          environment: config.environment as 'development' | 'staging' | 'production',
          region: [config.region],
          customDomain: config.customDomain,
          sslEnabled: true,
          environmentVars: {}
        });
        
        deployment.logs.push('Deployment successful!');
        deployment.status = 'deployed';
        
      } catch (error) {
        deployment.logs.push(`Deployment failed: ${error}`);
        deployment.status = 'failed';
      }
    })();
    
    return deployment;
  }
  
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentResult | null> {
    return this.deployments.get(deploymentId) || null;
  }
  
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    const deployment = this.deployments.get(deploymentId);
    return deployment ? deployment.logs : [];
  }
  
  private async detectProjectType(projectDir: string): Promise<string> {
    // File existence checks - absence is expected condition for detection
    try {
      // Check for package.json
      await fs.access(path.join(projectDir, 'package.json'));
      return 'node.js';
    } catch (err: any) { console.error("[catch]", err?.message || err); /* File not found - check next type */ }
    
    try {
      // Check for requirements.txt
      await fs.access(path.join(projectDir, 'requirements.txt'));
      return 'python';
    } catch (err: any) { console.error("[catch]", err?.message || err); /* File not found - check next type */ }
    
    try {
      // Check for index.html
      await fs.access(path.join(projectDir, 'index.html'));
      return 'static';
    } catch (err: any) { console.error("[catch]", err?.message || err); /* File not found - use default */ }
    
    return 'unknown';
  }
  
  private async buildProject(projectDir: string, projectType: string): Promise<void> {
    switch (projectType) {
      case 'node.js':
        try {
          // Check if build script exists
          const packageJson = JSON.parse(
            await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8')
          );
          
          if (packageJson.scripts?.build) {
            await execAsync(`cd ${projectDir} && npm run build`);
          }
        } catch (error) {
          logger.warn('No build script found or build failed:', error);
        }
        break;
        
      case 'python':
        // Python projects typically don't need a build step
        break;
        
      case 'static':
        // Static sites are already built
        break;
    }
  }
}

export const simpleDeployer = new SimpleDeployer();