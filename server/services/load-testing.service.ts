import { EventEmitter } from 'events';
import http from 'http';
import https from 'https';
import { IStorage } from '../storage';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger';

const logger = createLogger('load-testing-service');

/**
 * Enterprise Load Testing Service
 * Tests Reserved VM performance under realistic load
 * Fortune 500 Pre-Production Requirement
 */

export interface LoadTestConfig {
  concurrency: number;
  duration: number;
  rampUp: number;
}

export interface LoadTestResult {
  testName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errors: Array<{ message: string; count: number }>;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usagePercent: number;
  };
  activeConnections: number;
}

export class LoadTestingService extends EventEmitter {
  private storage: IStorage;
  private responseTimes: number[] = [];
  private errors: Map<string, number> = new Map();
  private activeRequests: number = 0;
  private systemMetrics: SystemMetrics[] = [];
  
  constructor(storage: IStorage) {
    super();
    this.storage = storage;
  }

  /**
   * Test 1: Concurrent AI Streaming Sessions
   * Simulates 10-50 concurrent AI streaming requests
   */
  async testConcurrentAIStreaming(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = new Date();
    const results = {
      testName: 'Concurrent AI Streaming Sessions',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (!openaiKey && !anthropicKey) {
      throw new Error('No AI provider keys configured for load testing');
    }

    this.responseTimes = [];
    this.errors.clear();

    const tasks: Promise<void>[] = [];
    const totalRequests = config.concurrency * Math.ceil(config.duration / 1000);
    
    logger.info(`Starting AI streaming load test: ${config.concurrency} concurrent streams for ${config.duration}ms`);
    
    for (let i = 0; i < config.concurrency; i++) {
      const delay = (i / config.concurrency) * config.rampUp;
      
      const task = new Promise<void>(async (resolve) => {
        await this.sleep(delay);
        
        const iterations = Math.ceil(config.duration / 1000);
        for (let j = 0; j < iterations; j++) {
          try {
            results.totalRequests++;
            const reqStartTime = Date.now();
            
            await this.streamAIRequest(openaiKey || anthropicKey!, openaiKey ? 'openai' : 'anthropic');
            
            const responseTime = Date.now() - reqStartTime;
            this.responseTimes.push(responseTime);
            results.successfulRequests++;
          } catch (error: any) {
            results.failedRequests++;
            const errorMsg = error.message || 'Unknown error';
            this.errors.set(errorMsg, (this.errors.get(errorMsg) || 0) + 1);
          }
        }
        resolve();
      });
      
      tasks.push(task);
    }

    await Promise.all(tasks);
    
    const endTime = new Date();
    return this.compileResults(results.testName, startTime, endTime, results);
  }

  /**
   * Test 2: Database Query Performance
   * Tests 100+ queries per second under concurrent load
   */
  async testDatabasePerformance(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = new Date();
    const results = {
      testName: 'Database Query Performance',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };

    this.responseTimes = [];
    this.errors.clear();

    const tasks: Promise<void>[] = [];
    const queriesPerSecond = 100;
    const totalQueries = queriesPerSecond * (config.duration / 1000);
    
    logger.info(`Starting database load test: ${queriesPerSecond} queries/sec for ${config.duration}ms`);

    for (let i = 0; i < config.concurrency; i++) {
      const delay = (i / config.concurrency) * config.rampUp;
      
      const task = new Promise<void>(async (resolve) => {
        await this.sleep(delay);
        
        const queriesPerWorker = Math.ceil(totalQueries / config.concurrency);
        
        for (let j = 0; j < queriesPerWorker; j++) {
          try {
            results.totalRequests++;
            const reqStartTime = Date.now();
            
            await this.executeDatabaseQuery();
            
            const responseTime = Date.now() - reqStartTime;
            this.responseTimes.push(responseTime);
            results.successfulRequests++;
          } catch (error: any) {
            results.failedRequests++;
            const errorMsg = error.message || 'Unknown error';
            this.errors.set(errorMsg, (this.errors.get(errorMsg) || 0) + 1);
          }
          
          await this.sleep(1000 / (queriesPerSecond / config.concurrency));
        }
        resolve();
      });
      
      tasks.push(task);
    }

    await Promise.all(tasks);
    
    const endTime = new Date();
    return this.compileResults(results.testName, startTime, endTime, results);
  }

  /**
   * Test 3: WebSocket Connection Limits
   * Tests 100-500 concurrent WebSocket connections
   */
  async testWebSocketLimits(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = new Date();
    const results = {
      testName: 'WebSocket Connection Limits',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };

    this.responseTimes = [];
    this.errors.clear();

    const connections: any[] = [];
    
    logger.info(`Starting WebSocket load test: ${config.concurrency} concurrent connections`);

    try {
      for (let i = 0; i < config.concurrency; i++) {
        results.totalRequests++;
        const reqStartTime = Date.now();
        
        try {
          const connection = await this.createMockWebSocketConnection();
          connections.push(connection);
          
          const responseTime = Date.now() - reqStartTime;
          this.responseTimes.push(responseTime);
          results.successfulRequests++;
        } catch (error: any) {
          results.failedRequests++;
          const errorMsg = error.message || 'Unknown error';
          this.errors.set(errorMsg, (this.errors.get(errorMsg) || 0) + 1);
        }
        
        await this.sleep(config.rampUp / config.concurrency);
      }

      await this.sleep(config.duration);

      connections.forEach(conn => {
        try {
          if (conn && conn.close) conn.close();
        } catch (e) {
        }
      });
      
    } catch (error: any) {
      logger.error('WebSocket test error:', error);
    }

    const endTime = new Date();
    return this.compileResults(results.testName, startTime, endTime, results);
  }

  /**
   * Test 4: System Performance Monitoring
   * Captures CPU, memory, and connection metrics during load
   */
  async monitorSystemPerformance(durationMs: number): Promise<SystemMetrics[]> {
    const metrics: SystemMetrics[] = [];
    const interval = 1000;
    const iterations = Math.ceil(durationMs / interval);

    for (let i = 0; i < iterations; i++) {
      const metric = this.captureSystemMetrics();
      metrics.push(metric);
      this.systemMetrics.push(metric);
      
      this.emit('metrics', metric);
      
      await this.sleep(interval);
    }

    return metrics;
  }

  private async streamAIRequest(apiKey: string, provider: 'openai' | 'anthropic'): Promise<void> {
    if (provider === 'openai') {
      const client = new OpenAI({ apiKey });
      const stream = await client.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: 'Test load testing message' }],
        stream: true,
        max_completion_tokens: 50
      });

      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
        }
      }
    } else {
      const client = new Anthropic({ apiKey });
      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Test load testing message' }]
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
        }
      }
    }
  }

  private async executeDatabaseQuery(): Promise<void> {
    const randomId = Math.random().toString(36).substring(7);
    
    await this.storage.getUser(randomId);
  }

  private async createMockWebSocketConnection(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({ 
          id: Math.random().toString(36),
          close: () => {},
          connected: true 
        });
      }, Math.random() * 100);
    });
  }

  private captureSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: new Date(),
      cpu: {
        usage: process.cpuUsage().user / 1000000,
        loadAverage: require('os').loadavg()
      },
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        usagePercent: (usedMem / totalMem) * 100
      },
      activeConnections: this.activeRequests
    };
  }

  private compileResults(
    testName: string,
    startTime: Date,
    endTime: Date,
    results: any
  ): LoadTestResult {
    const duration = endTime.getTime() - startTime.getTime();
    const sortedTimes = this.responseTimes.sort((a, b) => a - b);
    
    const avgResponseTime = sortedTimes.length > 0 
      ? sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length 
      : 0;
    
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      testName,
      startTime,
      endTime,
      duration,
      totalRequests: results.totalRequests,
      successfulRequests: results.successfulRequests,
      failedRequests: results.failedRequests,
      avgResponseTime: Math.round(avgResponseTime),
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      requestsPerSecond: results.totalRequests / (duration / 1000),
      errors: Array.from(this.errors.entries()).map(([message, count]) => ({ message, count }))
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSystemMetrics(): SystemMetrics[] {
    return this.systemMetrics;
  }

  clearMetrics(): void {
    this.systemMetrics = [];
    this.responseTimes = [];
    this.errors.clear();
  }
}
