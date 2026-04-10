// @ts-nocheck
/**
 * Real Package Management Service
 * Provides actual package installation and management via npm, pip, etc.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { dockerExecutor } from '../execution/docker-executor';

const logger = createLogger('real-package-manager');

export interface PackageInstallRequest {
  projectId: number;
  packages: string[];
  language: string;
  dev?: boolean;
  global?: boolean;
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  latest?: string;
  installed?: boolean;
  dependencies?: Record<string, string>;
}

export interface PackageInstallResult {
  success: boolean;
  installedPackages: PackageInfo[];
  output: string[];
  error?: string;
  updatedFiles?: Array<{
    path: string;
    content: string;
  }>;
}

export class RealPackageManager {
  private packageManagers: Map<string, {
    install: (packages: string[], options: any) => string[];
    uninstall: (packages: string[]) => string[];
    list: () => string[];
    search: (query: string) => string[];
    lockFile: string;
    manifestFile: string;
  }>;

  constructor() {
    this.packageManagers = new Map();
    this.setupPackageManagers();
  }

  private setupPackageManagers() {
    // Node.js / npm
    this.packageManagers.set('nodejs', {
      install: (packages, options) => {
        const cmd = ['npm', 'install'];
        if (options.dev) cmd.push('--save-dev');
        if (options.global) cmd.push('-g');
        return [...cmd, ...packages];
      },
      uninstall: (packages) => ['npm', 'uninstall', ...packages],
      list: () => ['npm', 'list', '--json'],
      search: (query) => ['npm', 'search', query, '--json'],
      lockFile: 'package-lock.json',
      manifestFile: 'package.json'
    });

    // Python / pip
    this.packageManagers.set('python', {
      install: (packages, options) => {
        const cmd = ['pip', 'install'];
        if (options.dev) cmd.push('--dev');
        return [...cmd, ...packages];
      },
      uninstall: (packages) => ['pip', 'uninstall', '-y', ...packages],
      list: () => ['pip', 'list', '--format=json'],
      search: (query) => ['pip', 'search', query],
      lockFile: 'requirements.txt',
      manifestFile: 'requirements.txt'
    });

    // Ruby / gem
    this.packageManagers.set('ruby', {
      install: (packages, options) => {
        const cmd = ['gem', 'install'];
        return [...cmd, ...packages];
      },
      uninstall: (packages) => ['gem', 'uninstall', ...packages],
      list: () => ['gem', 'list', '--local'],
      search: (query) => ['gem', 'search', query],
      lockFile: 'Gemfile.lock',
      manifestFile: 'Gemfile'
    });

    // Go modules
    this.packageManagers.set('go', {
      install: (packages, options) => ['go', 'get', ...packages],
      uninstall: (packages) => ['go', 'mod', 'edit', ...packages.map(p => `-droprequire=${p}`)],
      list: () => ['go', 'list', '-m', 'all'],
      search: (query) => ['go', 'list', '-m', '-versions', query],
      lockFile: 'go.sum',
      manifestFile: 'go.mod'
    });

    // Rust / cargo
    this.packageManagers.set('rust', {
      install: (packages, options) => {
        const cmd = ['cargo', 'add'];
        if (options.dev) cmd.push('--dev');
        return [...cmd, ...packages];
      },
      uninstall: (packages) => ['cargo', 'remove', ...packages],
      list: () => ['cargo', 'tree'],
      search: (query) => ['cargo', 'search', query],
      lockFile: 'Cargo.lock',
      manifestFile: 'Cargo.toml'
    });

    // PHP / composer
    this.packageManagers.set('php', {
      install: (packages, options) => {
        const cmd = ['composer', 'require'];
        if (options.dev) cmd.push('--dev');
        return [...cmd, ...packages];
      },
      uninstall: (packages) => ['composer', 'remove', ...packages],
      list: () => ['composer', 'show', '--format=json'],
      search: (query) => ['composer', 'search', query],
      lockFile: 'composer.lock',
      manifestFile: 'composer.json'
    });
  }

  async installPackages(request: PackageInstallRequest): Promise<PackageInstallResult> {
    const manager = this.packageManagers.get(request.language);
    if (!manager) {
      return {
        success: false,
        installedPackages: [],
        output: [],
        error: `Unsupported language: ${request.language}`
      };
    }

    try {
      // Get project files
      const project = await storage.getProject(request.projectId);
      const files = await storage.getFilesByProject(request.projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Install packages in container
      const installCmd = manager.install(request.packages, {
        dev: request.dev,
        global: request.global
      });

      logger.info(`Installing packages: ${installCmd.join(' ')}`);

      // Execute in container
      const result = await dockerExecutor.executeProject({
        projectId: request.projectId,
        language: request.language,
        command: installCmd.join(' '),
        files,
        timeout: 300 // 5 minute timeout for package installation
      });

      // Wait for completion
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await dockerExecutor.getContainerStatus(result.containerId);
          if (status?.status === 'stopped') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      // Get updated manifest files
      const updatedFiles = await this.getUpdatedManifestFiles(
        result.containerId,
        manager,
        request.projectId
      );

      // Parse installed packages
      const installedPackages = await this.parseInstalledPackages(
        result.output,
        request.language,
        request.packages
      );

      // Stop container
      await dockerExecutor.stopContainer(result.containerId);

      return {
        success: result.exitCode === 0,
        installedPackages,
        output: result.output,
        error: result.exitCode !== 0 ? result.errorOutput.join('\n') : undefined,
        updatedFiles
      };

    } catch (error) {
      logger.error(`Package installation failed: ${error}`);
      return {
        success: false,
        installedPackages: [],
        output: [],
        error: error.message
      };
    }
  }

  async uninstallPackages(
    projectId: number,
    packages: string[],
    language: string
  ): Promise<PackageInstallResult> {
    const manager = this.packageManagers.get(language);
    if (!manager) {
      return {
        success: false,
        installedPackages: [],
        output: [],
        error: `Unsupported language: ${language}`
      };
    }

    try {
      const project = await storage.getProject(projectId);
      const files = await storage.getFilesByProject(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      const uninstallCmd = manager.uninstall(packages);
      logger.info(`Uninstalling packages: ${uninstallCmd.join(' ')}`);

      const result = await dockerExecutor.executeProject({
        projectId,
        language,
        command: uninstallCmd.join(' '),
        files,
        timeout: 300
      });

      // Wait for completion
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await dockerExecutor.getContainerStatus(result.containerId);
          if (status?.status === 'stopped') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      const updatedFiles = await this.getUpdatedManifestFiles(
        result.containerId,
        manager,
        projectId
      );

      await dockerExecutor.stopContainer(result.containerId);

      return {
        success: result.exitCode === 0,
        installedPackages: [],
        output: result.output,
        error: result.exitCode !== 0 ? result.errorOutput.join('\n') : undefined,
        updatedFiles
      };

    } catch (error) {
      logger.error(`Package uninstallation failed: ${error}`);
      return {
        success: false,
        installedPackages: [],
        output: [],
        error: error.message
      };
    }
  }

  async searchPackages(
    query: string,
    language: string
  ): Promise<PackageInfo[]> {
    const manager = this.packageManagers.get(language);
    if (!manager) {
      return [];
    }

    try {
      // Create temporary container for search
      const result = await dockerExecutor.executeProject({
        projectId: -1, // Temporary
        language,
        command: manager.search(query).join(' '),
        files: [],
        timeout: 30
      });

      // Wait for completion
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await dockerExecutor.getContainerStatus(result.containerId);
          if (status?.status === 'stopped') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      const packages = await this.parseSearchResults(
        result.output,
        language
      );

      await dockerExecutor.stopContainer(result.containerId);

      return packages;

    } catch (error) {
      logger.error(`Package search failed: ${error}`);
      return [];
    }
  }

  async listInstalledPackages(
    projectId: number,
    language: string
  ): Promise<PackageInfo[]> {
    const manager = this.packageManagers.get(language);
    if (!manager) {
      return [];
    }

    try {
      const project = await storage.getProject(projectId);
      const files = await storage.getFilesByProject(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      const listCmd = manager.list();
      
      const result = await dockerExecutor.executeProject({
        projectId,
        language,
        command: listCmd.join(' '),
        files,
        timeout: 60
      });

      // Wait for completion
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await dockerExecutor.getContainerStatus(result.containerId);
          if (status?.status === 'stopped') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      const packages = await this.parseListResults(
        result.output,
        language
      );

      await dockerExecutor.stopContainer(result.containerId);

      return packages;

    } catch (error) {
      logger.error(`Package listing failed: ${error}`);
      return [];
    }
  }

  private async getUpdatedManifestFiles(
    containerId: string,
    manager: any,
    projectId: number
  ): Promise<Array<{ path: string; content: string }>> {
    const updatedFiles: Array<{ path: string; content: string }> = [];

    try {
      // Get manifest file content
      const manifestResult = await dockerExecutor.executeCommand(
        containerId,
        ['cat', `/app/${manager.manifestFile}`]
      );

      if (manifestResult.exitCode === 0) {
        updatedFiles.push({
          path: manager.manifestFile,
          content: manifestResult.output
        });

        // Update in storage
        const files = await storage.getFilesByProject(projectId);
        const manifestFile = files.find(f => f.name === manager.manifestFile);
        
        if (manifestFile) {
          await storage.updateFile(manifestFile.id, {
            content: manifestResult.output
          });
        } else {
          await storage.createFile({
            projectId,
            name: manager.manifestFile,
            content: manifestResult.output,
            isFolder: false
          });
        }
      }

      // Get lock file content if exists
      const lockResult = await dockerExecutor.executeCommand(
        containerId,
        ['cat', `/app/${manager.lockFile}`]
      );

      if (lockResult.exitCode === 0) {
        updatedFiles.push({
          path: manager.lockFile,
          content: lockResult.output
        });

        // Update in storage
        const lockFile = files.find(f => f.name === manager.lockFile);
        
        if (lockFile) {
          await storage.updateFile(lockFile.id, {
            content: lockResult.output
          });
        } else {
          await storage.createFile({
            projectId,
            name: manager.lockFile,
            content: lockResult.output,
            isFolder: false
          });
        }
      }

    } catch (error) {
      logger.error(`Failed to get updated manifest files: ${error}`);
    }

    return updatedFiles;
  }

  private async parseInstalledPackages(
    output: string[],
    language: string,
    requestedPackages: string[]
  ): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];

    // Language-specific parsing
    switch (language) {
      case 'nodejs':
        // npm outputs package info during install
        for (const line of output) {
          if (line.includes('added') && line.includes('package')) {
            // Extract package info from npm output
            const match = line.match(/added (\d+) packages?/);
            if (match) {
              // Return requested packages as installed
              return requestedPackages.map(name => ({
                name,
                version: 'latest',
                installed: true
              }));
            }
          }
        }
        break;

      case 'python':
        // pip outputs installed package info
        for (const line of output) {
          if (line.includes('Successfully installed')) {
            const installed = line.split('Successfully installed')[1].trim();
            const pkgs = installed.split(' ');
            for (const pkg of pkgs) {
              const [name, version] = pkg.split('-');
              if (name) {
                packages.push({
                  name,
                  version: version || 'latest',
                  installed: true
                });
              }
            }
          }
        }
        break;

      default:
        // Generic parsing - assume success if no errors
        if (output.some(line => line.toLowerCase().includes('success') || 
                               line.toLowerCase().includes('installed'))) {
          return requestedPackages.map(name => ({
            name,
            version: 'latest',
            installed: true
          }));
        }
    }

    return packages.length > 0 ? packages : requestedPackages.map(name => ({
      name,
      version: 'unknown',
      installed: true
    }));
  }

  private async parseSearchResults(
    output: string[],
    language: string
  ): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];
    const outputStr = output.join('\n');

    try {
      switch (language) {
        case 'nodejs':
          // npm search returns JSON
          const npmData = JSON.parse(outputStr);
          for (const pkg of npmData) {
            packages.push({
              name: pkg.name,
              version: pkg.version,
              description: pkg.description,
              latest: pkg.version
            });
          }
          break;

        case 'python':
          // pip search output parsing
          for (const line of output) {
            const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+-\s+(.+)$/);
            if (match) {
              packages.push({
                name: match[1],
                version: match[2],
                description: match[3]
              });
            }
          }
          break;

        default:
          // Generic line-based parsing
          for (const line of output) {
            if (line.trim() && !line.startsWith(' ')) {
              const parts = line.split(/\s+/);
              if (parts.length >= 1) {
                packages.push({
                  name: parts[0],
                  version: parts[1] || 'latest'
                });
              }
            }
          }
      }
    } catch (error) {
      logger.error(`Failed to parse search results: ${error}`);
    }

    return packages;
  }

  private async parseListResults(
    output: string[],
    language: string
  ): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];
    const outputStr = output.join('\n');

    try {
      switch (language) {
        case 'nodejs':
          // npm list returns JSON
          const npmData = JSON.parse(outputStr);
          const parseDependencies = (deps: any, installed = true) => {
            for (const [name, info] of Object.entries(deps || {})) {
              packages.push({
                name,
                version: (info as any).version || 'unknown',
                installed
              });
            }
          };
          parseDependencies(npmData.dependencies);
          break;

        case 'python':
          // pip list returns JSON with --format=json
          const pipData = JSON.parse(outputStr);
          for (const pkg of pipData) {
            packages.push({
              name: pkg.name,
              version: pkg.version,
              installed: true
            });
          }
          break;

        default:
          // Generic parsing
          for (const line of output) {
            if (line.trim()) {
              const parts = line.split(/\s+/);
              if (parts.length >= 2) {
                packages.push({
                  name: parts[0],
                  version: parts[1],
                  installed: true
                });
              }
            }
          }
      }
    } catch (error) {
      logger.error(`Failed to parse list results: ${error}`);
    }

    return packages;
  }
}

export const realPackageManager = new RealPackageManager();