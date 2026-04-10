import { EventEmitter } from 'events';
import * as os from 'os';
import { createLogger } from '../utils/logger';
import { ClusterManager } from '../distributed/cluster-manager';
import { ContainerOrchestrator } from '../orchestration/container-orchestrator';

const logger = createLogger('edge-manager');

export interface EdgeLocation {
  id: string;
  name: string;
  region: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive' | 'maintenance';
  capacity: {
    cpu: number;
    memory: number;
    storage: number;
  };
  load: {
    cpu: number;
    memory: number;
    requests: number;
  };
  metrics: EdgeMetrics;
  lastHeartbeat: Date;
}

export interface EdgeDeployment {
  id: string;
  projectId: string;
  locations: string[];
  routing: 'geo-nearest' | 'round-robin' | 'least-loaded' | 'custom';
  replication: 'full' | 'partial' | 'on-demand';
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  failoverEnabled: boolean;
  sslEnabled: boolean;
  customDomains: string[];
}

export interface EdgeMetrics {
  locationId: string;
  timestamp: Date;
  requests: number;
  bandwidth: number;
  cacheHitRate: number;
  avgLatency: number;
  errors: number;
}

export class EdgeManager extends EventEmitter {
  private locations: Map<string, EdgeLocation> = new Map();
  private deployments: Map<string, EdgeDeployment> = new Map();
  private metrics: Map<string, EdgeMetrics[]> = new Map();
  private clusterManager: ClusterManager;
  private orchestrator: ContainerOrchestrator;

  constructor() {
    super();
    this.clusterManager = new ClusterManager({
      nodePort: 7000,
      discoveryPort: 7001,
      heartbeatIntervalMs: 5000,
      nodeTimeoutMs: 30000
    });
    this.orchestrator = new ContainerOrchestrator();
    this.initializeEdgeLocations();
    this.startHealthChecks();
  }

  private initializeEdgeLocations() {
    // Initialize global edge locations similar to Replit's infrastructure
    const globalLocations: EdgeLocation[] = [
      {
        id: 'us-west-1',
        name: 'US West (California)',
        region: 'americas',
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'us-west-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'us-east-1',
        name: 'US East (Virginia)',
        region: 'americas',
        coordinates: { latitude: 38.7095, longitude: -77.3560 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'us-east-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'eu-west-1',
        name: 'EU West (Ireland)',
        region: 'europe',
        coordinates: { latitude: 53.3498, longitude: -6.2603 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'eu-west-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'eu-central-1',
        name: 'EU Central (Frankfurt)',
        region: 'europe',
        coordinates: { latitude: 50.1109, longitude: 8.6821 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'eu-central-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'ap-southeast-1',
        name: 'Asia Pacific (Singapore)',
        region: 'asia-pacific',
        coordinates: { latitude: 1.3521, longitude: 103.8198 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'ap-southeast-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'ap-northeast-1',
        name: 'Asia Pacific (Tokyo)',
        region: 'asia-pacific',
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'ap-northeast-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'sa-east-1',
        name: 'South America (São Paulo)',
        region: 'americas',
        coordinates: { latitude: -23.5505, longitude: -46.6333 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'sa-east-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      },
      {
        id: 'ap-south-1',
        name: 'Asia Pacific (Mumbai)',
        region: 'asia-pacific',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        status: 'active',
        capacity: { cpu: 1000, memory: 4096, storage: 1000 },
        load: { cpu: 0, memory: 0, requests: 0 },
        metrics: { locationId: 'ap-south-1', timestamp: new Date(), requests: 0, bandwidth: 0, cacheHitRate: 0, avgLatency: 0, errors: 0 },
        lastHeartbeat: new Date()
      }
    ];

    globalLocations.forEach(location => {
      this.locations.set(location.id, location);
    });

    logger.info(`Initialized ${globalLocations.length} edge locations globally`);
  }

  private startHealthChecks() {
    setInterval(() => {
      this.locations.forEach((location, id) => {
        // Simulate health checks
        const now = new Date();
        const timeSinceLastHeartbeat = now.getTime() - location.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > 60000) { // 1 minute timeout
          location.status = 'inactive';
          this.emit('location-down', location);
        }
        
        // Update load metrics with real system data
        const cpuUsage = process.cpuUsage();
        const totalCpu = cpuUsage.user + cpuUsage.system;
        const cpuPercent = Math.min(100, (totalCpu / 1000000) * 100);
        
        location.load = {
          cpu: cpuPercent,
          memory: (1 - (os.freemem() / os.totalmem())) * 100,
          requests: location.metrics.requests || 0
        };
      });
    }, 10000); // Check every 10 seconds
  }

  async deployToEdge(projectId: string, options: Partial<EdgeDeployment>): Promise<EdgeDeployment> {
    const deployment: EdgeDeployment = {
      id: `edge-${Date.now()}`,
      projectId,
      locations: options.locations || this.selectOptimalLocations(projectId),
      routing: options.routing || 'geo-nearest',
      replication: options.replication || 'full',
      cacheStrategy: options.cacheStrategy || 'moderate',
      failoverEnabled: options.failoverEnabled !== false,
      sslEnabled: options.sslEnabled !== false,
      customDomains: options.customDomains || []
    };

    // Deploy to each edge location
    for (const locationId of deployment.locations) {
      const location = this.locations.get(locationId);
      if (!location || location.status !== 'active') {
        logger.warn(`Skipping inactive location: ${locationId}`);
        continue;
      }

      try {
        await this.deployToLocation(projectId, locationId, deployment);
        logger.info(`Deployed project ${projectId} to edge location ${locationId}`);
      } catch (error) {
        logger.error(`Failed to deploy to ${locationId}:`, error);
        // Continue with other locations
      }
    }

    this.deployments.set(deployment.id, deployment);
    this.emit('deployment-created', deployment);

    return deployment;
  }

  private async deployToLocation(projectId: string, locationId: string, deployment: EdgeDeployment) {
    const location = this.locations.get(locationId);
    if (!location) {
      throw new Error(`Location ${locationId} not found`);
    }

    // Use container orchestrator to deploy to specific location
    const env = {
      EDGE_LOCATION: locationId,
      PROJECT_ID: projectId,
      CACHE_STRATEGY: deployment.cacheStrategy,
      SSL_ENABLED: deployment.sslEnabled.toString()
    };

    await this.orchestrator.submitTask(
      projectId,
      1, // System user ID for edge deployments
      'nodejs',
      '', // No code needed for edge deployment
      {}, // No files needed
      {
        env,
        memoryLimit: 512,
        cpuLimit: 0.5,
        networkEnabled: true,
        timeout: 3600 // 1 hour timeout for edge deployments
      }
    );
  }

  private selectOptimalLocations(projectId: string): string[] {
    // Select optimal edge locations based on load and geography
    const activeLocations = Array.from(this.locations.values())
      .filter(loc => loc.status === 'active')
      .sort((a, b) => {
        // Sort by load (lower is better)
        const loadA = (a.load.cpu + a.load.memory) / 2;
        const loadB = (b.load.cpu + b.load.memory) / 2;
        return loadA - loadB;
      });

    // Select top 3 locations from different regions for redundancy
    const selectedLocations: string[] = [];
    const usedRegions = new Set<string>();

    for (const location of activeLocations) {
      if (!usedRegions.has(location.region)) {
        selectedLocations.push(location.id);
        usedRegions.add(location.region);
        if (selectedLocations.length >= 3) break;
      }
    }

    // If we don't have 3 different regions, fill with best available
    while (selectedLocations.length < 3 && selectedLocations.length < activeLocations.length) {
      const nextLocation = activeLocations.find(loc => !selectedLocations.includes(loc.id));
      if (nextLocation) {
        selectedLocations.push(nextLocation.id);
      } else {
        break;
      }
    }

    return selectedLocations;
  }

  async getEdgeLocations(): Promise<EdgeLocation[]> {
    return Array.from(this.locations.values());
  }

  async getDeployment(deploymentId: string): Promise<EdgeDeployment | undefined> {
    return this.deployments.get(deploymentId);
  }

  async getProjectDeployments(projectId: string): Promise<EdgeDeployment[]> {
    return Array.from(this.deployments.values())
      .filter(deployment => deployment.projectId === projectId);
  }

  async updateDeployment(deploymentId: string, updates: Partial<EdgeDeployment>): Promise<EdgeDeployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const updatedDeployment = { ...deployment, ...updates };
    this.deployments.set(deploymentId, updatedDeployment);

    // Re-deploy if locations changed
    if (updates.locations && updates.locations.length > 0) {
      for (const locationId of updates.locations) {
        if (!deployment.locations.includes(locationId)) {
          await this.deployToLocation(deployment.projectId, locationId, updatedDeployment);
        }
      }
    }

    this.emit('deployment-updated', updatedDeployment);
    return updatedDeployment;
  }

  async removeDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Remove from all edge locations
    for (const locationId of deployment.locations) {
      try {
        await this.orchestrator.cancelTask(`${deployment.projectId}-${locationId}`);
      } catch (error) {
        logger.error(`Failed to remove from ${locationId}:`, error);
      }
    }

    this.deployments.delete(deploymentId);
    this.emit('deployment-removed', deployment);
  }

  async getMetrics(deploymentId: string, timeRange?: { start: Date; end: Date }): Promise<EdgeMetrics[]> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return [];
    }

    const allMetrics: EdgeMetrics[] = [];
    
    for (const locationId of deployment.locations) {
      const locationMetrics = this.metrics.get(locationId) || [];
      const filteredMetrics = timeRange
        ? locationMetrics.filter(m => 
            m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
          )
        : locationMetrics;
      
      allMetrics.push(...filteredMetrics);
    }

    return allMetrics;
  }

  async recordMetrics(locationId: string, metrics: Omit<EdgeMetrics, 'locationId' | 'timestamp'>): Promise<void> {
    const location = this.locations.get(locationId);
    if (!location) {
      return;
    }

    const metric: EdgeMetrics = {
      locationId,
      timestamp: new Date(),
      ...metrics
    };

    const locationMetrics = this.metrics.get(locationId) || [];
    locationMetrics.push(metric);

    // Keep only last 1000 metrics per location
    if (locationMetrics.length > 1000) {
      locationMetrics.shift();
    }

    this.metrics.set(locationId, locationMetrics);
    this.emit('metrics-recorded', metric);
  }

  // Geo-routing logic
  findNearestLocation(latitude: number, longitude: number): EdgeLocation | null {
    let nearestLocation: EdgeLocation | null = null;
    let minDistance = Infinity;

    this.locations.forEach(location => {
      if (location.status !== 'active') return;

      const distance = this.calculateDistance(
        latitude, longitude,
        location.coordinates.latitude, location.coordinates.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = location;
      }
    });

    return nearestLocation;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for great-circle distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Singleton instance
export const edgeManager = new EdgeManager();