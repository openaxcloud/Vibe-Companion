import { EventEmitter } from 'events';
import axios from 'axios';

interface DatadogConfig {
  apiKey: string;
  appKey: string;
  site?: string;
}

interface NewRelicConfig {
  apiKey: string;
  accountId: string;
  licenseKey?: string;
}

interface MetricData {
  metric: string;
  points: Array<[number, number]>;
  tags?: string[];
  host?: string;
}

interface Alert {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export class DatadogNewRelicService extends EventEmitter {
  private datadogConfigs: Map<string, DatadogConfig> = new Map();
  private newrelicConfigs: Map<string, NewRelicConfig> = new Map();

  constructor() {
    super();
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    if (process.env.DATADOG_API_KEY) {
      this.datadogConfigs.set('default', {
        apiKey: process.env.DATADOG_API_KEY,
        appKey: process.env.DATADOG_APP_KEY || '',
        site: process.env.DATADOG_SITE || 'datadoghq.com'
      });
    }

    if (process.env.NEWRELIC_API_KEY) {
      this.newrelicConfigs.set('default', {
        apiKey: process.env.NEWRELIC_API_KEY,
        accountId: process.env.NEWRELIC_ACCOUNT_ID || '',
        licenseKey: process.env.NEWRELIC_LICENSE_KEY
      });
    }
  }

  // Datadog Configuration
  async configureDatadog(projectId: string, config: DatadogConfig): Promise<void> {
    await this.testDatadogConnection(config);
    this.datadogConfigs.set(projectId, config);
    this.emit('datadog:configured', { projectId });
  }

  async testDatadogConnection(config: DatadogConfig): Promise<boolean> {
    try {
      const response = await axios.get(`https://api.${config.site || 'datadoghq.com'}/api/v1/validate`, {
        headers: {
          'DD-API-KEY': config.apiKey,
          'DD-APPLICATION-KEY': config.appKey
        }
      });
      return response.data.valid;
    } catch (error) {
      throw new Error('Datadog connection failed: Invalid API keys');
    }
  }

  // New Relic Configuration
  async configureNewRelic(projectId: string, config: NewRelicConfig): Promise<void> {
    await this.testNewRelicConnection(config);
    this.newrelicConfigs.set(projectId, config);
    this.emit('newrelic:configured', { projectId });
  }

  async testNewRelicConnection(config: NewRelicConfig): Promise<boolean> {
    try {
      const response = await axios.get(`https://api.newrelic.com/v2/accounts/${config.accountId}.json`, {
        headers: {
          'X-API-Key': config.apiKey
        }
      });
      return response.status === 200;
    } catch (error) {
      throw new Error('New Relic connection failed: Invalid API key or account ID');
    }
  }

  // Datadog Metrics
  async sendDatadogMetrics(projectId: string, metrics: MetricData[]): Promise<void> {
    const config = this.datadogConfigs.get(projectId) || this.datadogConfigs.get('default');
    if (!config) {
      throw new Error('Datadog not configured for this project');
    }

    const payload = {
      series: metrics.map(metric => ({
        metric: metric.metric,
        points: metric.points,
        tags: metric.tags,
        host: metric.host || 'e-code-app'
      }))
    };

    await axios.post(`https://api.${config.site}/api/v1/series`, payload, {
      headers: {
        'DD-API-KEY': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    this.emit('datadog:metrics_sent', { projectId, count: metrics.length });
  }

  async getDatadogMetrics(projectId: string, query: string, from: number, to: number): Promise<any> {
    const config = this.datadogConfigs.get(projectId) || this.datadogConfigs.get('default');
    if (!config) {
      throw new Error('Datadog not configured for this project');
    }

    const response = await axios.get(`https://api.${config.site}/api/v1/query`, {
      params: {
        query,
        from,
        to
      },
      headers: {
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey
      }
    });

    return response.data;
  }

  // New Relic Metrics
  async sendNewRelicMetrics(projectId: string, metrics: MetricData[]): Promise<void> {
    const config = this.newrelicConfigs.get(projectId) || this.newrelicConfigs.get('default');
    if (!config) {
      throw new Error('New Relic not configured for this project');
    }

    const payload = metrics.map(metric => ({
      metrics: [{
        name: metric.metric,
        type: 'gauge',
        value: metric.points[metric.points.length - 1][1],
        timestamp: metric.points[metric.points.length - 1][0],
        attributes: metric.tags?.reduce((acc, tag) => {
          const [key, value] = tag.split(':');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      }]
    }));

    for (const batch of payload) {
      await axios.post('https://metric-api.newrelic.com/metric/v1', batch, {
        headers: {
          'Api-Key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });
    }

    this.emit('newrelic:metrics_sent', { projectId, count: metrics.length });
  }

  async getNewRelicMetrics(projectId: string, nrql: string): Promise<any> {
    const config = this.newrelicConfigs.get(projectId) || this.newrelicConfigs.get('default');
    if (!config) {
      throw new Error('New Relic not configured for this project');
    }

    const response = await axios.get(`https://api.newrelic.com/graphql`, {
      method: 'POST',
      data: {
        query: `
          {
            actor {
              account(id: ${config.accountId}) {
                nrql(query: "${nrql}") {
                  results
                }
              }
            }
          }
        `
      },
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data.data.actor.account.nrql.results;
  }

  // Datadog Alerts
  async createDatadogAlert(projectId: string, alert: Omit<Alert, 'id'>): Promise<Alert> {
    const config = this.datadogConfigs.get(projectId) || this.datadogConfigs.get('default');
    if (!config) {
      throw new Error('Datadog not configured for this project');
    }

    const payload = {
      name: alert.name,
      query: alert.condition,
      message: `Alert: ${alert.name}`,
      tags: [`project:${projectId}`, `severity:${alert.severity}`],
      options: {
        thresholds: {
          critical: alert.threshold
        },
        notify_audit: false,
        notify_no_data: false
      }
    };

    const response = await axios.post(`https://api.${config.site}/api/v1/monitor`, payload, {
      headers: {
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey,
        'Content-Type': 'application/json'
      }
    });

    const createdAlert = {
      id: response.data.id.toString(),
      name: alert.name,
      condition: alert.condition,
      threshold: alert.threshold,
      severity: alert.severity,
      enabled: alert.enabled
    };

    this.emit('datadog:alert_created', { projectId, alertId: createdAlert.id });
    return createdAlert;
  }

  async getDatadogAlerts(projectId: string): Promise<Alert[]> {
    const config = this.datadogConfigs.get(projectId) || this.datadogConfigs.get('default');
    if (!config) {
      throw new Error('Datadog not configured for this project');
    }

    const response = await axios.get(`https://api.${config.site}/api/v1/monitor`, {
      params: {
        tags: `project:${projectId}`
      },
      headers: {
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey
      }
    });

    return response.data.map((monitor: any) => ({
      id: monitor.id.toString(),
      name: monitor.name,
      condition: monitor.query,
      threshold: monitor.options?.thresholds?.critical || 0,
      severity: this.extractSeverityFromTags(monitor.tags),
      enabled: monitor.options?.silenced === undefined
    }));
  }

  // New Relic Alerts
  async createNewRelicAlert(projectId: string, alert: Omit<Alert, 'id'>): Promise<Alert> {
    const config = this.newrelicConfigs.get(projectId) || this.newrelicConfigs.get('default');
    if (!config) {
      throw new Error('New Relic not configured for this project');
    }

    // First create a policy
    const policyResponse = await axios.post('https://api.newrelic.com/v2/alerts_policies.json', {
      policy: {
        name: `${alert.name} Policy`,
        incident_preference: 'PER_CONDITION'
      }
    }, {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    const policyId = policyResponse.data.policy.id;

    // Then create the condition
    const conditionResponse = await axios.post(`https://api.newrelic.com/v2/alerts_conditions/policies/${policyId}.json`, {
      condition: {
        type: 'apm_app_metric',
        name: alert.name,
        enabled: alert.enabled,
        entities: [],
        metric: 'apdex',
        condition_scope: 'application',
        terms: [{
          duration: '5',
          operator: 'below',
          priority: alert.severity === 'critical' ? 'critical' : 'warning',
          threshold: alert.threshold.toString(),
          time_function: 'all'
        }]
      }
    }, {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    const createdAlert = {
      id: conditionResponse.data.condition.id.toString(),
      name: alert.name,
      condition: alert.condition,
      threshold: alert.threshold,
      severity: alert.severity,
      enabled: alert.enabled
    };

    this.emit('newrelic:alert_created', { projectId, alertId: createdAlert.id });
    return createdAlert;
  }

  async getNewRelicAlerts(projectId: string): Promise<Alert[]> {
    const config = this.newrelicConfigs.get(projectId) || this.newrelicConfigs.get('default');
    if (!config) {
      throw new Error('New Relic not configured for this project');
    }

    const response = await axios.get('https://api.newrelic.com/v2/alerts_conditions.json', {
      headers: {
        'X-API-Key': config.apiKey
      }
    });

    return response.data.conditions.map((condition: any) => ({
      id: condition.id.toString(),
      name: condition.name,
      condition: condition.metric,
      threshold: parseFloat(condition.terms[0]?.threshold || '0'),
      severity: condition.terms[0]?.priority === 'critical' ? 'critical' : 'medium',
      enabled: condition.enabled
    }));
  }

  // Dashboard Management
  async createDatadogDashboard(projectId: string, title: string, widgets: any[]): Promise<string> {
    const config = this.datadogConfigs.get(projectId) || this.datadogConfigs.get('default');
    if (!config) {
      throw new Error('Datadog not configured for this project');
    }

    const payload = {
      title,
      widgets,
      layout_type: 'ordered',
      tags: [`project:${projectId}`]
    };

    const response = await axios.post(`https://api.${config.site}/api/v1/dashboard`, payload, {
      headers: {
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey,
        'Content-Type': 'application/json'
      }
    });

    this.emit('datadog:dashboard_created', { projectId, dashboardId: response.data.id });
    return response.data.id;
  }

  async createNewRelicDashboard(projectId: string, title: string, pages: any[]): Promise<string> {
    const config = this.newrelicConfigs.get(projectId) || this.newrelicConfigs.get('default');
    if (!config) {
      throw new Error('New Relic not configured for this project');
    }

    const mutation = `
      mutation {
        dashboardCreate(
          accountId: ${config.accountId}
          dashboard: {
            name: "${title}"
            pages: ${JSON.stringify(pages)}
            permissions: PRIVATE
          }
        ) {
          entityResult {
            guid
          }
        }
      }
    `;

    const response = await axios.post('https://api.newrelic.com/graphql', {
      query: mutation
    }, {
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    const dashboardId = response.data.data.dashboardCreate.entityResult.guid;
    this.emit('newrelic:dashboard_created', { projectId, dashboardId });
    return dashboardId;
  }

  // Application Performance Monitoring
  async trackApplicationPerformance(projectId: string, performanceData: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
  }): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const metrics: MetricData[] = [
      {
        metric: 'e_code.performance.response_time',
        points: [[timestamp, performanceData.responseTime]],
        tags: [`project:${projectId}`]
      },
      {
        metric: 'e_code.performance.throughput',
        points: [[timestamp, performanceData.throughput]],
        tags: [`project:${projectId}`]
      },
      {
        metric: 'e_code.performance.error_rate',
        points: [[timestamp, performanceData.errorRate]],
        tags: [`project:${projectId}`]
      },
      {
        metric: 'e_code.system.cpu_usage',
        points: [[timestamp, performanceData.cpuUsage]],
        tags: [`project:${projectId}`]
      },
      {
        metric: 'e_code.system.memory_usage',
        points: [[timestamp, performanceData.memoryUsage]],
        tags: [`project:${projectId}`]
      }
    ];

    // Send to both services if configured
    if (this.datadogConfigs.has(projectId) || this.datadogConfigs.has('default')) {
      await this.sendDatadogMetrics(projectId, metrics);
    }

    if (this.newrelicConfigs.has(projectId) || this.newrelicConfigs.has('default')) {
      await this.sendNewRelicMetrics(projectId, metrics);
    }

    this.emit('performance:tracked', { projectId, metrics: performanceData });
  }

  // Utility Methods
  private extractSeverityFromTags(tags: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const severityTag = tags.find(tag => tag.startsWith('severity:'));
    if (severityTag) {
      const severity = severityTag.split(':')[1];
      return ['low', 'medium', 'high', 'critical'].includes(severity) ? severity as any : 'medium';
    }
    return 'medium';
  }

  // Configuration Management
  getDatadogConfig(projectId: string): DatadogConfig | undefined {
    return this.datadogConfigs.get(projectId);
  }

  getNewRelicConfig(projectId: string): NewRelicConfig | undefined {
    return this.newrelicConfigs.get(projectId);
  }

  removeDatadogConfig(projectId: string): void {
    this.datadogConfigs.delete(projectId);
    this.emit('datadog:removed', { projectId });
  }

  removeNewRelicConfig(projectId: string): void {
    this.newrelicConfigs.delete(projectId);
    this.emit('newrelic:removed', { projectId });
  }
}