/**
 * Runtime service for PLOT projects
 * This module handles project runtime management, execution, and monitoring
 */

import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Project, File } from '@shared/schema';
import { storage } from './storage';
import * as runtimeManager from './runtimes/runtime-manager';
import { Language } from './runtimes/languages';
import { log } from './vite';
import { WebSocket } from 'ws';

// Map of active project processes
const activeProjects = new Map<number, {
  process: ChildProcess;
  logs: string[];
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
  port?: number;
  containerId?: string;
  logClients: Set<WebSocket>;
}>();

/**
 * Start a project's runtime
 */
export async function startProject(projectId: number): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // Check if already running
    if (activeProjects.has(projectId) && 
        activeProjects.get(projectId)!.status === 'running') {
      const project = activeProjects.get(projectId)!;
      return {
        success: true,
        url: project.url
      };
    }
    
    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      return {
        success: false,
        error: 'Project not found'
      };
    }
    
    // Get project files
    const files = await storage.getFilesByProject(projectId);
    if (!files.length) {
      return {
        success: false,
        error: 'No files found in project'
      };
    }

    // Init logs if not existing
    if (!activeProjects.has(projectId)) {
      activeProjects.set(projectId, {
        process: null as unknown as ChildProcess,
        logs: [],
        status: 'starting',
        logClients: new Set()
      });
    }
    
    const projectData = activeProjects.get(projectId)!;
    projectData.logs.push('Starting project...');
    
    // Get environmental variables
    const env = {
      PORT: '8080',
      NODE_ENV: 'development',
      ...process.env
    };
    
    // Start the project using runtime manager
    const runtime = await runtimeManager.startProject(project, files, {
      environmentVariables: env,
      port: 8080,
      useNix: false
    });
    
    // Handle runtime errors
    if (!runtime.success) {
      projectData.status = 'error';
      projectData.logs.push(`Error starting project: ${runtime.error}`);
      broadcastLogsToClients(projectId, `Error starting project: ${runtime.error}`);
      
      return {
        success: false,
        error: runtime.error
      };
    }
    
    // Update active project info
    projectData.status = 'running';
    projectData.port = runtime.port;
    projectData.containerId = runtime.containerId;
    projectData.url = `http://localhost:${runtime.port}`;
    projectData.logs.push(...runtime.logs);
    projectData.logs.push(`Project started successfully on port ${runtime.port}`);
    
    // Broadcast logs to connected clients
    broadcastLogsToClients(projectId, `Project started successfully on port ${runtime.port}`);
    
    // Set up log streaming
    const stopLogging = runtimeManager.streamProjectLogs(projectId, (log) => {
      projectData.logs.push(log);
      broadcastLogsToClients(projectId, log);
    });
    
    // Update project when the process exits
    projectData.process = {
      on: (event: string, callback: () => void) => {
        if (event === 'exit') {
          // Save the callback to be called when stopping
          const originalStop = projectData.process.kill;
          projectData.process.kill = () => {
            callback();
            originalStop();
          };
        }
      },
      kill: () => {
        stopLogging();
        runtimeManager.stopProject(projectId);
      }
    } as unknown as ChildProcess;
    
    return {
      success: true,
      url: projectData.url
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error starting project: ${errorMessage}`, 'runtime', 'error');
    
    if (activeProjects.has(projectId)) {
      const projectData = activeProjects.get(projectId)!;
      projectData.status = 'error';
      projectData.logs.push(`Error: ${errorMessage}`);
      broadcastLogsToClients(projectId, `Error: ${errorMessage}`);
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Stop a project's runtime
 */
export async function stopProject(projectId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!activeProjects.has(projectId)) {
      return {
        success: false,
        error: 'Project not running'
      };
    }
    
    const projectData = activeProjects.get(projectId)!;
    
    // Kill the process if it exists
    if (projectData.process) {
      projectData.process.kill();
    }
    
    projectData.status = 'stopped';
    projectData.logs.push('Project stopped');
    broadcastLogsToClients(projectId, 'Project stopped');
    
    // Stop the runtime
    await runtimeManager.stopProject(projectId);
    
    // Remove from active projects
    activeProjects.delete(projectId);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Error stopping project: ${errorMessage}`, 'runtime', 'error');
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get the status of a project's runtime
 */
export function getProjectStatus(projectId: number): {
  isRunning: boolean;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'unknown';
  logs: string[];
  url?: string;
} {
  if (!activeProjects.has(projectId)) {
    return {
      isRunning: false,
      status: 'unknown',
      logs: []
    };
  }
  
  const project = activeProjects.get(projectId)!;
  
  return {
    isRunning: project.status === 'running',
    status: project.status,
    logs: project.logs,
    url: project.url
  };
}

/**
 * Attach to project logs stream
 */
export function attachToProjectLogs(
  projectId: number,
  client: WebSocket,
  sendMessage: (message: string) => void
): void {
  // Initialize project data if not exists
  if (!activeProjects.has(projectId)) {
    activeProjects.set(projectId, {
      process: null as unknown as ChildProcess,
      logs: [],
      status: 'stopped',
      logClients: new Set()
    });
  }
  
  const projectData = activeProjects.get(projectId)!;
  
  // Add client to the set
  projectData.logClients.add(client);
  
  // Send existing logs
  for (const log of projectData.logs) {
    sendMessage(log);
  }
  
  // Handle disconnect
  client.on('close', () => {
    projectData.logClients.delete(client);
  });
}

/**
 * Broadcast log messages to all connected clients
 */
function broadcastLogsToClients(projectId: number, message: string): void {
  if (!activeProjects.has(projectId)) return;
  
  const projectData = activeProjects.get(projectId)!;
  
  for (const client of projectData.logClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'log',
        data: message
      }));
    }
  }
}

/**
 * Check if runtime dependencies are available
 */
export async function checkRuntimeDependencies(): Promise<{
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
  languages?: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }>;
}> {
  try {
    // Use the more detailed system dependencies directly
    try {
      const runtimeHealth = await import('./runtimes/runtime-health');
      const systemDeps = await runtimeHealth.checkSystemDependencies();
      
      return {
        docker: systemDeps.docker,
        nix: systemDeps.nix,
        languages: systemDeps.languages
      };
    } catch (error) {
      // If runtime-health module is not available, fall back to basic check
      // First check using the runtime manager
      const runtimeDeps = await runtimeManager.checkRuntimeDependencies();
      
      // Direct pass-through of the runtime dependencies
      return runtimeDeps;
    }
  } catch (error) {
    log(`Error checking runtime dependencies: ${error}`, 'runtime', 'error');
    return { 
      docker: { available: false, error: error instanceof Error ? error.message : 'Unknown error' },
      nix: { available: false, error: error instanceof Error ? error.message : 'Unknown error' },
      languages: {}
    };
  }
}

/**
 * Create default files for a new project
 */
export function getDefaultProjectFiles(language: Language): { name: string, content: string, isFolder: boolean }[] {
  return runtimeManager.createDefaultProject(language);
}

/**
 * Execute a command in a project runtime
 */
export async function executeProjectCommand(projectId: number, command: string): Promise<{
  success: boolean;
  output: string;
}> {
  return runtimeManager.executeCommand(projectId, command);
}