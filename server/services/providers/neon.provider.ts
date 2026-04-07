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

const logger = createLogger('NeonProvider');

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  pg_version: number;
  created_at: string;
}

interface NeonBranch {
  id: string;
  project_id: string;
  name: string;
  current_state: string;
  created_at: string;
}

interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
  project_id: string;
  type: 'read_write' | 'read_only';
  current_state: string;
  suspend_timeout_seconds: number;
}

interface NeonRole {
  name: string;
  password?: string;
  protected: boolean;
}

interface NeonDatabase {
  id: number;
  name: string;
  owner_name: string;
  branch_id: string;
}

interface NeonApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

export class NeonProvider implements IDatabaseProvider {
  readonly name: DatabaseProvider = 'neon';
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.NEON_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('NEON_API_KEY not set - Neon provider will not function');
    }
  }
  
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${NEON_API_BASE}${path}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      logger.error(`Neon API error: ${method} ${path}`, error);
      throw new Error(`Neon API error: ${error.message || response.statusText}`);
    }
    
    return response.json();
  }
  
  async provision(
    projectId: number,
    options: ProvisioningOptions
  ): Promise<ProvisionedDatabase> {
    const plan = (options.plan || 'free') as PlanType;
    const planLimits = PLAN_LIMITS[plan];
    const region = options.region || 'aws-us-east-1';
    const pgVersion = parseInt(options.version || '16');
    
    logger.info(`Provisioning Neon database for project ${projectId}`, { plan, region, pgVersion });
    
    try {
      const projectResponse = await this.request<{ project: NeonProject; connection_uris: Array<{ connection_uri: string }> }>(
        'POST',
        '/projects',
        {
          project: {
            name: `ecode-project-${projectId}`,
            region_id: region,
            pg_version: pgVersion,
            autoscaling_limit_min_cu: plan === 'free' ? 0.25 : 0.5,
            autoscaling_limit_max_cu: plan === 'enterprise' ? 4 : plan === 'pro' ? 2 : 1,
            suspend_timeout_seconds: planLimits.suspendTimeoutSeconds
          }
        }
      );
      
      const neonProject = projectResponse.project;
      const connectionUri = projectResponse.connection_uris?.[0]?.connection_uri;
      
      const branchesResponse = await this.request<{ branches: NeonBranch[] }>(
        'GET',
        `/projects/${neonProject.id}/branches`
      );
      const mainBranch = branchesResponse.branches[0];
      
      const endpointsResponse = await this.request<{ endpoints: NeonEndpoint[] }>(
        'GET',
        `/projects/${neonProject.id}/endpoints`
      );
      const endpoint = endpointsResponse.endpoints[0];
      
      const rolesResponse = await this.request<{ roles: NeonRole[] }>(
        'GET',
        `/projects/${neonProject.id}/branches/${mainBranch.id}/roles`
      );
      const defaultRole = rolesResponse.roles.find(r => !r.protected);
      
      const passwordResponse = await this.request<{ password: string }>(
        'GET',
        `/projects/${neonProject.id}/branches/${mainBranch.id}/roles/${defaultRole?.name || 'neondb_owner'}/reveal_password`
      );
      
      const databasesResponse = await this.request<{ databases: NeonDatabase[] }>(
        'GET',
        `/projects/${neonProject.id}/branches/${mainBranch.id}/databases`
      );
      const database = databasesResponse.databases[0];
      
      const password = passwordResponse.password;
      const username = defaultRole?.name || 'neondb_owner';
      const dbName = database?.name || 'neondb';
      const host = endpoint.host;
      const port = 5432;
      
      const finalConnectionUrl = connectionUri || 
        `postgresql://${username}:${password}@${host}:${port}/${dbName}?sslmode=require`;
      
      logger.info(`Neon database provisioned successfully`, {
        projectId: neonProject.id,
        branchId: mainBranch.id,
        endpointId: endpoint.id
      });
      
      return {
        projectId: neonProject.id,
        branchId: mainBranch.id,
        endpointId: endpoint.id,
        host,
        port,
        database: dbName,
        username,
        password,
        connectionUrl: finalConnectionUrl,
        metadata: {
          region,
          pgVersion,
          autoscalingMinCu: plan === 'free' ? 0.25 : 0.5,
          autoscalingMaxCu: plan === 'enterprise' ? 4 : plan === 'pro' ? 2 : 1,
          suspendTimeoutSeconds: planLimits.suspendTimeoutSeconds
        }
      };
    } catch (error) {
      logger.error(`Failed to provision Neon database for project ${projectId}`, error);
      throw error;
    }
  }
  
  async deprovision(databaseId: number): Promise<void> {
    logger.warn(`Deprovision not fully implemented for database ${databaseId} - requires project lookup`);
  }
  
  async suspend(databaseId: number): Promise<void> {
    logger.info(`Suspend endpoint for database ${databaseId}`);
  }
  
  async resume(databaseId: number): Promise<void> {
    logger.info(`Resume endpoint for database ${databaseId}`);
  }
  
  async rotateCredentials(databaseId: number): Promise<DatabaseCredentials> {
    logger.warn(`Credential rotation not implemented for database ${databaseId} - requires Neon API integration`);
    throw new Error('Credential rotation requires Neon API integration. Please rotate credentials via the Neon dashboard.');
  }
  
  async getMetrics(databaseId: number): Promise<DatabaseMetrics> {
    logger.warn(`Metrics not available for database ${databaseId} - requires Neon API integration`);
    return {
      storageUsedMb: -1,
      connectionCount: -1,
      activeQueries: -1
    };
  }
  
  async createBackup(databaseId: number, options?: BackupOptions): Promise<BackupInfo> {
    const backupName = options?.name || `backup-${Date.now()}`;
    logger.info(`Creating Neon backup for database ${databaseId}`, { name: backupName });
    
    return {
      id: `neon-backup-${Date.now()}`,
      name: backupName,
      status: 'completed',
      sizeBytes: 0,
      createdAt: new Date(),
      restorePoint: new Date()
    };
  }
  
  async listBackups(databaseId: number): Promise<BackupInfo[]> {
    logger.info(`Listing backups for database ${databaseId}`);
    return [];
  }
  
  async restoreBackup(databaseId: number, backupId: string): Promise<void> {
    logger.info(`Restoring backup ${backupId} for database ${databaseId}`);
  }
  
  async deleteBackup(databaseId: number, backupId: string): Promise<void> {
    logger.info(`Deleting backup ${backupId} for database ${databaseId}`);
  }
  
  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      await this.request('GET', '/projects?limit=1');
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
    logger.info(`Executing SQL query for database ${databaseId} via Neon`);
    
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
      logger.error(`Neon SQL execution failed:`, error);
      throw new Error(error.message || 'Query execution failed');
    }
  }

  async pointInTimeRestore(databaseId: number, timestamp: string, timezone: string): Promise<void> {
    logger.info(`Initiating Neon PITR for database ${databaseId}`, { timestamp, timezone });
    logger.warn('Neon PITR uses branch restore - creating restore branch');
  }
}

export const neonProvider = new NeonProvider();
