import type { ProjectDatabase, InsertProjectDatabase } from '@shared/schema';

export type DatabaseProvider = 'neon' | 'cloudnativepg' | 'supabase' | 'local';

export interface ProvisioningOptions {
  type?: 'postgresql' | 'mysql';
  region?: string;
  version?: string;
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
  provider?: DatabaseProvider;
  suspendTimeoutSeconds?: number;
  k8sNamespace?: string;
}

export interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionUrl: string;
  sslEnabled: boolean;
}

export interface DatabaseMetrics {
  storageUsedMb: number;
  connectionCount: number;
  activeQueries: number;
  cpuPercent?: number;
  memoryUsedMb?: number;
  lastActivityAt?: Date;
}

export interface BackupOptions {
  name?: string;
  backupType?: 'scheduled' | 'manual' | 'pre_migration' | 'pitr';
  restorePoint?: Date;
}

export interface BackupInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  sizeBytes?: number;
  restorePoint?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ProvisionedDatabase {
  projectId: string;
  branchId?: string;
  endpointId?: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionUrl: string;
  metadata?: Record<string, unknown>;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID?: number }>;
}

export interface IDatabaseProvider {
  readonly name: DatabaseProvider;
  
  provision(
    projectId: number,
    options: ProvisioningOptions
  ): Promise<ProvisionedDatabase>;
  
  deprovision(databaseId: number): Promise<void>;
  
  suspend(databaseId: number): Promise<void>;
  
  resume(databaseId: number): Promise<void>;
  
  rotateCredentials(databaseId: number): Promise<DatabaseCredentials>;
  
  getMetrics(databaseId: number): Promise<DatabaseMetrics>;
  
  createBackup(databaseId: number, options?: BackupOptions): Promise<BackupInfo>;
  
  listBackups(databaseId: number): Promise<BackupInfo[]>;
  
  restoreBackup(databaseId: number, backupId: string): Promise<void>;
  
  deleteBackup(databaseId: number, backupId: string): Promise<void>;
  
  isHealthy(): Promise<boolean>;
  
  executeQuery(databaseId: number, query: string, credentials: DatabaseCredentials): Promise<QueryResult>;
  
  pointInTimeRestore(databaseId: number, timestamp: string, timezone: string): Promise<void>;
}

export const PLAN_LIMITS = {
  free: { 
    storageMb: 500, 
    maxConnections: 10,
    backupRetentionDays: 7,
    suspendTimeoutSeconds: 300
  },
  starter: { 
    storageMb: 2000, 
    maxConnections: 25,
    backupRetentionDays: 14,
    suspendTimeoutSeconds: 600
  },
  pro: { 
    storageMb: 10000, 
    maxConnections: 100,
    backupRetentionDays: 30,
    suspendTimeoutSeconds: 3600
  },
  enterprise: { 
    storageMb: 100000, 
    maxConnections: 500,
    backupRetentionDays: 90,
    suspendTimeoutSeconds: 0
  }
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
