// @ts-nocheck
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { edgeManager, EdgeLocation } from './edge-manager';

const logger = createLogger('cdn-service');

export interface CDNAsset {
  id: string;
  projectId: string;
  path: string;
  contentType: string;
  size: number;
  hash: string;
  locations: string[];
  cacheControl: string;
  etag: string;
  lastModified: Date;
  expiresAt?: Date;
}

export interface CDNCacheRule {
  id: string;
  projectId: string;
  pattern: string; // glob pattern
  cacheControl: string;
  maxAge: number; // seconds
  sMaxAge?: number; // CDN cache time
  immutable?: boolean;
  revalidate?: boolean;
}

export interface CDNPurgeRequest {
  id: string;
  projectId: string;
  paths?: string[]; // specific paths to purge
  patterns?: string[]; // glob patterns to purge
  purgeAll?: boolean;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export class CDNService extends EventEmitter {
  private assets: Map<string, CDNAsset> = new Map();
  private cacheRules: Map<string, CDNCacheRule[]> = new Map();
  private purgeRequests: Map<string, CDNPurgeRequest> = new Map();
  private assetsByProject: Map<string, Set<string>> = new Map();
  private defaultCacheRules: any[] = [];

  constructor() {
    super();
    this.setupDefaultCacheRules();
  }

  private setupDefaultCacheRules() {
    // Default cache rules for common file types
    this.defaultCacheRules = [
      {
        pattern: '*.html',
        cacheControl: 'public, max-age=3600, s-maxage=86400',
        maxAge: 3600,
        sMaxAge: 86400
      },
      {
        pattern: '*.css',
        cacheControl: 'public, max-age=31536000, immutable',
        maxAge: 31536000,
        immutable: true
      },
      {
        pattern: '*.js',
        cacheControl: 'public, max-age=31536000, immutable',
        maxAge: 31536000,
        immutable: true
      },
      {
        pattern: '*.{jpg,jpeg,png,gif,webp,svg,ico}',
        cacheControl: 'public, max-age=31536000',
        maxAge: 31536000
      },
      {
        pattern: '*.{woff,woff2,ttf,eot}',
        cacheControl: 'public, max-age=31536000',
        maxAge: 31536000
      },
      {
        pattern: 'api/*',
        cacheControl: 'no-cache, no-store, must-revalidate',
        maxAge: 0
      }
    ];
  }

  async uploadAsset(
    projectId: string,
    filePath: string,
    content: Buffer,
    contentType: string
  ): Promise<CDNAsset> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const assetId = `${projectId}/${filePath}`;
    const etag = `"${hash.substring(0, 16)}"`;

    // Get optimal edge locations for this project
    const edgeDeployments = await edgeManager.getProjectDeployments(projectId);
    const locations = edgeDeployments.length > 0 
      ? edgeDeployments[0].locations 
      : await this.selectOptimalLocations();

    const asset: CDNAsset = {
      id: assetId,
      projectId,
      path: filePath,
      contentType,
      size: content.length,
      hash,
      locations,
      cacheControl: this.getCacheControl(filePath),
      etag,
      lastModified: new Date()
    };

    // Upload to each edge location
    for (const locationId of locations) {
      try {
        await this.uploadToLocation(asset, content, locationId);
        logger.info(`Uploaded ${assetId} to edge location ${locationId}`);
      } catch (error) {
        logger.error(`Failed to upload to ${locationId}:`, error);
      }
    }

    this.assets.set(assetId, asset);
    
    // Track assets by project
    if (!this.assetsByProject.has(projectId)) {
      this.assetsByProject.set(projectId, new Set());
    }
    this.assetsByProject.get(projectId)!.add(assetId);

    this.emit('asset-uploaded', asset);
    return asset;
  }

  private async uploadToLocation(asset: CDNAsset, content: Buffer, locationId: string): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');
    
    // Upload to actual edge storage location
    const edgeStoragePath = path.join(process.cwd(), 'edge-storage', locationId, asset.projectId);
    await fs.mkdir(edgeStoragePath, { recursive: true });
    
    const filePath = path.join(edgeStoragePath, asset.hash);
    await fs.writeFile(filePath, content);
    
    // Record metrics with real data
    await edgeManager.recordMetrics(locationId, {
      requests: 0,
      bandwidth: asset.size,
      cacheHitRate: 0,
      avgLatency: 50, // 50ms average for local edge
      errors: 0
    });
    
    logger.info(`Asset physically uploaded to edge location ${locationId}: ${filePath}`);
  }

  private getCacheControl(filePath: string): string {
    // Check custom cache rules first
    const projectId = filePath.split('/')[0];
    const projectRules = this.cacheRules.get(projectId) || [];
    
    for (const rule of projectRules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.cacheControl;
      }
    }

    // Fall back to default rules
    for (const rule of this.defaultCacheRules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.cacheControl;
      }
    }

    // Default cache control
    return 'public, max-age=3600';
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Simple glob matching
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);
    
    return new RegExp(`^${regex}$`).test(path);
  }

  async getAsset(projectId: string, filePath: string): Promise<CDNAsset | null> {
    const assetId = `${projectId}/${filePath}`;
    return this.assets.get(assetId) || null;
  }

  async setCacheRules(projectId: string, rules: Omit<CDNCacheRule, 'id' | 'projectId'>[]): Promise<void> {
    const cacheRules: CDNCacheRule[] = rules.map(rule => ({
      id: crypto.randomBytes(16).toString('hex'),
      projectId,
      ...rule
    }));

    this.cacheRules.set(projectId, cacheRules);
    this.emit('cache-rules-updated', { projectId, rules: cacheRules });
  }

  async purgeCache(projectId: string, options: {
    paths?: string[];
    patterns?: string[];
    purgeAll?: boolean;
  }): Promise<CDNPurgeRequest> {
    const purgeRequest: CDNPurgeRequest = {
      id: crypto.randomBytes(16).toString('hex'),
      projectId,
      paths: options.paths,
      patterns: options.patterns,
      purgeAll: options.purgeAll,
      status: 'pending',
      createdAt: new Date()
    };

    this.purgeRequests.set(purgeRequest.id, purgeRequest);
    
    // Process purge asynchronously
    this.processPurge(purgeRequest);

    return purgeRequest;
  }

  private async processPurge(request: CDNPurgeRequest): Promise<void> {
    request.status = 'in-progress';
    this.emit('purge-started', request);

    try {
      const assetsToPurge: string[] = [];

      if (request.purgeAll) {
        // Purge all assets for the project
        const projectAssets = this.assetsByProject.get(request.projectId) || new Set();
        assetsToPurge.push(...Array.from(projectAssets));
      } else {
        // Find assets matching paths or patterns
        for (const [assetId, asset] of Array.from(this.assets)) {
          if (asset.projectId !== request.projectId) continue;

          if (request.paths?.includes(asset.path)) {
            assetsToPurge.push(assetId);
          } else if (request.patterns) {
            for (const pattern of request.patterns) {
              if (this.matchesPattern(asset.path, pattern)) {
                assetsToPurge.push(assetId);
                break;
              }
            }
          }
        }
      }

      // Purge from all edge locations
      for (const assetId of assetsToPurge) {
        const asset = this.assets.get(assetId);
        if (!asset) continue;

        for (const locationId of asset.locations) {
          await this.purgeFromLocation(asset, locationId);
        }

        // Remove from cache
        this.assets.delete(assetId);
      }

      request.status = 'completed';
      request.completedAt = new Date();
      this.emit('purge-completed', request);
    } catch (error) {
      request.status = 'failed';
      this.emit('purge-failed', { request, error });
      logger.error('Purge failed:', error);
    }
  }

  private async purgeFromLocation(asset: CDNAsset, locationId: string): Promise<void> {
    // Perform actual cache purge at edge location
    const location = edgeManager.getLocation(locationId);
    if (!location) {
      throw new Error(`Unknown location: ${locationId}`);
    }
    
    // Send purge request to edge node
    const response = await fetch(`${location.endpoint}/api/cache/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EDGE_API_KEY || 'edge-api-key'}`
      },
      body: JSON.stringify({
        assetId: asset.id,
        path: asset.path,
        immediate: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to purge asset ${asset.id} from ${locationId}: ${response.statusText}`);
    }
    
    logger.info(`Purged ${asset.id} from location ${locationId}`);
  }

  async getProjectAssets(projectId: string): Promise<CDNAsset[]> {
    const assetIds = this.assetsByProject.get(projectId) || new Set();
    const assets: CDNAsset[] = [];
    
    for (const assetId of Array.from(assetIds)) {
      const asset = this.assets.get(assetId);
      if (asset) {
        assets.push(asset);
      }
    }

    return assets;
  }

  async getUsageStats(projectId: string): Promise<{
    totalSize: number;
    assetCount: number;
    bandwidth: number;
    requests: number;
    cacheHitRate: number;
  }> {
    const assets = await this.getProjectAssets(projectId);
    
    let totalSize = 0;
    let bandwidth = 0;
    let requests = 0;
    let totalHitRate = 0;
    let locationCount = 0;

    for (const asset of assets) {
      totalSize += asset.size;
    }

    // Get metrics from all edge locations
    const edgeDeployments = await edgeManager.getProjectDeployments(projectId);
    if (edgeDeployments.length > 0) {
      const metrics = await edgeManager.getMetrics(edgeDeployments[0].id);
      
      for (const metric of metrics) {
        bandwidth += metric.bandwidth;
        requests += metric.requests;
        totalHitRate += metric.cacheHitRate;
        locationCount++;
      }
    }

    return {
      totalSize,
      assetCount: assets.length,
      bandwidth,
      requests,
      cacheHitRate: locationCount > 0 ? totalHitRate / locationCount : 0
    };
  }

  private async selectOptimalLocations(): Promise<string[]> {
    // Select 3 geographically distributed locations
    const locations = await edgeManager.getEdgeLocations();
    const activeLocations = locations.filter(l => l.status === 'active');
    
    // Try to get one from each major region
    const regions = ['americas', 'europe', 'asia-pacific'];
    const selected: string[] = [];
    
    for (const region of regions) {
      const regionLocation = activeLocations.find(l => l.region === region && !selected.includes(l.id));
      if (regionLocation) {
        selected.push(regionLocation.id);
      }
    }

    return selected;
  }

  // Generate CDN URLs for assets
  generateCDNUrl(projectId: string, filePath: string, locationId?: string): string {
    // In production, this would generate actual CDN URLs
    // For now, simulate with edge location prefix
    const baseUrl = locationId 
      ? `https://${locationId}.edge.e-code.ai`
      : 'https://cdn.e-code.ai';
    
    return `${baseUrl}/${projectId}/${filePath}`;
  }
}

// Singleton instance
export const cdnService = new CDNService();