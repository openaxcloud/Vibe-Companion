// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface ServiceStatus {
  id: string;
  name: string;
  displayName: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime: number; // percentage
  responseTime: number; // ms
  lastChecked: Date;
  incidents: number;
}

export interface Incident {
  id: number;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  affectedServices: string[];
  startedAt: Date;
  resolvedAt?: Date;
  updates: {
    id: number;
    status: Incident['status'];
    message: string;
    timestamp: Date;
  }[];
}

export interface MaintenanceWindow {
  id: number;
  title: string;
  description: string;
  scheduledFor: Date;
  duration: number; // minutes
  affectedServices: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface StatusMetrics {
  service: string;
  period: '1h' | '24h' | '7d' | '30d' | '90d';
  uptime: number;
  averageResponseTime: number;
  incidents: number;
  dataPoints: {
    timestamp: Date;
    status: ServiceStatus['status'];
    responseTime: number;
  }[];
}

export class StatusPageService {
  private services: ServiceStatus[] = [
    {
      id: 'api',
      name: 'api',
      displayName: 'API',
      status: 'operational',
      uptime: 99.99,
      responseTime: 45,
      lastChecked: new Date(),
      incidents: 0
    },
    {
      id: 'website',
      name: 'website',
      displayName: 'Website',
      status: 'operational',
      uptime: 99.98,
      responseTime: 120,
      lastChecked: new Date(),
      incidents: 0
    },
    {
      id: 'editor',
      name: 'editor',
      displayName: 'Code Editor',
      status: 'operational',
      uptime: 99.95,
      responseTime: 80,
      lastChecked: new Date(),
      incidents: 0
    },
    {
      id: 'deployments',
      name: 'deployments',
      displayName: 'Deployments',
      status: 'operational',
      uptime: 99.90,
      responseTime: 200,
      lastChecked: new Date(),
      incidents: 0
    },
    {
      id: 'database',
      name: 'database',
      displayName: 'Database Hosting',
      status: 'operational',
      uptime: 99.99,
      responseTime: 25,
      lastChecked: new Date(),
      incidents: 0
    },
    {
      id: 'ai',
      name: 'ai',
      displayName: 'AI Services',
      status: 'operational',
      uptime: 99.80,
      responseTime: 300,
      lastChecked: new Date(),
      incidents: 0
    }
  ];

  constructor(private storage: DatabaseStorage) {
    // Start monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor services every minute
    setInterval(() => {
      this.checkAllServices();
    }, 60000);
  }

  private async checkAllServices(): Promise<void> {
    for (const service of this.services) {
      await this.checkService(service.id);
    }
  }

  private async checkService(serviceId: string): Promise<void> {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;
    
    // Perform real health check
    const startTime = Date.now();
    let isHealthy = true;
    try {
      // Check if service is actually responding
      const axios = require('axios');
      const baseUrl = process.env.APP_URL || process.env.VITE_PUBLIC_URL || 'http://localhost:5000';
      const checkUrl = service.endpoint || `${baseUrl}/api/health`;
      const response = await axios.get(checkUrl, { timeout: 5000 });
      isHealthy = response.status === 200;
    } catch (error) {
      isHealthy = false;
    }
    const responseTime = Date.now() - startTime;
    
    service.lastChecked = new Date();
    service.responseTime = responseTime;
    
    if (!isHealthy) {
      service.status = 'degraded';
      // Create incident if needed
      await this.createIncidentIfNeeded(service);
    } else {
      service.status = 'operational';
    }
    
    // Store metrics
    await this.storage.storeStatusMetric({
      service: service.id,
      timestamp: new Date(),
      status: service.status,
      responseTime
    });
  }

  private async createIncidentIfNeeded(service: ServiceStatus): Promise<void> {
    const activeIncidents = await this.storage.getActiveIncidents();
    const hasActiveIncident = activeIncidents.some(
      i => i.affectedServices.includes(service.id)
    );
    
    if (!hasActiveIncident) {
      await this.createIncident({
        title: `${service.displayName} Degraded Performance`,
        severity: 'minor',
        affectedServices: [service.id],
        message: `We're investigating issues with ${service.displayName}.`
      });
    }
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    return this.services;
  }

  async getServiceStatus(serviceId: string): Promise<ServiceStatus | null> {
    return this.services.find(s => s.id === serviceId) || null;
  }

  async createIncident(data: {
    title: string;
    severity: Incident['severity'];
    affectedServices: string[];
    message: string;
  }): Promise<Incident> {
    const incident = {
      title: data.title,
      status: 'investigating' as const,
      severity: data.severity,
      affectedServices: data.affectedServices,
      startedAt: new Date(),
      updates: [{
        id: 1,
        status: 'investigating' as const,
        message: data.message,
        timestamp: new Date()
      }]
    };
    
    const id = await this.storage.createIncident(incident);
    
    // Update affected services
    for (const serviceId of data.affectedServices) {
      const service = this.services.find(s => s.id === serviceId);
      if (service) {
        service.incidents++;
        if (data.severity === 'critical') {
          service.status = 'major_outage';
        } else if (data.severity === 'major') {
          service.status = 'partial_outage';
        } else {
          service.status = 'degraded';
        }
      }
    }
    
    return { ...incident, id };
  }

  async updateIncident(incidentId: number, data: {
    status: Incident['status'];
    message: string;
  }): Promise<void> {
    const incident = await this.storage.getIncident(incidentId);
    if (!incident) throw new Error('Incident not found');
    
    const update = {
      id: incident.updates.length + 1,
      status: data.status,
      message: data.message,
      timestamp: new Date()
    };
    
    incident.updates.push(update);
    
    if (data.status === 'resolved') {
      incident.resolvedAt = new Date();
      
      // Update service statuses
      for (const serviceId of incident.affectedServices) {
        const service = this.services.find(s => s.id === serviceId);
        if (service) {
          service.status = 'operational';
        }
      }
    }
    
    await this.storage.updateIncident(incidentId, {
      status: data.status,
      updates: incident.updates,
      resolvedAt: incident.resolvedAt
    });
  }

  async getActiveIncidents(): Promise<Incident[]> {
    return this.storage.getActiveIncidents();
  }

  async getIncidentHistory(limit: number = 50): Promise<Incident[]> {
    return this.storage.getIncidentHistory(limit);
  }

  async scheduleMaintenance(data: {
    title: string;
    description: string;
    scheduledFor: Date;
    duration: number;
    affectedServices: string[];
  }): Promise<MaintenanceWindow> {
    const maintenance = {
      ...data,
      status: 'scheduled' as const,
      createdAt: new Date()
    };
    
    const id = await this.storage.createMaintenanceWindow(maintenance);
    
    return { ...maintenance, id };
  }

  async getUpcomingMaintenance(): Promise<MaintenanceWindow[]> {
    return this.storage.getUpcomingMaintenance();
  }

  async getServiceMetrics(
    serviceId: string,
    period: StatusMetrics['period']
  ): Promise<StatusMetrics> {
    const metrics = await this.storage.getServiceMetrics(serviceId, period);
    
    // Calculate aggregates
    const uptime = metrics.dataPoints.filter(
      d => d.status === 'operational'
    ).length / metrics.dataPoints.length * 100;
    
    const averageResponseTime = metrics.dataPoints.reduce(
      (sum, d) => sum + d.responseTime, 0
    ) / metrics.dataPoints.length;
    
    const incidents = await this.storage.getServiceIncidents(serviceId, period);
    
    return {
      service: serviceId,
      period,
      uptime,
      averageResponseTime,
      incidents: incidents.length,
      dataPoints: metrics.dataPoints
    };
  }

  async getOverallStatus(): Promise<{
    status: ServiceStatus['status'];
    operationalServices: number;
    totalServices: number;
    activeIncidents: number;
    upcomingMaintenance: number;
  }> {
    const operationalServices = this.services.filter(
      s => s.status === 'operational'
    ).length;
    
    const activeIncidents = await this.storage.getActiveIncidents();
    const upcomingMaintenance = await this.storage.getUpcomingMaintenance();
    
    let overallStatus: ServiceStatus['status'] = 'operational';
    if (this.services.some(s => s.status === 'major_outage')) {
      overallStatus = 'major_outage';
    } else if (this.services.some(s => s.status === 'partial_outage')) {
      overallStatus = 'partial_outage';
    } else if (this.services.some(s => s.status === 'degraded')) {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      operationalServices,
      totalServices: this.services.length,
      activeIncidents: activeIncidents.length,
      upcomingMaintenance: upcomingMaintenance.length
    };
  }
}