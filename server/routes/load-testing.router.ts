import { Router, Request, Response } from "express";
import { type IStorage } from "../storage";
import { LoadTestingService, type LoadTestConfig, type LoadTestResult } from "../services/load-testing.service";
import { createLogger } from '../utils/logger';

const logger = createLogger('load-testing-router');

/**
 * Load Testing Router
 * Fortune 500 Pre-Production Requirement
 * Provides endpoints for Reserved VM performance testing
 */
export class LoadTestingRouter {
  private router: Router;
  private storage: IStorage;
  private loadTestingService: LoadTestingService;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.loadTestingService = new LoadTestingService(storage);
    this.initializeRoutes();
  }

  private ensureAdmin(req: Request, res: Response, next: any) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if ((req.user as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for load testing' });
    }
    next();
  }

  private initializeRoutes() {
    /**
     * Run comprehensive load test suite
     * Tests all 4 requirements: AI streaming, DB performance, WebSocket limits, system metrics
     * ADMIN ONLY - Prevents accidental production self-DOS and unexpected AI provider costs
     */
    this.router.post('/load-test/comprehensive', this.ensureAdmin.bind(this), async (req: Request, res: Response) => {
      try {
        const config: LoadTestConfig = {
          concurrency: Math.min(req.body.concurrency || 10, 50),
          duration: Math.min(req.body.duration || 30000, 300000),
          rampUp: Math.min(req.body.rampUp || 5000, 30000)
        };

        logger.info('Starting comprehensive load test suite...');
        logger.info(`Config: ${config.concurrency} concurrent, ${config.duration}ms duration, ${config.rampUp}ms ramp-up`);
        
        this.loadTestingService.clearMetrics();
        
        const results: any = {
          timestamp: new Date().toISOString(),
          config,
          tests: []
        };

        const totalTestDuration = config.duration * 3 + config.rampUp;

        logger.info('=== Starting System Performance Monitoring (Background) ===');
        const metricsPromise = this.loadTestingService.monitorSystemPerformance(totalTestDuration);

        logger.info('=== Test 1: Concurrent AI Streaming ===');
        const aiStreamingResult = await this.loadTestingService.testConcurrentAIStreaming({
          concurrency: Math.min(config.concurrency, 50),
          duration: config.duration,
          rampUp: config.rampUp
        });
        logger.info(`AI Streaming: ${aiStreamingResult.successfulRequests}/${aiStreamingResult.totalRequests} successful`);
        logger.info(`  Avg response time: ${aiStreamingResult.avgResponseTime}ms`);
        logger.info(`  P95: ${aiStreamingResult.p95ResponseTime}ms, P99: ${aiStreamingResult.p99ResponseTime}ms`);
        logger.info(`  RPS: ${aiStreamingResult.requestsPerSecond.toFixed(2)}`);

        logger.info('=== Test 2: Database Query Performance ===');
        const dbPerformanceResult = await this.loadTestingService.testDatabasePerformance({
          concurrency: 20,
          duration: config.duration,
          rampUp: config.rampUp
        });
        logger.info(`Database: ${dbPerformanceResult.successfulRequests}/${dbPerformanceResult.totalRequests} successful`);
        logger.info(`  Avg response time: ${dbPerformanceResult.avgResponseTime}ms`);
        logger.info(`  P95: ${dbPerformanceResult.p95ResponseTime}ms, P99: ${dbPerformanceResult.p99ResponseTime}ms`);
        logger.info(`  QPS: ${dbPerformanceResult.requestsPerSecond.toFixed(2)}`);

        logger.info('=== Test 3: WebSocket Connection Limits ===');
        const wsLimitsResult = await this.loadTestingService.testWebSocketLimits({
          concurrency: Math.min(config.concurrency * 10, 500),
          duration: config.duration,
          rampUp: config.rampUp
        });
        logger.info(`WebSocket: ${wsLimitsResult.successfulRequests}/${wsLimitsResult.totalRequests} connections`);
        logger.info(`  Avg connection time: ${wsLimitsResult.avgResponseTime}ms`);

        logger.info('=== Test 4: Waiting for System Metrics ===');
        const systemMetrics = await metricsPromise;
        logger.info(`System Metrics: ${systemMetrics.length} samples collected`);

        results.tests.push(aiStreamingResult, dbPerformanceResult, wsLimitsResult);

        const avgCpuLoad = systemMetrics.length > 0 
          ? systemMetrics.reduce((sum, m) => sum + m.cpu.loadAverage[0], 0) / systemMetrics.length 
          : 0;
        const avgMemUsage = systemMetrics.length > 0 
          ? systemMetrics.reduce((sum, m) => sum + m.memory.usagePercent, 0) / systemMetrics.length 
          : 0;
        const peakMemUsage = systemMetrics.length > 0 
          ? Math.max(...systemMetrics.map(m => m.memory.usagePercent)) 
          : 0;
        
        results.systemPerformance = {
          samples: systemMetrics.length,
          avgCpuLoad: avgCpuLoad.toFixed(2),
          avgMemoryUsage: `${avgMemUsage.toFixed(1)}%`,
          peakMemoryUsage: `${peakMemUsage.toFixed(1)}%`,
          metrics: systemMetrics
        };

        logger.info(`System Metrics: ${systemMetrics.length} samples collected`);
        logger.info(`  Avg CPU load: ${avgCpuLoad.toFixed(2)}`);
        logger.info(`  Avg memory usage: ${avgMemUsage.toFixed(1)}%`);

        // Compile overall results
        results.summary = {
          allTestsPassed: results.tests.every((t: LoadTestResult) => 
            t.successfulRequests > 0 && (t.failedRequests / t.totalRequests) < 0.1
          ),
          totalRequests: results.tests.reduce((sum: number, t: LoadTestResult) => sum + t.totalRequests, 0),
          totalSuccessful: results.tests.reduce((sum: number, t: LoadTestResult) => sum + t.successfulRequests, 0),
          totalFailed: results.tests.reduce((sum: number, t: LoadTestResult) => sum + t.failedRequests, 0),
          overallSuccessRate: 0
        };
        results.summary.overallSuccessRate = 
          (results.summary.totalSuccessful / results.summary.totalRequests * 100).toFixed(2) + '%';

        logger.info('=== Comprehensive Load Test Complete ===');
        logger.info(`Overall Success Rate: ${results.summary.overallSuccessRate}`);
        logger.info(`Total Requests: ${results.summary.totalRequests}`);

        // Clear metrics for next test
        this.loadTestingService.clearMetrics();

        res.json(results);
        
      } catch (error: any) {
        logger.error('Load test error:', error);
        res.status(500).json({
          error: 'Load test failed',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });

    /**
     * Individual test: AI Streaming
     * ADMIN ONLY
     */
    this.router.post('/load-test/ai-streaming', this.ensureAdmin.bind(this), async (req: Request, res: Response) => {
      try {
        const config: LoadTestConfig = {
          concurrency: req.body.concurrency || 10,
          duration: req.body.duration || 30000,
          rampUp: req.body.rampUp || 5000
        };

        const result = await this.loadTestingService.testConcurrentAIStreaming(config);
        this.loadTestingService.clearMetrics();
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * Individual test: Database Performance
     * ADMIN ONLY
     */
    this.router.post('/load-test/database', this.ensureAdmin.bind(this), async (req: Request, res: Response) => {
      try {
        const config: LoadTestConfig = {
          concurrency: req.body.concurrency || 20,
          duration: req.body.duration || 30000,
          rampUp: req.body.rampUp || 5000
        };

        const result = await this.loadTestingService.testDatabasePerformance(config);
        this.loadTestingService.clearMetrics();
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * Individual test: WebSocket Limits
     * ADMIN ONLY
     */
    this.router.post('/load-test/websocket', this.ensureAdmin.bind(this), async (req: Request, res: Response) => {
      try {
        const config: LoadTestConfig = {
          concurrency: req.body.concurrency || 100,
          duration: req.body.duration || 30000,
          rampUp: req.body.rampUp || 5000
        };

        const result = await this.loadTestingService.testWebSocketLimits(config);
        this.loadTestingService.clearMetrics();
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * Get current system metrics
     */
    this.router.get('/load-test/metrics', (req: Request, res: Response) => {
      const metrics = this.loadTestingService.getSystemMetrics();
      res.json({
        samples: metrics.length,
        metrics: metrics.slice(-100)
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
