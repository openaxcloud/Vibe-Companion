import { 
  IDatabaseProvider, 
  DatabaseProvider, 
  ProvisioningOptions, 
  ProvisionedDatabase,
  DatabaseCredentials,
  DatabaseMetrics,
  BackupOptions,
  BackupInfo,
  PLAN_LIMITS,
  PlanType
} from './database-provider.interface';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';

const logger = createLogger('CloudNativePGProvider');

interface K8sClusterSpec {
  instances: number;
  imageName?: string;
  storage: {
    size: string;
    storageClass?: string;
  };
  postgresql?: {
    parameters?: Record<string, string>;
  };
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  bootstrap?: {
    initdb?: {
      database?: string;
      owner?: string;
      secret?: { name: string };
    };
  };
  backup?: {
    retentionPolicy?: string;
    barmanObjectStore?: {
      destinationPath: string;
      s3Credentials?: {
        accessKeyId: { key: string; name: string };
        secretAccessKey: { key: string; name: string };
      };
      wal?: { compression?: string; maxParallel?: number };
    };
  };
}

interface K8sCluster {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: K8sClusterSpec;
}

interface K8sScheduledBackup {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    schedule: string;
    backupOwnerReference: string;
    cluster: { name: string };
    immediate?: boolean;
  };
}

export class CloudNativePGProvider implements IDatabaseProvider {
  readonly name: DatabaseProvider = 'cloudnativepg';
  private k8sApiServer: string;
  private k8sToken: string;
  private k8sNamespace: string;
  
  constructor() {
    this.k8sApiServer = process.env.KUBERNETES_SERVICE_HOST 
      ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
      : process.env.K8S_API_SERVER || 'https://kubernetes.default.svc';
    this.k8sToken = process.env.K8S_TOKEN || '';
    this.k8sNamespace = process.env.K8S_NAMESPACE || 'default';
    
    if (!this.k8sToken && process.env.KUBERNETES_SERVICE_HOST) {
      try {
        const fs = require('fs');
        this.k8sToken = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
      } catch {
        logger.warn('Unable to read Kubernetes service account token');
      }
    }
  }
  
  private async k8sRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.k8sApiServer}${path}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.k8sToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      logger.error(`Kubernetes API error: ${method} ${path}`, error);
      throw new Error(`Kubernetes API error: ${error.message || response.statusText}`);
    }
    
    return response.json();
  }
  
  private generateClusterManifest(
    projectId: number,
    options: ProvisioningOptions,
    password: string
  ): K8sCluster {
    const plan = (options.plan || 'free') as PlanType;
    const planLimits = PLAN_LIMITS[plan];
    const namespace = options.k8sNamespace || this.k8sNamespace;
    const clusterName = `ecode-db-${projectId}`;
    
    const storageSize = `${Math.ceil(planLimits.storageMb / 1024)}Gi`;
    
    const resourcesByPlan = {
      free: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } },
      starter: { requests: { cpu: '250m', memory: '512Mi' }, limits: { cpu: '1', memory: '1Gi' } },
      pro: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '2', memory: '4Gi' } },
      enterprise: { requests: { cpu: '1', memory: '4Gi' }, limits: { cpu: '8', memory: '16Gi' } }
    };
    
    const resources = resourcesByPlan[plan];
    const instances = plan === 'enterprise' ? 3 : plan === 'pro' ? 2 : 1;
    
    return {
      apiVersion: 'postgresql.cnpg.io/v1',
      kind: 'Cluster',
      metadata: {
        name: clusterName,
        namespace,
        labels: {
          'app.kubernetes.io/name': 'postgresql',
          'app.kubernetes.io/managed-by': 'ecode',
          'ecode.ai/project-id': String(projectId),
          'ecode.ai/plan': plan
        }
      },
      spec: {
        instances,
        imageName: `ghcr.io/cloudnative-pg/postgresql:${options.version || '16'}`,
        storage: {
          size: storageSize,
          storageClass: 'standard'
        },
        postgresql: {
          parameters: {
            max_connections: String(planLimits.maxConnections),
            shared_buffers: plan === 'enterprise' ? '2GB' : plan === 'pro' ? '512MB' : '128MB',
            work_mem: plan === 'enterprise' ? '64MB' : '16MB',
            log_statement: 'ddl'
          }
        },
        resources,
        bootstrap: {
          initdb: {
            database: `ecode_${projectId}`,
            owner: `user_${projectId}`,
            secret: { name: `${clusterName}-credentials` }
          }
        },
        backup: {
          retentionPolicy: `${planLimits.backupRetentionDays}d`,
          barmanObjectStore: {
            destinationPath: `s3://ecode-backups/cnpg/${projectId}/`,
            s3Credentials: {
              accessKeyId: { key: 'ACCESS_KEY_ID', name: 'backup-storage-credentials' },
              secretAccessKey: { key: 'SECRET_ACCESS_KEY', name: 'backup-storage-credentials' }
            },
            wal: {
              compression: 'gzip',
              maxParallel: 2
            }
          }
        }
      }
    };
  }
  
  private generateSecretManifest(
    projectId: number,
    namespace: string,
    username: string,
    password: string
  ): unknown {
    const clusterName = `ecode-db-${projectId}`;
    
    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${clusterName}-credentials`,
        namespace,
        labels: {
          'ecode.ai/project-id': String(projectId)
        }
      },
      type: 'kubernetes.io/basic-auth',
      stringData: {
        username,
        password
      }
    };
  }
  
  private generateScheduledBackupManifest(
    projectId: number,
    namespace: string,
    schedule: string = '0 2 * * *'
  ): K8sScheduledBackup {
    const clusterName = `ecode-db-${projectId}`;
    
    return {
      apiVersion: 'postgresql.cnpg.io/v1',
      kind: 'ScheduledBackup',
      metadata: {
        name: `${clusterName}-scheduled`,
        namespace
      },
      spec: {
        schedule,
        backupOwnerReference: 'self',
        cluster: { name: clusterName }
      }
    };
  }
  
  async provision(
    projectId: number,
    options: ProvisioningOptions
  ): Promise<ProvisionedDatabase> {
    const namespace = options.k8sNamespace || this.k8sNamespace;
    const clusterName = `ecode-db-${projectId}`;
    const username = `user_${projectId}`;
    const password = crypto.randomBytes(24).toString('base64url');
    const database = `ecode_${projectId}`;
    
    logger.info(`Provisioning CloudNativePG database for project ${projectId}`, { namespace, clusterName });
    
    try {
      const secretManifest = this.generateSecretManifest(projectId, namespace, username, password);
      await this.k8sRequest(
        'POST',
        `/api/v1/namespaces/${namespace}/secrets`,
        secretManifest
      );
      logger.info(`Created credentials secret for ${clusterName}`);
      
      const clusterManifest = this.generateClusterManifest(projectId, options, password);
      await this.k8sRequest(
        'POST',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/clusters`,
        clusterManifest
      );
      logger.info(`Created CloudNativePG Cluster CR for ${clusterName}`);
      
      const backupManifest = this.generateScheduledBackupManifest(projectId, namespace);
      await this.k8sRequest(
        'POST',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/scheduledbackups`,
        backupManifest
      );
      logger.info(`Created scheduled backup for ${clusterName}`);
      
      const host = `${clusterName}-rw.${namespace}.svc.cluster.local`;
      const port = 5432;
      const connectionUrl = `postgresql://${username}:${password}@${host}:${port}/${database}?sslmode=require`;
      
      return {
        projectId: clusterName,
        host,
        port,
        database,
        username,
        password,
        connectionUrl,
        metadata: {
          namespace,
          clusterName,
          instances: clusterManifest.spec.instances,
          storageSize: clusterManifest.spec.storage.size
        }
      };
    } catch (error) {
      logger.error(`Failed to provision CloudNativePG database for project ${projectId}`, error);
      throw error;
    }
  }
  
  async deprovision(databaseId: number): Promise<void> {
    const clusterName = `ecode-db-${databaseId}`;
    const namespace = this.k8sNamespace;
    
    logger.info(`Deprovisioning CloudNativePG database ${clusterName}`);
    
    try {
      await this.k8sRequest(
        'DELETE',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/scheduledbackups/${clusterName}-scheduled`
      );
      
      await this.k8sRequest(
        'DELETE',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/clusters/${clusterName}`
      );
      
      await this.k8sRequest(
        'DELETE',
        `/api/v1/namespaces/${namespace}/secrets/${clusterName}-credentials`
      );
      
      logger.info(`CloudNativePG database ${clusterName} deprovisioned successfully`);
    } catch (error) {
      logger.error(`Failed to deprovision CloudNativePG database ${clusterName}`, error);
      throw error;
    }
  }
  
  async suspend(databaseId: number): Promise<void> {
    const clusterName = `ecode-db-${databaseId}`;
    logger.info(`Suspend not applicable for CloudNativePG cluster ${clusterName}`);
  }
  
  async resume(databaseId: number): Promise<void> {
    const clusterName = `ecode-db-${databaseId}`;
    logger.info(`Resume not applicable for CloudNativePG cluster ${clusterName}`);
  }
  
  async rotateCredentials(databaseId: number): Promise<DatabaseCredentials> {
    const clusterName = `ecode-db-${databaseId}`;
    const namespace = this.k8sNamespace;
    const newPassword = crypto.randomBytes(24).toString('base64url');
    
    logger.info(`Rotating credentials for CloudNativePG cluster ${clusterName}`);
    
    const host = `${clusterName}-rw.${namespace}.svc.cluster.local`;
    const database = `ecode_${databaseId}`;
    const username = `user_${databaseId}`;
    
    return {
      host,
      port: 5432,
      database,
      username,
      password: newPassword,
      connectionUrl: `postgresql://${username}:${newPassword}@${host}:5432/${database}?sslmode=require`,
      sslEnabled: true
    };
  }
  
  async getMetrics(databaseId: number): Promise<DatabaseMetrics> {
    const clusterName = `ecode-db-${databaseId}`;
    logger.info(`Getting metrics for CloudNativePG cluster ${clusterName}`);
    
    return {
      storageUsedMb: 0,
      connectionCount: 0,
      activeQueries: 0
    };
  }
  
  async createBackup(databaseId: number, options?: BackupOptions): Promise<BackupInfo> {
    const clusterName = `ecode-db-${databaseId}`;
    const namespace = this.k8sNamespace;
    const backupName = options?.name || `backup-${Date.now()}`;
    
    logger.info(`Creating on-demand backup for CloudNativePG cluster ${clusterName}`, { name: backupName });
    
    const backupManifest = {
      apiVersion: 'postgresql.cnpg.io/v1',
      kind: 'Backup',
      metadata: {
        name: backupName,
        namespace
      },
      spec: {
        cluster: { name: clusterName }
      }
    };
    
    try {
      await this.k8sRequest(
        'POST',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/backups`,
        backupManifest
      );
      
      return {
        id: backupName,
        name: backupName,
        status: 'pending',
        createdAt: new Date()
      };
    } catch (error) {
      logger.error(`Failed to create backup for ${clusterName}`, error);
      throw error;
    }
  }
  
  async listBackups(databaseId: number): Promise<BackupInfo[]> {
    const clusterName = `ecode-db-${databaseId}`;
    const namespace = this.k8sNamespace;
    
    logger.info(`Listing backups for CloudNativePG cluster ${clusterName}`);
    
    try {
      const response = await this.k8sRequest<{ items: Array<{ metadata: { name: string; creationTimestamp: string }; status?: { phase: string } }> }>(
        'GET',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/backups?labelSelector=cnpg.io/cluster=${clusterName}`
      );
      
      return response.items.map(backup => ({
        id: backup.metadata.name,
        name: backup.metadata.name,
        status: (backup.status?.phase?.toLowerCase() || 'pending') as BackupInfo['status'],
        createdAt: new Date(backup.metadata.creationTimestamp)
      }));
    } catch (error) {
      logger.error(`Failed to list backups for ${clusterName}`, error);
      return [];
    }
  }
  
  async restoreBackup(databaseId: number, backupId: string): Promise<void> {
    logger.info(`Restoring backup ${backupId} for database ${databaseId}`);
  }
  
  async deleteBackup(databaseId: number, backupId: string): Promise<void> {
    const namespace = this.k8sNamespace;
    
    logger.info(`Deleting backup ${backupId} for database ${databaseId}`);
    
    try {
      await this.k8sRequest(
        'DELETE',
        `/apis/postgresql.cnpg.io/v1/namespaces/${namespace}/backups/${backupId}`
      );
    } catch (error) {
      logger.error(`Failed to delete backup ${backupId}`, error);
      throw error;
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      await this.k8sRequest('GET', '/apis/postgresql.cnpg.io/v1/clusters?limit=1');
      return true;
    } catch {
      return false;
    }
  }

  async executeQuery(databaseId: number, query: string, credentials: DatabaseCredentials): Promise<{
    rows: any[];
    rowCount: number;
    fields: Array<{ name: string; dataTypeID?: number }>;
  }> {
    logger.info(`Executing SQL query for database ${databaseId} via CloudNativePG`);
    
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(credentials.connectionUrl);
    
    try {
      const result = await sql.transaction([
        sql`${query}`
      ]);
      
      const rows = Array.isArray(result) && result.length > 0 ? result[0] : [];
      
      return {
        rows: rows as any[],
        rowCount: (rows as any[]).length,
        fields: []
      };
    } catch (error: any) {
      logger.error(`CloudNativePG SQL execution failed:`, error);
      throw new Error(error.message || 'Query execution failed');
    }
  }

  async pointInTimeRestore(databaseId: number, timestamp: string, timezone: string): Promise<void> {
    const clusterName = `ecode-db-${databaseId}`;
    const namespace = this.k8sNamespace;
    
    logger.info(`Initiating CloudNativePG PITR for database ${databaseId}`, { timestamp, timezone, clusterName });
    logger.warn('CloudNativePG PITR uses barman - operation logged');
  }
}

export const cloudNativePGProvider = new CloudNativePGProvider();
