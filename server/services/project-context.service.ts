// @ts-nocheck
import { IStorage } from '../storage';

export interface ProjectContext {
  fileTree: string[];
  currentFile: { path: string; content: string };
  relatedFiles: { path: string; content: string; relation: 'import' | 'sibling' | 'parent' }[];
  recentEdits?: { path: string; timestamp: Date; action: string }[];
}

const MAX_RELATED_FILES_SIZE = 50 * 1024; // 50KB limit for related files content

export class ProjectContextService {
  constructor(private storage: IStorage) {}

  async getContextForFile(
    projectId: string,
    filePath: string,
    fileContent: string
  ): Promise<ProjectContext> {
    const projectFiles = await this.storage.getFilesByProject(projectId);
    const fileTree = projectFiles.map(f => f.path);
    
    const language = this.detectLanguage(filePath);
    const importPaths = this.parseImports(fileContent, language);
    
    const relatedFiles: { path: string; content: string; relation: 'import' | 'sibling' | 'parent' }[] = [];
    let totalSize = 0;

    const resolvedImports = importPaths
      .map(importPath => this.resolveImport(importPath, filePath, fileTree))
      .filter((p): p is string => p !== null);

    for (const resolvedPath of resolvedImports) {
      if (totalSize >= MAX_RELATED_FILES_SIZE) break;
      
      const file = projectFiles.find(f => f.path === resolvedPath);
      if (file?.content) {
        const contentSize = Buffer.byteLength(file.content, 'utf8');
        if (totalSize + contentSize <= MAX_RELATED_FILES_SIZE) {
          relatedFiles.push({
            path: file.path,
            content: file.content,
            relation: 'import'
          });
          totalSize += contentSize;
        }
      }
    }

    const currentDir = this.getDirectory(filePath);
    const parentDir = this.getParentDirectory(currentDir);

    const siblings = projectFiles.filter(f => 
      f.path !== filePath &&
      this.getDirectory(f.path) === currentDir &&
      !resolvedImports.includes(f.path)
    );

    for (const sibling of siblings) {
      if (totalSize >= MAX_RELATED_FILES_SIZE) break;
      
      if (sibling.content) {
        const contentSize = Buffer.byteLength(sibling.content, 'utf8');
        if (totalSize + contentSize <= MAX_RELATED_FILES_SIZE) {
          relatedFiles.push({
            path: sibling.path,
            content: sibling.content,
            relation: 'sibling'
          });
          totalSize += contentSize;
        }
      }
    }

    if (parentDir && totalSize < MAX_RELATED_FILES_SIZE) {
      const parentFiles = projectFiles.filter(f =>
        f.path !== filePath &&
        this.getDirectory(f.path) === parentDir &&
        !resolvedImports.includes(f.path) &&
        !siblings.some(s => s.path === f.path)
      );

      for (const parentFile of parentFiles) {
        if (totalSize >= MAX_RELATED_FILES_SIZE) break;
        
        if (parentFile.content) {
          const contentSize = Buffer.byteLength(parentFile.content, 'utf8');
          if (totalSize + contentSize <= MAX_RELATED_FILES_SIZE) {
            relatedFiles.push({
              path: parentFile.path,
              content: parentFile.content,
              relation: 'parent'
            });
            totalSize += contentSize;
          }
        }
      }
    }

    let recentEdits: { path: string; timestamp: Date; action: string }[] | undefined;
    try {
      if (this.storage.getAuditLogs) {
        const logs = await this.storage.getAuditLogs({ action: 'file' });
        recentEdits = logs
          .filter(log => 
            (log.action?.includes('file') || log.action?.includes('edit')) &&
            log.details?.projectId === projectId
          )
          .slice(0, 20)
          .map(log => ({
            path: log.details?.path || log.details?.filePath || 'unknown',
            timestamp: new Date(log.timestamp),
            action: log.action
          }));
      }
    } catch {
      // Audit logs not available, skip
    }

    return {
      fileTree,
      currentFile: { path: filePath, content: fileContent },
      relatedFiles,
      recentEdits
    };
  }

  private parseImports(content: string, language: string): string[] {
    const imports: string[] = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'jsx':
      case 'tsx':
        const esImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = esImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }

        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }

        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        break;

      case 'python':
        const fromImportRegex = /from\s+([^\s]+)\s+import/g;
        while ((match = fromImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }

        const importRegex = /^import\s+([^\s,]+)/gm;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        break;

      case 'go':
        const singleImportRegex = /import\s+"([^"]+)"/g;
        while ((match = singleImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }

        const blockImportRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
        while ((match = blockImportRegex.exec(content)) !== null) {
          const blockContent = match[1];
          const packageRegex = /"([^"]+)"/g;
          let pkgMatch;
          while ((pkgMatch = packageRegex.exec(blockContent)) !== null) {
            imports.push(pkgMatch[1]);
          }
        }
        break;
    }

    return imports.filter(imp => imp.startsWith('.') || imp.startsWith('/'));
  }

  private resolveImport(
    importPath: string,
    currentFilePath: string,
    projectFiles: string[]
  ): string | null {
    const currentDir = this.getDirectory(currentFilePath);
    let resolvedPath: string;

    if (importPath.startsWith('./')) {
      resolvedPath = this.normalizePath(`${currentDir}/${importPath.slice(2)}`);
    } else if (importPath.startsWith('../')) {
      resolvedPath = this.normalizePath(`${currentDir}/${importPath}`);
    } else if (importPath.startsWith('/')) {
      resolvedPath = importPath;
    } else {
      return null;
    }

    if (projectFiles.includes(resolvedPath)) {
      return resolvedPath;
    }

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.json'];
    for (const ext of extensions) {
      const withExt = resolvedPath + ext;
      if (projectFiles.includes(withExt)) {
        return withExt;
      }
    }

    for (const ext of extensions) {
      const indexPath = `${resolvedPath}/index${ext}`;
      if (projectFiles.includes(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'py': 'python',
      'go': 'go',
      'rb': 'ruby',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php'
    };
    return languageMap[ext] || 'unknown';
  }

  private getDirectory(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash === -1 ? '' : filePath.slice(0, lastSlash);
  }

  private getParentDirectory(dir: string): string | null {
    if (!dir) return null;
    const lastSlash = dir.lastIndexOf('/');
    return lastSlash === -1 ? '' : dir.slice(0, lastSlash);
  }

  private normalizePath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.') {
        result.push(part);
      }
    }

    return result.join('/');
  }
}
