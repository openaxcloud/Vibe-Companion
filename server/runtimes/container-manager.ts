/**
 * Container manager for PLOT runtime
 * This module handles container-based execution environments
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Language, languageConfigs } from './languages';
import { createLogger } from '../utils/logger';

const logger = createLogger('container');

// Map to track active containers and their processes
const activeContainers: Map<string, {
  process: ChildProcess,
  logs: string[],
  status: 'starting' | 'running' | 'error',
  error?: string,
  port?: number
}> = new Map();

// Interface for container configuration
interface ContainerConfig {
  projectId: number;
  language: Language;
  projectDir: string;
  environmentVariables?: Record<string, string>;
  port?: number;
}

// Container creation result
interface ContainerResult {
  containerId: string;
  status: 'starting' | 'running' | 'error';
  error?: string;
  logs: string[];
  port?: number;
}

/**
 * Creates and starts a container for a project
 */
export async function createContainer(config: ContainerConfig): Promise<ContainerResult> {
  const { projectId, language, projectDir, environmentVariables = {}, port } = config;
  const languageConfig = languageConfigs[language];
  const containerId = `plot-${projectId}-${Date.now()}`;
  
  try {
    // Prepare project directory
    await prepareProjectDir(projectDir, language);
    
    // Set up Docker run command with appropriate image based on language
    const dockerImage = getDockerImage(language);
    const containerPort = port || 8080;
    const hostPort = port || 8080;
    
    // Prepare environment variables for the container
    const envArgs = Object.entries(environmentVariables).map(([key, value]) => 
      `--env ${key}=${value}`
    ).join(' ');
    
    // Construct the Docker run command
    const dockerCommand = `docker run --name ${containerId} -d -p ${hostPort}:${containerPort} -v ${projectDir}:/app ${envArgs} ${dockerImage}`;
    
    logger.info(`Starting container for project ${projectId} with language ${language}`);
    
    // Start the container
    const containerProcess = spawn('sh', ['-c', dockerCommand]);
    const logs: string[] = [];
    
    containerProcess.stdout.on('data', (data: Buffer) => {
      const logEntry = data.toString().trim();
      logs.push(logEntry);
      logger.info(`[Container ${containerId}] ${logEntry}`);
    });
    
    containerProcess.stderr.on('data', (data: Buffer) => {
      const logEntry = data.toString().trim();
      logs.push(`ERROR: ${logEntry}`);
      logger.error(`[Container ${containerId}] ${logEntry}`);
    });
    
    // Handle container exit
    containerProcess.on('exit', (code: number | null) => {
      if (code !== 0) {
        const errorMsg = `Container exited with code ${code}`;
        logs.push(`ERROR: ${errorMsg}`);
        logger.error(`[Container ${containerId}] ${errorMsg}`);
        
        if (activeContainers.has(containerId)) {
          const container = activeContainers.get(containerId)!;
          container.status = 'error';
          container.error = errorMsg;
        }
      } else {
        logger.info(`[Container ${containerId}] Container stopped`);
        
        if (activeContainers.has(containerId)) {
          const container = activeContainers.get(containerId)!;
          container.status = 'error';
        }
      }
    });
    
    // Store the container in the active containers map
    activeContainers.set(containerId, {
      process: containerProcess,
      logs,
      status: 'starting',
      port: containerPort
    });
    
    // Wait for container to start
    await new Promise<void>((resolve) => {
      // Check if container is running
      const checkInterval = setInterval(() => {
        const checkProcess = spawn('docker', ['ps', '--filter', `name=${containerId}`, '--format', '{{.Status}}']);
        let output = '';
        
        checkProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        checkProcess.on('close', () => {
          if (output.includes('Up')) {
            clearInterval(checkInterval);
            if (activeContainers.has(containerId)) {
              const container = activeContainers.get(containerId)!;
              container.status = 'running';
            }
            resolve();
          }
        });
      }, 500);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (activeContainers.has(containerId)) {
          const container = activeContainers.get(containerId)!;
          if (container.status === 'starting') {
            container.status = 'error';
            container.error = 'Container startup timed out';
            logs.push('ERROR: Container startup timed out');
            resolve();
          }
        }
      }, 30000);
    });
    
    const container = activeContainers.get(containerId)!;
    
    // Execute run command in container
    if (container.status === 'running') {
      const runCommand = languageConfig.runCommand;
      const execCommand = `docker exec -d ${containerId} sh -c "cd /app && ${runCommand}"`;
      
      logger.info(`Running command in container: ${runCommand}`);
      
      const execProcess = spawn('sh', ['-c', execCommand]);
      
      execProcess.stdout.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        logs.push(logEntry);
        logger.info(`[Container ${containerId}] ${logEntry}`);
      });
      
      execProcess.stderr.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        logs.push(`ERROR: ${logEntry}`);
        logger.error(`[Container ${containerId}] ${logEntry}`);
      });
    }
    
    return {
      containerId,
      status: container.status,
      error: container.error,
      logs: container.logs,
      port: container.port
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error creating container: ${errorMessage}`);
    
    return {
      containerId,
      status: 'error',
      error: errorMessage,
      logs: [`ERROR: ${errorMessage}`]
    };
  }
}

/**
 * Stops and removes a container
 */
export async function stopContainer(containerId: string): Promise<boolean> {
  try {
    logger.info(`Stopping container ${containerId}`);
    
    // Check if container exists
    const containerExists = await new Promise<boolean>((resolve) => {
      const checkProcess = spawn('docker', ['ps', '-a', '--filter', `name=${containerId}`, '--format', '{{.ID}}']);
      let output = '';
      
      checkProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      checkProcess.on('close', () => {
        resolve(output.trim().length > 0);
      });
    });
    
    if (!containerExists) {
      logger.error(`Container ${containerId} does not exist`);
      return false;
    }
    
    // Stop the container
    await new Promise<void>((resolve, reject) => {
      const stopProcess = spawn('docker', ['stop', containerId]);
      
      stopProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to stop container ${containerId}`));
        }
      });
    });
    
    // Remove the container
    await new Promise<void>((resolve, reject) => {
      const rmProcess = spawn('docker', ['rm', containerId]);
      
      rmProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to remove container ${containerId}`));
        }
      });
    });
    
    // Update active containers map
    if (activeContainers.has(containerId)) {
      const container = activeContainers.get(containerId)!;
      container.status = 'error';
      container.process.kill();
      activeContainers.delete(containerId);
    }
    
    logger.info(`Container ${containerId} stopped and removed`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error stopping container: ${errorMessage}`);
    return false;
  }
}

/**
 * Get the status of a container
 */
export function getContainerStatus(containerId: string): {
  status: 'starting' | 'running' | 'error' | 'unknown';
  error?: string;
  logs: string[];
  port?: number;
} {
  if (activeContainers.has(containerId)) {
    const container = activeContainers.get(containerId)!;
    
    return {
      status: container.status,
      error: container.error,
      logs: container.logs,
      port: container.port
    };
  }
  
  return {
    status: 'unknown',
    logs: []
  };
}

/**
 * Stream container logs
 */
export function streamContainerLogs(containerId: string, callback: (log: string) => void): () => void {
  if (!activeContainers.has(containerId)) {
    callback(`ERROR: Container ${containerId} not found`);
    return () => {};
  }
  
  const container = activeContainers.get(containerId)!;
  
  // Send existing logs
  container.logs.forEach(log => callback(log));
  
  // Set up log streaming
  const logProcess = spawn('docker', ['logs', '-f', containerId]);
  
  logProcess.stdout.on('data', (data: Buffer) => {
    const logEntry = data.toString().trim();
    container.logs.push(logEntry);
    callback(logEntry);
  });
  
  logProcess.stderr.on('data', (data: Buffer) => {
    const logEntry = `ERROR: ${data.toString().trim()}`;
    container.logs.push(logEntry);
    callback(logEntry);
  });
  
  // Return cleanup function
  return () => {
    logProcess.kill();
  };
}

/**
 * Prepare the project directory for container use
 */
async function prepareProjectDir(projectDir: string, language: Language): Promise<void> {
  const languageConfig = languageConfigs[language];
  
  // Create Dockerfile based on language
  const dockerfile = getDockerfile(language);
  fs.writeFileSync(path.join(projectDir, 'Dockerfile'), dockerfile);
  
  // Create docker-compose.yml for easier management
  const dockerCompose = getDockerCompose(language);
  fs.writeFileSync(path.join(projectDir, 'docker-compose.yml'), dockerCompose);
}

/**
 * Get Docker image based on language
 */
function getDockerImage(language: Language): string {
  switch (language) {
    case 'nodejs':
    case 'typescript':
      return 'node:18-alpine';
    case 'python':
      return 'python:3.11-slim';
    case 'java':
      return 'openjdk:17-slim';
    case 'go':
      return 'golang:1.20-alpine';
    case 'ruby':
      return 'ruby:3.2-slim';
    case 'rust':
      return 'rust:1.70-slim';
    case 'php':
      return 'php:8.2-apache';
    case 'c':
    case 'cpp':
      return 'gcc:12.2.0';
    case 'csharp':
      return 'mcr.microsoft.com/dotnet/sdk:7.0';
    case 'swift':
      return 'swift:5.8';
    case 'kotlin':
      return 'openjdk:17-slim'; // Use OpenJDK for Kotlin
    case 'dart':
      return 'dart:stable';
    case 'bash':
      return 'alpine:3.17';
    case 'html-css-js':
      return 'nginx:alpine';
    case 'nix':
      return 'nixos/nix:latest';
    case 'deno':
      return 'denoland/deno:latest';
    default:
      return 'alpine:latest';
  }
}

/**
 * Get Dockerfile content based on language
 */
function getDockerfile(language: Language): string {
  switch (language) {
    case 'nodejs':
      return `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 8080
CMD ["npm", "start"]`;

    case 'typescript':
      return `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm install -g ts-node typescript
EXPOSE 8080
CMD ["npm", "start"]`;

    case 'python':
      return `FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8080
CMD ["python", "main.py"]`;

    case 'java':
      return `FROM openjdk:17-slim
WORKDIR /app
COPY . .
RUN javac Main.java
CMD ["java", "Main"]`;

    case 'go':
      return `FROM golang:1.20-alpine
WORKDIR /app
COPY . .
RUN go mod download
EXPOSE 8080
CMD ["go", "run", "main.go"]`;

    case 'ruby':
      return `FROM ruby:3.2-slim
WORKDIR /app
COPY . .
RUN if [ -f Gemfile ]; then bundle install; fi
EXPOSE 8080
CMD ["ruby", "main.rb"]`;

    case 'rust':
      return `FROM rust:1.70-slim
WORKDIR /app
COPY . .
RUN if [ -f Cargo.toml ]; then cargo build; else rustc main.rs; fi
CMD ["./main"]`;

    case 'php':
      return `FROM php:8.2-apache
WORKDIR /var/www/html
COPY . .
EXPOSE 80
CMD ["php", "-S", "0.0.0.0:80"]`;

    case 'c':
      return `FROM gcc:12.2.0
WORKDIR /app
COPY . .
RUN gcc -o main main.c
CMD ["./main"]`;

    case 'cpp':
      return `FROM gcc:12.2.0
WORKDIR /app
COPY . .
RUN g++ -o main main.cpp
CMD ["./main"]`;

    case 'csharp':
      return `FROM mcr.microsoft.com/dotnet/sdk:7.0
WORKDIR /app
COPY . .
RUN dotnet restore
RUN dotnet build
EXPOSE 8080
CMD ["dotnet", "run"]`;

    case 'swift':
      return `FROM swift:5.8
WORKDIR /app
COPY . .
RUN swift build
CMD ["swift", "run"]`;

    case 'kotlin':
      return `FROM openjdk:17-slim
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y curl unzip
RUN curl -s https://get.sdkman.io | bash
RUN bash -c "source $HOME/.sdkman/bin/sdkman-init.sh && sdk install kotlin"
RUN bash -c "source $HOME/.sdkman/bin/sdkman-init.sh && kotlinc Main.kt -include-runtime -d Main.jar"
CMD ["java", "-jar", "Main.jar"]`;

    case 'dart':
      return `FROM dart:stable
WORKDIR /app
COPY . .
RUN dart pub get
CMD ["dart", "main.dart"]`;

    case 'bash':
      return `FROM alpine:3.17
WORKDIR /app
COPY . .
CMD ["sh", "script.sh"]`;

    case 'html-css-js':
      return `FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY . .
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

    case 'nix':
      return `FROM nixos/nix:latest
WORKDIR /app
COPY . .
CMD ["nix-build"]`;

    case 'deno':
      return `FROM denoland/deno:latest
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["deno", "run", "--allow-net", "index.ts"]`;

    default:
      return `FROM alpine:latest
WORKDIR /app
COPY . .
CMD ["sh", "-c", "echo 'No specific runtime configured for this language'"]`;
  }
}

/**
 * Get docker-compose.yml content based on language
 */
function getDockerCompose(language: Language): string {
  const imageName = getDockerImage(language);
  let port = '8080:8080';
  
  // Specific port mappings for certain languages
  if (language === 'php') {
    port = '80:80';
  } else if (language === 'html-css-js') {
    port = '80:80';
  }
  
  return `version: '3'
services:
  app:
    build: .
    image: ${imageName}
    volumes:
      - ./:/app
    ports:
      - "${port}"
    restart: unless-stopped
`;
}

/**
 * Install dependencies for a project
 */
export async function installDependencies(containerId: string, language: Language): Promise<boolean> {
  try {
    const languageConfig = languageConfigs[language];
    
    if (!languageConfig.installCommand) {
      return true; // No install command needed
    }
    
    logger.info(`Installing dependencies for container ${containerId} with language ${language}`);
    
    const execCommand = `docker exec ${containerId} sh -c "cd /app && ${languageConfig.installCommand}"`;
    
    return new Promise<boolean>((resolve) => {
      const installProcess = spawn('sh', ['-c', execCommand]);
      
      let output = '';
      
      installProcess.stdout.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += logEntry + '\n';
        
        if (activeContainers.has(containerId)) {
          activeContainers.get(containerId)!.logs.push(logEntry);
        }
        
        logger.info(`[Container ${containerId}] ${logEntry}`);
      });
      
      installProcess.stderr.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += 'ERROR: ' + logEntry + '\n';
        
        if (activeContainers.has(containerId)) {
          activeContainers.get(containerId)!.logs.push(`ERROR: ${logEntry}`);
        }
        
        logger.error(`[Container ${containerId}] ${logEntry}`);
      });
      
      installProcess.on('close', (code) => {
        const success = code === 0;
        
        if (!success) {
          logger.error(`Failed to install dependencies for container ${containerId}`);
          
          if (activeContainers.has(containerId)) {
            activeContainers.get(containerId)!.logs.push(`ERROR: Failed to install dependencies (exit code ${code})`);
          }
        } else {
          logger.info(`Successfully installed dependencies for container ${containerId}`);
          
          if (activeContainers.has(containerId)) {
            activeContainers.get(containerId)!.logs.push('Successfully installed dependencies');
          }
        }
        
        resolve(success);
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error installing dependencies: ${errorMessage}`);
    
    if (activeContainers.has(containerId)) {
      activeContainers.get(containerId)!.logs.push(`ERROR: ${errorMessage}`);
    }
    
    return false;
  }
}

/**
 * Execute a command in a container
 */
export async function executeCommand(containerId: string, command: string): Promise<{
  success: boolean;
  output: string;
}> {
  try {
    logger.info(`Executing command in container ${containerId}: ${command}`);
    
    const execCommand = `docker exec ${containerId} sh -c "cd /app && ${command}"`;
    
    return new Promise<{ success: boolean; output: string }>((resolve) => {
      const execProcess = spawn('sh', ['-c', execCommand]);
      
      let output = '';
      
      execProcess.stdout.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += logEntry + '\n';
        
        if (activeContainers.has(containerId)) {
          activeContainers.get(containerId)!.logs.push(logEntry);
        }
        
        logger.info(`[Container ${containerId}] ${logEntry}`);
      });
      
      execProcess.stderr.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += 'ERROR: ' + logEntry + '\n';
        
        if (activeContainers.has(containerId)) {
          activeContainers.get(containerId)!.logs.push(`ERROR: ${logEntry}`);
        }
        
        logger.error(`[Container ${containerId}] ${logEntry}`);
      });
      
      execProcess.on('close', (code) => {
        const success = code === 0;
        
        if (!success) {
          logger.error(`Command execution failed in container ${containerId} with exit code ${code}`);
        } else {
          logger.info(`Command execution succeeded in container ${containerId}`);
        }
        
        resolve({ success, output });
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error executing command: ${errorMessage}`);
    
    return {
      success: false,
      output: `ERROR: ${errorMessage}`
    };
  }
}

/**
 * Check if Docker is installed and running
 */
export async function checkDockerAvailability(): Promise<boolean> {
  try {
    logger.info('Checking Docker availability');
    return new Promise<boolean>((resolve) => {
      const dockerProcess = spawn('docker', ['info']);
      
      dockerProcess.on('close', (code) => {
        const isAvailable = code === 0;
        if (isAvailable) {
          logger.info('Docker is available on the system');
        } else {
          logger.warn('Docker is not available on the system');
        }
        resolve(isAvailable);
      });
    });
  } catch (error) {
    logger.error('Error checking Docker availability');
    return false;
  }
}

/**
 * Get Docker version information
 */
export async function getDockerVersion(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    logger.info('Getting Docker version');
    const dockerProcess = spawn('docker', ['version', '--format', '{{.Server.Version}}']);
    
    let versionOutput = '';
    
    dockerProcess.stdout.on('data', (data) => {
      versionOutput += data.toString().trim();
    });
    
    dockerProcess.on('close', (code) => {
      if (code === 0 && versionOutput) {
        logger.info(`Docker version: ${versionOutput}`);
        resolve(versionOutput);
      } else {
        logger.error('Failed to get Docker version');
        reject(new Error('Failed to get Docker version'));
      }
    });
    
    dockerProcess.on('error', (error) => {
      logger.error(`Error getting Docker version: ${error.message}`);
      reject(error);
    });
  });
}