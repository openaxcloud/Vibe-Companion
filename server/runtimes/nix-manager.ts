/**
 * Nix configuration manager for PLOT runtime
 * This module handles Nix configuration for reproducible environments
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Language, languageConfigs } from './languages';
import { createLogger } from '../utils/logger';

const logger = createLogger('nix');

// Interface for Nix configuration options
interface NixConfig {
  packages: string[];
  buildInputs?: string[];
  shellHook?: string;
  environmentVariables?: Record<string, string>;
}

/**
 * Generate a Nix configuration file for a project
 */
export async function generateNixConfig(
  projectDir: string,
  language: Language,
  options: Partial<NixConfig> = {}
): Promise<boolean> {
  try {
    logger.info(`Generating Nix configuration for ${language}`);
    
    const nixConfig = generateLanguageNixConfig(language, options);
    const nixFilePath = path.join(projectDir, 'replit.nix');
    
    fs.writeFileSync(nixFilePath, nixConfig);
    
    // Also generate the .replit file with run command
    const replitConfig = generateECodeConfig(language);
    const replitFilePath = path.join(projectDir, '.replit');
    
    fs.writeFileSync(replitFilePath, replitConfig);
    
    logger.info(`Nix configuration generated successfully`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error generating Nix configuration: ${errorMessage}`);
    return false;
  }
}

/**
 * Apply Nix environment to a project
 */
export async function applyNixEnvironment(projectDir: string): Promise<{
  success: boolean;
  output: string;
}> {
  try {
    logger.info(`Applying Nix environment to ${projectDir}`);
    
    const nixShellCommand = `cd ${projectDir} && nix-shell replit.nix --run "echo 'Nix environment applied successfully'"`;
    
    return new Promise<{ success: boolean; output: string }>((resolve) => {
      const nixProcess = spawn('sh', ['-c', nixShellCommand]);
      
      let output = '';
      
      nixProcess.stdout.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += logEntry + '\n';
        logger.info(`[Nix] ${logEntry}`);
      });
      
      nixProcess.stderr.on('data', (data: Buffer) => {
        const logEntry = data.toString().trim();
        output += 'ERROR: ' + logEntry + '\n';
        logger.error(`[Nix] ${logEntry}`);
      });
      
      nixProcess.on('close', (code) => {
        const success = code === 0;
        
        if (!success) {
          logger.error(`Failed to apply Nix environment with exit code ${code}`);
        } else {
          logger.info(`Successfully applied Nix environment`);
        }
        
        resolve({ success, output });
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error applying Nix environment: ${errorMessage}`);
    
    return {
      success: false,
      output: `ERROR: ${errorMessage}`
    };
  }
}

/**
 * Check if Nix is installed
 */
export async function checkNixAvailability(): Promise<boolean> {
  try {
    logger.info('Checking Nix availability');
    
    return new Promise<boolean>((resolve) => {
      const nixProcess = spawn('nix', ['--version']);
      
      nixProcess.on('close', (code) => {
        const isAvailable = code === 0;
        if (isAvailable) {
          logger.info('Nix is available on the system');
        } else {
          logger.warn('Nix is not available on the system');
        }
        resolve(isAvailable);
      });
    });
  } catch (error) {
    logger.error('Error checking Nix availability');
    return false;
  }
}

/**
 * Get Nix version information
 */
export async function getNixVersion(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    logger.info('Getting Nix version');
    const nixProcess = spawn('nix', ['--version']);
    
    let versionOutput = '';
    
    nixProcess.stdout.on('data', (data) => {
      versionOutput += data.toString().trim();
    });
    
    nixProcess.on('close', (code) => {
      if (code === 0 && versionOutput) {
        logger.info(`Nix version: ${versionOutput}`);
        resolve(versionOutput);
      } else {
        logger.error('Failed to get Nix version');
        reject(new Error('Failed to get Nix version'));
      }
    });
    
    nixProcess.on('error', (error) => {
      logger.error(`Error getting Nix version: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Generate a language-specific Nix configuration
 */
function generateLanguageNixConfig(language: Language, options: Partial<NixConfig> = {}): string {
  const { packages = [], buildInputs = [], shellHook = '', environmentVariables = {} } = options;
  
  // Base packages for all environments
  const basePackages = ['pkgs.bashInteractive'];
  
  // Language-specific packages
  const languagePackages = getLanguageNixPackages(language);
  
  // Combine all packages
  const allPackages = [...basePackages, ...languagePackages, ...packages];
  
  // Environment variables
  const envVars = {
    // Default environment variables
    LANG: 'en_US.UTF-8',
    TERM: 'xterm-256color',
    ...environmentVariables
  };
  
  // Generate environment variables string
  const envVarsStr = Object.entries(envVars)
    .map(([key, value]) => `    ${key} = "${value}";`)
    .join('\n');
  
  // Generate build inputs string
  const buildInputsStr = buildInputs.length > 0 ? 
    `\n\n  buildInputs = [\n    ${buildInputs.join('\n    ')}\n  ];` : '';
  
  // Generate shell hook
  const shellHookStr = shellHook ? 
    `\n\n  shellHook = ''
    ${shellHook}
  '';` : '';
  
  // Final Nix configuration
  return `{ pkgs }: {
  deps = [
    ${allPackages.join('\n    ')}
  ];${buildInputsStr}

  env = {
${envVarsStr}
  };${shellHookStr}
}`;
}

/**
 * Get language-specific Nix packages
 */
function getLanguageNixPackages(language: Language): string[] {
  switch (language) {
    case 'nodejs':
    case 'typescript':
      return ['pkgs.nodejs-18_x', 'pkgs.nodePackages.typescript', 'pkgs.yarn'];
      
    case 'python':
      return ['pkgs.python311', 'pkgs.poetry', 'pkgs.pip'];
      
    case 'java':
      return ['pkgs.jdk17', 'pkgs.gradle', 'pkgs.maven'];
      
    case 'go':
      return ['pkgs.go', 'pkgs.gotools', 'pkgs.gopls'];
      
    case 'ruby':
      return ['pkgs.ruby_3_2', 'pkgs.bundler', 'pkgs.rubyPackages.solargraph'];
      
    case 'rust':
      return ['pkgs.rustc', 'pkgs.cargo', 'pkgs.rustfmt', 'pkgs.rust-analyzer'];
      
    case 'php':
      return ['pkgs.php82', 'pkgs.composer', 'pkgs.phpPackages.psalm'];
      
    case 'c':
    case 'cpp':
      return ['pkgs.gcc', 'pkgs.gdb', 'pkgs.gnumake', 'pkgs.cmake'];
      
    case 'csharp':
      return ['pkgs.dotnet-sdk_7', 'pkgs.omnisharp-roslyn'];
      
    case 'swift':
      return ['pkgs.swift'];
      
    case 'kotlin':
      return ['pkgs.kotlin', 'pkgs.jdk17'];
      
    case 'dart':
      return ['pkgs.dart', 'pkgs.flutter'];
      
    case 'bash':
      return ['pkgs.bashInteractive', 'pkgs.shellcheck'];
      
    case 'html-css-js':
      return ['pkgs.nodejs-18_x', 'pkgs.yarn', 'pkgs.emmet-ls'];
      
    case 'nix':
      return ['pkgs.nix', 'pkgs.nixpkgs-fmt'];
      
    case 'deno':
      return ['pkgs.deno'];
      
    default:
      return [];
  }
}

/**
 * Generate .replit configuration
 */
function generateECodeConfig(language: Language): string {
  const config = languageConfigs[language];
  
  return `run = "${config.runCommand}"
language = "${language}"

[nix]
channel = "stable-22_11"

[languages.${language}]
pattern = "**/*.{${config.fileExtensions.map(ext => ext.replace('.', '')).join(',')}}"

[env]
PATH = "/home/runner/$REPL_SLUG/.config/npm/node_global/bin:/home/runner/$REPL_SLUG/node_modules/.bin"
`;
}