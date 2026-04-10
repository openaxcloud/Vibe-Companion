import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { storage } from '../storage';
import { replitDB } from '../database/replitdb';

export interface ExportOptions {
  projectId: number;
  includeEnvVars?: boolean;
  includeDatabase?: boolean;
  includeGitHistory?: boolean;
  format?: 'zip' | 'tar';
}

export interface ExportResult {
  filename: string;
  path: string;
  size: number;
  checksum: string;
}

export class ProjectExporter {
  private exportPath: string;

  constructor() {
    this.exportPath = path.join(process.cwd(), '.exports');
    this.initializeExportDir();
  }

  private async initializeExportDir() {
    try {
      await fs.mkdir(this.exportPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize export directory:', error);
    }
  }

  async exportProject(options: ExportOptions): Promise<ExportResult> {
    const { projectId, includeEnvVars = false, includeDatabase = false, includeGitHistory = false, format = 'zip' } = options;

    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Create export filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '-')}-export-${timestamp}.${format}`;
    const exportFilePath = path.join(this.exportPath, filename);

    // Create archive
    const output = await fs.open(exportFilePath, 'w');
    const archive = format === 'zip' 
      ? archiver('zip', { zlib: { level: 9 } })
      : archiver('tar', { gzip: true });

    archive.pipe(output.createWriteStream());

    // Add project metadata
    const metadata = {
      projectId: project.id,
      projectName: project.name,
      description: project.description,
      language: project.language,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'project.json' });

    // Add project files
    const files = await storage.getFilesByProject(projectId);
    for (const file of files) {
      if (!file.isFolder && file.content) {
        const filePath = file.name; // In real implementation, this would include the full path
        archive.append(file.content, { name: filePath });
      }
    }

    // Add environment variables if requested
    if (includeEnvVars) {
      const envVars = await storage.getEnvironmentVariables(projectId);
      const envContent = envVars
        .filter(v => !v.isSecret) // Don't export secrets
        .map(v => `${v.key}=${v.value}`)
        .join('\n');
      
      if (envContent) {
        archive.append(envContent, { name: '.env.example' });
      }

      // Create a separate file listing secret keys
      const secretKeys = envVars
        .filter(v => v.isSecret)
        .map(v => v.key);
      
      if (secretKeys.length > 0) {
        archive.append(
          `# Secret environment variables (values not included for security):\n${secretKeys.join('\n')}`,
          { name: '.env.secrets' }
        );
      }
    }

    // Add database if requested
    if (includeDatabase) {
      const dbExport = await replitDB.export(projectId);
      archive.append(dbExport, { name: 'database.json' });
    }

    // Add git history if requested and available
    if (includeGitHistory) {
      const gitPath = path.join(process.cwd(), 'projects', `project-${projectId}`, '.git');
      try {
        const gitExists = await fs.access(gitPath).then(() => true).catch(() => false);
        if (gitExists) {
          archive.directory(gitPath, '.git');
        }
      } catch (error) {
        console.error('Failed to include git history:', error);
      }
    }

    // Add README
    const readmeContent = `# ${project.name}

${project.description || 'No description provided.'}

## Export Information
- Exported on: ${new Date().toISOString()}
- Language: ${project.language}
- Includes: ${[
  'Project files',
  includeEnvVars && 'Environment variables',
  includeDatabase && 'Database',
  includeGitHistory && 'Git history'
].filter(Boolean).join(', ')}

## Import Instructions
1. Create a new project in your IDE
2. Upload this archive using the import feature
3. ${includeEnvVars ? 'Set up your secret environment variables listed in .env.secrets' : ''}
4. Run the project

## Notes
- Secret environment variables are not included for security reasons
- Check .env.secrets for a list of required secret keys
`;

    archive.append(readmeContent, { name: 'README.md' });

    // Finalize archive
    await archive.finalize();
    await output.close();

    // Calculate checksum
    const fileBuffer = await fs.readFile(exportFilePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Get file size
    const stats = await fs.stat(exportFilePath);

    return {
      filename,
      path: exportFilePath,
      size: stats.size,
      checksum
    };
  }

  async getExportedFiles(): Promise<Array<{
    filename: string;
    size: number;
    createdAt: Date;
  }>> {
    try {
      const files = await fs.readdir(this.exportPath);
      const fileDetails = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(this.exportPath, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            createdAt: stats.birthtime
          };
        })
      );
      
      return fileDetails.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to get exported files:', error);
      return [];
    }
  }

  async deleteExport(filename: string): Promise<void> {
    const filePath = path.join(this.exportPath, filename);
    await fs.unlink(filePath);
  }

  async cleanupOldExports(daysToKeep = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    try {
      const files = await fs.readdir(this.exportPath);
      
      for (const filename of files) {
        const filePath = path.join(this.exportPath, filename);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old exports:', error);
    }
    
    return deletedCount;
  }
}

export const projectExporter = new ProjectExporter();