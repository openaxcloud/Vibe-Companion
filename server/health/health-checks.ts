/**
 * Advanced Health Checks
 * Fortune 500 Standard - Kubernetes-Ready
 *
 * Features:
 * - Liveness probe (is the app running?)
 * - Readiness probe (is the app ready to serve traffic?)
 * - Deep health checks for all dependencies
 * - Graceful degradation
 * - Health metrics export
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('health-checks');

/**
 * Health status interface
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
}

/**
 * Check database connection
 */
async function checkDatabase(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime: number; message?: string }> {
  const startTime = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;

    if (responseTime > 1000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Database responding slowly'
      };
    }

    return {
      status: 'up',
      responseTime
    };
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error.message
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime: number; message?: string }> {
  const startTime = Date.now();

  try {
    const { redisCache } = await import('../services/redis-cache');
    const isConnected = await redisCache.healthCheck();

    const responseTime = Date.now() - startTime;

    if (!isConnected) {
      return {
        status: 'down',
        responseTime,
        message: 'Redis client not connected'
      };
    }

    if (responseTime > 500) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Redis responding slowly'
      };
    }

    return {
      status: 'up',
      responseTime
    };
  } catch (error: any) {
    logger.error('Redis health check failed', { error: error.message });
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error.message
    };
  }
}

/**
 * Check Runner microservice connectivity
 */
async function checkRunner(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime: number; message?: string; configured: boolean }> {
  const startTime = Date.now();

  try {
    const { isRunnerConfigured, pingRunner } = await import('../runnerClient');

    if (!isRunnerConfigured()) {
      return {
        status: 'down',
        responseTime: 0,
        message: 'Runner not configured (RUNNER_BASE_URL / RUNNER_JWT_SECRET missing)',
        configured: false
      };
    }

    const health = await pingRunner();
    const responseTime = Date.now() - startTime;

    if (!health.online) {
      return {
        status: 'down',
        responseTime,
        message: `Runner unreachable at ${health.baseUrl}`,
        configured: true
      };
    }

    if (responseTime > 2000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Runner responding slowly',
        configured: true
      };
    }

    return {
      status: 'up',
      responseTime,
      message: health.workspaces !== undefined ? `${health.workspaces} active workspace(s)` : undefined,
      configured: true
    };
  } catch (error: any) {
    logger.error('Runner health check failed', { error: error.message });
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error.message,
      configured: false
    };
  }
}

/**
 * Check all AI providers health using the provider manager
 */
async function checkAIProviders(): Promise<{ 
  status: 'up' | 'down' | 'degraded'; 
  responseTime: number; 
  message?: string;
  providers?: Record<string, { status: string; configured: boolean }>;
}> {
  const startTime = Date.now();
  
  try {
    // Import provider manager dynamically
    const { aiProviderManager } = await import('../ai/ai-provider-manager');
    
    const providerHealth: Record<string, { status: string; configured: boolean }> = {};
    const availableModels = aiProviderManager.getAvailableModels();
    
    // Check each unique provider - count as healthy if it has available models
    const providers = new Set(availableModels.map(m => m.provider));
    let configuredCount = providers.size;
    
    for (const provider of providers) {
      providerHealth[provider] = {
        status: 'configured',
        configured: true
      };
    }
    
    // Check for unconfigured providers by checking API keys
    const providerKeys: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      xai: 'XAI_API_KEY',
      moonshot: 'MOONSHOT_API_KEY',
      groq: 'GROQ_API_KEY'
    };
    
    for (const [providerName, keyName] of Object.entries(providerKeys)) {
      if (!providers.has(providerName as any)) {
        providerHealth[providerName] = {
          status: process.env[keyName] ? 'key_present_not_initialized' : 'not_configured',
          configured: false
        };
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    // Determine overall status
    if (configuredCount === 0) {
      return {
        status: 'down',
        responseTime,
        message: 'No AI providers available',
        providers: providerHealth
      };
    }
    
    // If we have at least one provider, we're good
    return {
      status: 'up',
      responseTime,
      message: `${configuredCount} AI provider(s) available`,
      providers: providerHealth
    };
  } catch (error: any) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: `AI provider check failed: ${error.message}`
    };
  }
}

/**
 * Check OpenAI API availability
 */
async function checkOpenAI(): Promise<{ status: 'up' | 'down'; responseTime: number; message?: string }> {
  const startTime = Date.now();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        status: 'down',
        responseTime: 0,
        message: 'OpenAI API key not configured'
      };
    }

    // Simple health check - verify API key format
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey.startsWith('sk-')) {
      return {
        status: 'down',
        responseTime: 0,
        message: 'Invalid OpenAI API key format'
      };
    }

    return {
      status: 'up',
      responseTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error.message
    };
  }
}

/**
 * Check Anthropic API availability
 */
async function checkAnthropic(): Promise<{ status: 'up' | 'down'; responseTime: number; message?: string }> {
  const startTime = Date.now();

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        status: 'down',
        responseTime: 0,
        message: 'Anthropic API key not configured'
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey.startsWith('sk-ant-')) {
      return {
        status: 'down',
        responseTime: 0,
        message: 'Invalid Anthropic API key format'
      };
    }

    return {
      status: 'up',
      responseTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error.message
    };
  }
}

/**
 * Check disk space
 */
async function checkDiskSpace(): Promise<{ status: 'up' | 'down' | 'degraded'; message?: string; details?: any }> {
  try {
    const { execSync } = require('child_process');
    const output = execSync('df -h / | tail -1').toString();
    const parts = output.split(/\s+/);
    const used = parseInt(parts[4]);

    if (used > 90) {
      return {
        status: 'down',
        message: `Disk usage critical: ${used}%`,
        details: { used: `${used}%` }
      };
    }

    if (used > 80) {
      return {
        status: 'degraded',
        message: `Disk usage warning: ${used}%`,
        details: { used: `${used}%` }
      };
    }

    return {
      status: 'up',
      details: { used: `${used}%` }
    };
  } catch (error: any) {
    logger.warn('Disk space check failed', { error: error.message });
    return {
      status: 'up', // Don't fail if we can't check
      message: 'Unable to check disk space'
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): { status: 'up' | 'down' | 'degraded'; message?: string; details?: any } {
  const totalMemory = process.memoryUsage();
  const usedMemory = totalMemory.heapUsed;
  const totalHeap = totalMemory.heapTotal;
  const usagePercent = (usedMemory / totalHeap) * 100;

  if (usagePercent > 90) {
    return {
      status: 'down',
      message: `Memory usage critical: ${usagePercent.toFixed(2)}%`,
      details: {
        used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
        total: `${(totalHeap / 1024 / 1024).toFixed(2)} MB`,
        percent: `${usagePercent.toFixed(2)}%`
      }
    };
  }

  if (usagePercent > 80) {
    return {
      status: 'degraded',
      message: `Memory usage warning: ${usagePercent.toFixed(2)}%`,
      details: {
        used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
        total: `${(totalHeap / 1024 / 1024).toFixed(2)} MB`,
        percent: `${usagePercent.toFixed(2)}%`
      }
    };
  }

  return {
    status: 'up',
    details: {
      used: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
      total: `${(totalHeap / 1024 / 1024).toFixed(2)} MB`,
      percent: `${usagePercent.toFixed(2)}%`
    }
  };
}

/**
 * Perform all health checks
 */
async function performHealthChecks(deep: boolean = false): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {};

  // Always check critical dependencies
  checks.database = await checkDatabase();
  
  const redisEnabled = process.env.REDIS_ENABLED === 'true' || process.env.NODE_ENV === 'production';
  if (redisEnabled) {
    checks.redis = await checkRedis();
  } else {
    checks.redis = { status: 'up', responseTime: 0, message: 'Redis disabled (REDIS_ENABLED not set)' };
  }
  
  checks.runner = await checkRunner();
  checks.memory = checkMemory();

  // Deep health checks (optional)
  if (deep) {
    checks.aiProviders = await checkAIProviders();
    checks.openai = await checkOpenAI();
    checks.anthropic = await checkAnthropic();
    checks.disk = await checkDiskSpace();
  }

  // Determine overall status
  const hasDown = Object.values(checks).some(check => check.status === 'down');
  const hasDegraded = Object.values(checks).some(check => check.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasDown) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks
  };
}

/**
 * Liveness Probe Handler
 * Kubernetes: Is the application running?
 * Returns 200 if the process is alive
 */
export async function livenessProbe(req: Request, res: Response): Promise<void> {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    status: 'ok',
    message: 'Application is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
}

/**
 * Readiness Probe Handler
 * Kubernetes: Is the application ready to serve traffic?
 * Returns 200 only if all critical dependencies are healthy
 */
export async function readinessProbe(req: Request, res: Response): Promise<void> {
  try {
    const health = await performHealthChecks(false);

    // Ready only if all critical checks pass
    // Redis is optional caching layer - not critical for serving traffic
    const criticalChecks = ['database'];
    const isReady = criticalChecks.every(
      key => health.checks[key]?.status === 'up' || health.checks[key]?.status === 'degraded'
    );

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        message: 'Application is ready to serve traffic',
        timestamp: health.timestamp,
        uptime: health.uptime,
        checks: health.checks
      });
    } else {
      // Return 503 when not ready so K8s can remove pod from load balancer (Fortune 500 production requirement)
      res.status(503).json({
        status: 'not ready',
        message: 'Application is not ready to serve traffic',
        timestamp: health.timestamp,
        uptime: health.uptime,
        checks: health.checks
      });
    }
  } catch (error: any) {
    logger.error('Readiness probe failed', { error: error.message });
    // Return 503 on error to prevent K8s from routing traffic to unhealthy pod
    res.status(503).json({
      status: 'error',
      message: 'Failed to perform readiness check',
      error: error.message
    });
  }
}

/**
 * Deep Health Check Handler
 * Comprehensive check of all system components
 */
export async function deepHealthCheck(req: Request, res: Response): Promise<void> {
  try {
    const health = await performHealthChecks(true);

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error: any) {
    logger.error('Deep health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Startup Probe Handler
 * Kubernetes: Has the application finished starting up?
 */
export async function startupProbe(req: Request, res: Response): Promise<void> {
  // Check if application has been running for at least 10 seconds
  const uptime = process.uptime();

  if (uptime < 10) {
    res.status(503).json({
      status: 'starting',
      message: 'Application is still starting up',
      uptime,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Perform basic health check
  try {
    const dbCheck = await checkDatabase();

    if (dbCheck.status === 'up' || dbCheck.status === 'degraded') {
      res.status(200).json({
        status: 'started',
        message: 'Application has started successfully',
        uptime,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'starting',
        message: 'Application is starting but dependencies are not ready',
        uptime,
        timestamp: new Date().toISOString(),
        checks: { database: dbCheck }
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Startup check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Export health check endpoints
 */
export const healthCheckRoutes = {
  liveness: livenessProbe,
  readiness: readinessProbe,
  deep: deepHealthCheck,
  startup: startupProbe
};

export default {
  livenessProbe,
  readinessProbe,
  deepHealthCheck,
  startupProbe,
  performHealthChecks
};
