/**
 * Runtime manager for PLOT
 * This module coordinates all runtime components including containers and Nix environments
 */

import * as fs from 'fs';
import * as path from 'path';
import { Language, languageConfigs, getLanguageByExtension, getDefaultFiles } from './languages';
import * as containerManager from './container-manager';
import * as nixManager from './nix-manager';
import { createLogger } from '../utils/logger';
import { Project, File } from '@shared/schema';

const logger = createLogger('runtime');

// Map to track active project runtimes
const activeRuntimes: Map<number, {
  projectId: number;
  language: Language;
  containerId?: string;
  port?: number;
  status: 'starting' | 'running' | 'error';
  logs: string[];
  error?: string;
}> = new Map();

// Interface for starting a project
export interface StartProjectOptions {
  environmentVariables?: Record<string, string>;
  port?: number;
  useNix?: boolean;
  nixOptions?: {
    packages?: string[];
    buildInputs?: string[];
    shellHook?: string;
    environmentVariables?: Record<string, string>;
  };
}

/**
 * Start a project runtime
 */
export async function startProject(
  project: Project,
  files: File[],
  options: StartProjectOptions = {}
): Promise<{
  success: boolean;
  port?: number;
  containerId?: string;
  status: 'starting' | 'running' | 'error';
  logs: string[];
  error?: string;
}> {
  try {
    const projectId = project.id;
    
    // Check if project is already running
    if (activeRuntimes.has(projectId)) {
      const runtime = activeRuntimes.get(projectId)!;
      
      // If it's already running, return the current status
      if (runtime.status === 'running') {
        return {
          success: true,
          port: runtime.port,
          containerId: runtime.containerId,
          status: runtime.status,
          logs: runtime.logs
        };
      }
      
      // If it's in an error state, clean it up and restart
      if (runtime.status === 'error' && runtime.containerId) {
        await containerManager.stopContainer(runtime.containerId);
        activeRuntimes.delete(projectId);
      }
    }
    
    // Create project directory
    const projectDir = await createProjectDir(project, files);
    
    // Detect language from files
    const language = detectProjectLanguage(files);
    
    if (!language) {
      const error = 'Could not detect language for project';
      logger.error(error);
      
      return {
        success: false,
        status: 'error',
        logs: [error],
        error
      };
    }
    
    logger.info(`Starting project ${projectId} with language ${language}`);
    
    // Initialize runtime logs
    const logs: string[] = [`Starting ${languageConfigs[language].displayName} project...`];
    
    // Set up initial runtime entry
    activeRuntimes.set(projectId, {
      projectId,
      language,
      status: 'starting',
      logs
    });
    
    // Set up Nix environment if requested
    if (options.useNix) {
      logs.push('Setting up Nix environment...');
      
      const nixResult = await nixManager.generateNixConfig(
        projectDir,
        language,
        options.nixOptions
      );
      
      if (!nixResult) {
        const error = 'Failed to generate Nix configuration';
        logs.push(`ERROR: ${error}`);
        logger.error(error);
        
        activeRuntimes.set(projectId, {
          projectId,
          language,
          status: 'error',
          logs,
          error
        });
        
        return {
          success: false,
          status: 'error',
          logs,
          error
        };
      }
      
      logs.push('Applying Nix environment...');
      
      const applyResult = await nixManager.applyNixEnvironment(projectDir);
      
      if (!applyResult.success) {
        const error = 'Failed to apply Nix environment';
        logs.push(`ERROR: ${error}`);
        logger.error(error);
        
        activeRuntimes.set(projectId, {
          projectId,
          language,
          status: 'error',
          logs,
          error
        });
        
        return {
          success: false,
          status: 'error',
          logs,
          error
        };
      }
      
      logs.push('Nix environment set up successfully');
    }
    
    // Start container
    logs.push(`Starting ${languageConfigs[language].displayName} container...`);
    
    const containerResult = await containerManager.createContainer({
      projectId,
      language,
      projectDir,
      environmentVariables: options.environmentVariables,
      port: options.port
    });
    
    if (containerResult.status === 'error') {
      const error = containerResult.error || 'Failed to start container';
      logs.push(...containerResult.logs);
      logger.error(error);
      
      activeRuntimes.set(projectId, {
        projectId,
        language,
        status: 'error',
        logs,
        error
      });
      
      return {
        success: false,
        status: 'error',
        logs,
        error
      };
    }
    
    logs.push(...containerResult.logs);
    logs.push('Container started successfully');
    
    // Install dependencies
    logs.push('Installing dependencies...');
    
    const installResult = await containerManager.installDependencies(
      containerResult.containerId,
      language
    );
    
    if (!installResult) {
      logs.push('WARNING: Dependency installation may not have completed successfully');
      logger.warn('Dependency installation may not have completed successfully');
    } else {
      logs.push('Dependencies installed successfully');
    }
    
    // Update runtime status
    activeRuntimes.set(projectId, {
      projectId,
      language,
      containerId: containerResult.containerId,
      port: containerResult.port,
      status: 'running',
      logs
    });
    
    return {
      success: true,
      port: containerResult.port,
      containerId: containerResult.containerId,
      status: 'running',
      logs
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error starting project: ${errorMessage}`);
    
    return {
      success: false,
      status: 'error',
      logs: [`ERROR: ${errorMessage}`],
      error: errorMessage
    };
  }
}

/**
 * Stop a project runtime
 */
export async function stopProject(projectId: number): Promise<boolean> {
  try {
    logger.info(`Stopping project ${projectId}`);
    
    if (!activeRuntimes.has(projectId)) {
      logger.warn(`Project ${projectId} is not running`);
      return false;
    }
    
    const runtime = activeRuntimes.get(projectId)!;
    
    if (!runtime.containerId) {
      logger.warn(`Project ${projectId} does not have a container ID`);
      activeRuntimes.delete(projectId);
      return false;
    }
    
    // Stop the container
    const result = await containerManager.stopContainer(runtime.containerId);
    
    if (result) {
      logger.info(`Project ${projectId} stopped successfully`);
      // Just delete the runtime - no need to set status to 'stopped' as we'll remove it
      activeRuntimes.delete(projectId);
      return true;
    } else {
      logger.error(`Failed to stop project ${projectId}`);
      runtime.status = 'error';
      runtime.error = 'Failed to stop container';
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error stopping project: ${errorMessage}`);
    return false;
  }
}

/**
 * Get the status of a project runtime
 */
export function getProjectStatus(projectId: number): {
  isRunning: boolean;
  language?: Language;
  containerId?: string;
  port?: number;
  status: 'starting' | 'running' | 'error' | 'unknown';
  logs: string[];
  error?: string;
} {
  if (!activeRuntimes.has(projectId)) {
    return {
      isRunning: false,
      status: 'unknown',
      logs: []
    };
  }
  
  const runtime = activeRuntimes.get(projectId)!;
  
  return {
    isRunning: runtime.status === 'running',
    language: runtime.language,
    containerId: runtime.containerId,
    port: runtime.port,
    status: runtime.status,
    logs: runtime.logs,
    error: runtime.error
  };
}

/**
 * Execute a command in a project runtime
 */
export async function executeCommand(projectId: number, command: string): Promise<{
  success: boolean;
  output: string;
}> {
  try {
    logger.info(`Executing command in project ${projectId}: ${command}`);
    
    if (!activeRuntimes.has(projectId)) {
      const errorMessage = `Project ${projectId} is not running`;
      logger.error(errorMessage);
      
      return {
        success: false,
        output: `ERROR: ${errorMessage}`
      };
    }
    
    const runtime = activeRuntimes.get(projectId)!;
    
    if (!runtime.containerId) {
      const errorMessage = `Project ${projectId} does not have a container ID`;
      logger.error(errorMessage);
      
      return {
        success: false,
        output: `ERROR: ${errorMessage}`
      };
    }
    
    // Execute the command in the container
    const result = await containerManager.executeCommand(
      runtime.containerId,
      command
    );
    
    return result;
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
 * Stream project logs
 */
export function streamProjectLogs(projectId: number, callback: (log: string) => void): () => void {
  if (!activeRuntimes.has(projectId)) {
    const errorMessage = `Project ${projectId} is not running`;
    logger.warn(errorMessage);
    callback(`ERROR: ${errorMessage}`);
    return () => {};
  }
  
  const runtime = activeRuntimes.get(projectId)!;
  
  // Send existing logs
  runtime.logs.forEach(log => callback(log));
  
  if (!runtime.containerId) {
    const errorMessage = `Project ${projectId} does not have a container ID`;
    logger.warn(errorMessage);
    callback(`ERROR: ${errorMessage}`);
    return () => {};
  }
  
  logger.info(`Streaming logs for project ${projectId}`);
  // Stream container logs
  return containerManager.streamContainerLogs(runtime.containerId, callback);
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
  languages: Record<string, {
    available: boolean;
    version?: string;
    error?: string;
  }>;
}> {
  try {
    logger.info('Checking runtime dependencies');
    
    // Try to get Docker version info
    let dockerInfo = {
      available: false as boolean,
      version: undefined as string | undefined,
      error: undefined as string | undefined
    };
    
    try {
      const dockerAvailable = await containerManager.checkDockerAvailability();
      if (dockerAvailable) {
        try {
          const dockerVersion = await containerManager.getDockerVersion();
          dockerInfo = {
            available: true,
            version: dockerVersion,
            error: undefined
          };
          logger.info(`Docker is available, version: ${dockerVersion}`);
        } catch (err) {
          dockerInfo = {
            available: true,
            version: undefined,
            error: err instanceof Error ? err.message : 'Failed to get Docker version'
          };
          logger.warn(`Docker is available but couldn't get version: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        dockerInfo = {
          available: false,
          version: undefined,
          error: 'Docker is not available'
        };
        logger.warn('Docker is not available on the system');
      }
    } catch (err) {
      dockerInfo = {
        available: false,
        version: undefined,
        error: err instanceof Error ? err.message : 'Error checking Docker availability'
      };
      logger.error(`Error checking Docker: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Try to get Nix version info
    let nixInfo = {
      available: false as boolean,
      version: undefined as string | undefined,
      error: undefined as string | undefined
    };
    
    try {
      const nixAvailable = await nixManager.checkNixAvailability();
      if (nixAvailable) {
        try {
          const nixVersion = await nixManager.getNixVersion();
          nixInfo = {
            available: true,
            version: nixVersion,
            error: undefined
          };
          logger.info(`Nix is available, version: ${nixVersion}`);
        } catch (err) {
          nixInfo = {
            available: true,
            version: undefined,
            error: err instanceof Error ? err.message : 'Failed to get Nix version'
          };
          logger.warn(`Nix is available but couldn't get version: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        nixInfo = {
          available: false,
          version: undefined,
          error: 'Nix is not available'
        };
        logger.warn('Nix is not available on the system');
      }
    } catch (err) {
      nixInfo = {
        available: false,
        version: undefined,
        error: err instanceof Error ? err.message : 'Error checking Nix availability'
      };
      logger.error(`Error checking Nix: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // Check language availability
    // For now, we'll just return a map of language configs and their assumed availability
    // In a full implementation, we would actually check each language runtime
    const languages: Record<string, {
      available: boolean;
      version?: string;
      error?: string;
    }> = {};
    
    // Gather language info based on docker and nix availability
    if (dockerInfo.available || nixInfo.available) {
      logger.info('Checking language availability');
      
      // Get all language codes
      const languageCodes = Object.keys(languageConfigs);
      
      // For each language, check availability
      for (const code of languageCodes) {
        try {
          const config = languageConfigs[code as Language];
          if (!config) continue;
          
          // In a real implementation, we'd test each language runtime here
          // For now, we'll just say they're available if Docker or Nix is available
          languages[code] = {
            available: true,
            version: config.version || 'Unknown version',
            error: undefined
          };
        } catch (err) {
          languages[code] = {
            available: false,
            version: undefined,
            error: err instanceof Error ? err.message : `Error checking ${code}`
          };
          logger.warn(`Error checking language ${code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      logger.info(`Detected ${Object.keys(languages).length} available languages`);
    } else {
      logger.warn('No container environments available, languages will not be available');
    }
    
    return { 
      docker: dockerInfo,
      nix: nixInfo,
      languages
    };
  } catch (error) {
    logger.error(`Error checking runtime dependencies: ${error instanceof Error ? error.message : String(error)}`);
    return { 
      docker: { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      nix: { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      languages: {}
    };
  }
}

/**
 * Create a project directory with all files
 */
async function createProjectDir(project: Project, files: File[]): Promise<string> {
  const projectDir = path.join(process.cwd(), 'projects', `project-${project.id}`);
  
  logger.info(`Creating project directory for project ${project.id}`);
  
  // Create project directory if it doesn't exist
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    logger.info(`Created new project directory: ${projectDir}`);
  }
  
  // Write all files to the project directory
  let fileCount = 0;
  for (const file of files) {
    // Skip folders - we'll create them when writing files
    if (file.isFolder) continue;
    
    // Make sure parent directories exist
    const filePath = path.join(projectDir, file.name);
    const fileDir = path.dirname(filePath);
    
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Write file content
    fs.writeFileSync(filePath, file.content || '');
    fileCount++;
  }
  
  logger.info(`Wrote ${fileCount} files to project directory`);
  return projectDir;
}

/**
 * Detect the primary language of a project
 */
function detectProjectLanguage(files: File[]): Language | undefined {
  logger.info(`Detecting project language from ${files.length} files`);
  
  // Filter out folder entries
  const nonFolderFiles = files.filter(file => !file.isFolder);
  
  // If no files, return undefined
  if (nonFolderFiles.length === 0) {
    logger.warn('No files found for language detection');
    return undefined;
  }
  
  // Check for common main files
  const mainFileChecks: [string, Language][] = [
    ['package.json', 'nodejs'],
    ['tsconfig.json', 'typescript'],
    ['requirements.txt', 'python'],
    ['Cargo.toml', 'rust'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['go.mod', 'go'],
    ['Gemfile', 'ruby'],
    ['composer.json', 'php'],
    ['*.csproj', 'csharp'],
    ['CMakeLists.txt', 'cpp'],
    ['pubspec.yaml', 'dart'],
    ['*.kt', 'kotlin'],
    ['*.swift', 'swift'],
    ['index.html', 'html-css-js'],
    ['replit.nix', 'nix']
  ];
  
  // First try to detect by main file
  for (const [pattern, language] of mainFileChecks) {
    // Handle glob patterns
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      for (const file of nonFolderFiles) {
        if (regex.test(file.name)) {
          logger.info(`Language detected as ${language} by main file pattern: ${pattern}`);
          return language;
        }
      }
    } else {
      // Direct match
      for (const file of nonFolderFiles) {
        if (file.name === pattern) {
          logger.info(`Language detected as ${language} by main file: ${pattern}`);
          return language;
        }
      }
    }
  }
  
  // Count file extensions
  const extensionCounts: Record<string, number> = {};
  
  for (const file of nonFolderFiles) {
    const language = getLanguageByExtension(file.name);
    
    if (language) {
      extensionCounts[language] = (extensionCounts[language] || 0) + 1;
    }
  }
  
  // Find the most common language
  let maxCount = 0;
  let detectedLanguage: Language | undefined;
  
  for (const [language, count] of Object.entries(extensionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedLanguage = language as Language;
    }
  }
  
  if (detectedLanguage) {
    logger.info(`Language detected as ${detectedLanguage} by file extension frequency`);
  } else {
    logger.warn('Could not detect language by file extensions');
  }
  
  return detectedLanguage;
}

/**
 * Create a new project with default files for a language
 */
export function createDefaultProject(language: Language): { name: string, content: string, isFolder: boolean }[] {
  logger.info(`Creating default project files for ${language}`);
  const files = getDefaultFiles(language);
  logger.info(`Generated ${files.length} default files for ${language}`);
  return files;
}