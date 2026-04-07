import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DeploymentTarget {
  id: string;
  region: string;
  host: string;
  port: number;
  status: 'active' | 'draining' | 'offline';
}

export interface ContainerDeployment {
  deploymentId: string;
  projectId: number;
  imageName: string;
  imageTag: string;
  containerName: string;
  port: number;
  environmentVars?: Record<string, string>;
  replicas: number;
  targetHosts: DeploymentTarget[];
  healthCheckPath?: string;
  resourceLimits?: {
    cpu: string;
    memory: string;
  };
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url: string;
  containerIds: string[];
  logs: string[];
  error?: string;
}

export class ContainerOrchestrator {
  private deploymentTargets: Map<string, DeploymentTarget> = new Map();
  private activeDeployments: Map<string, ContainerDeployment> = new Map();
  private kubeconfigPath: string;

  constructor() {
    this.kubeconfigPath = process.env.KUBECONFIG || path.join(process.env.HOME || '', '.kube', 'config');
    this.initializeTargets();
  }

  private initializeTargets() {
    // Initialize deployment targets (Kubernetes clusters or Docker hosts)
    const targets: DeploymentTarget[] = [
      { id: 'us-east-1', region: 'us-east-1', host: 'k8s-us-east-1.e-code.ai', port: 443, status: 'active' },
      { id: 'us-west-1', region: 'us-west-1', host: 'k8s-us-west-1.e-code.ai', port: 443, status: 'active' },
      { id: 'eu-west-1', region: 'eu-west-1', host: 'k8s-eu-west-1.e-code.ai', port: 443, status: 'active' },
      { id: 'ap-northeast-1', region: 'ap-northeast-1', host: 'k8s-ap-northeast-1.e-code.ai', port: 443, status: 'active' }
    ];

    targets.forEach(target => {
      this.deploymentTargets.set(target.id, target);
    });
  }

  async deployContainer(deployment: ContainerDeployment): Promise<DeploymentResult> {
    const logs: string[] = [];
    const containerIds: string[] = [];
    
    try {
      logs.push(`[${new Date().toISOString()}] Starting container deployment for ${deployment.containerName}`);

      // Generate Kubernetes deployment manifest
      const manifest = this.generateK8sManifest(deployment);
      const manifestPath = `/tmp/deployment-${deployment.deploymentId}.yaml`;
      await fs.writeFile(manifestPath, manifest);
      logs.push(`[${new Date().toISOString()}] Generated Kubernetes manifest`);

      // Deploy to each target region
      for (const target of deployment.targetHosts) {
        logs.push(`[${new Date().toISOString()}] Deploying to ${target.region}...`);
        
        try {
          // Apply Kubernetes manifest
          const deployCommand = `kubectl apply -f ${manifestPath} --context=${target.id}`;
          const { stdout, stderr } = await execAsync(deployCommand);
          
          if (stdout) logs.push(stdout);
          if (stderr) logs.push(`[WARN] ${stderr}`);

          // Wait for deployment to be ready
          const waitCommand = `kubectl rollout status deployment/${deployment.containerName} -n e-code-apps --context=${target.id} --timeout=300s`;
          await execAsync(waitCommand);
          logs.push(`[${new Date().toISOString()}] Deployment ready in ${target.region}`);

          // Get pod names
          const podCommand = `kubectl get pods -n e-code-apps -l app=${deployment.containerName} --context=${target.id} -o jsonpath='{.items[*].metadata.name}'`;
          const { stdout: podNames } = await execAsync(podCommand);
          containerIds.push(...podNames.split(' ').filter(Boolean));

        } catch (error: any) {
          logs.push(`[${new Date().toISOString()}] Failed to deploy to ${target.region}: ${error.message}`);
          throw error;
        }
      }

      // Setup ingress and SSL
      const ingressUrl = await this.setupIngress(deployment);
      logs.push(`[${new Date().toISOString()}] Ingress configured: ${ingressUrl}`);

      // Store deployment info
      this.activeDeployments.set(deployment.deploymentId, deployment);

      // Clean up manifest file
      await fs.unlink(manifestPath).catch((err) => {
        console.warn('[ContainerOrchestrator] Failed to clean up manifest:', manifestPath, err?.message);
      });

      logs.push(`[${new Date().toISOString()}] Deployment completed successfully`);

      return {
        success: true,
        deploymentId: deployment.deploymentId,
        url: ingressUrl,
        containerIds,
        logs
      };

    } catch (error: any) {
      logs.push(`[${new Date().toISOString()}] Deployment failed: ${error.message}`);
      return {
        success: false,
        deploymentId: deployment.deploymentId,
        url: '',
        containerIds,
        logs,
        error: error.message
      };
    }
  }

  private generateK8sManifest(deployment: ContainerDeployment): string {
    const cpu = deployment.resourceLimits?.cpu || '500m';
    const memory = deployment.resourceLimits?.memory || '512Mi';
    
    const envVars = deployment.environmentVars 
      ? Object.entries(deployment.environmentVars).map(([key, value]) => `
        - name: ${key}
          value: "${value}"`)
          .join('')
      : '';

    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployment.containerName}
  namespace: e-code-apps
  labels:
    app: ${deployment.containerName}
    projectId: "${deployment.projectId}"
spec:
  replicas: ${deployment.replicas}
  selector:
    matchLabels:
      app: ${deployment.containerName}
  template:
    metadata:
      labels:
        app: ${deployment.containerName}
    spec:
      containers:
      - name: ${deployment.containerName}
        image: ${deployment.imageName}:${deployment.imageTag}
        ports:
        - containerPort: ${deployment.port}
        resources:
          limits:
            cpu: ${cpu}
            memory: ${memory}
          requests:
            cpu: ${cpu === '500m' ? '100m' : '250m'}
            memory: ${memory === '512Mi' ? '128Mi' : '256Mi'}
        env:${envVars}
        ${deployment.healthCheckPath ? `
        livenessProbe:
          httpGet:
            path: ${deployment.healthCheckPath}
            port: ${deployment.port}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: ${deployment.healthCheckPath}
            port: ${deployment.port}
          initialDelaySeconds: 5
          periodSeconds: 5` : ''}
---
apiVersion: v1
kind: Service
metadata:
  name: ${deployment.containerName}
  namespace: e-code-apps
spec:
  selector:
    app: ${deployment.containerName}
  ports:
    - protocol: TCP
      port: 80
      targetPort: ${deployment.port}
  type: ClusterIP
`;
  }

  private async setupIngress(deployment: ContainerDeployment): Promise<string> {
    const subdomain = deployment.containerName;
    const domain = 'e-code.ai';
    const url = `https://${subdomain}.${domain}`;

    const ingressManifest = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${deployment.containerName}
  namespace: e-code-apps
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
  - hosts:
    - ${subdomain}.${domain}
    secretName: ${deployment.containerName}-tls
  rules:
  - host: ${subdomain}.${domain}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${deployment.containerName}
            port:
              number: 80
`;

    const ingressPath = `/tmp/ingress-${deployment.deploymentId}.yaml`;
    await fs.writeFile(ingressPath, ingressManifest);

    // Apply ingress to all regions
    for (const target of deployment.targetHosts) {
      try {
        const applyCommand = `kubectl apply -f ${ingressPath} --context=${target.id}`;
        await execAsync(applyCommand);
      } catch (error) {
        console.error(`Failed to setup ingress in ${target.region}:`, error);
      }
    }

    await fs.unlink(ingressPath).catch((err) => {
      console.warn('[ContainerOrchestrator] Failed to clean up ingress manifest:', ingressPath, err?.message);
    });
    return url;
  }

  async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    for (const target of deployment.targetHosts) {
      const scaleCommand = `kubectl scale deployment/${deployment.containerName} --replicas=${replicas} -n e-code-apps --context=${target.id}`;
      await execAsync(scaleCommand);
    }

    deployment.replicas = replicas;
  }

  async stopDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    for (const target of deployment.targetHosts) {
      try {
        // Delete deployment and service
        const deleteCommand = `kubectl delete deployment,service,ingress ${deployment.containerName} -n e-code-apps --context=${target.id}`;
        await execAsync(deleteCommand);
      } catch (error) {
        console.error(`Failed to stop deployment in ${target.region}:`, error);
      }
    }

    this.activeDeployments.delete(deploymentId);
  }

  async getDeploymentLogs(deploymentId: string, lines: number = 100): Promise<string[]> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    const logs: string[] = [];
    
    for (const target of deployment.targetHosts) {
      try {
        const logCommand = `kubectl logs -l app=${deployment.containerName} -n e-code-apps --tail=${lines} --context=${target.id}`;
        const { stdout } = await execAsync(logCommand);
        logs.push(`=== Logs from ${target.region} ===`);
        logs.push(stdout);
      } catch (error) {
        logs.push(`Failed to get logs from ${target.region}`);
      }
    }

    return logs;
  }

  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    const status: any = {
      deploymentId,
      containerName: deployment.containerName,
      replicas: deployment.replicas,
      regions: []
    };

    for (const target of deployment.targetHosts) {
      try {
        const statusCommand = `kubectl get deployment ${deployment.containerName} -n e-code-apps --context=${target.id} -o json`;
        const { stdout } = await execAsync(statusCommand);
        const deploymentStatus = JSON.parse(stdout);
        
        status.regions.push({
          region: target.region,
          ready: deploymentStatus.status.readyReplicas || 0,
          desired: deploymentStatus.status.replicas || 0,
          available: deploymentStatus.status.availableReplicas || 0
        });
      } catch (error) {
        status.regions.push({
          region: target.region,
          error: 'Failed to get status'
        });
      }
    }

    return status;
  }
}

export const containerOrchestrator = new ContainerOrchestrator();