// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface AnalyticsEvent {
  id: number;
  userId: number;
  projectId?: number;
  event: string;
  category: 'user' | 'project' | 'deployment' | 'code' | 'collaboration' | 'system';
  properties?: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
}

export interface UserAnalytics {
  userId: number;
  period: '1h' | '24h' | '7d' | '30d' | '90d' | 'all';
  metrics: {
    totalEvents: number;
    uniqueSessions: number;
    totalProjects: number;
    totalDeployments: number;
    codeWritten: number; // lines
    activeTime: number; // minutes
    collaborators: number;
    errorRate: number; // percentage
  };
  activity: {
    hourly?: number[];
    daily?: number[];
    weekly?: number[];
  };
  topProjects: {
    projectId: number;
    name: string;
    events: number;
    time: number;
  }[];
  languages: {
    language: string;
    lines: number;
    percentage: number;
  }[];
}

export interface ProjectAnalytics {
  projectId: number;
  period: '1h' | '24h' | '7d' | '30d' | '90d' | 'all';
  metrics: {
    views: number;
    uniqueVisitors: number;
    runs: number;
    deployments: number;
    errors: number;
    averageRunTime: number; // ms
    codeChanges: number;
    collaborators: number;
  };
  performance: {
    cpu: number[];
    memory: number[];
    responseTime: number[];
    timestamps: Date[];
  };
  traffic: {
    sources: { source: string; visits: number }[];
    countries: { country: string; visits: number }[];
    devices: { device: string; visits: number }[];
  };
  engagement: {
    bounceRate: number;
    averageSessionDuration: number; // seconds
    pagesPerSession: number;
  };
}

export interface DeploymentAnalytics {
  deploymentId: number;
  period: '1h' | '24h' | '7d' | '30d';
  metrics: {
    requests: number;
    uniqueVisitors: number;
    bandwidth: number; // MB
    errors: number;
    errorRate: number;
    uptime: number; // percentage
    averageResponseTime: number; // ms
  };
  geography: {
    country: string;
    region: string;
    requests: number;
    avgResponseTime: number;
  }[];
  endpoints: {
    path: string;
    method: string;
    requests: number;
    avgResponseTime: number;
    errorRate: number;
  }[];
  statusCodes: {
    code: number;
    count: number;
  }[];
}

export interface AnalyticsDashboard {
  userId: number;
  period: '1h' | '24h' | '7d' | '30d';
  overview: {
    totalProjects: number;
    totalDeployments: number;
    totalViews: number;
    totalCodeLines: number;
    activeUsers: number;
    errorRate: number;
  };
  trends: {
    metric: string;
    current: number;
    previous: number;
    change: number; // percentage
  }[];
  realtime: {
    activeUsers: number;
    currentRequests: number;
    locations: { lat: number; lng: number; intensity: number }[];
  };
}

export class AdvancedAnalyticsService {
  constructor(private storage: DatabaseStorage) {}

  async trackEvent(data: {
    userId: number;
    projectId?: number;
    event: string;
    category: AnalyticsEvent['category'];
    properties?: Record<string, any>;
    sessionId?: string;
    deviceInfo?: AnalyticsEvent['deviceInfo'];
  }): Promise<void> {
    const event = {
      ...data,
      timestamp: new Date()
    };
    
    await this.storage.createAnalyticsEvent(event);
    
    // Process event for real-time analytics
    await this.processRealtimeEvent(event);
  }

  private async processRealtimeEvent(event: any): Promise<void> {
    // Update real-time counters
    if (event.category === 'user') {
      await this.storage.incrementRealtimeMetric('activeUsers', 1);
    } else if (event.category === 'deployment' && event.event === 'request') {
      await this.storage.incrementRealtimeMetric('currentRequests', 1);
    }
  }

  async getUserAnalytics(userId: number, period: UserAnalytics['period']): Promise<UserAnalytics> {
    const events = await this.storage.getUserAnalyticsEvents(userId, period);
    
    // Calculate metrics
    const metrics = {
      totalEvents: events.length,
      uniqueSessions: new Set(events.map(e => e.sessionId).filter(Boolean)).size,
      totalProjects: new Set(events.filter(e => e.projectId).map(e => e.projectId)).size,
      totalDeployments: events.filter(e => e.event === 'deployment_created').length,
      codeWritten: events
        .filter(e => e.event === 'code_written')
        .reduce((sum, e) => sum + (e.properties?.lines || 0), 0),
      activeTime: this.calculateActiveTime(events),
      collaborators: await this.storage.getUserCollaboratorCount(userId, period),
      errorRate: this.calculateErrorRate(events)
    };
    
    // Calculate activity patterns
    const activity = this.calculateActivityPatterns(events, period);
    
    // Get top projects
    const projectEvents = events.filter(e => e.projectId);
    const projectCounts = new Map<number, number>();
    projectEvents.forEach(e => {
      projectCounts.set(e.projectId!, (projectCounts.get(e.projectId!) || 0) + 1);
    });
    
    const topProjects = await Promise.all(
      Array.from(projectCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([projectId, events]) => {
          const project = await this.storage.getProject(projectId);
          return {
            projectId,
            name: project?.name || 'Unknown',
            events,
            time: 0 // Calculate from events
          };
        })
    );
    
    // Get language statistics
    const languages = await this.storage.getUserLanguageStats(userId, period);
    
    return {
      userId,
      period,
      metrics,
      activity,
      topProjects,
      languages
    };
  }

  private calculateActiveTime(events: AnalyticsEvent[]): number {
    // Group events by session and calculate session durations
    const sessions = new Map<string, { start: Date; end: Date }>();
    
    events.forEach(event => {
      if (!event.sessionId) return;
      
      const session = sessions.get(event.sessionId);
      if (!session) {
        sessions.set(event.sessionId, {
          start: event.timestamp,
          end: event.timestamp
        });
      } else {
        if (event.timestamp < session.start) session.start = event.timestamp;
        if (event.timestamp > session.end) session.end = event.timestamp;
      }
    });
    
    // Sum up session durations
    let totalMinutes = 0;
    sessions.forEach(session => {
      const duration = (session.end.getTime() - session.start.getTime()) / 1000 / 60;
      totalMinutes += Math.min(duration, 60); // Cap at 60 minutes per session
    });
    
    return Math.round(totalMinutes);
  }

  private calculateErrorRate(events: AnalyticsEvent[]): number {
    const totalEvents = events.length;
    const errorEvents = events.filter(e => e.event.includes('error')).length;
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  private calculateActivityPatterns(
    events: AnalyticsEvent[],
    period: UserAnalytics['period']
  ): UserAnalytics['activity'] {
    const activity: UserAnalytics['activity'] = {};
    
    if (period === '24h' || period === '1h') {
      // Hourly pattern for last 24 hours
      activity.hourly = new Array(24).fill(0);
      events.forEach(event => {
        const hour = event.timestamp.getHours();
        activity.hourly![hour]++;
      });
    } else if (period === '7d') {
      // Daily pattern for last 7 days
      activity.daily = new Array(7).fill(0);
      const now = new Date();
      events.forEach(event => {
        const daysAgo = Math.floor((now.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo < 7) {
          activity.daily![6 - daysAgo]++;
        }
      });
    } else if (period === '30d') {
      // Weekly pattern for last 4 weeks
      activity.weekly = new Array(4).fill(0);
      const now = new Date();
      events.forEach(event => {
        const weeksAgo = Math.floor((now.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24 * 7));
        if (weeksAgo < 4) {
          activity.weekly![3 - weeksAgo]++;
        }
      });
    }
    
    return activity;
  }

  async getProjectAnalytics(projectId: number, period: ProjectAnalytics['period']): Promise<ProjectAnalytics> {
    const events = await this.storage.getProjectAnalyticsEvents(projectId, period);
    
    // Calculate metrics
    const metrics = {
      views: events.filter(e => e.event === 'project_viewed').length,
      uniqueVisitors: new Set(events.map(e => e.userId)).size,
      runs: events.filter(e => e.event === 'project_run').length,
      deployments: events.filter(e => e.event === 'deployment_created').length,
      errors: events.filter(e => e.event.includes('error')).length,
      averageRunTime: this.calculateAverageRunTime(events),
      codeChanges: events.filter(e => e.event === 'code_changed').length,
      collaborators: await this.storage.getProjectCollaboratorCount(projectId, period)
    };
    
    // Get performance data
    const performance = await this.storage.getProjectPerformanceMetrics(projectId, period);
    
    // Calculate traffic sources
    const traffic = this.calculateTrafficAnalytics(events);
    
    // Calculate engagement metrics
    const engagement = this.calculateEngagementMetrics(events);
    
    return {
      projectId,
      period,
      metrics,
      performance,
      traffic,
      engagement
    };
  }

  private calculateAverageRunTime(events: AnalyticsEvent[]): number {
    const runEvents = events.filter(e => e.event === 'project_run' && e.properties?.duration);
    if (runEvents.length === 0) return 0;
    
    const totalTime = runEvents.reduce((sum, e) => sum + (e.properties?.duration || 0), 0);
    return Math.round(totalTime / runEvents.length);
  }

  private calculateTrafficAnalytics(events: AnalyticsEvent[]): ProjectAnalytics['traffic'] {
    const sources = new Map<string, number>();
    const countries = new Map<string, number>();
    const devices = new Map<string, number>();
    
    events.forEach(event => {
      if (event.event === 'project_viewed') {
        const source = event.properties?.source || 'direct';
        sources.set(source, (sources.get(source) || 0) + 1);
        
        const country = event.properties?.country || 'unknown';
        countries.set(country, (countries.get(country) || 0) + 1);
        
        const device = event.deviceInfo?.device || 'desktop';
        devices.set(device, (devices.get(device) || 0) + 1);
      }
    });
    
    return {
      sources: Array.from(sources.entries()).map(([source, visits]) => ({ source, visits })),
      countries: Array.from(countries.entries()).map(([country, visits]) => ({ country, visits })),
      devices: Array.from(devices.entries()).map(([device, visits]) => ({ device, visits }))
    };
  }

  private calculateEngagementMetrics(events: AnalyticsEvent[]): ProjectAnalytics['engagement'] {
    const sessions = new Map<string, AnalyticsEvent[]>();
    
    events.forEach(event => {
      if (event.sessionId) {
        if (!sessions.has(event.sessionId)) {
          sessions.set(event.sessionId, []);
        }
        sessions.get(event.sessionId)!.push(event);
      }
    });
    
    let totalDuration = 0;
    let totalPages = 0;
    let bounces = 0;
    
    sessions.forEach(sessionEvents => {
      sessionEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      if (sessionEvents.length === 1) {
        bounces++;
      } else {
        const duration = (sessionEvents[sessionEvents.length - 1].timestamp.getTime() - 
                         sessionEvents[0].timestamp.getTime()) / 1000;
        totalDuration += duration;
      }
      
      totalPages += sessionEvents.filter(e => e.event === 'project_viewed').length;
    });
    
    const totalSessions = sessions.size;
    
    return {
      bounceRate: totalSessions > 0 ? (bounces / totalSessions) * 100 : 0,
      averageSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
      pagesPerSession: totalSessions > 0 ? totalPages / totalSessions : 0
    };
  }

  async getDeploymentAnalytics(deploymentId: number, period: DeploymentAnalytics['period']): Promise<DeploymentAnalytics> {
    const events = await this.storage.getDeploymentAnalyticsEvents(deploymentId, period);
    
    // Calculate metrics
    const metrics = {
      requests: events.filter(e => e.event === 'deployment_request').length,
      uniqueVisitors: new Set(events.map(e => e.properties?.ip).filter(Boolean)).size,
      bandwidth: events.reduce((sum, e) => sum + (e.properties?.bytes || 0), 0) / 1024 / 1024,
      errors: events.filter(e => e.properties?.statusCode >= 400).length,
      errorRate: 0,
      uptime: await this.calculateUptime(deploymentId, period),
      averageResponseTime: this.calculateAverageResponseTime(events)
    };
    
    metrics.errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
    
    // Geographic analysis
    const geography = await this.analyzeGeography(events);
    
    // Endpoint analysis
    const endpoints = this.analyzeEndpoints(events);
    
    // Status code distribution
    const statusCodes = this.analyzeStatusCodes(events);
    
    return {
      deploymentId,
      period,
      metrics,
      geography,
      endpoints,
      statusCodes
    };
  }

  private async calculateUptime(deploymentId: number, period: string): Promise<number> {
    // Get health check events
    const healthChecks = await this.storage.getDeploymentHealthChecks(deploymentId, period);
    const totalChecks = healthChecks.length;
    const successfulChecks = healthChecks.filter(h => h.status === 'healthy').length;
    
    return totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;
  }

  private calculateAverageResponseTime(events: AnalyticsEvent[]): number {
    const requestEvents = events.filter(e => 
      e.event === 'deployment_request' && e.properties?.responseTime
    );
    
    if (requestEvents.length === 0) return 0;
    
    const totalTime = requestEvents.reduce((sum, e) => sum + (e.properties?.responseTime || 0), 0);
    return Math.round(totalTime / requestEvents.length);
  }

  private async analyzeGeography(events: AnalyticsEvent[]): Promise<DeploymentAnalytics['geography']> {
    const geoMap = new Map<string, { requests: number; totalTime: number }>();
    
    events.forEach(event => {
      if (event.event === 'deployment_request' && event.properties?.country) {
        const key = `${event.properties.country}:${event.properties.region || 'unknown'}`;
        const existing = geoMap.get(key) || { requests: 0, totalTime: 0 };
        
        existing.requests++;
        existing.totalTime += event.properties.responseTime || 0;
        
        geoMap.set(key, existing);
      }
    });
    
    return Array.from(geoMap.entries()).map(([key, data]) => {
      const [country, region] = key.split(':');
      return {
        country,
        region,
        requests: data.requests,
        avgResponseTime: Math.round(data.totalTime / data.requests)
      };
    });
  }

  private analyzeEndpoints(events: AnalyticsEvent[]): DeploymentAnalytics['endpoints'] {
    const endpointMap = new Map<string, {
      requests: number;
      totalTime: number;
      errors: number;
    }>();
    
    events.forEach(event => {
      if (event.event === 'deployment_request' && event.properties?.path) {
        const key = `${event.properties.method || 'GET'}:${event.properties.path}`;
        const existing = endpointMap.get(key) || { requests: 0, totalTime: 0, errors: 0 };
        
        existing.requests++;
        existing.totalTime += event.properties.responseTime || 0;
        if (event.properties.statusCode >= 400) {
          existing.errors++;
        }
        
        endpointMap.set(key, existing);
      }
    });
    
    return Array.from(endpointMap.entries()).map(([key, data]) => {
      const [method, path] = key.split(':');
      return {
        path,
        method,
        requests: data.requests,
        avgResponseTime: Math.round(data.totalTime / data.requests),
        errorRate: (data.errors / data.requests) * 100
      };
    });
  }

  private analyzeStatusCodes(events: AnalyticsEvent[]): DeploymentAnalytics['statusCodes'] {
    const statusMap = new Map<number, number>();
    
    events.forEach(event => {
      if (event.event === 'deployment_request' && event.properties?.statusCode) {
        const code = event.properties.statusCode;
        statusMap.set(code, (statusMap.get(code) || 0) + 1);
      }
    });
    
    return Array.from(statusMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code - b.code);
  }

  async getAnalyticsDashboard(userId: number, period: AnalyticsDashboard['period']): Promise<AnalyticsDashboard> {
    // Get overview metrics
    const overview = await this.storage.getAnalyticsOverview(userId, period);
    
    // Calculate trends
    const currentMetrics = await this.storage.getAnalyticsMetrics(userId, period);
    const previousPeriod = this.getPreviousPeriod(period);
    const previousMetrics = await this.storage.getAnalyticsMetrics(userId, previousPeriod);
    
    const trends = this.calculateTrends(currentMetrics, previousMetrics);
    
    // Get real-time data
    const realtime = await this.storage.getRealtimeAnalytics();
    
    return {
      userId,
      period,
      overview,
      trends,
      realtime
    };
  }

  private getPreviousPeriod(period: string): string {
    const periodMap: Record<string, string> = {
      '1h': '2h',
      '24h': '48h',
      '7d': '14d',
      '30d': '60d'
    };
    return periodMap[period] || period;
  }

  private calculateTrends(current: any, previous: any): AnalyticsDashboard['trends'] {
    const metrics = ['projects', 'deployments', 'views', 'codeLines', 'activeUsers', 'errorRate'];
    
    return metrics.map(metric => ({
      metric,
      current: current[metric] || 0,
      previous: previous[metric] || 0,
      change: previous[metric] > 0 
        ? ((current[metric] - previous[metric]) / previous[metric]) * 100
        : 0
    }));
  }

  async exportAnalytics(userId: number, options: {
    type: 'user' | 'project' | 'deployment';
    id: number;
    period: string;
    format: 'json' | 'csv' | 'pdf';
  }): Promise<string> {
    let data;
    
    switch (options.type) {
      case 'user':
        data = await this.getUserAnalytics(options.id, options.period as any);
        break;
      case 'project':
        data = await this.getProjectAnalytics(options.id, options.period as any);
        break;
      case 'deployment':
        data = await this.getDeploymentAnalytics(options.id, options.period as any);
        break;
    }
    
    // Export based on format
    switch (options.format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      case 'pdf':
        return await this.generatePDF(data);
    }
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const lines: string[] = [];
    const flatten = (obj: any, prefix = ''): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const key in obj) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          Object.assign(result, flatten(obj[key], prefix + key + '.'));
        } else {
          result[prefix + key] = obj[key];
        }
      }
      return result;
    };
    
    const flattened = flatten(data);
    lines.push(Object.keys(flattened).join(','));
    lines.push(Object.values(flattened).join(','));
    
    return lines.join('\n');
  }

  private async generatePDF(data: any): Promise<string> {
    // Generate a text-based report format that can be used as PDF content
    // For full PDF generation, integrate pdfkit or puppeteer in production
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    E-CODE ANALYTICS REPORT                 ');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    const formatSection = (title: string, obj: any, indent = 0): void => {
      const prefix = '  '.repeat(indent);
      lines.push(`${prefix}${title}`);
      lines.push(`${prefix}${'─'.repeat(40)}`);
      
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          formatSection(key, value, indent + 1);
        } else if (Array.isArray(value)) {
          lines.push(`${prefix}  ${key}: [${value.length} items]`);
        } else {
          lines.push(`${prefix}  ${key}: ${value}`);
        }
      }
      lines.push('');
    };
    
    formatSection('Analytics Data', data);
    
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                      END OF REPORT                        ');
    lines.push('═══════════════════════════════════════════════════════════');
    
    return lines.join('\n');
  }
}