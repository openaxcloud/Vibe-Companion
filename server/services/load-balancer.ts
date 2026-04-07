// @ts-nocheck
/**
 * Load Balancer Service
 * Fortune 500-grade traffic distribution
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { scalabilityOrchestrator } from './scalability-orchestrator';
import httpProxy from 'http-proxy-middleware';

const logger = createLogger('load-balancer');

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  healthCheckInterval: number;
  sessionAffinity: boolean;
  maxConnections: number;
}

interface Backend {
  id: string;
  url: string;
  weight: number;
  connections: number;
  healthy: boolean;
  lastHealthCheck: Date;
  responseTime: number[];
}

export class LoadBalancerService {
  private static instance: LoadBalancerService;
  private backends: Map<string, Backend[]> = new Map();
  private currentIndex: Map<string, number> = new Map();
  private sessionMap: Map<string, string> = new Map();
  
  private config: LoadBalancerConfig = {
    algorithm: 'round-robin',
    healthCheckInterval: 5000,
    sessionAffinity: true,
    maxConnections: 10000
  };

  private constructor() {
    this.initialize();
  }

  static getInstance(): LoadBalancerService {
    if (!LoadBalancerService.instance) {
      LoadBalancerService.instance = new LoadBalancerService();
    }
    return LoadBalancerService.instance;
  }

  private initialize() {
    logger.info('[LOAD-BALANCER] Initializing Fortune 500-grade load balancer');
    
    // Start health checks
    this.startHealthChecks();
    
    // Monitor backend performance
    this.startPerformanceMonitoring();
    
    logger.info('[LOAD-BALANCER] ✅ Load balancer ready for millions of requests');
  }

  /**
   * Register a backend server
   */
  registerBackend(serviceId: string, backend: Omit<Backend, 'connections' | 'healthy' | 'lastHealthCheck' | 'responseTime'>): void {
    if (!this.backends.has(serviceId)) {
      this.backends.set(serviceId, []);
    }
    
    const completeBackend: Backend = {
      ...backend,
      connections: 0,
      healthy: true,
      lastHealthCheck: new Date(),
      responseTime: []
    };
    
    this.backends.get(serviceId)!.push(completeBackend);
    
    logger.info(`[LOAD-BALANCER] Registered backend ${backend.id} for service ${serviceId}`);
  }

  /**
   * Get next backend based on load balancing algorithm
   */
  getNextBackend(serviceId: string, req?: Request): Backend | null {
    const backends = this.backends.get(serviceId);
    if (!backends || backends.length === 0) {
      return null;
    }
    
    const healthyBackends = backends.filter(b => b.healthy);
    if (healthyBackends.length === 0) {
      logger.error(`[LOAD-BALANCER] No healthy backends for service ${serviceId}`);
      return null;
    }
    
    // Check session affinity
    if (this.config.sessionAffinity && req) {
      const sessionId = this.getSessionId(req);
      const affinity = this.sessionMap.get(sessionId);
      if (affinity) {
        const backend = healthyBackends.find(b => b.id === affinity);
        if (backend && backend.healthy) {
          return backend;
        }
      }
    }
    
    let selected: Backend | null = null;
    
    switch (this.config.algorithm) {
      case 'round-robin':
        selected = this.roundRobin(serviceId, healthyBackends);
        break;
      
      case 'least-connections':
        selected = this.leastConnections(healthyBackends);
        break;
      
      case 'ip-hash':
        selected = this.ipHash(healthyBackends, req);
        break;
      
      case 'weighted':
        selected = this.weighted(healthyBackends);
        break;
      
      default:
        selected = healthyBackends[0];
    }
    
    if (selected && this.config.sessionAffinity && req) {
      const sessionId = this.getSessionId(req);
      this.sessionMap.set(sessionId, selected.id);
    }
    
    return selected;
  }

  /**
   * Round-robin algorithm
   */
  private roundRobin(serviceId: string, backends: Backend[]): Backend {
    const currentIdx = this.currentIndex.get(serviceId) || 0;
    const nextIdx = (currentIdx + 1) % backends.length;
    this.currentIndex.set(serviceId, nextIdx);
    
    return backends[nextIdx];
  }

  /**
   * Least connections algorithm
   */
  private leastConnections(backends: Backend[]): Backend {
    return backends.reduce((min, backend) => 
      backend.connections < min.connections ? backend : min
    );
  }

  /**
   * IP hash algorithm
   */
  private ipHash(backends: Backend[], req?: Request): Backend {
    if (!req) return backends[0];
    
    const ip = req.ip || req.connection.remoteAddress || '';
    const hash = this.hashString(ip);
    const index = hash % backends.length;
    
    return backends[index];
  }

  /**
   * Weighted algorithm
   */
  private weighted(backends: Backend[]): Backend {
    const totalWeight = backends.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const backend of backends) {
      random -= backend.weight;
      if (random <= 0) {
        return backend;
      }
    }
    
    return backends[0];
  }

  /**
   * Create proxy middleware for a service
   */
  createProxyMiddleware(serviceId: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const backend = this.getNextBackend(serviceId, req);
      
      if (!backend) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'No healthy backends available'
        });
        return;
      }
      
      // Track connection
      backend.connections++;
      const startTime = Date.now();
      
      // Create proxy
      const proxy = httpProxy.createProxyMiddleware({
        target: backend.url,
        changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
          // Add load balancer headers
          proxyReq.setHeader('X-Forwarded-For', req.ip);
          proxyReq.setHeader('X-Real-IP', req.ip);
          proxyReq.setHeader('X-Backend-Server', backend.id);
        },
        onProxyRes: (proxyRes, req, res) => {
          // Track response time
          const responseTime = Date.now() - startTime;
          backend.responseTime.push(responseTime);
          if (backend.responseTime.length > 100) {
            backend.responseTime.shift();
          }
          
          // Add response headers
          res.setHeader('X-Backend-Response-Time', responseTime.toString());
          res.setHeader('X-Load-Balancer', 'E-Code-LB');
        },
        onError: (err, req, res) => {
          logger.error(`[LOAD-BALANCER] Proxy error for backend ${backend.id}:`, err);
          backend.connections--;
          
          // Mark backend as unhealthy
          backend.healthy = false;
          
          // Try another backend
          const fallback = this.getNextBackend(serviceId, req);
          if (fallback && fallback.id !== backend.id) {
            this.createProxyMiddleware(serviceId)(req, res, next);
          } else {
            res.status(502).json({
              error: 'Bad Gateway',
              message: 'Backend server error'
            });
          }
        }
      });
      
      proxy(req, res, next);
      
      // Cleanup connection count
      res.on('finish', () => {
        backend.connections--;
      });
    };
  }

  /**
   * Health check for backends
   */
  private async healthCheck(backend: Backend): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${backend.url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      const responseTime = Date.now() - startTime;
      
      backend.healthy = response.ok;
      backend.lastHealthCheck = new Date();
      backend.responseTime.push(responseTime);
      
      if (backend.responseTime.length > 100) {
        backend.responseTime.shift();
      }
      
      if (!response.ok) {
        logger.warn(`[LOAD-BALANCER] Backend ${backend.id} failed health check`);
      }
    } catch (error) {
      backend.healthy = false;
      logger.error(`[LOAD-BALANCER] Health check failed for backend ${backend.id}:`, error);
    }
  }

  /**
   * Start health checks for all backends
   */
  private startHealthChecks(): void {
    setInterval(() => {
      for (const [serviceId, backends] of this.backends) {
        for (const backend of backends) {
          this.healthCheck(backend);
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Monitor backend performance
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      for (const [serviceId, backends] of this.backends) {
        for (const backend of backends) {
          if (backend.responseTime.length > 0) {
            const avgResponseTime = backend.responseTime.reduce((a, b) => a + b, 0) / backend.responseTime.length;
            
            if (avgResponseTime > 1000) {
              logger.warn(`[LOAD-BALANCER] Backend ${backend.id} slow response time: ${avgResponseTime}ms`);
            }
          }
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Get session ID from request
   */
  private getSessionId(req: Request): string {
    return req.sessionID || req.ip || 'default';
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get load balancer statistics
   */
  getStatistics(): any {
    const stats: any = {
      services: {}
    };
    
    for (const [serviceId, backends] of this.backends) {
      stats.services[serviceId] = {
        totalBackends: backends.length,
        healthyBackends: backends.filter(b => b.healthy).length,
        totalConnections: backends.reduce((sum, b) => sum + b.connections, 0),
        backends: backends.map(b => ({
          id: b.id,
          healthy: b.healthy,
          connections: b.connections,
          weight: b.weight,
          avgResponseTime: b.responseTime.length > 0 
            ? b.responseTime.reduce((a, b) => a + b, 0) / b.responseTime.length 
            : 0
        }))
      };
    }
    
    return stats;
  }
}

// Export singleton instance
export const loadBalancer = LoadBalancerService.getInstance();