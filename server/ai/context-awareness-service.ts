import { Project, File, files, projects } from '@shared/schema';
import { storage } from '../storage';
import { db } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseAST } from '@babel/parser';
import traverse from '@babel/traverse';

interface FileContext {
  id: number;
  path: string;
  content: string;
  language: string;
  lastModified: Date;
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  dependencies: string[];
}

interface ProjectContext {
  projectId: number;
  projectName: string;
  projectLanguage: string;
  recentFiles: FileContext[];
  recentChanges: string[];
  projectStructure: any;
  dependencies: Record<string, string>;
  gitHistory: any[];
  userPatterns: UserPattern[];
}

interface UserPattern {
  action: string;
  frequency: number;
  lastOccurrence: Date;
  context: string;
}

interface ConversationMemory {
  projectId: number;
  messages: AIMessage[];
  currentIntent: string;
  suggestedActions: string[];
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: any;
  intent?: string;
}

export class ContextAwarenessService {
  private conversationMemory: Map<number, ConversationMemory> = new Map();
  private projectContextCache: Map<number, ProjectContext> = new Map();
  
  /**
   * Get comprehensive context for a project
   */
  async getProjectContext(projectId: number): Promise<ProjectContext> {
    // Check cache first
    const cached = this.projectContextCache.get(projectId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get recent files
    const recentFiles = await this.getRecentFiles(projectId);
    
    // Get recent changes from activity log
    const recentChanges = await this.getRecentChanges(projectId);
    
    // Get project structure
    const projectStructure = await this.analyzeProjectStructure(projectId);
    
    // Get dependencies
    const dependencies = await this.getProjectDependencies(projectId);
    
    // Get git history if available
    const gitHistory = await this.getGitHistory(projectId);
    
    // Analyze user patterns
    const userPatterns = await this.analyzeUserPatterns(projectId);

    const context: ProjectContext = {
      projectId,
      projectName: project.name,
      projectLanguage: project.language || 'javascript',
      recentFiles,
      recentChanges,
      projectStructure,
      dependencies,
      gitHistory,
      userPatterns
    };

    // Cache the context
    this.projectContextCache.set(projectId, context);
    
    return context;
  }

  /**
   * Analyze code context for intelligent suggestions
   */
  async analyzeCodeContext(fileId: number, cursorPosition?: { line: number; column: number }): Promise<any> {
    const file = await storage.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const fileContext = await this.parseFile(file);
    
    // Get related files (imports/exports)
    const relatedFiles = await this.getRelatedFiles(file);
    
    // Analyze current context at cursor position
    let currentContext = null;
    if (cursorPosition) {
      currentContext = await this.getContextAtPosition(file, cursorPosition);
    }

    return {
      file: fileContext,
      relatedFiles,
      currentContext,
      suggestions: await this.generateContextualSuggestions(fileContext, currentContext)
    };
  }

  /**
   * Update conversation memory with new interaction
   */
  updateConversationMemory(projectId: number, message: AIMessage) {
    let memory = this.conversationMemory.get(projectId);
    if (!memory) {
      memory = {
        projectId,
        messages: [],
        currentIntent: '',
        suggestedActions: []
      };
      this.conversationMemory.set(projectId, memory);
    }

    // Add message to history
    memory.messages.push(message);
    
    // Keep only last 50 messages for memory efficiency
    if (memory.messages.length > 50) {
      memory.messages = memory.messages.slice(-50);
    }

    // Detect intent from user message
    if (message.role === 'user') {
      memory.currentIntent = this.detectIntent(message.content);
      memory.suggestedActions = this.suggestNextActions(memory);
    }
  }

  /**
   * Get conversation context for AI responses
   */
  getConversationContext(projectId: number): ConversationMemory | undefined {
    return this.conversationMemory.get(projectId);
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): string {
    const intents = {
      'build': /\b(build|create|make|develop|implement)\b/i,
      'debug': /\b(debug|fix|error|bug|issue|problem)\b/i,
      'refactor': /\b(refactor|improve|optimize|clean)\b/i,
      'test': /\b(test|testing|unit test|coverage)\b/i,
      'deploy': /\b(deploy|deployment|production|release)\b/i,
      'documentation': /\b(document|docs|readme|comment)\b/i,
      'dependency': /\b(install|package|dependency|import|require)\b/i,
      'api': /\b(api|endpoint|route|request)\b/i,
      'database': /\b(database|db|query|migration|schema)\b/i,
      'style': /\b(style|css|design|ui|layout)\b/i
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(message)) {
        return intent;
      }
    }

    return 'general';
  }

  /**
   * Suggest next actions based on context
   */
  private suggestNextActions(memory: ConversationMemory): string[] {
    const suggestions: string[] = [];
    const { currentIntent, messages } = memory;

    switch (currentIntent) {
      case 'build':
        suggestions.push('Create project structure', 'Install dependencies', 'Set up configuration');
        break;
      case 'debug':
        suggestions.push('Run tests', 'Check logs', 'Add debugging statements');
        break;
      case 'refactor':
        suggestions.push('Extract functions', 'Improve naming', 'Remove duplication');
        break;
      case 'test':
        suggestions.push('Generate test cases', 'Run test suite', 'Check coverage');
        break;
      case 'deploy':
        suggestions.push('Build for production', 'Configure deployment', 'Check environment variables');
        break;
    }

    return suggestions;
  }

  /**
   * Parse file to extract context
   */
  private async parseFile(file: File): Promise<FileContext> {
    const content = file.content || '';
    const language = this.detectLanguage(file.name);
    
    let imports: string[] = [];
    let exports: string[] = [];
    let functions: string[] = [];
    let classes: string[] = [];
    let dependencies: string[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = parseAST(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx', 'decorators-legacy']
        });

        traverse(ast, {
          ImportDeclaration(path) {
            imports.push(path.node.source.value);
          },
          ExportDeclaration(path) {
            exports.push(path.node.type);
          },
          FunctionDeclaration(path) {
            if (path.node.id) {
              functions.push(path.node.id.name);
            }
          },
          ClassDeclaration(path) {
            if (path.node.id) {
              classes.push(path.node.id.name);
            }
          }
        });
      } catch (error) {
        // Fallback to regex-based parsing if AST parsing fails
        imports = this.extractImportsRegex(content);
        functions = this.extractFunctionsRegex(content);
        classes = this.extractClassesRegex(content);
      }
    }

    // Extract dependencies from imports
    dependencies = imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('@/'));

    return {
      id: file.id,
      path: file.name,
      content,
      language,
      lastModified: file.updatedAt || new Date(),
      imports,
      exports,
      functions,
      classes,
      dependencies
    };
  }

  /**
   * Get files that have been recently modified
   */
  private async getRecentFiles(projectId: number, limit: number = 10): Promise<FileContext[]> {
    const recentFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(desc(files.updatedAt))
      .limit(limit);

    const contexts = await Promise.all(
      recentFiles.map(file => this.parseFile(file))
    );

    return contexts;
  }

  /**
   * Get recent changes from file modifications
   */
  private async getRecentChanges(projectId: number, limit: number = 20): Promise<string[]> {
    // Since we don't have activity log, we'll track file changes
    const recentFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(desc(files.updatedAt))
      .limit(limit);

    return recentFiles.map(file => 
      `Modified ${file.name} at ${file.updatedAt}`
    );
  }

  /**
   * Analyze project structure
   */
  private async analyzeProjectStructure(projectId: number): Promise<any> {
    const allFiles = await storage.getFilesByProjectId(projectId);
    
    const structure = {
      totalFiles: allFiles.length,
      fileTypes: {} as Record<string, number>,
      directories: new Set<string>(),
      mainFiles: [] as string[],
      configFiles: [] as string[],
      testFiles: [] as string[]
    };

    for (const file of allFiles) {
      // Count file types
      const ext = path.extname(file.name).toLowerCase();
      structure.fileTypes[ext] = (structure.fileTypes[ext] || 0) + 1;

      // Track directories
      const dir = path.dirname(file.name);
      if (dir !== '.') {
        structure.directories.add(dir);
      }

      // Identify special files
      const basename = path.basename(file.name);
      if (['index', 'main', 'app'].some(name => basename.includes(name))) {
        structure.mainFiles.push(file.name);
      }
      if (['config', 'package.json', 'tsconfig.json', '.env'].some(name => basename.includes(name))) {
        structure.configFiles.push(file.name);
      }
      if (['test', 'spec', '__tests__'].some(name => file.name.includes(name))) {
        structure.testFiles.push(file.name);
      }
    }

    return {
      ...structure,
      directories: Array.from(structure.directories)
    };
  }

  /**
   * Get project dependencies
   */
  private async getProjectDependencies(projectId: number): Promise<Record<string, string>> {
    const allFiles = await storage.getFilesByProjectId(projectId);
    const packageJsonFile = allFiles.find(f => f.name === 'package.json' || f.path === 'package.json');
    
    if (packageJsonFile && packageJsonFile.content) {
      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        return {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
      } catch (error) {
        console.error('Error parsing package.json:', error);
      }
    }

    return {};
  }

  /**
   * Get git history if available
   */
  private async getGitHistory(projectId: number, limit: number = 10): Promise<any[]> {
    // Since we don't have a git commits table, we'll return file modification history
    const recentFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(desc(files.updatedAt))
      .limit(limit);

    return recentFiles.map(file => ({
      type: 'file_change',
      message: `Updated ${file.name}`,
      date: file.updatedAt,
      file: file.name
    }));
  }

  /**
   * Analyze user patterns
   */
  private async analyzeUserPatterns(projectId: number): Promise<UserPattern[]> {
    // Since we don't have activity log, we'll analyze file modification patterns
    const recentFiles = await db
      .select()
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(desc(files.updatedAt))
      .limit(100);

    const patterns: Map<string, UserPattern> = new Map();

    for (const file of recentFiles) {
      const ext = path.extname(file.name);
      const key = `editing_${ext || 'files'}`;
      const pattern = patterns.get(key) || {
        action: `Editing ${ext || 'files'}`,
        frequency: 0,
        lastOccurrence: file.updatedAt,
        context: file.name
      };

      pattern.frequency++;
      if (file.updatedAt > pattern.lastOccurrence) {
        pattern.lastOccurrence = file.updatedAt;
        pattern.context = file.name;
      }

      patterns.set(key, pattern);
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Get related files based on imports/exports
   */
  private async getRelatedFiles(file: File): Promise<FileContext[]> {
    const fileContext = await this.parseFile(file);
    const relatedPaths = new Set<string>();

    // Add imported files
    for (const imp of fileContext.imports) {
      if (imp.startsWith('.')) {
        const importPath = path.resolve(path.dirname(file.name), imp);
        relatedPaths.add(importPath);
      }
    }

    // Get files that import this file
    const allFiles = await storage.getFilesByProjectId(file.projectId);
    for (const f of allFiles) {
      if (f.content && f.content.includes(file.name)) {
        relatedPaths.add(f.name);
      }
    }

    const relatedFiles: FileContext[] = [];
    for (const relPath of Array.from(relatedPaths)) {
      const relFile = allFiles.find(f => f.name === relPath || f.path === relPath);
      if (relFile) {
        relatedFiles.push(await this.parseFile(relFile));
      }
    }

    return relatedFiles;
  }

  /**
   * Get context at cursor position
   */
  private async getContextAtPosition(file: File, position: { line: number; column: number }): Promise<any> {
    const lines = (file.content || '').split('\n');
    if (position.line >= lines.length) {
      return null;
    }

    const currentLine = lines[position.line];
    const beforeCursor = currentLine.substring(0, position.column);
    const afterCursor = currentLine.substring(position.column);

    // Detect what user might be typing
    const context = {
      inFunction: this.isInFunction(lines, position.line),
      inClass: this.isInClass(lines, position.line),
      inImport: currentLine.trim().startsWith('import'),
      inString: this.isInString(currentLine, position.column),
      lastWord: this.getLastWord(beforeCursor),
      nextWord: this.getNextWord(afterCursor),
      indentLevel: this.getIndentLevel(currentLine)
    };

    return context;
  }

  /**
   * Generate contextual suggestions
   */
  private async generateContextualSuggestions(fileContext: FileContext, currentContext: any): Promise<string[]> {
    const suggestions: string[] = [];

    if (currentContext) {
      if (currentContext.inImport) {
        suggestions.push('Suggest commonly used imports for this project');
      }
      if (currentContext.inFunction) {
        suggestions.push('Add error handling', 'Add logging', 'Extract to separate function');
      }
      if (currentContext.inClass) {
        suggestions.push('Add constructor', 'Add method', 'Implement interface');
      }
    }

    // Suggest based on file type
    if (fileContext.language === 'javascript' || fileContext.language === 'typescript') {
      if (fileContext.functions.length === 0) {
        suggestions.push('Add main function');
      }
      if (fileContext.exports.length === 0) {
        suggestions.push('Export functions or classes');
      }
    }

    return suggestions;
  }

  // Helper methods
  private detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cs': 'csharp'
    };
    return langMap[ext] || 'text';
  }

  private extractImportsRegex(content: string): string[] {
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
    const imports: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractFunctionsRegex(content: string): string[] {
    const functionRegex = /function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    const functions: string[] = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    return functions;
  }

  private extractClassesRegex(content: string): string[] {
    const classRegex = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }

  private isInFunction(lines: string[], lineNum: number): boolean {
    let braceCount = 0;
    for (let i = 0; i <= lineNum; i++) {
      const line = lines[i];
      if (line.includes('function') || line.includes('=>')) {
        braceCount = 1;
      }
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
    }
    return braceCount > 0;
  }

  private isInClass(lines: string[], lineNum: number): boolean {
    for (let i = lineNum; i >= 0; i--) {
      if (lines[i].includes('class ')) {
        return true;
      }
      if (lines[i].includes('}')) {
        return false;
      }
    }
    return false;
  }

  private isInString(line: string, column: number): boolean {
    const beforeCursor = line.substring(0, column);
    const singleQuotes = (beforeCursor.match(/'/g) || []).length;
    const doubleQuotes = (beforeCursor.match(/"/g) || []).length;
    const backticks = (beforeCursor.match(/`/g) || []).length;
    
    return singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1;
  }

  private getLastWord(text: string): string {
    const words = text.trim().split(/\s+/);
    return words[words.length - 1] || '';
  }

  private getNextWord(text: string): string {
    const words = text.trim().split(/\s+/);
    return words[0] || '';
  }

  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  private isCacheValid(context: ProjectContext): boolean {
    // Cache is valid for 5 minutes
    const cacheTime = 5 * 60 * 1000;
    const lastFile = context.recentFiles[0];
    if (!lastFile) return false;
    
    return Date.now() - lastFile.lastModified.getTime() < cacheTime;
  }

  /**
   * Clear context cache for a project
   */
  clearProjectContext(projectId: number) {
    this.projectContextCache.delete(projectId);
    this.conversationMemory.delete(projectId);
  }

  /**
   * Get smart suggestions based on full context
   */
  async getSmartSuggestions(projectId: number, fileId?: number): Promise<string[]> {
    const projectContext = await this.getProjectContext(projectId);
    const conversationContext = this.getConversationContext(projectId);
    
    const suggestions: string[] = [];

    // Based on user patterns
    for (const pattern of projectContext.userPatterns) {
      if (pattern.frequency > 3) {
        suggestions.push(`You frequently ${pattern.action}. Would you like help with that?`);
      }
    }

    // Based on project structure
    if (projectContext.projectStructure.testFiles.length === 0) {
      suggestions.push('Add unit tests to improve code quality');
    }

    // Based on dependencies
    if (!projectContext.dependencies['typescript'] && projectContext.projectLanguage === 'javascript') {
      suggestions.push('Consider adding TypeScript for better type safety');
    }

    // Based on conversation intent
    if (conversationContext?.currentIntent === 'debug' && projectContext.recentChanges.some(c => c.includes('error'))) {
      suggestions.push('I noticed recent errors. Let me help debug them.');
    }

    return suggestions;
  }
}

// Export singleton instance
export const contextAwarenessService = new ContextAwarenessService();