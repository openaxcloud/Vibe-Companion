// @ts-nocheck
import * as k8s from '@kubernetes/client-node';
import * as crypto from 'crypto';
import * as path from 'path';
import { storage } from '../storage';
import { containerBuilder } from './container-builder';
import { isKubernetesEnabled } from '../config/deployment-mode';
import { createLogger } from '../utils/logger';

const logger = createLogger('k8s-deployment-service');

export interface DeploymentConfig {
  projectId: number;
  deploymentType: 'static' | 'autoscale' | 'reserved-vm' | 'scheduled';
  environment: Record<string, string>;
  customDomain?: string;
  regions?: string[];
  scaling?: {
    minInstances: number;
    maxInstances: number;
    targetCPUUtilization: number;
  };
}

export interface DeploymentStatus {
  id: string;
  projectId: number;
  status: 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  url: string;
  customDomain?: string;
  regions: string[];
  replicas: number;
  createdAt: Date;
  updatedAt: Date;
  logs?: string[];
}

export class K8sDeploymentService {
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;
  private kc: k8s.KubeConfig;
  
  private initialized = false;

  constructor() {
    if (!isKubernetesEnabled()) {
      logger.info('K8s deployment service disabled in single-VM mode');
      return;
    }

    this.kc = new k8s.KubeConfig();
    
    // Load from default kubeconfig or in-cluster config
    try {
      this.kc.loadFromDefault();
    } catch (err: any) { console.error("[catch]", err?.message || err);
      // If not in cluster, use mock config for development
      this.kc.loadFromString(this.getDevKubeconfig());
    }
    
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.initialized = true;
  }

  async deploy(config: DeploymentConfig): Promise<DeploymentStatus> {
    if (!isKubernetesEnabled() || !this.initialized) {
      logger.warn('K8s deployment requested but K8s is disabled in single-VM mode');
      throw new Error('Kubernetes deployment is disabled in single-VM mode');
    }

    const deploymentId = crypto.randomBytes(16).toString('hex');
    const project = await storage.getProject(config.projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }

    // Build container image
    const imageName = await containerBuilder.buildImage({
      projectId: config.projectId,
      projectName: project.name,
      deploymentId,
      language: project.language,
    });

    // Create deployment status
    const status: DeploymentStatus = {
      id: deploymentId,
      projectId: config.projectId,
      status: 'deploying',
      url: `https://${project.name.toLowerCase().replace(/\s+/g, '-')}-${deploymentId}.e-code.ai`,
      customDomain: config.customDomain,
      regions: config.regions || ['us-east-1'],
      replicas: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      logs: [`Building container image: ${imageName}`],
    };

    // Deploy to each region
    for (const region of status.regions) {
      await this.deployToRegion(status, imageName, config, region);
    }

    // Create ingress for custom domain
    if (config.customDomain) {
      await this.createIngress(status, config.customDomain);
    }

    status.status = 'running';
    status.updatedAt = new Date();
    
    // Save deployment to storage
    await storage.saveDeployment(status);
    
    return status;
  }

  private async deployToRegion(
    status: DeploymentStatus,
    imageName: string,
    config: DeploymentConfig,
    region: string
  ): Promise<void> {
    const namespace = 'e-code-apps';
    const appName = `app-${status.projectId}-${status.id}`;
    
    // Create namespace if not exists
    try {
      await this.k8sApi.createNamespace({
        metadata: { name: namespace }
      });
    } catch (e) {
      // Namespace might already exist
    }

    // Create deployment
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: appName,
        namespace,
        labels: {
          app: appName,
          projectId: String(status.projectId),
          deploymentId: status.id,
          region,
        }
      },
      spec: {
        replicas: config.scaling?.minInstances || 1,
        selector: {
          matchLabels: {
            app: appName,
          }
        },
        template: {
          metadata: {
            labels: {
              app: appName,
            }
          },
          spec: {
            containers: [{
              name: 'app',
              image: imageName,
              ports: [{
                containerPort: 3000,
              }],
              env: Object.entries(config.environment).map(([name, value]) => ({
                name,
                value,
              })),
              resources: {
                requests: {
                  memory: '256Mi',
                  cpu: '250m',
                },
                limits: {
                  memory: '512Mi',
                  cpu: '500m',
                }
              }
            }],
          }
        }
      }
    };

    await this.k8sAppsApi.createNamespacedDeployment(namespace, deployment);
    status.logs?.push(`Deployed to region: ${region}`);

    // Create service
    const service: k8s.V1Service = {
      metadata: {
        name: appName,
        namespace,
      },
      spec: {
        selector: {
          app: appName,
        },
        ports: [{
          port: 80,
          targetPort: 3000,
        }],
        type: 'LoadBalancer',
      }
    };

    await this.k8sApi.createNamespacedService(namespace, service);
    status.logs?.push(`Created service in region: ${region}`);

    // Create horizontal pod autoscaler if autoscale
    if (config.deploymentType === 'autoscale' && config.scaling) {
      const hpa: k8s.V2HorizontalPodAutoscaler = {
        metadata: {
          name: appName,
          namespace,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: appName,
          },
          minReplicas: config.scaling.minInstances,
          maxReplicas: config.scaling.maxInstances,
          metrics: [{
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: config.scaling.targetCPUUtilization,
              }
            }
          }],
        }
      };

      await this.k8sApi.createNamespacedHorizontalPodAutoscaler(namespace, hpa);
      status.logs?.push(`Created autoscaler in region: ${region}`);
    }
  }

  private async createIngress(status: DeploymentStatus, customDomain: string): Promise<void> {
    const namespace = 'e-code-apps';
    const appName = `app-${status.projectId}-${status.id}`;
    
    const ingress: k8s.V1Ingress = {
      metadata: {
        name: `${appName}-ingress`,
        namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        }
      },
      spec: {
        tls: [{
          hosts: [customDomain],
          secretName: `${appName}-tls`,
        }],
        rules: [{
          host: customDomain,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: appName,
                  port: {
                    number: 80,
                  }
                }
              }
            }],
          }
        }],
      }
    };

    await this.k8sNetworkingApi.createNamespacedIngress(namespace, ingress);
    status.logs?.push(`Created ingress for custom domain: ${customDomain}`);
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    return storage.getDeployment(deploymentId);
  }

  async getLogs(deploymentId: string): Promise<string> {
    const deployment = await storage.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const namespace = 'e-code-apps';
    const appName = `app-${deployment.projectId}-${deployment.id}`;
    
    try {
      const pods = await this.k8sApi.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${appName}`
      );

      if (pods.body.items.length === 0) {
        return 'No pods found for this deployment';
      }

      const podName = pods.body.items[0].metadata!.name!;
      const log = await this.k8sApi.readNamespacedPodLog(podName, namespace);
      
      return log.body;
    } catch (error) {
      return `Error fetching logs: ${error.message}`;
    }
  }

  async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
    const deployment = await storage.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const namespace = 'e-code-apps';
    const appName = `app-${deployment.projectId}-${deployment.id}`;
    
    const patch = [{
      op: 'replace',
      path: '/spec/replicas',
      value: replicas,
    }];

    await this.k8sAppsApi.patchNamespacedDeployment(
      appName,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: {
          'Content-Type': 'application/json-patch+json',
        }
      }
    );

    deployment.replicas = replicas;
    deployment.updatedAt = new Date();
    await storage.saveDeployment(deployment);
  }

  async stopDeployment(deploymentId: string): Promise<void> {
    const deployment = await storage.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const namespace = 'e-code-apps';
    const appName = `app-${deployment.projectId}-${deployment.id}`;
    
    // Delete deployment
    await this.k8sAppsApi.deleteNamespacedDeployment(appName, namespace);
    
    // Delete service
    await this.k8sApi.deleteNamespacedService(appName, namespace);
    
    // Delete ingress if exists
    if (deployment.customDomain) {
      await this.k8sNetworkingApi.deleteNamespacedIngress(`${appName}-ingress`, namespace);
    }

    deployment.status = 'stopped';
    deployment.updatedAt = new Date();
    await storage.saveDeployment(deployment);
  }

  private getDevKubeconfig(): string {
    // Development kubeconfig for local testing
    return `
apiVersion: v1
clusters:
- cluster:
    server: http://localhost:8001
  name: local
contexts:
- context:
    cluster: local
    user: admin
  name: local-context
current-context: local-context
kind: Config
users:
- name: admin
  user:
    token: dev-token
`;
  }
}

export const k8sDeploymentService = new K8sDeploymentService();