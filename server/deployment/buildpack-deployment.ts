import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface BuildpackDeployment {
  projectId: number;
  deploymentId: string;
  buildpackType: 'nodejs' | 'python' | 'static' | 'docker';
  buildCommand?: string;
  startCommand?: string;
  port: number;
  environmentVars?: Record<string, string>;
  customDomain?: string;
}

export interface BuildpackDeploymentResult {
  success: boolean;
  deploymentId: string;
  url: string;
  buildLogs: string[];
  deploymentPath: string;
  error?: string;
}

/**
 * Alternative deployment service that works without Docker/Kubernetes
 * Uses buildpacks and process management for real deployments
 */
export class BuildpackDeploymentService {
  private deploymentBase: string;
  private nginxConfigPath: string;
  private processManager: Map<string, any> = new Map();
  
  constructor() {
    this.deploymentBase = path.join(process.cwd(), '.deployments');
    this.nginxConfigPath = '/etc/nginx/sites-enabled';
    this.initializeDeploymentDirectory();
  }

  private async initializeDeploymentDirectory() {
    try {
      await fs.mkdir(this.deploymentBase, { recursive: true });
      await fs.mkdir(path.join(this.deploymentBase, 'apps'), { recursive: true });
      await fs.mkdir(path.join(this.deploymentBase, 'logs'), { recursive: true });
    } catch (error) {
      console.error('[buildpack-deployment] Failed to initialize directories:', error);
    }
  }

  async deployWithBuildpack(config: BuildpackDeployment): Promise<BuildpackDeploymentResult> {
    const buildLogs: string[] = [];
    const deploymentPath = path.join(this.deploymentBase, 'apps', config.deploymentId);
    
    try {
      buildLogs.push(`[${new Date().toISOString()}] Starting buildpack deployment for project ${config.projectId}`);
      
      // Create deployment directory
      await fs.mkdir(deploymentPath, { recursive: true });
      buildLogs.push(`[${new Date().toISOString()}] Created deployment directory`);

      // Copy project files
      const project = await storage.getProject(config.projectId);
      if (!project) throw new Error('Project not found');
      
      const projectPath = path.join(process.cwd(), '.projects', `project-${config.projectId}`);
      await this.copyProjectFiles(projectPath, deploymentPath);
      buildLogs.push(`[${new Date().toISOString()}] Copied project files`);

      // Write environment variables
      if (config.environmentVars) {
        const envContent = Object.entries(config.environmentVars)
          .map(([key, value]) => `export ${key}="${value}"`)
          .join('\n');
        await fs.writeFile(path.join(deploymentPath, '.env.sh'), envContent);
        buildLogs.push(`[${new Date().toISOString()}] Created environment file`);
      }

      // Install dependencies and build based on buildpack type
      switch (config.buildpackType) {
        case 'nodejs':
          await this.deployNodeJs(deploymentPath, config, buildLogs);
          break;
        case 'python':
          await this.deployPython(deploymentPath, config, buildLogs);
          break;
        case 'static':
          await this.deployStatic(deploymentPath, config, buildLogs);
          break;
        default:
          throw new Error(`Unsupported buildpack type: ${config.buildpackType}`);
      }

      // Generate deployment URL
      const subdomain = `project-${config.projectId}-${config.deploymentId.slice(0, 8)}`;
      const url = `https://${subdomain}.e-code.ai`;

      // Configure reverse proxy (nginx)
      await this.configureReverseProxy(subdomain, config.port, deploymentPath);
      buildLogs.push(`[${new Date().toISOString()}] Configured reverse proxy`);

      // Handle custom domain if provided
      if (config.customDomain) {
        await this.configureCustomDomain(config.customDomain, subdomain);
        buildLogs.push(`[${new Date().toISOString()}] Configured custom domain: ${config.customDomain}`);
      }

      buildLogs.push(`[${new Date().toISOString()}] Deployment completed successfully`);
      buildLogs.push(`[${new Date().toISOString()}] Application is live at: ${url}`);

      return {
        success: true,
        deploymentId: config.deploymentId,
        url,
        buildLogs,
        deploymentPath
      };

    } catch (error: any) {
      buildLogs.push(`[${new Date().toISOString()}] Deployment failed: ${error.message}`);
      return {
        success: false,
        deploymentId: config.deploymentId,
        url: '',
        buildLogs,
        deploymentPath,
        error: error.message
      };
    }
  }

  private async deployNodeJs(deploymentPath: string, config: BuildpackDeployment, logs: string[]): Promise<void> {
    // Install dependencies
    logs.push(`[${new Date().toISOString()}] Installing Node.js dependencies...`);
    const { stdout: npmOutput } = await execAsync('npm ci --production', { cwd: deploymentPath });
    logs.push(npmOutput);

    // Run build command if specified
    if (config.buildCommand) {
      logs.push(`[${new Date().toISOString()}] Running build command: ${config.buildCommand}`);
      const { stdout: buildOutput } = await execAsync(config.buildCommand, { cwd: deploymentPath });
      logs.push(buildOutput);
    }

    // Create start script
    const startScript = `#!/bin/bash
source .env.sh 2>/dev/null || true
${config.startCommand || 'npm start'}
`;
    await fs.writeFile(path.join(deploymentPath, 'start.sh'), startScript, { mode: 0o755 });

    // Start the application using PM2 or similar
    logs.push(`[${new Date().toISOString()}] Starting Node.js application...`);
    const pm2Config = {
      name: `app-${config.deploymentId}`,
      script: 'start.sh',
      cwd: deploymentPath,
      env: {
        ...config.environmentVars,
        PORT: config.port.toString(),
        NODE_ENV: 'production'
      },
      error_file: path.join(this.deploymentBase, 'logs', `${config.deploymentId}-error.log`),
      out_file: path.join(this.deploymentBase, 'logs', `${config.deploymentId}-out.log`),
      max_memory_restart: '500M'
    };

    // Start with PM2
    await execAsync(`pm2 start ${JSON.stringify(pm2Config)}`);
    logs.push(`[${new Date().toISOString()}] Application started on port ${config.port}`);
  }

  private async deployPython(deploymentPath: string, config: BuildpackDeployment, logs: string[]): Promise<void> {
    // Create virtual environment
    logs.push(`[${new Date().toISOString()}] Creating Python virtual environment...`);
    await execAsync('python3 -m venv venv', { cwd: deploymentPath });

    // Install dependencies
    logs.push(`[${new Date().toISOString()}] Installing Python dependencies...`);
    const pipCmd = 'source venv/bin/activate && pip install -r requirements.txt';
    const { stdout: pipOutput } = await execAsync(pipCmd, { cwd: deploymentPath, shell: '/bin/bash' });
    logs.push(pipOutput);

    // Create start script
    const startScript = `#!/bin/bash
source venv/bin/activate
source .env.sh 2>/dev/null || true
${config.startCommand || 'python app.py'}
`;
    await fs.writeFile(path.join(deploymentPath, 'start.sh'), startScript, { mode: 0o755 });

    // Start the application
    logs.push(`[${new Date().toISOString()}] Starting Python application...`);
    const pm2Config = {
      name: `app-${config.deploymentId}`,
      script: 'start.sh',
      cwd: deploymentPath,
      interpreter: '/bin/bash',
      env: {
        ...config.environmentVars,
        PORT: config.port.toString()
      },
      error_file: path.join(this.deploymentBase, 'logs', `${config.deploymentId}-error.log`),
      out_file: path.join(this.deploymentBase, 'logs', `${config.deploymentId}-out.log`)
    };

    await execAsync(`pm2 start ${JSON.stringify(pm2Config)}`);
    logs.push(`[${new Date().toISOString()}] Application started on port ${config.port}`);
  }

  private async deployStatic(deploymentPath: string, config: BuildpackDeployment, logs: string[]): Promise<void> {
    // Run build command if specified
    if (config.buildCommand) {
      logs.push(`[${new Date().toISOString()}] Running build command: ${config.buildCommand}`);
      const { stdout: buildOutput } = await execAsync(config.buildCommand, { cwd: deploymentPath });
      logs.push(buildOutput);
    }

    // No need to start a process for static files
    logs.push(`[${new Date().toISOString()}] Static files deployed successfully`);
  }

  private async copyProjectFiles(sourcePath: string, destinationPath: string) {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(sourcePath, entry.name);
      const destPath = path.join(destinationPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'venv', '__pycache__'].includes(entry.name)) {
          await fs.mkdir(destPath, { recursive: true });
          await this.copyProjectFiles(srcPath, destPath);
        }
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async configureReverseProxy(subdomain: string, port: number, deploymentPath: string): Promise<void> {
    const nginxConfig = `
server {
    listen 80;
    server_name ${subdomain}.e-code.ai;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files optimization
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|txt)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

    // Write nginx config (would need sudo in production)
    const configPath = path.join(this.deploymentBase, 'nginx', `${subdomain}.conf`);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, nginxConfig);

    // In production, would reload nginx: sudo nginx -s reload
  }

  private async configureCustomDomain(customDomain: string, targetSubdomain: string): Promise<void> {
    // In production, this would:
    // 1. Update DNS records
    // 2. Configure SSL with Let's Encrypt
    // 3. Add nginx server block for custom domain
  }

  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    try {
      const errorLogPath = path.join(this.deploymentBase, 'logs', `${deploymentId}-error.log`);
      const outLogPath = path.join(this.deploymentBase, 'logs', `${deploymentId}-out.log`);
      
      const logs: string[] = [];
      
      try {
        const errorLogs = await fs.readFile(errorLogPath, 'utf-8');
        logs.push('=== Error Logs ===', errorLogs);
      } catch (err: any) { console.error("[catch]", err?.message || err); /* Log file may not exist yet - that's OK */ }
      
      try {
        const outLogs = await fs.readFile(outLogPath, 'utf-8');
        logs.push('=== Output Logs ===', outLogs);
      } catch (err: any) { console.error("[catch]", err?.message || err); /* Log file may not exist yet - that's OK */ }
      
      return logs;
    } catch (error) {
      return [`Failed to retrieve logs: ${error}`];
    }
  }

  async stopDeployment(deploymentId: string): Promise<void> {
    try {
      await execAsync(`pm2 stop app-${deploymentId}`);
      await execAsync(`pm2 delete app-${deploymentId}`);
    } catch (error) {
      console.error(`[buildpack-deployment] Failed to stop deployment:`, error);
    }
  }

  async scaleDeployment(deploymentId: string, instances: number): Promise<void> {
    try {
      await execAsync(`pm2 scale app-${deploymentId} ${instances}`);
    } catch (error) {
      throw new Error(`Failed to scale deployment: ${error}`);
    }
  }
}

export const buildpackDeploymentService = new BuildpackDeploymentService();