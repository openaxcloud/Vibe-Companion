/**
 * Runtime health monitoring
 * This module provides health checks and monitoring for language runtimes
 */

import * as http from 'http';
import * as os from 'os';
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger';
import * as containerManager from './container-manager';
import * as nixManager from './nix-manager';

const logger = createLogger('runtime-health');

/**
 * Check if a container is healthy by checking if it responds to HTTP requests
 */
export async function checkContainerHealth(containerId: string, port: number): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
}> {
  try {
    logger.info(`Checking health of container ${containerId} on port ${port}`);
    
    // First check if container is still running
    const containerStatus = containerManager.getContainerStatus(containerId);
    
    if (containerStatus.status !== 'running') {
      logger.warn(`Container ${containerId} is not running (status: ${containerStatus.status})`);
      return {
        healthy: false,
        error: `Container is ${containerStatus.status}`
      };
    }
    
    // Try to connect to the container's port
    return new Promise((resolve) => {
      const startTime = Date.now();
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/',
        method: 'HEAD',
        timeout: 5000 // 5 second timeout
      }, (res) => {
        const responseTime = Date.now() - startTime;
        logger.info(`Container ${containerId} responded with status ${res.statusCode} in ${responseTime}ms`);
        
        // Any response is considered healthy
        resolve({
          healthy: true,
          responseTime
        });
      });
      
      req.on('error', (error) => {
        logger.warn(`Health check failed for container ${containerId}: ${error.message}`);
        resolve({
          healthy: false,
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        logger.warn(`Health check timed out for container ${containerId}`);
        req.destroy();
        resolve({
          healthy: false,
          error: 'Connection timed out'
        });
      });
      
      req.end();
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error checking container health: ${errorMessage}`);
    
    return {
      healthy: false,
      error: errorMessage
    };
  }
}

/**
 * Check system-wide dependencies for language runtimes
 */
export async function checkSystemDependencies(): Promise<{
  docker: {
    available: boolean;
    version?: string;
    error?: string;
  };
  nix: {
    available: boolean;
    version?: string;
    error?: string;
  };
  languages: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }>;
}> {
  logger.info('Checking system dependencies for language runtimes');
  
  // Check Docker availability with version info
  let dockerInfo = {
    available: false,
    version: undefined,
    error: undefined
  };
  
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
    dockerInfo = {
      available: true,
      version: dockerVersion
    };
  } catch (error) {
    dockerInfo.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  // Check Nix availability with version info
  let nixInfo = {
    available: false,
    version: undefined,
    error: undefined
  };
  
  try {
    const nixVersion = execSync('nix --version', { encoding: 'utf8' }).trim();
    nixInfo = {
      available: true,
      version: nixVersion
    };
  } catch (error) {
    nixInfo.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  // Check common language interpreters/compilers
  const languages: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }> = {};
  
  const languageCommands = {
    nodejs: 'node --version',
    python: 'python --version',
    python3: 'python3 --version',
    java: 'java -version',
    go: 'go version',
    ruby: 'ruby --version',
    rust: 'rustc --version',
    php: 'php --version',
    gcc: 'gcc --version',
    dotnet: 'dotnet --version',
    swift: 'swift --version',
    kotlin: 'kotlin -version',
    dart: 'dart --version',
    typescript: 'tsc --version',
    bash: 'bash --version',
    deno: 'deno --version'
  };
  
  // Check each language
  for (const [language, command] of Object.entries(languageCommands)) {
    try {
      // Use stderr for commands that output to stderr (like java -version)
      const stdio = language === 'java' ? 'pipe' : 'pipe';
      const version = execSync(command, { encoding: 'utf8', stdio }).trim();
      
      languages[language] = {
        available: true,
        version
      };
    } catch (error) {
      languages[language] = {
        available: false,
        error: error instanceof Error ? error.message : 'Command failed'
      };
    }
  }
  
  return {
    docker: dockerInfo,
    nix: nixInfo,
    languages
  };
}

/**
 * Get health status of all active containers
 */
/**
 * Get current CPU usage (1 minute load average)
 */
export function getCpuUsage(): number {
  try {
    return os.loadavg()[0]; // 1 minute load average
  } catch (error) {
    logger.error(`Error getting CPU usage: ${error}`);
    return 0;
  }
}

/**
 * Get current memory usage as a percentage string (e.g., "65.42%")
 */
export function getMemoryUsage(): string {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2);
    return `${memoryUsage}%`;
  } catch (error) {
    logger.error(`Error getting memory usage: ${error}`);
    return "0%";
  }
}

export async function getHealthStatus(activeContainers: Map<string, {
  port?: number;
  status: string;
}>): Promise<{
  [containerId: string]: {
    healthy: boolean;
    responseTime?: number;
    error?: string;
    status: string;
  };
}> {
  const healthStatus: {
    [containerId: string]: {
      healthy: boolean;
      responseTime?: number;
      error?: string;
      status: string;
    };
  } = {};
  
  // Check health of each container
  for (const [containerId, containerInfo] of activeContainers.entries()) {
    if (containerInfo.status === 'running' && containerInfo.port) {
      const health = await checkContainerHealth(containerId, containerInfo.port);
      
      healthStatus[containerId] = {
        ...health,
        status: containerInfo.status
      };
    } else {
      healthStatus[containerId] = {
        healthy: false,
        status: containerInfo.status,
        error: `Container is ${containerInfo.status}`
      };
    }
  }
  
  return healthStatus;
}