import { storage } from '../storage';
import * as path from 'path';

export interface SearchResult {
  type: 'file' | 'project' | 'user' | 'code';
  id: number;
  name: string;
  description?: string;
  match: {
    line?: number;
    column?: number;
    text?: string;
    context?: string;
  };
  score: number;
}

export interface SearchOptions {
  query: string;
  userId?: number;
  projectId?: number;
  type?: 'all' | 'files' | 'projects' | 'users' | 'code';
  limit?: number;
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  fileExtensions?: string[];
}

export class SearchEngine {
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      userId,
      projectId,
      type = 'all',
      limit = 50,
      caseSensitive = false,
      regex = false,
      wholeWord = false,
      fileExtensions = []
    } = options;

    const results: SearchResult[] = [];

    // Build search pattern
    const searchPattern = this.buildSearchPattern(query, { caseSensitive, regex, wholeWord });

    // Search based on type
    if (type === 'all' || type === 'projects') {
      const projectResults = await this.searchProjects(searchPattern, userId, limit);
      results.push(...projectResults);
    }

    if (type === 'all' || type === 'files') {
      const fileResults = await this.searchFiles(searchPattern, userId, projectId, fileExtensions, limit);
      results.push(...fileResults);
    }

    if (type === 'all' || type === 'code') {
      const codeResults = await this.searchCode(searchPattern, userId, projectId, fileExtensions, limit);
      results.push(...codeResults);
    }

    if (type === 'all' || type === 'users') {
      const userResults = await this.searchUsers(searchPattern, limit);
      results.push(...userResults);
    }

    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private buildSearchPattern(
    query: string,
    options: { caseSensitive: boolean; regex: boolean; wholeWord: boolean }
  ): RegExp {
    let pattern = query;

    if (!options.regex) {
      // Escape special regex characters
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    const flags = options.caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  }

  private async searchProjects(
    pattern: RegExp,
    userId?: number,
    limit?: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Get projects based on user access
    let projects;
    if (userId) {
      projects = await storage.getProjectsByUser(userId);
      // Also get projects where user is a collaborator
      const collaborations = await storage.getUserCollaborations(userId);
      for (const collab of collaborations) {
        const project = await storage.getProject(collab.projectId);
        if (project) {
          projects.push(project);
        }
      }
    } else {
      // Only search public projects
      projects = await storage.getPublicProjects();
    }

    for (const project of projects) {
      let score = 0;

      // Search in project name
      const nameMatches = project.name.match(pattern);
      if (nameMatches) {
        score += nameMatches.length * 10;
      }

      // Search in description
      if (project.description) {
        const descMatches = project.description.match(pattern);
        if (descMatches) {
          score += descMatches.length * 5;
        }
      }

      if (score > 0) {
        results.push({
          type: 'project',
          id: project.id,
          name: project.name,
          description: project.description || undefined,
          match: {},
          score
        });
      }
    }

    return results;
  }

  private async searchFiles(
    pattern: RegExp,
    userId?: number,
    projectId?: number,
    fileExtensions: string[],
    limit?: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let files;

    if (projectId) {
      // Search in specific project
      files = await storage.getFilesByProject(projectId);
    } else if (userId) {
      // Search in all user's projects
      files = [];
      const projects = await storage.getProjectsByUser(userId);
      for (const project of projects) {
        const projectFiles = await storage.getFilesByProject(project.id);
        files.push(...projectFiles);
      }
    } else {
      return []; // Can't search files without context
    }

    for (const file of files) {
      if (file.isFolder) continue;

      // Check file extension filter
      if (fileExtensions.length > 0) {
        const ext = path.extname(file.name).toLowerCase();
        if (!fileExtensions.includes(ext)) continue;
      }

      // Search in filename
      const matches = file.name.match(pattern);
      if (matches) {
        results.push({
          type: 'file',
          id: file.id,
          name: file.name,
          match: {},
          score: matches.length * 8
        });
      }
    }

    return results;
  }

  private async searchCode(
    pattern: RegExp,
    userId?: number,
    projectId?: number,
    fileExtensions: string[],
    limit?: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let files;

    if (projectId) {
      files = await storage.getFilesByProject(projectId);
    } else if (userId) {
      files = [];
      const projects = await storage.getProjectsByUser(userId);
      for (const project of projects) {
        const projectFiles = await storage.getFilesByProject(project.id);
        files.push(...projectFiles);
      }
    } else {
      return [];
    }

    for (const file of files) {
      if (file.isFolder || !file.content) continue;

      // Check file extension filter
      if (fileExtensions.length > 0) {
        const ext = path.extname(file.name).toLowerCase();
        if (!fileExtensions.includes(ext)) continue;
      }

      // Search in file content
      const lines = file.content.split('\n');
      let fileScore = 0;

      lines.forEach((line, lineIndex) => {
        const matches = line.match(pattern);
        if (matches) {
          fileScore += matches.length;

          // Get context (surrounding lines)
          const contextStart = Math.max(0, lineIndex - 2);
          const contextEnd = Math.min(lines.length - 1, lineIndex + 2);
          const context = lines.slice(contextStart, contextEnd + 1).join('\n');

          results.push({
            type: 'code',
            id: file.id,
            name: file.name,
            match: {
              line: lineIndex + 1,
              column: line.indexOf(matches[0]) + 1,
              text: line.trim(),
              context
            },
            score: matches.length * 5
          });
        }
      });
    }

    return results;
  }

  private async searchUsers(pattern: RegExp, limit?: number): Promise<SearchResult[]> {
    // In real implementation, this would search users
    // For now, returning empty array
    return [];
  }

  async searchByFileType(
    userId: number,
    extensions: string[]
  ): Promise<Array<{ id: number; name: string; projectId: number }>> {
    const results = [];
    const projects = await storage.getProjectsByUser(userId);

    for (const project of projects) {
      const files = await storage.getFilesByProject(project.id);
      
      for (const file of files) {
        if (file.isFolder) continue;
        
        const ext = path.extname(file.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push({
            id: file.id,
            name: file.name,
            projectId: project.id
          });
        }
      }
    }

    return results;
  }

  async getRecentSearches(userId: number, limit = 10): Promise<string[]> {
    // In real implementation, this would fetch from a search history table
    return [];
  }

  async saveSearchQuery(userId: number, query: string): Promise<void> {
    // In real implementation, this would save to a search history table
  }
}

export const searchEngine = new SearchEngine();