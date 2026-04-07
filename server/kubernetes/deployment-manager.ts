// @ts-nocheck
import * as k8s from '@kubernetes/client-node';
import { createLogger } from '../utils/logger';

const logger = createLogger('DeploymentManager');
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';

const execAsync = promisify(exec);

// Kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

export interface UserEnvironment {
  userId: number;
  username: string;
  namespace: string;
  deploymentName: string;
  serviceName: string;
  ingressName: string;
  persistentVolumeName: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  lastAccessedAt: Date;
  resources: {
    cpuLimit: string;
    memoryLimit: string;
    storageSize: string;
  };
}

export class KubernetesDeploymentManager {
  private readonly namespace = 'e-code-users';
  private readonly storageClass = 'standard';
  private readonly imageRegistry = 'gcr.io/e-code-platform';
  private readonly baseImage = 'user-environment:latest';

  constructor() {
    this.initializeNamespace();
  }

  private async initializeNamespace() {
    try {
      await k8sApi.readNamespace(this.namespace);
    } catch (error) {
      // Namespace doesn't exist, create it
      const namespace = {
        metadata: {
          name: this.namespace,
          labels: {
            'e-code.ai/type': 'user-environments'
          }
        }
      };
      
      try {
        await k8sApi.createNamespace(namespace);
        logger.info(`Created namespace: ${this.namespace}`);
      } catch (createError) {
        logger.error('Failed to create namespace:', createError);
      }
    }
  }

  /**
   * Create an isolated Kubernetes deployment for a user
   */
  async createUserEnvironment(userId: number, username: string): Promise<UserEnvironment> {
    const deploymentId = `user-${userId}-${uuidv4().slice(0, 8)}`;
    const namespace = `user-${userId}`;
    
    logger.info(`Creating isolated environment for user ${username} (ID: ${userId})`);

    try {
      // Create user-specific namespace
      await this.createUserNamespace(namespace, userId, username);
      
      // Create persistent volume for user storage
      const pvcName = await this.createPersistentVolume(namespace, userId);
      
      // Create deployment
      const deploymentName = await this.createDeployment(namespace, userId, username, pvcName);
      
      // Create service
      const serviceName = await this.createService(namespace, userId, deploymentName);
      
      // Create ingress
      const ingressName = await this.createIngress(namespace, userId, username, serviceName);
      
      const environment: UserEnvironment = {
        userId,
        username,
        namespace,
        deploymentName,
        serviceName,
        ingressName,
        persistentVolumeName: pvcName,
        status: 'running',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        resources: {
          cpuLimit: '2',
          memoryLimit: '4Gi',
          storageSize: '10Gi'
        }
      };
      
      // Store environment info in database
      await storage.saveUserEnvironment(environment);
      
      logger.info(`Successfully created environment for user ${username}`);
      return environment;
    } catch (error) {
      logger.error(`Failed to create environment for user ${username}:`, error);
      throw error;
    }
  }

  private async createUserNamespace(namespace: string, userId: number, username: string) {
    const namespaceObj = {
      metadata: {
        name: namespace,
        labels: {
          'e-code.ai/user-id': userId.toString(),
          'e-code.ai/username': username,
          'e-code.ai/type': 'user-environment'
        }
      }
    };
    
    try {
      await k8sApi.createNamespace(namespaceObj);
      logger.info(`Created namespace: ${namespace}`);
    } catch (error: any) {
      if (error.statusCode !== 409) { // 409 = Already exists
        throw error;
      }
    }
  }

  private async createPersistentVolume(namespace: string, userId: number): Promise<string> {
    const pvcName = `user-storage-${userId}`;
    
    const pvc = {
      metadata: {
        name: pvcName,
        namespace: namespace,
        labels: {
          'e-code.ai/user-id': userId.toString()
        }
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: this.storageClass,
        resources: {
          requests: {
            storage: '10Gi'
          }
        }
      }
    };
    
    try {
      await k8sApi.createNamespacedPersistentVolumeClaim(namespace, pvc);
      logger.info(`Created PVC: ${pvcName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }
    
    return pvcName;
  }

  private async createDeployment(
    namespace: string, 
    userId: number, 
    username: string, 
    pvcName: string
  ): Promise<string> {
    const deploymentName = `user-env-${userId}`;
    
    const deployment = {
      metadata: {
        name: deploymentName,
        namespace: namespace,
        labels: {
          'e-code.ai/user-id': userId.toString(),
          'e-code.ai/username': username
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'e-code.ai/user-id': userId.toString()
          }
        },
        template: {
          metadata: {
            labels: {
              'e-code.ai/user-id': userId.toString(),
              'e-code.ai/username': username
            }
          },
          spec: {
            containers: [{
              name: 'user-environment',
              image: `${this.imageRegistry}/${this.baseImage}`,
              ports: [{
                containerPort: 3000,
                name: 'app'
              }, {
                containerPort: 8080,
                name: 'ide'
              }],
              env: [
                { name: 'USER_ID', value: userId.toString() },
                { name: 'USERNAME', value: username },
                { name: 'NODE_ENV', value: 'production' },
                { name: 'PORT', value: '3000' },
                { name: 'IDE_PORT', value: '8080' }
              ],
              resources: {
                requests: {
                  memory: '512Mi',
                  cpu: '250m'
                },
                limits: {
                  memory: '4Gi',
                  cpu: '2'
                }
              },
              volumeMounts: [{
                name: 'user-storage',
                mountPath: '/home/user/projects'
              }, {
                name: 'docker-socket',
                mountPath: '/var/run/docker.sock'
              }],
              securityContext: {
                runAsUser: 1000,
                runAsGroup: 1000,
                fsGroup: 1000
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 3000
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 3000
                },
                initialDelaySeconds: 10,
                periodSeconds: 5
              }
            }],
            volumes: [{
              name: 'user-storage',
              persistentVolumeClaim: {
                claimName: pvcName
              }
            }, {
              name: 'docker-socket',
              hostPath: {
                path: '/var/run/docker.sock',
                type: 'Socket'
              }
            }],
            nodeSelector: {
              'e-code.ai/node-type': 'user-workload'
            },
            tolerations: [{
              key: 'e-code.ai/user-workload',
              operator: 'Equal',
              value: 'true',
              effect: 'NoSchedule'
            }]
          }
        }
      }
    };
    
    try {
      await k8sAppsApi.createNamespacedDeployment(namespace, deployment);
      logger.info(`Created deployment: ${deploymentName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }
    
    return deploymentName;
  }

  private async createService(namespace: string, userId: number, deploymentName: string): Promise<string> {
    const serviceName = `user-svc-${userId}`;
    
    const service = {
      metadata: {
        name: serviceName,
        namespace: namespace,
        labels: {
          'e-code.ai/user-id': userId.toString()
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'e-code.ai/user-id': userId.toString()
        },
        ports: [{
          name: 'app',
          port: 3000,
          targetPort: 3000,
          protocol: 'TCP'
        }, {
          name: 'ide',
          port: 8080,
          targetPort: 8080,
          protocol: 'TCP'
        }]
      }
    };
    
    try {
      await k8sApi.createNamespacedService(namespace, service);
      logger.info(`Created service: ${serviceName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }
    
    return serviceName;
  }

  private async createIngress(
    namespace: string, 
    userId: number, 
    username: string, 
    serviceName: string
  ): Promise<string> {
    const ingressName = `user-ingress-${userId}`;
    const domain = process.env.DOMAIN || 'e-code.ai';
    
    const ingress = {
      metadata: {
        name: ingressName,
        namespace: namespace,
        labels: {
          'e-code.ai/user-id': userId.toString(),
          'e-code.ai/username': username
        },
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/proxy-body-size': '100m',
          'nginx.ingress.kubernetes.io/websocket-services': serviceName
        }
      },
      spec: {
        tls: [{
          hosts: [`${username}.${domain}`, `ide-${username}.${domain}`],
          secretName: `${username}-tls`
        }],
        rules: [{
          host: `${username}.${domain}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: serviceName,
                  port: {
                    number: 3000
                  }
                }
              }
            }]
          }
        }, {
          host: `ide-${username}.${domain}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: serviceName,
                  port: {
                    number: 8080
                  }
                }
              }
            }]
          }
        }]
      }
    };
    
    try {
      await k8sNetworkingApi.createNamespacedIngress(namespace, ingress);
      logger.info(`Created ingress: ${ingressName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }
    
    return ingressName;
  }

  /**
   * Get user environment status
   */
  async getUserEnvironment(userId: number): Promise<UserEnvironment | null> {
    try {
      const environment = await storage.getUserEnvironment(userId);
      if (!environment) {
        return null;
      }
      
      // Check deployment status
      const deployment = await k8sAppsApi.readNamespacedDeployment(
        environment.deploymentName,
        environment.namespace
      );
      
      const readyReplicas = deployment.body.status?.readyReplicas || 0;
      const replicas = deployment.body.spec?.replicas || 0;
      
      environment.status = readyReplicas === replicas ? 'running' : 'creating';
      
      return environment;
    } catch (error) {
      logger.error(`Failed to get environment for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Scale user environment
   */
  async scaleEnvironment(userId: number, replicas: number): Promise<void> {
    const environment = await storage.getUserEnvironment(userId);
    if (!environment) {
      throw new Error('User environment not found');
    }
    
    const patch = [{
      op: 'replace',
      path: '/spec/replicas',
      value: replicas
    }];
    
    await k8sAppsApi.patchNamespacedDeployment(
      environment.deploymentName,
      environment.namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
    
    logger.info(`Scaled environment for user ${userId} to ${replicas} replicas`);
  }

  /**
   * Delete user environment
   */
  async deleteUserEnvironment(userId: number): Promise<void> {
    const environment = await storage.getUserEnvironment(userId);
    if (!environment) {
      return;
    }
    
    try {
      // Delete namespace (this will delete all resources within it)
      await k8sApi.deleteNamespace(environment.namespace);
      
      // Remove from database
      await storage.deleteUserEnvironment(userId);
      
      logger.info(`Deleted environment for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete environment for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Execute command in user environment
   */
  async executeInEnvironment(userId: number, command: string): Promise<string> {
    const environment = await storage.getUserEnvironment(userId);
    if (!environment) {
      throw new Error('User environment not found');
    }
    
    const podName = await this.getPodName(environment.namespace, userId);
    
    const execCommand = `kubectl exec -n ${environment.namespace} ${podName} -- bash -c "${command}"`;
    
    try {
      const { stdout, stderr } = await execAsync(execCommand);
      if (stderr) {
        logger.warn(`Command stderr: ${stderr}`);
      }
      return stdout;
    } catch (error: any) {
      logger.error(`Failed to execute command in user environment:`, error);
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  private async getPodName(namespace: string, userId: number): Promise<string> {
    const labelSelector = `e-code.ai/user-id=${userId}`;
    const pods = await k8sApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );
    
    if (pods.body.items.length === 0) {
      throw new Error('No pods found for user environment');
    }
    
    const runningPod = pods.body.items.find(pod => 
      pod.status?.phase === 'Running'
    );
    
    if (!runningPod) {
      throw new Error('No running pods found for user environment');
    }
    
    return runningPod.metadata?.name || '';
  }

  /**
   * Update resource limits for user environment
   */
  async updateResourceLimits(
    userId: number, 
    cpuLimit: string, 
    memoryLimit: string
  ): Promise<void> {
    const environment = await storage.getUserEnvironment(userId);
    if (!environment) {
      throw new Error('User environment not found');
    }
    
    const patch = [{
      op: 'replace',
      path: '/spec/template/spec/containers/0/resources/limits',
      value: {
        cpu: cpuLimit,
        memory: memoryLimit
      }
    }];
    
    await k8sAppsApi.patchNamespacedDeployment(
      environment.deploymentName,
      environment.namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
    
    // Update in database
    environment.resources.cpuLimit = cpuLimit;
    environment.resources.memoryLimit = memoryLimit;
    await storage.updateUserEnvironment(environment);
    
    logger.info(`Updated resource limits for user ${userId}`);
  }

  /**
   * Get environment metrics
   */
  async getEnvironmentMetrics(userId: number): Promise<any> {
    const environment = await storage.getUserEnvironment(userId);
    if (!environment) {
      return null;
    }
    
    try {
      const podName = await this.getPodName(environment.namespace, userId);
      
      // Get pod metrics using kubectl (requires metrics-server)
      const { stdout } = await execAsync(
        `kubectl top pod ${podName} -n ${environment.namespace} --no-headers`
      );
      
      const parts = stdout.trim().split(/\s+/);
      const cpu = parts[1];
      const memory = parts[2];
      
      return {
        cpu,
        memory,
        namespace: environment.namespace,
        pod: podName
      };
    } catch (error) {
      logger.error(`Failed to get metrics for user ${userId}:`, error);
      return null;
    }
  }
}

export const deploymentManager = new KubernetesDeploymentManager();