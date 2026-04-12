// @ts-nocheck
/**
 * Real AI Code Generation Service
 * Provides actual code generation and file modification capabilities
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import { DESIGN_SYSTEM_PROMPT } from './prompts/design-system';
import { File, Project } from '@shared/schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { diff_match_patch } from 'diff-match-patch';

const logger = createLogger('real-code-generator');

export interface CodeGenerationRequest {
  projectId: number;
  instruction: string;
  targetFiles?: string[];
  context?: {
    currentCode?: string;
    language?: string;
    framework?: string;
    dependencies?: string[];
  };
}

export interface CodeModification {
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  oldContent?: string;
  newContent?: string;
  changes?: Array<{
    lineNumber: number;
    type: 'add' | 'remove' | 'modify';
    content: string;
  }>;
}

export interface CodeGenerationResult {
  success: boolean;
  modifications: CodeModification[];
  explanation: string;
  error?: string;
  rollbackData?: {
    files: Array<{
      path: string;
      content: string;
    }>;
  };
}

export class RealCodeGenerator {
  private openai: OpenAI | null;
  private anthropic: Anthropic | null;
  private dmp: diff_match_patch;
  private providersAvailable: boolean;

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    // Initialize providers only if keys are available
    this.openai = openaiKey ? new OpenAI({
      apiKey: openaiKey
    }) : null;
    
    this.anthropic = anthropicKey ? new Anthropic({
      apiKey: anthropicKey
    }) : null;

    this.dmp = new diff_match_patch();
    this.providersAvailable = !!(this.openai || this.anthropic);
    
    // Log provider status
    logger.info('RealCodeGenerator initialized', {
      openai: !!openaiKey,
      anthropic: !!anthropicKey,
      providersAvailable: this.providersAvailable
    });
  }
  
  // Get provider status
  getProviderStatus() {
    return {
      openai: !!this.openai,
      anthropic: !!this.anthropic,
      anyAvailable: this.providersAvailable,
      missingKeys: [
        !this.openai ? 'OPENAI_API_KEY' : null,
        !this.anthropic ? 'ANTHROPIC_API_KEY' : null
      ].filter(Boolean)
    };
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    // Early validation - check if AI providers are available
    if (!this.providersAvailable) {
      const status = this.getProviderStatus();
      logger.error('No AI providers available for code generation', status);
      
      return {
        success: false,
        modifications: [],
        explanation: 'AI code generation service is not available',
        error: `AI service is not configured. Please set up at least one API key: ${status.missingKeys.join(' or ')}`
      };
    }

    try {
      // Validate request
      if (!request.instruction || request.instruction.trim() === '') {
        return {
          success: false,
          modifications: [],
          explanation: '',
          error: 'No instruction provided for code generation'
        };
      }

      // Get project context
      const project = await storage.getProject(request.projectId);
      if (!project) {
        return {
          success: false,
          modifications: [],
          explanation: '',
          error: 'Project not found. Please ensure the project exists.'
        };
      }

      // Get all project files
      const files = await storage.getFilesByProject(request.projectId);
      
      // Build comprehensive context
      const context = await this.buildContext(project, files, request);

      // Generate code modifications using AI
      const modifications = await this.generateModifications(context, request.instruction);

      // Apply modifications to files
      const result = await this.applyModifications(request.projectId, files, modifications);

      return result;

    } catch (error) {
      logger.error(`Code generation failed: ${error}`);
      
      // Provide user-friendly error messages
      let userMessage = 'An error occurred during code generation';
      
      if (error.message.includes('API key')) {
        userMessage = 'AI service authentication failed. Please check API key configuration.';
      } else if (error.message.includes('rate limit')) {
        userMessage = 'AI service rate limit exceeded. Please try again in a few moments.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'AI service request timed out. Please try again.';
      } else if (error.message.includes('No AI service available')) {
        userMessage = 'No AI service is currently available. Please configure API keys.';
      }
      
      return {
        success: false,
        modifications: [],
        explanation: '',
        error: `${userMessage} (${error.message})`
      };
    }
  }

  private async buildContext(
    project: Project, 
    files: File[], 
    request: CodeGenerationRequest
  ): Promise<string> {
    let context = `Project: ${project.name}
Language: ${project.language || request.context?.language || 'javascript'}
Framework: ${request.context?.framework || 'none'}

Current File Structure:
`;

    // Add file tree
    const fileTree = this.buildFileTree(files);
    context += fileTree + '\n\n';

    // Add relevant file contents
    if (request.targetFiles && request.targetFiles.length > 0) {
      context += 'Target Files Content:\n';
      for (const targetFile of request.targetFiles) {
        const file = files.find(f => f.name === targetFile);
        if (file && file.content) {
          context += `\n--- ${file.name} ---\n${file.content}\n`;
        }
      }
    } else if (request.context?.currentCode) {
      context += `\nCurrent Code:\n${request.context.currentCode}\n`;
    }

    // Add dependencies if available
    const packageFile = files.find(f => f.name === 'package.json');
    if (packageFile && packageFile.content) {
      try {
        const pkg = JSON.parse(packageFile.content);
        context += `\nDependencies: ${Object.keys(pkg.dependencies || {}).join(', ')}\n`;
      } catch (e) {
        // Ignore parse errors
      }
    }

    return context;
  }

  private buildFileTree(files: File[]): string {
    const tree: any = {};
    
    // Build tree structure
    for (const file of files) {
      const parts = file.name.split('/');
      let current = tree;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      if (!file.isFolder) {
        current[parts[parts.length - 1]] = 'file';
      }
    }

    // Convert to string
    return this.treeToString(tree, '');
  }

  private treeToString(tree: any, indent: string): string {
    let result = '';
    const entries = Object.entries(tree);
    
    entries.forEach(([name, value], index) => {
      const isLast = index === entries.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      
      if (value === 'file') {
        result += indent + prefix + name + '\n';
      } else {
        result += indent + prefix + name + '/\n';
        const nextIndent = indent + (isLast ? '    ' : '│   ');
        result += this.treeToString(value, nextIndent);
      }
    });
    
    return result;
  }

  private async generateModifications(
    context: string, 
    instruction: string
  ): Promise<CodeModification[]> {
    const systemPrompt = `You are a world-class code generator and UI designer. Given a project context and user instruction, generate stunning, complete, production-ready code.

Return your response as a JSON array of modifications with this structure:
[
  {
    "filePath": "path/to/file.js",
    "action": "create|modify|delete",
    "newContent": "full file content for create/modify actions"
  }
]

Important rules:
1. For 'create' actions, provide the COMPLETE file content — no placeholders or TODOs
2. For 'modify' actions, provide the complete updated file content
3. For 'delete' actions, newContent should be null
4. Ensure all code is syntactically correct and production-ready
5. Follow the project's existing code style and conventions
6. Include necessary imports and exports
7. Generate a MINIMUM of 8-15 files for any application
8. The UI must look premium: gradients, glassmorphism, animations, dark mode
9. Always use Tailwind CSS CDN and Inter font for HTML files

${DESIGN_SYSTEM_PROMPT}`;

    const userPrompt = `You will receive the user's request followed by relevant project context. Read all details carefully and respond only with the JSON structure defined above.

Task:
Generate the necessary code modifications as a JSON array.

User Instruction:
${instruction}

Project Context:
${context}`;

    try {
      // Try Claude first for better code understanding
      if (process.env.ANTHROPIC_API_KEY) {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 16384,
          temperature: 0.3
        });

        const content = response.content[0];
        if (content.type === 'text') {
          // Extract JSON from response
          const jsonMatch = content.text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        }
      }

      // Fallback to OpenAI
      if (process.env.OPENAI_API_KEY) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 16384,
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens;
        if (typeof cachedTokens === 'number') {
          logger.info('OpenAI real-code-generator cache metrics', {
            cachedTokens,
            promptTokens: response.usage?.prompt_tokens,
          });
        }

        const content = response.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content);
          return parsed.modifications || parsed;
        }
      }

      throw new Error('No AI service available for code generation');

    } catch (error) {
      logger.error(`AI generation failed: ${error}`);
      throw error;
    }
  }

  private async applyModifications(
    projectId: number,
    existingFiles: File[],
    modifications: CodeModification[]
  ): Promise<CodeGenerationResult> {
    const rollbackData: Array<{ path: string; content: string }> = [];
    const appliedModifications: CodeModification[] = [];
    let explanation = '';

    try {
      for (const mod of modifications) {
        const existingFile = existingFiles.find(f => f.name === mod.filePath);

        switch (mod.action) {
          case 'create':
            if (existingFile) {
              logger.warn(`File ${mod.filePath} already exists, modifying instead`);
              mod.action = 'modify';
              mod.oldContent = existingFile.content || '';
            }

            // Create new file
            await storage.createFile({
              projectId,
              name: mod.filePath,
              content: mod.newContent || '',
              isFolder: false
            });

            appliedModifications.push(mod);
            explanation += `Created new file: ${mod.filePath}\n`;
            break;

          case 'modify':
            if (!existingFile) {
              logger.warn(`File ${mod.filePath} doesn't exist, creating instead`);
              mod.action = 'create';
            } else {
              // Store rollback data
              rollbackData.push({
                path: mod.filePath,
                content: existingFile.content || ''
              });

              mod.oldContent = existingFile.content || '';

              // Calculate changes
              const patches = this.dmp.patch_make(mod.oldContent, mod.newContent || '');
              mod.changes = this.patchesToChanges(patches, mod.oldContent);

              // Update file
              await storage.updateFile(existingFile.id, {
                content: mod.newContent || ''
              });
            }

            appliedModifications.push(mod);
            explanation += `Modified file: ${mod.filePath}\n`;
            break;

          case 'delete':
            if (!existingFile) {
              logger.warn(`File ${mod.filePath} doesn't exist, skipping delete`);
              continue;
            }

            // Store rollback data
            rollbackData.push({
              path: mod.filePath,
              content: existingFile.content || ''
            });

            // Delete file
            await storage.deleteFile(existingFile.id);

            appliedModifications.push(mod);
            explanation += `Deleted file: ${mod.filePath}\n`;
            break;
        }
      }

      // Generate detailed explanation
      explanation = await this.generateExplanation(appliedModifications, modifications);

      return {
        success: true,
        modifications: appliedModifications,
        explanation,
        rollbackData: { files: rollbackData }
      };

    } catch (error) {
      logger.error(`Failed to apply modifications: ${error}`);
      
      // Attempt rollback
      await this.rollback(projectId, rollbackData);
      
      throw error;
    }
  }

  private patchesToChanges(patches: any[], originalContent: string): any[] {
    const lines = originalContent.split('\n');
    const changes: any[] = [];
    
    for (const patch of patches) {
      let lineNumber = 1;
      
      for (const diff of patch.diffs) {
        const diffLines = diff[1].split('\n');
        
        switch (diff[0]) {
          case -1: // Delete
            changes.push({
              lineNumber,
              type: 'remove',
              content: diff[1]
            });
            break;
            
          case 1: // Insert
            changes.push({
              lineNumber,
              type: 'add',
              content: diff[1]
            });
            break;
            
          case 0: // Equal
            lineNumber += diffLines.length - 1;
            break;
        }
      }
    }
    
    return changes;
  }

  private async generateExplanation(
    applied: CodeModification[],
    requested: CodeModification[]
  ): Promise<string> {
    let explanation = 'Code Generation Summary:\n\n';
    
    explanation += `Requested ${requested.length} modifications, applied ${applied.length} successfully.\n\n`;
    
    for (const mod of applied) {
      explanation += `• ${mod.action.toUpperCase()} ${mod.filePath}\n`;
      
      if (mod.changes && mod.changes.length > 0) {
        const adds = mod.changes.filter(c => c.type === 'add').length;
        const removes = mod.changes.filter(c => c.type === 'remove').length;
        const modifies = mod.changes.filter(c => c.type === 'modify').length;
        
        explanation += `  Changes: +${adds} additions, -${removes} deletions, ~${modifies} modifications\n`;
      }
    }
    
    return explanation;
  }

  private async rollback(projectId: number, rollbackData: Array<{ path: string; content: string }>) {
    logger.info(`Rolling back ${rollbackData.length} file changes`);
    
    for (const data of rollbackData) {
      try {
        const files = await storage.getFilesByProject(projectId);
        const file = files.find(f => f.name === data.path);
        
        if (file) {
          await storage.updateFile(file.id, { content: data.content });
        }
      } catch (error) {
        logger.error(`Failed to rollback ${data.path}: ${error}`);
      }
    }
  }

  async testCode(projectId: number, testCommand?: string): Promise<{
    success: boolean;
    output: string;
    errors: string[];
  }> {
    try {
      const { dockerExecutor } = require('../execution/docker-executor');
      const project = await storage.getProject(projectId);
      const files = await storage.getFilesByProject(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Execute test in container
      const result = await dockerExecutor.executeProject({
        projectId,
        language: project.language || 'nodejs',
        command: testCommand || 'npm test',
        files,
        timeout: 30 // 30 second timeout for tests
      });

      // Wait for completion
      await new Promise(resolve => {
        dockerExecutor.on('stopped', (data: any) => {
          if (data.containerId === result.containerId) {
            resolve(data);
          }
        });
      });

      return {
        success: result.exitCode === 0,
        output: result.output.join('\n'),
        errors: result.errorOutput
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        errors: [error.message]
      };
    }
  }
}

export const realCodeGenerator = new RealCodeGenerator();