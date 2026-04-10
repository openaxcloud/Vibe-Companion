import { EventEmitter } from 'events';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('edge-functions');

interface EdgeFunction {
  id: string;
  name: string;
  code: string;
  runtime: 'javascript' | 'typescript' | 'wasm';
  triggers: {
    http?: {
      path: string;
      methods: string[];
    };
    cron?: string;
    event?: string;
  };
  env: Record<string, string>;
  regions: string[];
  timeout: number;
  memory: number;
  status: 'deploying' | 'active' | 'failed' | 'inactive';
  deployedAt?: Date;
  lastInvocation?: Date;
  invocationCount: number;
  averageLatency?: number;
}

interface EdgeFunctionInvocation {
  functionId: string;
  region: string;
  requestId: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  memory: number;
  logs: string[];
  result?: any;
  error?: string;
  timestamp: Date;
}

export class EdgeFunctionsService extends EventEmitter {
  private deploymentQueue: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeService();
  }

  private initializeService(): void {
    setInterval(() => this.processDeploymentQueue(), 5000);
    setInterval(() => this.checkFunctionHealth(), 30000);
  }

  private async getFunction(functionId: string): Promise<EdgeFunction | null> {
    return await redisCache.get<EdgeFunction>(CacheKeys.edgeFunction(functionId));
  }

  private async setFunction(func: EdgeFunction): Promise<void> {
    await redisCache.set(CacheKeys.edgeFunction(func.id), func, CacheTTL.WEEK);
    await redisCache.sadd(CacheKeys.edgeFunctionsList(), func.id);
  }

  private async removeFunction(functionId: string): Promise<void> {
    await redisCache.del(CacheKeys.edgeFunction(functionId));
    await redisCache.srem(CacheKeys.edgeFunctionsList(), functionId);
    await redisCache.del(CacheKeys.edgeInvocations(functionId));
  }

  private async getInvocations(functionId: string): Promise<EdgeFunctionInvocation[]> {
    return await redisCache.get<EdgeFunctionInvocation[]>(CacheKeys.edgeInvocations(functionId)) || [];
  }

  private async addInvocation(functionId: string, invocation: EdgeFunctionInvocation): Promise<void> {
    const invocations = await this.getInvocations(functionId);
    invocations.push(invocation);
    const kept = invocations.slice(-100);
    await redisCache.set(CacheKeys.edgeInvocations(functionId), kept, CacheTTL.DAY);
  }

  async deployFunction(
    projectId: number,
    name: string,
    code: string,
    config: {
      runtime?: 'javascript' | 'typescript' | 'wasm';
      triggers?: EdgeFunction['triggers'];
      env?: Record<string, string>;
      regions?: string[];
      timeout?: number;
      memory?: number;
    }
  ): Promise<EdgeFunction> {
    const functionId = `ef_${projectId}_${Date.now()}`;
    
    const edgeFunction: EdgeFunction = {
      id: functionId,
      name,
      code,
      runtime: config.runtime || 'javascript',
      triggers: config.triggers || { http: { path: `/${name}`, methods: ['GET', 'POST'] } },
      env: config.env || {},
      regions: config.regions || ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
      timeout: config.timeout || 30,
      memory: config.memory || 128,
      status: 'deploying',
      invocationCount: 0,
    };

    await this.setFunction(edgeFunction);
    this.deploymentQueue.set(functionId, edgeFunction);
    
    setTimeout(async () => {
      edgeFunction.status = 'active';
      edgeFunction.deployedAt = new Date();
      await this.setFunction(edgeFunction);
      this.emit('functionDeployed', edgeFunction);
    }, 3000);

    return edgeFunction;
  }

  async invokeFunction(
    functionId: string,
    request: {
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
    }
  ): Promise<EdgeFunctionInvocation> {
    const func = await this.getFunction(functionId);
    if (!func || func.status !== 'active') {
      throw new Error('Function not found or not active');
    }

    const invocation: EdgeFunctionInvocation = {
      functionId,
      region: this.selectOptimalRegion(func.regions),
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'success',
      duration: 0,
      memory: 0,
      logs: [],
      timestamp: new Date(),
    };

    const startTime = Date.now();
    const memBefore = process.memoryUsage().heapUsed;

    try {
      let result: any;
      
      switch (func.runtime) {
        case 'javascript':
        case 'typescript':
          result = await this.executeJavaScriptFunction(func, request);
          break;
        case 'wasm':
          result = await this.executeWasmFunction(func, request);
          break;
        default:
          throw new Error(`Unsupported runtime: ${func.runtime}`);
      }

      invocation.result = result;
      invocation.duration = Date.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;
      invocation.memory = Math.max(0, Math.round((memAfter - memBefore) / 1024));
      invocation.logs.push(`Function executed successfully in ${invocation.duration}ms`);

      func.lastInvocation = new Date();
      func.invocationCount++;
      func.averageLatency = func.averageLatency 
        ? (func.averageLatency + invocation.duration) / 2 
        : invocation.duration;

    } catch (error: any) {
      invocation.status = 'error';
      invocation.error = error.message;
      invocation.logs.push(`Error: ${error.message}`);
    }

    await this.addInvocation(functionId, invocation);
    await this.setFunction(func);

    return invocation;
  }

  private async executeJavaScriptFunction(
    func: EdgeFunction,
    request: any
  ): Promise<any> {
    const context = {
      request,
      env: func.env,
      console: {
        log: (msg: string) => {},
        error: (msg: string) => console.error(`[EdgeFunction ${func.id}] ${msg}`),
      },
      fetch: global.fetch,
      Response: global.Response,
      Request: global.Request,
      Headers: global.Headers,
    };

    const criticalPatterns = /\b(require|import|child_process|exec|spawn)\s*\(|process\.env|globalThis\b|global\b|__proto__|constructor\s*\[|\.constructor\b|prototype\b|\bfs\b|Buffer\b|Reflect\b|Proxy\b/i;
    if (criticalPatterns.test(func.code)) {
      throw new Error('Blocked dangerous pattern in edge function');
    }
    
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const handler = new AsyncFunction('context', `"use strict"; ${func.code}`);
      return await handler(context);
    } catch (error) {
      throw new Error(`Edge function execution failed: ${error}`);
    }
  }

  private async executeWasmFunction(
    func: EdgeFunction,
    request: any
  ): Promise<any> {
    return {
      message: 'WASM function executed',
      functionId: func.id,
      request,
    };
  }

  async updateFunction(
    functionId: string,
    updates: Partial<EdgeFunction>
  ): Promise<EdgeFunction> {
    const func = await this.getFunction(functionId);
    if (!func) {
      throw new Error('Function not found');
    }

    Object.assign(func, updates);
    func.status = 'deploying';
    
    this.deploymentQueue.set(functionId, func);
    
    setTimeout(async () => {
      func.status = 'active';
      func.deployedAt = new Date();
      await this.setFunction(func);
    }, 2000);

    await this.setFunction(func);
    return func;
  }

  async deleteFunction(functionId: string): Promise<void> {
    const func = await this.getFunction(functionId);
    if (!func) {
      throw new Error('Function not found');
    }

    func.status = 'inactive';
    await this.setFunction(func);
    
    setTimeout(async () => {
      await this.removeFunction(functionId);
    }, 60000);
  }

  async getFunctions(projectId?: number): Promise<EdgeFunction[]> {
    const functionIds = await redisCache.smembers(CacheKeys.edgeFunctionsList());
    const functions: EdgeFunction[] = [];
    
    for (const id of functionIds) {
      const func = await this.getFunction(id);
      if (func) {
        if (projectId) {
          if (func.id.includes(`ef_${projectId}_`)) {
            functions.push(func);
          }
        } else {
          functions.push(func);
        }
      }
    }
    
    return functions;
  }

  async getFunctionMetrics(functionId: string): Promise<{
    invocations: EdgeFunctionInvocation[];
    stats: {
      totalInvocations: number;
      successRate: number;
      averageLatency: number;
      errorRate: number;
      memoryUsage: {
        avg: number;
        max: number;
      };
    };
  }> {
    const invocations = await this.getInvocations(functionId);
    const successful = invocations.filter(i => i.status === 'success');
    
    const stats = {
      totalInvocations: invocations.length,
      successRate: invocations.length > 0 ? (successful.length / invocations.length) * 100 : 0,
      averageLatency: successful.reduce((sum, i) => sum + i.duration, 0) / (successful.length || 1),
      errorRate: invocations.length > 0 ? ((invocations.length - successful.length) / invocations.length) * 100 : 0,
      memoryUsage: {
        avg: successful.reduce((sum, i) => sum + i.memory, 0) / (successful.length || 1),
        max: Math.max(...successful.map(i => i.memory), 0),
      },
    };

    return { invocations, stats };
  }

  async setFunctionTrigger(
    functionId: string,
    trigger: EdgeFunction['triggers']
  ): Promise<void> {
    const func = await this.getFunction(functionId);
    if (!func) {
      throw new Error('Function not found');
    }

    func.triggers = trigger;
    await this.updateFunction(functionId, { triggers: trigger });
  }

  private selectOptimalRegion(regions: string[]): string {
    return regions[Math.floor(Math.random() * regions.length)];
  }

  private processDeploymentQueue(): void {
    for (const [functionId, func] of Array.from(this.deploymentQueue)) {
      this.deploymentQueue.delete(functionId);
    }
  }

  private async checkFunctionHealth(): Promise<void> {
    const functionIds = await redisCache.smembers(CacheKeys.edgeFunctionsList());
    for (const functionId of functionIds) {
      const func = await this.getFunction(functionId);
      if (func && func.status === 'active' && func.lastInvocation) {
        const inactiveDuration = Date.now() - new Date(func.lastInvocation).getTime();
        if (inactiveDuration > 300000) {
          // Function can be scaled down
        }
      }
    }
  }

  streamFunctionLogs(functionId: string, callback: (log: string) => void): () => void {
    const interval = setInterval(async () => {
      const invocations = await this.getInvocations(functionId);
      const latest = invocations[invocations.length - 1];
      
      if (latest && latest.logs.length > 0) {
        latest.logs.forEach(log => callback(log));
      }
    }, 1000);

    return () => clearInterval(interval);
  }
}

export const edgeFunctionsService = new EdgeFunctionsService();
