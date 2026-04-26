/**
 * Memory Bank Service
 * Inspired by Kilocode's Memory Bank feature
 * 
 * Provides persistent project context across agent sessions to prevent "AI amnesia"
 * Stores project-specific documentation that is automatically injected into agent prompts
 * 
 * Storage location: .ecode/memory-bank/ in each project
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('memory-bank-service');

export interface MemoryBankFile {
  name: string;
  content: string;
  lastUpdated: Date;
  size: number;
}

export interface MemoryBank {
  projectId: string | number;
  files: MemoryBankFile[];
  totalSize: number;
  initialized: boolean;
  lastUpdated: Date;
}

export interface MemoryBankContext {
  brief: string;
  architecture: string;
  dependencies: string;
  patterns: string;
  recentChanges: string;
  custom: Record<string, string>;
}

const MEMORY_BANK_DIR = '.ecode/memory-bank';
const MAX_CONTEXT_TOKENS = 8000; // ~32KB of text for context injection

// Security: Allowed characters for memory bank filenames
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+\.md$/;

/**
 * Validate and sanitize filename to prevent path traversal attacks
 * Only allows alphanumeric, underscore, hyphen, and .md extension
 */
function sanitizeFilename(filename: string): string | null {
  // Get just the basename, stripping any path components
  const basename = path.basename(filename);
  
  // Ensure it ends with .md
  const safeName = basename.endsWith('.md') ? basename : `${basename}.md`;
  
  // Validate against safe pattern
  if (!SAFE_FILENAME_REGEX.test(safeName)) {
    return null;
  }
  
  return safeName;
}

/**
 * Validate that resolved path is within the memory bank directory
 */
function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}

const DEFAULT_FILES: Record<string, { template: string; description: string }> = {
  'projectbrief.md': {
    description: 'Foundation document defining core requirements and goals',
    template: `# Project Brief

## Overview
[High-level description of what this project does]

## Core Requirements
- Requirement 1
- Requirement 2
- Requirement 3

## Project Goals
[What success looks like for this project]

## Scope
[What is in and out of scope]
`
  },
  'productContext.md': {
    description: 'Why this project exists and problems it solves',
    template: `# Product Context

## Problem Statement
[What problem does this solve?]

## Target Users
[Who will use this application?]

## User Experience Goals
[How should users feel when using this?]

## How It Should Work
[Key user flows and interactions]
`
  },
  'systemPatterns.md': {
    description: 'System architecture and key technical decisions',
    template: `# System Patterns

## Architecture Overview
[High-level system design]

## Key Technical Decisions
1. [Decision]: [Rationale]
2. [Decision]: [Rationale]

## Design Patterns in Use
- [Pattern 1]: [Where/Why]
- [Pattern 2]: [Where/Why]

## Component Relationships
[How major components interact]
`
  },
  'techContext.md': {
    description: 'Technologies, dependencies, and development setup',
    template: `# Technical Context

## Tech Stack
- Frontend: React, TypeScript, Tailwind CSS
- Backend: Express, Node.js
- Database: PostgreSQL
- AI: Multi-provider (OpenAI, Anthropic, Gemini)

## Development Setup
[How to run the project locally]

## Key Dependencies
[Important libraries and their purposes]

## Environment Variables
[Required configuration]
`
  },
  'activeContext.md': {
    description: 'Current work focus and recent changes',
    template: `# Active Context

## Current Focus
[What is being worked on right now]

## Recent Changes
- [Date]: [Change description]

## Next Steps
- [ ] Task 1
- [ ] Task 2

## Active Decisions
[Decisions that need to be made]

---
*Updated automatically as work progresses*
`
  }
};

export class MemoryBankService extends EventEmitter {
  private projectBasePaths: Map<string, string> = new Map();
  private memoryCache: Map<string, MemoryBank> = new Map();
  
  constructor() {
    super();
  }

  /**
   * Set the base path for a project's files
   */
  setProjectBasePath(projectId: string | number, basePath: string): void {
    this.projectBasePaths.set(String(projectId), basePath);
  }

  /**
   * Get the memory bank directory path for a project
   */
  private getMemoryBankPath(projectId: string | number): string {
    const key = String(projectId);
    const basePath = this.projectBasePaths.get(key) || path.join(process.cwd(), 'project-workspaces', key);
    return path.join(basePath, MEMORY_BANK_DIR);
  }

  /**
   * Check if memory bank is initialized for a project
   */
  async isInitialized(projectId: string | number): Promise<boolean> {
    try {
      const mbPath = this.getMemoryBankPath(projectId);
      await fs.access(mbPath);
      return true;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  /**
   * Initialize memory bank with default files
   */
  async initialize(projectId: string | number, projectDescription?: string): Promise<MemoryBank> {
    const mbPath = this.getMemoryBankPath(projectId);
    
    // Create directory
    await fs.mkdir(mbPath, { recursive: true });
    
    // Create default files
    const files: MemoryBankFile[] = [];
    
    for (const [filename, config] of Object.entries(DEFAULT_FILES)) {
      let content = config.template;
      
      // If project description provided, enhance the brief
      if (filename === 'projectbrief.md' && projectDescription) {
        content = `# Project Brief

## Overview
${projectDescription}

## Core Requirements
[To be extracted from requirements]

## Project Goals
[To be defined]

## Scope
[To be defined]
`;
      }
      
      const filePath = path.join(mbPath, filename);
      await fs.writeFile(filePath, content, 'utf-8');
      
      files.push({
        name: filename,
        content,
        lastUpdated: new Date(),
        size: Buffer.byteLength(content, 'utf-8')
      });
    }
    
    const memoryBank: MemoryBank = {
      projectId,
      files,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      initialized: true,
      lastUpdated: new Date()
    };
    
    this.memoryCache.set(String(projectId), memoryBank);
    this.emit('initialized', { projectId, memoryBank });
    
    logger.info(`[MemoryBank] Initialized for project ${projectId} with ${files.length} files`);
    
    return memoryBank;
  }

  /**
   * Initialize memory bank with AI-generated content based on user prompt
   * Replit-identical: Generates contextual documentation automatically
   * 
   * @param projectId - The project ID
   * @param userPrompt - The user's original prompt describing what they want to build
   * @param options - Additional context (language, framework, etc.)
   */
  async initializeWithAI(
    projectId: string | number, 
    userPrompt: string,
    options?: {
      language?: string;
      framework?: string;
      buildMode?: string;
      preferredModel?: string; // ✅ User's preferred AI model (supports ALL providers)
    }
  ): Promise<MemoryBank> {
    const mbPath = this.getMemoryBankPath(projectId);
    
    // Create directory
    await fs.mkdir(mbPath, { recursive: true });
    
    logger.info(`[MemoryBank] 🤖 Generating AI-powered context for project ${projectId}...`);
    
    // Generate AI content for all files in parallel
    const aiContent = await this.generateAIContent(userPrompt, options);
    
    const files: MemoryBankFile[] = [];
    
    // Write all files with AI-generated content
    for (const [filename, content] of Object.entries(aiContent)) {
      const filePath = path.join(mbPath, filename);
      await fs.writeFile(filePath, content, 'utf-8');
      
      files.push({
        name: filename,
        content,
        lastUpdated: new Date(),
        size: Buffer.byteLength(content, 'utf-8')
      });
    }
    
    const memoryBank: MemoryBank = {
      projectId,
      files,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      initialized: true,
      lastUpdated: new Date()
    };
    
    this.memoryCache.set(String(projectId), memoryBank);
    this.emit('initialized', { projectId, memoryBank, aiGenerated: true });
    
    logger.info(`[MemoryBank] ✅ AI-generated Memory Bank for project ${projectId} (${files.length} files, ${memoryBank.totalSize} bytes)`);
    
    return memoryBank;
  }

  /**
   * Generate AI content for all Memory Bank files based on user prompt
   * ✅ Uses UNIFIED AI Provider System - respects user's model preference
   * Supports: OpenAI, Anthropic, Gemini, xAI, Moonshot, etc.
   */
  private async generateAIContent(
    userPrompt: string,
    options?: {
      language?: string;
      framework?: string;
      buildMode?: string;
      preferredModel?: string; // User's preferred model ID
    }
  ): Promise<Record<string, string>> {
    const language = options?.language || 'typescript';
    const framework = options?.framework || 'react';
    const buildMode = options?.buildMode || 'full-app';
    
    try {
      // ✅ Use unified AI provider system - supports all configured models
      const systemPrompt = `You are an expert software architect. Generate project documentation for a Memory Bank system.
The user wants to build: "${userPrompt}"
Tech stack: ${language} with ${framework}
Build mode: ${buildMode}

Generate JSON with exactly 5 keys, each containing markdown content:
1. "projectbrief.md" - Project overview, core requirements, goals, and scope
2. "productContext.md" - Problem statement, target users, UX goals, key user flows
3. "systemPatterns.md" - Architecture overview, key technical decisions, design patterns
4. "techContext.md" - Tech stack details, development setup, key dependencies, env vars
5. "activeContext.md" - Current focus (initial setup), next steps as a checklist

Keep each file concise (10-30 lines). Be specific to this project, not generic.
Output valid JSON only, no markdown code blocks.`;

      const userMessage = `Generate Memory Bank documentation for this project. Return JSON only.\n\nProject: ${userPrompt}`;
      
      // ✅ Determine which model to use (user preference or intelligent default)
      const modelId = options?.preferredModel || this.selectBestAvailableModel();
      
      logger.info(`[MemoryBank] 🤖 Using model: ${modelId} for Memory Bank generation`);
      
      // ✅ Call unified AI provider (works with ANY configured model)
      const response = await aiProviderManager.generateChat(
        modelId,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        { maxTokens: 4000 }
      );

      // Parse JSON response
      let parsed: Record<string, string>;
      try {
        // Clean potential markdown code blocks
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.warn('[MemoryBank] Failed to parse AI response, using fallback:', parseError);
        return this.generateFallbackContent(userPrompt, options);
      }

      // Validate all required files exist
      const requiredFiles = ['projectbrief.md', 'productContext.md', 'systemPatterns.md', 'techContext.md', 'activeContext.md'];
      for (const file of requiredFiles) {
        if (!parsed[file] || typeof parsed[file] !== 'string') {
          logger.warn(`[MemoryBank] Missing or invalid ${file}, using fallback content`);
          parsed[file] = DEFAULT_FILES[file]?.template || `# ${file}\n\nContent to be added.`;
        }
      }

      return parsed;
    } catch (error) {
      logger.error('[MemoryBank] AI generation failed, using fallback:', error);
      return this.generateFallbackContent(userPrompt, options);
    }
  }
  
  /**
   * Select the best available model for Memory Bank generation
   * Priority: Claude Sonnet 4 > GPT-4.1 > Gemini 2.5 Flash > Any available
   */
  private selectBestAvailableModel(): string {
    const preferredModels = [
      'claude-sonnet-4-6',      // Anthropic Claude Sonnet 4 (best Claude, March 2026)
      'gpt-4.1',                       // OpenAI GPT-4.1 (best verified ModelFarm model)
      'gpt-4.1-nano',                    // OpenAI GPT-4.1 Nano (fast, free via ModelFarm)
      'gemini-2.5-flash',              // Google Gemini 2.5 Flash (production-stable)
      'gemini-2.5-pro',                // Google Gemini 2.5 Pro (complex reasoning)
      'grok-3',                        // xAI Grok 3
    ];
    
    // Return first available model or fallback
    for (const modelId of preferredModels) {
      try {
        // Check if model is available (provider is configured)
        const providers = aiProviderManager.getAvailableProviders();
        if (providers.length > 0) {
          return modelId;
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
        continue;
      }
    }
    
    // Ultimate fallback
    return 'claude-sonnet-4-6';
  }

  /**
   * Fallback content generation when AI is unavailable
   */
  private generateFallbackContent(
    userPrompt: string,
    options?: {
      language?: string;
      framework?: string;
    }
  ): Record<string, string> {
    const language = options?.language || 'typescript';
    const framework = options?.framework || 'react';
    const date = new Date().toISOString().split('T')[0];

    return {
      'projectbrief.md': `# Project Brief

## Overview
${userPrompt}

## Core Requirements
- Implement the core functionality described above
- Ensure responsive design for all screen sizes
- Follow best practices for ${language} development

## Project Goals
- Deliver a working MVP
- Clean, maintainable code
- Good user experience

## Scope
- Frontend: ${framework} application
- Backend: API endpoints as needed
- Database: PostgreSQL for persistence
`,
      'productContext.md': `# Product Context

## Problem Statement
${userPrompt}

## Target Users
- Primary users who need this functionality
- Secondary users who may benefit

## User Experience Goals
- Intuitive interface
- Fast performance
- Accessible design

## How It Should Work
1. User accesses the application
2. Core functionality is immediately available
3. Data is persisted across sessions
`,
      'systemPatterns.md': `# System Patterns

## Architecture Overview
- Frontend: ${framework} with ${language}
- Backend: Express.js API
- Database: PostgreSQL with Drizzle ORM
- Styling: Tailwind CSS with shadcn/ui

## Key Technical Decisions
1. ${framework}: Modern, component-based UI
2. ${language}: Type safety and better DX
3. Drizzle ORM: Type-safe database queries

## Design Patterns in Use
- Repository pattern for data access
- Component composition for UI
- Server-side validation with Zod
`,
      'techContext.md': `# Technical Context

## Tech Stack
- Frontend: ${framework}, ${language}, Tailwind CSS
- Backend: Express.js, Node.js
- Database: PostgreSQL
- ORM: Drizzle

## Development Setup
\`\`\`bash
npm run dev  # Start development server
\`\`\`

## Key Dependencies
- TanStack Query for data fetching
- shadcn/ui for UI components
- Zod for validation

## Environment Variables
- DATABASE_URL: PostgreSQL connection string
`,
      'activeContext.md': `# Active Context

## Current Focus
- Initial project setup based on user requirements
- Implementing core functionality

## Recent Changes
- [${date}] Project initialized from prompt

## Next Steps
- [ ] Set up database schema
- [ ] Create API endpoints
- [ ] Build UI components
- [ ] Connect frontend to backend
- [ ] Test and refine

---
*Auto-generated by E-Code Memory Bank*
`
    };
  }

  /**
   * Get all memory bank files for a project
   */
  async getMemoryBank(projectId: string | number): Promise<MemoryBank | null> {
    const key = String(projectId);
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }
    
    const mbPath = this.getMemoryBankPath(projectId);
    
    try {
      await fs.access(mbPath);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return null;
    }
    
    try {
      const entries = await fs.readdir(mbPath);
      const files: MemoryBankFile[] = [];
      
      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          const filePath = path.join(mbPath, entry);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          
          files.push({
            name: entry,
            content,
            lastUpdated: stats.mtime,
            size: stats.size
          });
        }
      }
      
      const memoryBank: MemoryBank = {
        projectId,
        files,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        initialized: true,
        lastUpdated: new Date(Math.max(...files.map(f => f.lastUpdated.getTime())))
      };
      
      this.memoryCache.set(key, memoryBank);
      return memoryBank;
    } catch (error) {
      logger.error(`[MemoryBank] Error reading memory bank for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Get a specific memory file
   */
  async getFile(projectId: string | number, filename: string): Promise<MemoryBankFile | null> {
    // Security: Sanitize filename to prevent path traversal
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
      logger.warn(`[MemoryBank] Rejected unsafe filename: ${filename}`);
      return null;
    }
    
    const mbPath = this.getMemoryBankPath(projectId);
    const filePath = path.join(mbPath, safeFilename);
    
    // Security: Verify path is within memory bank directory
    if (!isPathWithinDirectory(filePath, mbPath)) {
      logger.warn(`[MemoryBank] Path traversal attempt blocked: ${filename}`);
      return null;
    }
    
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        name: safeFilename,
        content,
        lastUpdated: stats.mtime,
        size: stats.size
      };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return null;
    }
  }

  /**
   * Update or create a memory file
   */
  async updateFile(projectId: string | number, filename: string, content: string): Promise<MemoryBankFile | null> {
    // Security: Sanitize filename to prevent path traversal
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
      logger.warn(`[MemoryBank] Rejected unsafe filename for update: ${filename}`);
      return null;
    }
    
    const mbPath = this.getMemoryBankPath(projectId);
    
    // Ensure directory exists
    await fs.mkdir(mbPath, { recursive: true });
    
    const filePath = path.join(mbPath, safeFilename);
    
    // Security: Verify path is within memory bank directory
    if (!isPathWithinDirectory(filePath, mbPath)) {
      logger.warn(`[MemoryBank] Path traversal attempt blocked on update: ${filename}`);
      return null;
    }
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    const file: MemoryBankFile = {
      name: safeFilename,
      content,
      lastUpdated: new Date(),
      size: Buffer.byteLength(content, 'utf-8')
    };
    
    // Invalidate cache
    this.memoryCache.delete(String(projectId));
    
    this.emit('fileUpdated', { projectId, file });
    logger.info(`[MemoryBank] Updated ${safeFilename} for project ${projectId}`);
    
    return file;
  }

  async deleteFile(projectId: string | number, filename: string): Promise<boolean> {
    // Security: Sanitize filename to prevent path traversal
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
      logger.warn(`[MemoryBank] Rejected unsafe filename for delete: ${filename}`);
      return false;
    }
    
    const mbPath = this.getMemoryBankPath(projectId);
    const filePath = path.join(mbPath, safeFilename);
    
    // Security: Verify path is within memory bank directory
    if (!isPathWithinDirectory(filePath, mbPath)) {
      logger.warn(`[MemoryBank] Path traversal attempt blocked on delete: ${filename}`);
      return false;
    }
    
    try {
      await fs.unlink(filePath);
      this.memoryCache.delete(String(projectId));
      this.emit('fileDeleted', { projectId, filename: safeFilename });
      return true;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  /**
   * Get memory bank context formatted for agent prompt injection
   * Optimized for token efficiency
   */
  async getContextForAgent(projectId: string | number): Promise<string> {
    const memoryBank = await this.getMemoryBank(projectId);
    
    if (!memoryBank || memoryBank.files.length === 0) {
      return '';
    }
    
    // Priority order for context injection (most important first)
    const priorityOrder = [
      'projectbrief.md',
      'project-brief.md',
      'productContext.md',
      'systemPatterns.md',
      'techContext.md',
      'activeContext.md',
      'architecture.md',
      'patterns.md',
      'dependencies.md',
      'recent-changes.md'
    ];
    
    const sections: string[] = [];
    let totalLength = 0;
    const maxLength = MAX_CONTEXT_TOKENS * 4; // ~4 chars per token
    
    // Add files in priority order
    for (const filename of priorityOrder) {
      const file = memoryBank.files.find(f => f.name === filename);
      if (file && file.content.trim()) {
        const section = `### ${file.name.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n${file.content.trim()}`;
        
        if (totalLength + section.length <= maxLength) {
          sections.push(section);
          totalLength += section.length;
        }
      }
    }
    
    // Add any custom files not in priority list
    for (const file of memoryBank.files) {
      if (!priorityOrder.includes(file.name) && file.content.trim()) {
        const section = `### ${file.name.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n${file.content.trim()}`;
        
        if (totalLength + section.length <= maxLength) {
          sections.push(section);
          totalLength += section.length;
        }
      }
    }
    
    if (sections.length === 0) {
      return '';
    }
    
    return `<memory_bank>
## Project Memory Bank
The following is persistent context about this project. Use this information to maintain consistency across sessions.

${sections.join('\n\n---\n\n')}
</memory_bank>`;
  }

  /**
   * Auto-update recent changes after agent makes modifications
   */
  async logRecentChange(
    projectId: string | number, 
    description: string, 
    filesAffected: string[], 
    reason?: string
  ): Promise<void> {
    const existingFile = await this.getFile(projectId, 'recent-changes.md');
    const date = new Date().toISOString().split('T')[0];
    
    const newEntry = `### ${date}
- ${description}
- Files affected: ${filesAffected.map(f => `\`${f}\``).join(', ')}
${reason ? `- Reason: ${reason}` : ''}
`;
    
    let content: string;
    if (existingFile) {
      // Insert new entry after "## Latest Updates" header
      const lines = existingFile.content.split('\n');
      const headerIndex = lines.findIndex(l => l.includes('## Latest Updates'));
      
      if (headerIndex !== -1) {
        lines.splice(headerIndex + 2, 0, newEntry);
        content = lines.join('\n');
      } else {
        content = `# Recent Changes\n\n## Latest Updates\n\n${newEntry}\n${existingFile.content}`;
      }
      
      // Keep only last 20 entries to prevent file from growing too large
      const entries = content.split('###').slice(0, 21);
      content = entries.join('###');
    } else {
      content = `# Recent Changes\n\n## Latest Updates\n\n${newEntry}`;
    }
    
    await this.updateFile(projectId, 'recent-changes.md', content);
  }

  /**
   * Auto-generate architecture doc from project analysis
   */
  async generateArchitectureDoc(
    projectId: string | number,
    techStack: {
      frontend?: string[];
      backend?: string[];
      database?: string;
      hosting?: string;
    },
    structure?: string
  ): Promise<void> {
    const content = `# Architecture

## Tech Stack
- Frontend: ${techStack.frontend?.join(', ') || 'Not specified'}
- Backend: ${techStack.backend?.join(', ') || 'Not specified'}
- Database: ${techStack.database || 'Not specified'}
- Hosting: ${techStack.hosting || 'Not specified'}

## Project Structure
\`\`\`
${structure || 'Structure to be analyzed'}
\`\`\`

## Key Design Decisions
*Auto-generated - update with specific decisions*

## API Design
*Document key API endpoints here*

---
*Generated by E-Code Memory Bank*
`;
    
    await this.updateFile(projectId, 'architecture.md', content);
  }

  /**
   * Get list of available default templates
   */
  getDefaultTemplates(): Record<string, { description: string }> {
    const templates: Record<string, { description: string }> = {};
    for (const [name, config] of Object.entries(DEFAULT_FILES)) {
      templates[name] = { description: config.description };
    }
    return templates;
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId: string | number): void {
    this.memoryCache.delete(String(projectId));
  }

  /**
   * Auto-update activeContext.md after AI completes a response
   * This provides automatic memory updates without user intervention
   */
  async updateActiveContext(
    projectId: string | number,
    update: {
      action: string;
      filesChanged?: string[];
    }
  ): Promise<void> {
    try {
      const existingFile = await this.getFile(projectId, 'activeContext.md');
      const timestamp = new Date().toLocaleString();
      
      // Sanitize action - remove sensitive data patterns
      const sanitizedAction = this.sanitizeForLogging(update.action);
      const newEntry = `- [${timestamp}] ${sanitizedAction}${update.filesChanged?.length ? ` (Files: ${update.filesChanged.slice(0, 5).join(', ')})` : ''}`;
      
      let content: string;
      if (existingFile) {
        // Parse existing content into sections
        const sections = this.parseMarkdownSections(existingFile.content);
        
        // Update Recent Changes section
        let recentChanges = sections.get('Recent Changes') || '';
        const existingEntries = recentChanges.split('\n').filter(l => l.startsWith('- ['));
        
        // Add new entry at the top, limit to 15 entries
        const allEntries = [newEntry, ...existingEntries].slice(0, 15);
        sections.set('Recent Changes', allEntries.join('\n'));
        
        // Rebuild the document
        content = this.rebuildMarkdownFromSections(existingFile.content, sections);
      } else {
        // Create new activeContext.md
        content = `# Active Context

## Current Focus
Working with AI agent

## Recent Changes
${newEntry}

## Next Steps
- [ ] Continue development

---
*Auto-updated by E-Code AI Agent*
`;
      }
      
      await this.updateFile(projectId, 'activeContext.md', content);
      logger.info(`[MemoryBank] Auto-updated activeContext.md for project ${projectId}`);
      
      this.emit('autoUpdated', { projectId, file: 'activeContext.md', update });
    } catch (error) {
      logger.error(`[MemoryBank] Failed to auto-update activeContext.md:`, error);
    }
  }

  /**
   * Parse markdown content into sections by ## headers
   */
  private parseMarkdownSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.set(currentSection, currentContent.join('\n').trim());
        }
        currentSection = line.substring(3).trim();
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }
    
    if (currentSection) {
      sections.set(currentSection, currentContent.join('\n').trim());
    }
    
    return sections;
  }

  /**
   * Rebuild markdown content with updated sections
   */
  private rebuildMarkdownFromSections(originalContent: string, sections: Map<string, string>): string {
    const lines = originalContent.split('\n');
    const result: string[] = [];
    let currentSection = '';
    let skipUntilNextSection = false;
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).trim();
        result.push(line);
        
        if (sections.has(currentSection)) {
          result.push(sections.get(currentSection)!);
          skipUntilNextSection = true;
        } else {
          skipUntilNextSection = false;
        }
      } else if (line.startsWith('# ') || line.startsWith('---')) {
        skipUntilNextSection = false;
        result.push(line);
      } else if (!skipUntilNextSection) {
        result.push(line);
      }
    }
    
    return result.join('\n');
  }

  /**
   * Sanitize content for logging - remove potential sensitive data
   */
  private sanitizeForLogging(text: string, maxLength: number = 80): string {
    if (!text) return 'AI interaction';
    
    // Remove potential API keys, tokens, passwords
    let clean = text
      .replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]')
      .replace(/password[:\s]*\S+/gi, 'password: [REDACTED]')
      .replace(/api[_-]?key[:\s]*\S+/gi, 'api_key: [REDACTED]')
      .replace(/token[:\s]*\S+/gi, 'token: [REDACTED]')
      .replace(/secret[:\s]*\S+/gi, 'secret: [REDACTED]')
      .trim();
    
    // Truncate to max length
    if (clean.length > maxLength) {
      return clean.substring(0, maxLength - 3) + '...';
    }
    
    return clean || 'AI interaction';
  }
}

// Singleton instance
export const memoryBankService = new MemoryBankService();
