/**
 * Scan Executor Service
 * Processes security scans asynchronously using the SecurityScanner
 */

import type { IStorage } from '../storage';
import type { SecurityScan } from '@shared/schema';
import { SecurityScanner, type SecurityIssue } from '../security/security-scanner';
import { createLogger } from '../utils/logger';

const logger = createLogger('scan-executor-service');

interface ScanJob {
  scanId: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

export class ScanExecutorService {
  private storage: IStorage;
  private scanner: SecurityScanner;
  private processingQueue: Map<string, ScanJob> = new Map();
  private isProcessing: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.scanner = new SecurityScanner();
  }

  /**
   * Queue a scan for processing
   */
  async queueScan(scan: SecurityScan): Promise<void> {
    const job: ScanJob = {
      scanId: scan.id,
      projectId: scan.projectId.toString(),
      status: 'queued',
    };

    this.processingQueue.set(scan.id, job);
    logger.info(`[ScanExecutor] Queued scan ${scan.id} for project ${scan.projectId}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the scan queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.processingQueue.size > 0) {
        // Get next queued job
        const queuedJob = Array.from(this.processingQueue.values()).find(j => j.status === 'queued');
        if (!queuedJob) break;

        await this.executeScan(queuedJob);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single scan
   */
  private async executeScan(job: ScanJob): Promise<void> {
    const startTime = Date.now();
    logger.info(`[ScanExecutor] Starting scan ${job.scanId} for project ${job.projectId}`);

    try {
      // Update status to running
      job.status = 'running';
      await this.storage.updateSecurityScan(job.scanId, {
        status: 'running',
        startedAt: new Date(),
      });
      await this.broadcastScanUpdate(job.scanId);

      // Get project files from database
      const files = await this.storage.getProjectFiles(job.projectId);
      
      if (!files || files.length === 0) {
        logger.info(`[ScanExecutor] No files found for project ${job.projectId}`);
        await this.completeScan(job, 0, startTime);
        return;
      }

      // Convert files to scanner format
      const scanFiles = files
        .filter((f: any) => !f.isDirectory && f.content)
        .map((f: any) => ({
          path: f.path || f.name,
          content: f.content || '',
        }));

      logger.info(`[ScanExecutor] Scanning ${scanFiles.length} files for project ${job.projectId}`);

      // Run the security scanner
      const result = await this.scanner.scanProject(
        parseInt(job.projectId),
        scanFiles
      );

      // Create vulnerability records from scan results
      let vulnerabilityCount = 0;
      for (const issue of result.issues) {
        try {
          await this.storage.createVulnerability({
            scanId: job.scanId,
            projectId: parseInt(job.projectId),
            title: issue.title,
            description: issue.description,
            severity: this.mapSeverity(issue.severity),
            type: this.mapCategory(issue.type),
            status: 'open',
            filePath: issue.file || null,
            lineNumber: issue.line || null,
            recommendation: issue.suggestion || null,
            cwe: null,
            toolAttribution: 'ecode-scanner',
            isHidden: false,
          });
          vulnerabilityCount++;
        } catch (error) {
          logger.error(`[ScanExecutor] Error creating vulnerability:`, error);
        }
      }

      // Broadcast vulnerability updates
      await this.broadcastVulnerabilityUpdate(job.projectId);

      // Complete the scan
      await this.completeScan(job, vulnerabilityCount, startTime, result.summary);

    } catch (error) {
      logger.error(`[ScanExecutor] Error executing scan ${job.scanId}:`, error);
      
      // Mark scan as failed
      job.status = 'failed';
      await this.storage.updateSecurityScan(job.scanId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.broadcastScanUpdate(job.scanId);
    } finally {
      // Remove from queue
      this.processingQueue.delete(job.scanId);
    }
  }

  /**
   * Complete a scan successfully
   */
  private async completeScan(
    job: ScanJob,
    vulnerabilityCount: number,
    startTime: number,
    summary?: { critical: number; high: number; medium: number; low: number; info: number }
  ): Promise<void> {
    const duration = Date.now() - startTime;
    
    job.status = 'completed';
    await this.storage.updateSecurityScan(job.scanId, {
      status: 'completed',
      completedAt: new Date(),
      totalVulnerabilities: vulnerabilityCount,
      criticalCount: summary?.critical || 0,
      highCount: summary?.high || 0,
      mediumCount: summary?.medium || 0,
      lowCount: (summary?.low || 0) + (summary?.info || 0),
    });

    logger.info(`[ScanExecutor] Completed scan ${job.scanId}: ${vulnerabilityCount} issues found in ${duration}ms`);
    await this.broadcastScanUpdate(job.scanId);
  }

  /**
   * Map scanner severity to database severity
   */
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': 
      case 'info':
      default: return 'low';
    }
  }

  /**
   * Map scanner issue type to category
   */
  private mapCategory(type: string): string {
    switch (type) {
      case 'secret': return 'secrets';
      case 'vulnerability': return 'security';
      case 'code_quality': return 'code-quality';
      case 'best_practice': return 'best-practices';
      default: return 'security';
    }
  }

  /**
   * Broadcast scan update via WebSocket
   */
  private async broadcastScanUpdate(scanId: string): Promise<void> {
    try {
      const scan = await this.storage.getSecurityScan(scanId);
      if (!scan) return;

      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService) {
        await securityScannerService.broadcastScanUpdate(scan.projectId.toString(), scan);
      }
    } catch (error) {
      logger.error('[ScanExecutor] Error broadcasting scan update:', error);
    }
  }

  /**
   * Broadcast vulnerability update via WebSocket
   */
  private async broadcastVulnerabilityUpdate(projectId: string): Promise<void> {
    try {
      const securityScannerService = (global as any).securityScannerService;
      if (securityScannerService) {
        // Broadcast that vulnerabilities have changed (clients will refetch)
        const clients = securityScannerService.clients?.get(projectId);
        if (clients) {
          for (const client of clients) {
            if (client.ws.readyState === 1) { // WebSocket.OPEN
              client.ws.send(JSON.stringify({ type: 'vulnerability_update' }));
            }
          }
        }
      }
    } catch (error) {
      logger.error('[ScanExecutor] Error broadcasting vulnerability update:', error);
    }
  }

  /**
   * Get scan queue status
   */
  getQueueStatus(): { queued: number; running: number } {
    let queued = 0;
    let running = 0;
    for (const job of this.processingQueue.values()) {
      if (job.status === 'queued') queued++;
      if (job.status === 'running') running++;
    }
    return { queued, running };
  }
}

let scanExecutorInstance: ScanExecutorService | null = null;

export function getScanExecutor(storage: IStorage): ScanExecutorService {
  if (!scanExecutorInstance) {
    scanExecutorInstance = new ScanExecutorService(storage);
  }
  return scanExecutorInstance;
}

export function setupScanExecutor(storage: IStorage): ScanExecutorService {
  scanExecutorInstance = new ScanExecutorService(storage);
  (global as any).scanExecutor = scanExecutorInstance;
  logger.info('[ScanExecutor] Service initialized');
  return scanExecutorInstance;
}
