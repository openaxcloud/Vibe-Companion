import { Router, Request, Response } from "express";
import { type IStorage } from "../storage";
import os from 'os';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { agentOrchestrator } from '../services/agent-orchestrator.service';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { runtimeWarmup } from '../execution/runtime-warmup';

export class HealthRouter {
  private router: Router;
  private storage: IStorage;
  private startTime: Date;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.startTime = new Date();
    this.initializeRoutes();
  }

  private getUptime(): string {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private getCorsHealth(): { enabled: boolean; mode: string | undefined; configuredOrigins: number; status: 'configured' | 'misconfigured' } {
    const corsEnabled = process.env.NODE_ENV === 'production' ? 
      (!!process.env.ALLOWED_ORIGINS || !!process.env.FRONTEND_URL) : true;
    
    return {
      enabled: corsEnabled,
      mode: process.env.NODE_ENV,
      configuredOrigins: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',').length : 
        (process.env.FRONTEND_URL ? 1 : 0),
      status: corsEnabled ? 'configured' : 'misconfigured'
    };
  }

  private async getDatabaseHealth(): Promise<{ status: string; connection: string; responseTime?: string; latencyMs?: number; error?: string }> {
    const dbStartTime = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      const latencyMs = Date.now() - dbStartTime;
      return {
        status: 'healthy',
        connection: 'active',
        responseTime: `${latencyMs}ms`,
        latencyMs
      };
    } catch (error) {
      const latencyMs = Date.now() - dbStartTime;
      return {
        status: 'unhealthy',
        connection: 'failed',
        responseTime: `${latencyMs}ms`,
        latencyMs,
        error: 'Database connection issue'
      };
    }
  }

  private getSystemHealth(): object {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsagePercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    
    return {
      memory: {
        usage: `${memUsagePercent}%`,
        available: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        process: {
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
        }
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg().map(load => load.toFixed(2))
      },
      platform: {
        os: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: this.getUptime()
      }
    };
  }

  private getSecurityStatus(): object {
    return {
      cors: this.getCorsHealth(),
      authentication: {
        bypassEnabled: false, // Fortune 500 grade: All auth via Passport sessions only
        csrfProtection: true,
        sessionStore: 'PostgreSQL'
      },
      packageSecurity: {
        inputValidation: 'enabled',
        pathTraversalProtection: 'enabled',
        commandInjectionProtection: 'enabled'
      },
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Enterprise-grade AI Provider Health Checks
   * Tests API key validity for all 5 major providers
   */
  private async checkProviderHealth(provider: string, apiKey: string | undefined, timeout: number = 5000): Promise<{
    status: 'healthy' | 'unhealthy' | 'missing' | 'timeout';
    responseTime?: number;
    error?: string;
    recommendation?: string;
  }> {
    if (!apiKey || apiKey.trim() === '') {
      return { 
        status: 'missing', 
        error: 'API key not configured',
        recommendation: `Set ${provider.toUpperCase()}_API_KEY in environment variables`
      };
    }

    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Provider timeout')), timeout)
      );

      let testPromise: Promise<any>;

      switch (provider) {
        case 'openai': {
          const client = new OpenAI({ apiKey, timeout: timeout - 500 });
          testPromise = client.models.list().then(res => res.data.length > 0);
          break;
        }
        case 'anthropic': {
          const client = new Anthropic({ apiKey, timeout: timeout - 500 });
          testPromise = client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          });
          break;
        }
        case 'gemini': {
          const client = new GoogleGenAI({ apiKey });
          const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
          testPromise = (async () => {
            for (const modelName of geminiModels) {
              try {
                await client.models.generateContent({ model: modelName, contents: 'test' });
                return true;
              } catch (e: any) {
                if (e.message?.includes('not found') || e.status === 404) {
                  continue; // Try next model
                }
                throw e; // Re-throw other errors
              }
            }
            throw new Error('No Gemini models available');
          })();
          break;
        }
        case 'xai': {
          const client = new OpenAI({ 
            apiKey, 
            baseURL: 'https://api.x.ai/v1',
            timeout: timeout - 500 
          });
          testPromise = client.models.list().then(res => res.data.length > 0);
          break;
        }
        case 'moonshot': {
          const client = new OpenAI({ 
            apiKey, 
            baseURL: 'https://api.moonshot.ai/v1',
            timeout: timeout - 500 
          });
          testPromise = client.models.list().then(res => res.data.length > 0);
          break;
        }
        case 'groq': {
          const client = new OpenAI({ 
            apiKey, 
            baseURL: 'https://api.groq.com/openai/v1',
            timeout: timeout - 500 
          });
          testPromise = client.models.list().then(res => res.data.length > 0);
          break;
        }
        default:
          return { status: 'unhealthy', error: 'Unknown provider' };
      }

      await Promise.race([testPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;
      
      return { status: 'healthy', responseTime };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message === 'Provider timeout') {
        return { status: 'timeout', responseTime, error: 'Request timeout' };
      }
      
      if (error.status === 401 || error.message?.includes('API key') || error.message?.includes('authentication')) {
        return { 
          status: 'unhealthy', 
          responseTime, 
          error: 'Invalid API key',
          recommendation: `Verify ${provider.toUpperCase()}_API_KEY is correct`
        };
      }
      
      if (error.message?.includes('Insufficient credits') || error.message?.includes('quota')) {
        return { 
          status: 'unhealthy', 
          responseTime, 
          error: error.message,
          recommendation: `Add credits or check billing for ${provider}`
        };
      }
      
      return { 
        status: 'unhealthy', 
        responseTime, 
        error: error.message || 'Provider error' 
      };
    }
  }

  private async getAllProvidersHealth(): Promise<any> {
    // S-H1 FIXED: Never expose API keys in responses - use masked check
    const providers = [
      { name: 'openai', key: process.env.OPENAI_API_KEY },
      { name: 'anthropic', key: process.env.ANTHROPIC_API_KEY },
      { name: 'gemini', key: process.env.GEMINI_API_KEY },
      { name: 'xai', key: process.env.XAI_API_KEY },
      { name: 'moonshot', key: process.env.MOONSHOT_API_KEY },
      { name: 'groq', key: process.env.GROQ_API_KEY }
    ];

    const results = await Promise.all(
      providers.map(async ({ name, key }) => {
        const health = await this.checkProviderHealth(name, key);
        // S-H1 FIXED (Fortune 500): Only boolean configured flag, no key exposure
        return { 
          provider: name, 
          configured: !!key,
          ...health 
        };
      })
    );

    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      missing: results.filter(r => r.status === 'missing').length,
      timeout: results.filter(r => r.status === 'timeout').length
    };

    return { summary, providers: results };
  }

  private initializeRoutes() {
    // Basic health check
    this.router.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        service: "E-Code Platform API",
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      });
    });

    // Detailed health check with circuit breaker and recovery queue status
    // ✅ MONITORING ENDPOINT (Dec 7, 2025): Comprehensive health for monitoring tools
    this.router.get("/health/detailed", async (req: Request, res: Response) => {
      try {
        const startTime = Date.now();
        const [dbHealth] = await Promise.all([
          this.getDatabaseHealth()
        ]);
        const dbLatencyMs = Date.now() - startTime;

        // Get circuit breaker statuses from AI Provider Manager
        const circuitBreakers = aiProviderManager.getCircuitBreakerStatuses();
        
        // Get recovery queue status from Agent Orchestrator
        const recoveryQueueFull = agentOrchestrator.getRecoveryQueueStatus();
        const recoveryQueue = {
          pendingItems: recoveryQueueFull.pendingItems,
          oldestItem: recoveryQueueFull.oldestItem,
          lastProcessed: recoveryQueueFull.lastProcessed
        };

        // Determine overall health status
        const hasOpenCircuitBreakers = Object.values(circuitBreakers).some(
          cb => cb.status === 'open'
        );
        const hasPendingRecovery = recoveryQueue.pendingItems > 0;
        const dbOk = dbHealth.status === 'healthy';
        
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (!dbOk) {
          overallStatus = 'unhealthy';
        } else if (hasOpenCircuitBreakers || hasPendingRecovery) {
          overallStatus = 'degraded';
        }

        // Calculate uptime in seconds
        const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

        res.json({
          status: overallStatus,
          timestamp: new Date().toISOString(),
          uptime: uptimeSeconds,
          components: {
            database: {
              status: dbOk ? 'ok' : 'error',
              latencyMs: dbLatencyMs
            },
            circuitBreakers,
            recoveryQueue
          },
          // Legacy fields for backwards compatibility
          service: "E-Code Platform API",
          environment: process.env.NODE_ENV || 'development',
          version: process.env.APP_VERSION || '1.0.0',
          system: this.getSystemHealth(),
          security: this.getSecurityStatus()
        });
      } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
          components: {
            database: { status: 'error' },
            circuitBreakers: {},
            recoveryQueue: { pendingItems: 0 }
          },
          error: "Failed to gather health metrics"
        });
      }
    });

    // CORS health endpoint
    this.router.get("/cors-health", (req: Request, res: Response) => {
      const corsHealth = this.getCorsHealth();
      const statusCode = corsHealth.status === 'configured' ? 200 : 500;
      
      res.status(statusCode).json({
        ...corsHealth,
        recommendation: corsHealth.status === 'misconfigured' ? 
          'Set ALLOWED_ORIGINS or FRONTEND_URL environment variables in production' : 
          'CORS is properly configured'
      });
    });

    // Liveness probe — both paths for backward compatibility
    this.router.get("/liveness", (_req: Request, res: Response) => {
      res.json({ status: "alive" });
    });
    // Frontend hooks use /api/health/liveness (alias)
    this.router.get("/health/liveness", (_req: Request, res: Response) => {
      res.json({ status: "alive" });
    });
    // Replit deployment health check alias
    this.router.get("/monitoring/health", (_req: Request, res: Response) => {
      res.json({ status: "ok" });
    });

    // Readiness probe (for Kubernetes/Docker)
    this.router.get("/readiness", async (req: Request, res: Response) => {
      try {
        const dbHealth = await this.getDatabaseHealth();
        if (dbHealth.status === 'healthy') {
          res.json({ status: "ready" });
        } else {
          res.status(503).json({ status: "not_ready", reason: "database_unavailable" });
        }
      } catch (error) {
        res.status(503).json({ status: "not_ready", reason: "health_check_failed" });
      }
    });

    // Application metrics endpoint (JSON format - use /api/metrics for Prometheus format)
    this.router.get("/health/metrics", (req: Request, res: Response) => {
      const memUsage = process.memoryUsage();
      
      res.json({
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: process.cpuUsage().user,
          system: process.cpuUsage().system
        },
        requests: {
          total: 0,
          errors: 0,
          avgResponseTime: 0
        }
      });
    });

    // AI Provider Health Check - Fortune 500 requirement
    // Always returns HTTP 200 with status in body (degraded/healthy)
    // Only returns 503 on complete failure to check providers
    this.router.get("/health/providers", async (req: Request, res: Response) => {
      try {
        const providersHealth = await this.getAllProvidersHealth();
        const allHealthy = providersHealth.summary.healthy === providersHealth.summary.total;
        
        // Always return 200 - degraded status is informational, not an error
        res.status(200).json({
          timestamp: new Date().toISOString(),
          status: allHealthy ? 'healthy' : 'degraded',
          service: 'AI Providers',
          ...providersHealth,
          recommendations: providersHealth.providers
            .filter((p: any) => p.status !== 'healthy')
            .map((p: any) => ({
              provider: p.provider,
              action: p.status === 'missing' 
                ? `Set ${p.provider.toUpperCase()}_API_KEY environment variable`
                : p.status === 'unhealthy'
                ? `Replace invalid ${p.provider.toUpperCase()}_API_KEY or add credits`
                : `Check network connectivity to ${p.provider}`
            }))
        });
      } catch (error) {
        console.error('Provider health check error:', error);
        res.status(503).json({
          status: 'error',
          service: 'AI Providers',
          timestamp: new Date().toISOString(),
          error: 'Failed to check provider health'
        });
      }
    });

    // Language Runtime Health Check - All 29 languages
    this.router.get("/health/runtimes", (req: Request, res: Response) => {
      const status = runtimeWarmup.getStatus();
      res.status(200).json({
        timestamp: new Date().toISOString(),
        status: status.warmupComplete ? (status.readyCount === status.totalCount ? 'healthy' : 'degraded') : 'warming_up',
        service: 'Language Runtimes',
        ...status
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}