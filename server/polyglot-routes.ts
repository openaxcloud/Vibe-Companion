// @ts-nocheck
/**
 * Polyglot Backend Routes
 * Integrates TypeScript and Python services into unified API
 * Container, file, and build operations are handled by the unified executor
 */

import { Router } from 'express';
import { PolyglotCoordinator } from './services/polyglot-coordinator';
import { CodeExecutor } from './execution/executor';
import { ContainerOrchestrator } from './containers/container-orchestrator';
import { createLogger } from './utils/logger';

const router = Router();
const logger = createLogger('polyglot-routes');
let coordinator: PolyglotCoordinator | null = null;
const codeExecutor = new CodeExecutor();
const containerOrchestrator = new ContainerOrchestrator();

function getCoordinator(): PolyglotCoordinator {
  if (!coordinator) {
    coordinator = new PolyglotCoordinator();
  }
  return coordinator;
}

router.get('/polyglot/health', async (req, res) => {
  const healthStatus = getCoordinator().getHealthStatus();
  const overallHealth = healthStatus.every(service => service.status === 'healthy');
  
  res.json({
    status: overallHealth ? 'healthy' : 'degraded',
    services: healthStatus,
    timestamp: new Date().toISOString(),
    architecture: 'polyglot',
    languages: ['TypeScript', 'Python']
  });
});

router.post('/containers/create', async (req, res) => {
  try {
    const { projectId, language, code, image = 'node:18', name } = req.body;
    
    if (language && code) {
      const result = await codeExecutor.execute(language, code, { timeout: 30000 });
      return res.status(200).json({
        id: `container-${projectId}-${Date.now()}`,
        projectId,
        language,
        status: result.exitCode === 0 ? 'completed' : 'failed',
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        createdAt: new Date().toISOString(),
        message: 'Executed via unified executor'
      });
    }

    const containerName = name || `project-${projectId}`;
    const containerId = await containerOrchestrator.deployContainer({
      image,
      name: containerName,
      env: req.body.env || {},
      resources: req.body.resources || { cpu: '0.5', memory: '512Mi' },
      ports: req.body.ports || []
    });

    res.status(200).json({
      id: containerId,
      projectId,
      image,
      name: containerName,
      status: 'running',
      createdAt: new Date().toISOString(),
      message: 'Container deployed via orchestrator'
    });
  } catch (error) {
    logger.error('[CONTAINERS] Error creating container', { error });
    res.status(500).json({ 
      error: 'Failed to create container',
      message: error.message
    });
  }
});

router.get('/containers/list', async (req, res) => {
  try {
    const containers = await containerOrchestrator.listContainers();
    res.json({ containers });
  } catch (error) {
    logger.error('[CONTAINERS] Error listing containers', { error });
    res.status(500).json({ 
      error: 'Container service error',
      message: error.message
    });
  }
});

router.post('/files/batch-operations', async (req, res) => {
  try {
    const { operations } = req.body;
    const fs = await import('fs/promises');
    const path = await import('path');

    const results = [];
    for (const op of (operations as Array<Record<string, unknown>>) || []) {
      try {
        const filePath = op.path as string;
        switch (op.type) {
          case 'read': {
            const content = await fs.readFile(filePath, 'utf-8');
            results.push({ ...op, status: 'completed', content });
            break;
          }
          case 'write': {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, op.content as string, 'utf-8');
            results.push({ ...op, status: 'completed' });
            break;
          }
          case 'delete': {
            await fs.unlink(filePath);
            results.push({ ...op, status: 'completed' });
            break;
          }
          case 'stat': {
            const stat = await fs.stat(filePath);
            results.push({ ...op, status: 'completed', stat: { size: stat.size, isDirectory: stat.isDirectory(), modified: stat.mtime } });
            break;
          }
          default:
            results.push({ ...op, status: 'error', error: `Unknown operation type: ${op.type}` });
        }
      } catch (opError: unknown) {
        const errMsg = opError instanceof Error ? opError.message : String(opError);
        results.push({ ...op, status: 'error', error: errMsg });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error('[FILES] Error in batch operations', { error });
    res.status(500).json({ 
      error: 'File operations error',
      message: error.message
    });
  }
});

router.post('/builds/fast-build', async (req, res) => {
  try {
    const { projectId, language, code } = req.body;
    
    if (language && code) {
      const result = await codeExecutor.execute(language, code, { timeout: 60000 });
      return res.json({
        success: result.exitCode === 0,
        projectId,
        language,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        buildTime: result.executionTime,
        message: 'Built via unified executor'
      });
    }

    res.json({
      success: true,
      projectId,
      language,
      buildTime: 0,
      message: 'Build operations handled by unified executor'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Build service error',
      message: error.message
    });
  }
});

// AI/ML Code Analysis (Python Service)
router.post('/ai/code-analysis', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'ai-ml',
      '/api/code/analyze',
      'POST',
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'AI analysis service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// Machine Learning Training (Python Service)
router.post('/ml/train-model', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'ai-ml',
      '/api/ml/train',
      'POST',
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'ML training service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// ML Training Status (Python Service)
router.get('/ml/training-status/:jobId', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'ai-ml',
      `/api/ml/training/${req.params.jobId}`,
      'GET'
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'ML training service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// Text Analysis (Python Service)
router.post('/ai/text-analysis', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'ai-ml',
      '/api/text/analyze',
      'POST',
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'Text analysis service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// Advanced Data Processing (Python Service)
router.post('/data/advanced-processing', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'data-analysis',
      '/api/data/process',
      'POST',
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'Data processing service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// AI Inference (Python Service)
router.post('/ai/inference', async (req, res) => {
  try {
    const result = await getCoordinator().forwardRequest(
      'ai-ml',
      '/api/ai/inference',
      'POST',
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(503).json({ 
      error: 'AI inference service unavailable',
      message: error.message,
      service: 'python-ml'
    });
  }
});

// Smart Service Router
router.post('/smart-route', async (req, res) => {
  try {
    const { operation, data, requestType } = req.body;
    const dataSize = JSON.stringify(data || {}).length;
    
    const serviceUrl = getCoordinator().selectOptimalService(requestType, dataSize);
    
    if (!serviceUrl) {
      return res.status(503).json({
        error: 'No available service for request type',
        requestType,
        dataSize
      });
    }

    let endpoint = '/';
    if (requestType.includes('ml') || requestType.includes('ai')) {
      endpoint = '/api/ai/inference';
    } else if (requestType.includes('file') || requestType.includes('container')) {
      endpoint = '/api/files/batch';
    }

    const response = await fetch(`${serviceUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, data, requestType })
    });

    const result = await response.json();
    
    res.json({
      result,
      routedTo: serviceUrl,
      requestType,
      dataSize,
      processingTime: Date.now() - parseInt(req.headers['x-start-time'] || '0')
    });

  } catch (error) {
    res.status(500).json({
      error: 'Smart routing failed',
      message: error.message
    });
  }
});

// Service Capabilities Discovery
router.get('/polyglot/capabilities', (req, res) => {
  res.json({
    services: {
      typescript: {
        port: process.env.PORT || 5000,
        capabilities: [
          'User authentication and session management',
          'Database operations with Drizzle ORM', 
          'REST API endpoints',
          'Project management',
          'File serving and basic operations',
          'Container orchestration via unified executor',
          'Batch file operations',
          'Real-time WebSocket connections',
          'Build pipelines via unified executor',
          'Terminal session management',
          'Multi-language code execution (Go, Python, JavaScript, etc.)'
        ],
        endpoints: ['/api/projects', '/api/users', '/api/auth', '/api/files', '/api/containers', '/api/build', '/api/execute']
      },
      'python-ml': {
        port: process.env.PYTHON_ML_PORT || 8081,
        capabilities: [
          'Advanced code analysis and optimization suggestions',
          'Machine learning model training and inference',
          'Natural language processing and text analysis',
          'Data processing with NumPy/Pandas', 
          'AI-powered code completion and generation'
        ],
        endpoints: ['/api/code/analyze', '/api/ml/train', '/api/text/analyze', '/api/data/process']
      }
    },
    routing: {
      'file-operations': 'typescript',
      'container-orchestration': 'typescript',
      'real-time': 'typescript',
      'builds': 'typescript',
      'code-execution': 'typescript',
      'ai-ml': 'python-ml',
      'data-analysis': 'python-ml',
      'text-processing': 'python-ml',
      'code-analysis': 'python-ml',
      'web-api': 'typescript',
      'user-management': 'typescript',
      'database': 'typescript'
    }
  });
});

// Performance benchmarking endpoint
router.get('/polyglot/benchmark', async (req, res) => {
  const benchmarks = [];
  
  for (const [serviceName, endpoint] of [
    ['typescript', `http://localhost:${process.env.PORT || 5000}/health/liveness`],
    ['python-ml', `http://localhost:${process.env.PYTHON_ML_PORT || 8081}/health`]
  ]) {
    const startTime = Date.now();
    try {
      const response = await fetch(endpoint as string);
      const responseTime = Date.now() - startTime;
      benchmarks.push({
        service: serviceName,
        responseTime,
        status: response.ok ? 'healthy' : 'unhealthy'
      });
    } catch (error) {
      benchmarks.push({
        service: serviceName,
        responseTime: -1,
        status: 'unavailable',
        error: error.message
      });
    }
  }
  
  res.json({
    benchmarks,
    timestamp: new Date().toISOString(),
    fastest: benchmarks.reduce((prev, curr) => 
      prev.responseTime < curr.responseTime && prev.responseTime > 0 ? prev : curr
    )
  });
});

export default router;
