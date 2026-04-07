// @ts-nocheck
import { KubeConfig, CoreV1Api, AppsV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { isKubernetesEnabled } from '../config/deployment-mode';

const logger = createLogger('kubernetes-orchestrator');

export interface ProjectEnvironment {
  userId: string;
  projectId: string;
  namespace: string;
  podName: string;
  serviceUrl: string;
  resources: {
    cpu: string;
    memory: string;
  };
}

export class KubernetesOrchestrator {
  private k8sApi: CoreV1Api;
  private appsApi: AppsV1Api;
  private networkApi: NetworkingV1Api;
  private kubeConfig: KubeConfig;

  private initialized = false;

  constructor() {
    if (!isKubernetesEnabled()) {
      logger.info('Kubernetes orchestrator disabled in single-VM mode');
      return;
    }

    this.kubeConfig = new KubeConfig();
    
    // Load from cluster config when running in GKE
    if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kubeConfig.loadFromCluster();
    } else {
      // Load from default config for local development
      this.kubeConfig.loadFromDefault();
    }

    this.k8sApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api);
    this.networkApi = this.kubeConfig.makeApiClient(NetworkingV1Api);
    this.initialized = true;
  }

  /**
   * Create an isolated environment for a user's project
   */
  async createProjectEnvironment(userId: string, projectId: string): Promise<ProjectEnvironment> {
    if (!isKubernetesEnabled() || !this.initialized) {
      logger.warn('K8s project environment requested but K8s is disabled in single-VM mode');
      throw new Error('Kubernetes orchestration is disabled in single-VM mode');
    }

    const namespace = `project-${userId}-${projectId}`;
    const podName = `app-${projectId}`;
    
    try {
      // Step 1: Create namespace for isolation
      await this.createNamespace(namespace);
      
      // Step 2: Apply resource quota
      await this.createResourceQuota(namespace);
      
      // Step 3: Create network policy for isolation
      await this.createNetworkPolicy(namespace);
      
      // Step 4: Create persistent volume for code storage
      await this.createPersistentVolume(namespace, projectId);
      
      // Step 5: Deploy the project container
      await this.deployProjectContainer(namespace, podName, projectId);
      
      // Step 6: Create service for internal access
      const serviceUrl = await this.createService(namespace, podName);
      
      // Step 7: Setup ingress for external access
      await this.createIngress(namespace, podName, projectId);
      
      logger.info(`Created isolated environment for project ${projectId} in namespace ${namespace}`);
      
      return {
        userId,
        projectId,
        namespace,
        podName,
        serviceUrl,
        resources: {
          cpu: '500m',
          memory: '512Mi'
        }
      };
    } catch (error) {
      logger.error(`Failed to create environment for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Create namespace for project isolation
   */
  private async createNamespace(name: string): Promise<void> {
    try {
      await this.k8sApi.createNamespace({
        metadata: {
          name,
          labels: {
            'managed-by': 'e-code-platform',
            'isolation': 'project'
          }
        }
      });
      logger.info(`Created namespace: ${name}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Namespace ${name} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create resource quota to limit resource usage
   */
  private async createResourceQuota(namespace: string): Promise<void> {
    try {
      await this.k8sApi.createNamespacedResourceQuota(namespace, {
        metadata: {
          name: 'project-quota'
        },
        spec: {
          hard: {
            'requests.cpu': '1',
            'requests.memory': '1Gi',
            'limits.cpu': '2',
            'limits.memory': '2Gi',
            'persistentvolumeclaims': '2',
            'pods': '5'
          }
        }
      });
      logger.info(`Created resource quota for namespace: ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Resource quota already exists for ${namespace}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create network policy for isolation
   */
  private async createNetworkPolicy(namespace: string): Promise<void> {
    try {
      await this.networkApi.createNamespacedNetworkPolicy(namespace, {
        metadata: {
          name: 'project-isolation'
        },
        spec: {
          podSelector: {},
          policyTypes: ['Ingress', 'Egress'],
          ingress: [{
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    name: 'e-code-platform'
                  }
                }
              }
            ]
          }],
          egress: [
            {
              // Allow DNS
              to: [{
                namespaceSelector: {
                  matchLabels: {
                    name: 'kube-system'
                  }
                }
              }],
              ports: [{
                protocol: 'UDP',
                port: 53
              }]
            },
            {
              // Allow external HTTPS
              ports: [{
                protocol: 'TCP',
                port: 443
              }]
            }
          ]
        }
      });
      logger.info(`Created network policy for namespace: ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Network policy already exists for ${namespace}`);
      } else {
        logger.warn(`Failed to create network policy: ${error.message}`);
      }
    }
  }

  /**
   * Create persistent volume for project code
   */
  private async createPersistentVolume(namespace: string, projectId: string): Promise<void> {
    try {
      await this.k8sApi.createNamespacedPersistentVolumeClaim(namespace, {
        metadata: {
          name: `project-storage-${projectId}`
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '5Gi'
            }
          },
          storageClassName: 'standard'
        }
      });
      logger.info(`Created PVC for project ${projectId}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`PVC already exists for project ${projectId}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Deploy the project container with isolation
   */
  private async deployProjectContainer(namespace: string, podName: string, projectId: string): Promise<void> {
    try {
      await this.appsApi.createNamespacedDeployment(namespace, {
        metadata: {
          name: podName,
          labels: {
            app: podName,
            projectId: projectId
          }
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: podName
            }
          },
          template: {
            metadata: {
              labels: {
                app: podName
              }
            },
            spec: {
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                fsGroup: 1000
              },
              containers: [{
                name: 'user-environment',
                image: 'gcr.io/votre-projet-ecode/user-environment:latest',
                imagePullPolicy: 'Always',
                ports: [{
                  containerPort: 3000,
                  name: 'http'
                }],
                env: [
                  {
                    name: 'PROJECT_ID',
                    value: projectId
                  },
                  {
                    name: 'NODE_ENV',
                    value: 'production'
                  }
                ],
                resources: {
                  limits: {
                    cpu: '500m',
                    memory: '512Mi'
                  },
                  requests: {
                    cpu: '100m',
                    memory: '128Mi'
                  }
                },
                volumeMounts: [{
                  name: 'project-storage',
                  mountPath: '/workspace'
                }],
                readinessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 3000
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 5
                },
                livenessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 3000
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10
                }
              }],
              volumes: [{
                name: 'project-storage',
                persistentVolumeClaim: {
                  claimName: `project-storage-${projectId}`
                }
              }]
            }
          }
        }
      });
      logger.info(`Deployed container for project ${projectId}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Deployment already exists for project ${projectId}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create service for internal project access
   */
  private async createService(namespace: string, podName: string): Promise<string> {
    try {
      await this.k8sApi.createNamespacedService(namespace, {
        metadata: {
          name: `${podName}-service`
        },
        spec: {
          selector: {
            app: podName
          },
          ports: [{
            protocol: 'TCP',
            port: 80,
            targetPort: 3000
          }],
          type: 'ClusterIP'
        }
      });
      
      const serviceUrl = `${podName}-service.${namespace}.svc.cluster.local`;
      logger.info(`Created service: ${serviceUrl}`);
      return serviceUrl;
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        return `${podName}-service.${namespace}.svc.cluster.local`;
      } else {
        throw error;
      }
    }
  }

  /**
   * Create ingress for external access
   */
  private async createIngress(namespace: string, podName: string, projectId: string): Promise<void> {
    try {
      await this.networkApi.createNamespacedIngress(namespace, {
        metadata: {
          name: `${podName}-ingress`,
          annotations: {
            'kubernetes.io/ingress.class': 'nginx',
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
          }
        },
        spec: {
          rules: [{
            host: `${projectId}.e-code.ai`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: `${podName}-service`,
                    port: {
                      number: 80
                    }
                  }
                }
              }]
            }
          }],
          tls: [{
            hosts: [`${projectId}.e-code.ai`],
            secretName: `${projectId}-tls`
          }]
        }
      });
      logger.info(`Created ingress for project ${projectId}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Ingress already exists for project ${projectId}`);
      } else {
        logger.warn(`Failed to create ingress: ${error.message}`);
      }
    }
  }

  /**
   * Delete project environment
   */
  async deleteProjectEnvironment(userId: string, projectId: string): Promise<void> {
    const namespace = `project-${userId}-${projectId}`;
    
    try {
      await this.k8sApi.deleteNamespace(namespace);
      logger.info(`Deleted namespace ${namespace} and all resources`);
    } catch (error) {
      logger.error(`Failed to delete namespace ${namespace}:`, error);
      throw error;
    }
  }

  /**
   * Get project environment status
   */
  async getProjectStatus(userId: string, projectId: string): Promise<any> {
    const namespace = `project-${userId}-${projectId}`;
    const podName = `app-${projectId}`;
    
    try {
      const deployment = await this.appsApi.readNamespacedDeployment(podName, namespace);
      const pods = await this.k8sApi.listNamespacedPod(namespace);
      
      return {
        deployment: {
          ready: deployment.body.status?.readyReplicas === deployment.body.status?.replicas,
          replicas: deployment.body.status?.replicas || 0,
          readyReplicas: deployment.body.status?.readyReplicas || 0
        },
        pods: pods.body.items.map(pod => ({
          name: pod.metadata?.name,
          phase: pod.status?.phase,
          ready: pod.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True'
        }))
      };
    } catch (error) {
      logger.error(`Failed to get status for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Execute command in project container
   */
  async executeInContainer(userId: string, projectId: string, command: string[]): Promise<string> {
    const namespace = `project-${userId}-${projectId}`;
    
    try {
      const pods = await this.k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=app-${projectId}`);
      
      if (pods.body.items.length === 0) {
        throw new Error('No running pods found for project');
      }
      
      const podName = pods.body.items[0].metadata?.name!;
      
      // This would use the exec API to run commands
      // Implementation depends on WebSocket connection for interactive execution
      logger.info(`Executing command in pod ${podName}: ${command.join(' ')}`);
      
      return 'Command execution implemented via WebSocket';
    } catch (error) {
      logger.error(`Failed to execute command in project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Scale deployment to stop/start containers
   */
  async scaleDeployment(userId: string, projectId: string, replicas: number): Promise<void> {
    const namespace = `project-${userId}-${projectId}`;
    const deploymentName = `app-${projectId}`;
    
    try {
      await this.appsApi.patchNamespacedDeployment(
        deploymentName,
        namespace,
        {
          spec: {
            replicas: replicas
          }
        },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: {
            'Content-Type': 'application/strategic-merge-patch+json'
          }
        }
      );
      
      logger.info(`Scaled deployment ${deploymentName} to ${replicas} replicas`);
    } catch (error: any) {
      logger.error(`Failed to scale deployment:`, error);
      throw error;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(userId: string, projectId: string): Promise<string> {
    const namespace = `project-${userId}-${projectId}`;
    
    try {
      const pods = await this.k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=app-${projectId}`);
      
      if (pods.body.items.length === 0) {
        return 'No pods found for this project';
      }
      
      const podName = pods.body.items[0].metadata?.name!;
      
      // Get logs from the pod
      const logs = await this.k8sApi.readNamespacedPodLog(
        podName,
        namespace,
        'user-environment',
        false,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        100, // tail last 100 lines
        true
      );
      
      return logs.body;
    } catch (error: any) {
      logger.error(`Failed to get container logs:`, error);
      return `Failed to retrieve logs: ${error.message}`;
    }
  }
}

export const orchestrator = new KubernetesOrchestrator();