import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// Helper function to validate and sanitize project ID
function validateProjectId(projectId: string): boolean {
  // Only allow alphanumeric characters, hyphens, and underscores
  const validIdPattern = /^[a-zA-Z0-9_-]+$/;
  return validIdPattern.test(projectId) && projectId.length <= 100;
}

// Helper function to validate package name
function validatePackageName(packageName: string): boolean {
  // Allow npm package naming conventions: @scope/package-name
  const validPackagePattern = /^(@[a-zA-Z0-9-_.]+\/)?[a-zA-Z0-9-_.]+$/;
  return validPackagePattern.test(packageName) && packageName.length <= 200;
}

// Helper function to get project directory with validation
async function getProjectDirectory(projectId: string): Promise<string> {
  // Validate project ID to prevent path traversal
  if (!validateProjectId(projectId)) {
    throw new Error('Invalid project ID format');
  }
  
  const baseDir = path.resolve(process.cwd(), 'projects');
  const projectDir = path.join(baseDir, projectId);
  
  // Ensure the resolved path is within the projects directory (prevent path traversal)
  const resolvedPath = path.resolve(projectDir);
  if (!resolvedPath.startsWith(baseDir)) {
    throw new Error('Invalid project path');
  }
  
  // Ensure directory exists
  try {
    await fs.mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  return resolvedPath;
}

// Helper function to execute commands safely
async function executeCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false // Disable shell to prevent injection
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('error', reject);
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with code ${code}: ${stderr}`);
        reject(error);
      }
    });
  });
}

export interface InstalledPackage {
  name: string;
  version: string;
  attribute?: string;
}

export class SimplePackageInstaller {
  async installPackage(projectId: string, packageName: string, language?: string): Promise<void> {
    // Validate inputs
    if (!validatePackageName(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    const projectDir = await getProjectDirectory(projectId);
    
    // Detect language from project or use provided one
    const detectedLanguage = language || await this.detectLanguage(projectDir);
    
    switch (detectedLanguage) {
      case 'nodejs':
      case 'javascript':
      case 'typescript':
        await this.installNpmPackage(projectDir, packageName);
        break;
      case 'python':
      case 'python3':
        await this.installPipPackage(projectDir, packageName);
        break;
      case 'ruby':
        await this.installGemPackage(projectDir, packageName);
        break;
      default:
        // Try npm as default
        await this.installNpmPackage(projectDir, packageName);
    }
  }
  
  async removePackage(projectId: string, packageName: string, language?: string): Promise<void> {
    // Validate inputs
    if (!validatePackageName(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    const projectDir = await getProjectDirectory(projectId);
    const detectedLanguage = language || await this.detectLanguage(projectDir);
    
    switch (detectedLanguage) {
      case 'nodejs':
      case 'javascript':
      case 'typescript':
        await executeCommand('npm', ['uninstall', packageName], projectDir);
        break;
      case 'python':
      case 'python3':
        await executeCommand('pip', ['uninstall', '-y', packageName], projectDir);
        break;
      case 'ruby':
        await executeCommand('gem', ['uninstall', packageName], projectDir);
        break;
    }
  }
  
  async getInstalledPackages(projectId: string): Promise<InstalledPackage[]> {
    const projectDir = await getProjectDirectory(projectId);
    const packages: InstalledPackage[] = [];
    
    // Check for Node.js packages
    try {
      const packageJsonPath = path.join(projectDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      for (const [name, version] of Object.entries(deps)) {
        packages.push({ name, version: version as string });
      }
    } catch (error) {
      // No package.json
    }
    
    // Check for Python packages
    try {
      const requirementsPath = path.join(projectDir, 'requirements.txt');
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      const lines = requirements.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/^([^=<>!]+)(?:[=<>!]+(.+))?$/);
        if (match) {
          packages.push({
            name: match[1].trim(),
            version: match[2]?.trim() || 'latest'
          });
        }
      }
    } catch (error) {
      // No requirements.txt
    }
    
    return packages;
  }
  
  async searchPackages(query: string, language?: string): Promise<any[]> {
    // Validate query to prevent injection
    const validQueryPattern = /^[a-zA-Z0-9-_.@/\s]+$/;
    if (!validQueryPattern.test(query) || query.length > 100) {
      throw new Error('Invalid search query');
    }
    
    // Simple search implementation
    try {
      if (language === 'python' || language === 'python3') {
        try {
          const { stdout } = await executeCommand('pip', ['search', query], process.cwd());
          return this.parsePipSearch(stdout).slice(0, 10);
        } catch (error) {
          // pip search is deprecated, return empty array
          return [];
        }
      } else {
        // Default to npm search
        try {
          const { stdout } = await executeCommand('npm', ['search', query, '--json'], process.cwd());
          const results = JSON.parse(stdout || '[]');
          return results.slice(0, 10).map((pkg: any) => ({
            name: pkg.name,
            version: pkg.version,
            description: pkg.description
          }));
        } catch (error) {
          return [];
        }
      }
    } catch (error) {
      return [];
    }
  }
  
  private async detectLanguage(projectDir: string): Promise<string> {
    // Check for package.json (file not existing is expected condition)
    try {
      await fs.access(path.join(projectDir, 'package.json'));
      return 'nodejs';
    } catch { /* File not found - check next type */ }
    
    // Check for requirements.txt
    try {
      await fs.access(path.join(projectDir, 'requirements.txt'));
      return 'python';
    } catch { /* File not found - check next type */ }
    
    // Check for Gemfile
    try {
      await fs.access(path.join(projectDir, 'Gemfile'));
      return 'ruby';
    } catch { /* File not found - use default */ }
    
    return 'nodejs'; // Default
  }
  
  private async installNpmPackage(projectDir: string, packageName: string): Promise<void> {
    // Validate package name again for safety
    if (!validatePackageName(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    // Ensure package.json exists
    try {
      await fs.access(path.join(projectDir, 'package.json'));
    } catch {
      // Create a basic package.json
      const packageJson = {
        name: 'project',
        version: '1.0.0',
        dependencies: {}
      };
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }
    
    // Install the package safely using spawn
    await executeCommand('npm', ['install', packageName], projectDir);
  }
  
  private async installPipPackage(projectDir: string, packageName: string): Promise<void> {
    // Validate package name again for safety
    if (!validatePackageName(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    // Install the package safely using spawn
    await executeCommand('pip', ['install', packageName], projectDir);
    
    // Update requirements.txt
    try {
      const requirementsPath = path.join(projectDir, 'requirements.txt');
      let requirements = '';
      
      try {
        requirements = await fs.readFile(requirementsPath, 'utf-8');
      } catch {
        // File doesn't exist yet
      }
      
      if (!requirements.includes(packageName)) {
        requirements += `\n${packageName}`;
        await fs.writeFile(requirementsPath, requirements.trim());
      }
    } catch (error) {
      console.error('Failed to update requirements.txt:', error);
    }
  }
  
  private async installGemPackage(projectDir: string, packageName: string): Promise<void> {
    // Validate package name again for safety
    if (!validatePackageName(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    await executeCommand('gem', ['install', packageName], projectDir);
  }
  
  private parsePipSearch(output: string): any[] {
    const results: any[] = [];
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\S+)\s+\(([^)]+)\)\s+-\s+(.+)$/);
      if (match) {
        results.push({
          name: match[1],
          version: match[2],
          description: match[3]
        });
      }
    }
    
    return results;
  }
}

// Export a singleton instance
export const simplePackageInstaller = new SimplePackageInstaller();