import Anthropic from '@anthropic-ai/sdk';
import { type IStorage } from '../storage';
import type { File, Project } from '@shared/schema';
import { aiSecurityService, type ValidatedAction } from './ai-security.service';
import { aiApprovalQueue } from './ai-approval-queue.service';
import { aiProviderManager, type AIModel } from '../ai/ai-provider-manager';
import { createLogger } from '../utils/logger';
import { previewEvents } from '../preview/preview-websocket';

const logger = createLogger('project-ai-agent-service');

/**
 * Project AI Agent Service
 * Handles AI-powered code generation for user projects
 * Supports multiple AI providers: OpenAI, Anthropic, Gemini, xAI, etc.
 * Fortune 500-grade multi-provider architecture
 */
export class ProjectAIAgentService {
  private storage: IStorage;
  
  // Legacy Anthropic client for backward compatibility
  private anthropic: Anthropic;

  constructor(storage: IStorage) {
    this.storage = storage;
    
    // Initialize legacy Anthropic client for backward compatibility
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.warn('[ProjectAIAgent] No ANTHROPIC_API_KEY configured. Anthropic features will be unavailable. Set ANTHROPIC_API_KEY environment variable or use a different AI provider.');
    }
    this.anthropic = new Anthropic({ apiKey: apiKey || 'not-configured' });
  }
  
  /**
   * Get available AI models across all providers
   */
  getAvailableModels(): AIModel[] {
    return aiProviderManager.getAvailableModels();
  }

  /**
   * Process a chat message and generate code/files with security controls
   * Streams responses back to client
   * 
   * Security: Rate limiting, path validation, and audit logging applied
   * 
   * @param modelId Optional model ID to use (e.g., "gpt-4.1", "claude-sonnet-4-6")
   *                If not provided, uses user's preferred model or first available provider
   */
  async *processChat(
    userId: string,
    projectId: string,
    message: string,
    context?: {
      file?: string;
      code?: string;
      history?: any[];
      modelId?: string;
    }
  ): AsyncGenerator<string> {
    // SECURITY: Check rate limits before processing
    const rateLimit = await aiSecurityService.checkRateLimit(userId, projectId);
    if (!rateLimit.allowed) {
      yield JSON.stringify({ 
        type: 'error', 
        content: `Rate limit exceeded. ${rateLimit.remaining} requests remaining. Try again at ${rateLimit.resetAt?.toISOString()}`
      });
      return;
    }
    try {
      // Get project details
      const project = await this.storage.getProject(projectId);
      if (!project) {
        yield JSON.stringify({ type: 'error', content: 'Project not found' });
        return;
      }

      // Get existing files for context
      const files = await this.storage.getProjectFiles(projectId);
      const fileList = files.map(f => f.path).join('\n');

      // Build system prompt with file context if provided
      let systemPrompt = `You are a world-class full-stack developer and UI designer helping to build a ${project.language} project named "${project.name}".

Current project files:
${fileList || 'No files yet'}

When the user asks you to build something:
1. Analyze their request thoroughly — think about ALL features a real user would need
2. Create ALL necessary files with complete, polished, working code (minimum 8-15 files for any app)
3. Respond with JSON actions to create/edit files
4. Use this exact JSON format:

{
  "type": "action",
  "action": {
    "type": "create_file" | "edit_file",
    "path": "filename.ext",
    "content": "full file content here"
  }
}

For explanations, use:
{
  "type": "message",
  "content": "your explanation"
}

MANDATORY DESIGN STANDARDS:
- Always use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Always use Inter font: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
- Premium color palette: Primary #667eea, Secondary #764ba2, Accent #06b6d4
- Gradient hero sections, glassmorphism cards, smooth hover animations
- Dark mode support, mobile-first responsive design
- Semantic HTML, ARIA labels, proper heading hierarchy
- The result MUST look like a premium SaaS product — not a basic tutorial page
- Include proper footer, navigation, and all sections users would expect
- ALWAYS use real images from Unsplash (https://images.unsplash.com/photo-{ID}?w=800&h=600&fit=crop) or Picsum (https://picsum.photos/800/600?random=N) — NEVER use emoji or placeholder text as images
- For avatars use https://i.pravatar.cc/150?img=N

Always generate COMPLETE, production-ready code. No placeholders or TODOs.`;

      // IMPORTANT: Merge file/code context into system prompt to preserve context
      if (context?.file && context?.code) {
        systemPrompt += `\n\nUser is currently viewing file: ${context.file}\n\nCurrent code:\n${context.code}`;
      }

      // Build messages array (no system role messages)
      const messages: any[] = [];

      // Add history if provided - use last 20 messages for better conversation memory
      if (context?.history) {
        messages.push(...context.history.slice(-20));
      }

      // Add user message
      messages.push({
        role: 'user',
        content: message
      });

      // MULTI-PROVIDER: Get user's preferred model or use first available
      let selectedModelId = context?.modelId;
      
      // If no model specified, try to get user's preference from database
      if (!selectedModelId) {
        const user = await this.storage.getUser(userId);
        selectedModelId = user?.preferredAiModel || undefined;
      }
      
      // Smart fallback: Use first available model if no preference set
      const availableModels = aiProviderManager.getAvailableModels();
      if (availableModels.length === 0) {
        yield JSON.stringify({ 
          type: 'error', 
          content: 'No AI providers configured. Please configure at least one API key (OpenAI, Anthropic, Gemini, xAI, or Groq).'
        });
        return;
      }
      
      if (!selectedModelId) {
        selectedModelId = availableModels[0].id;
        logger.info(`[ProjectAIAgent] No model preference found, using fallback: ${selectedModelId}`);
      }
      
      // Get the model and provider
      const model = aiProviderManager.getModelById(selectedModelId);
      if (!model) {
        yield JSON.stringify({ 
          type: 'error', 
          content: `Model "${selectedModelId}" not found or provider not configured`
        });
        return;
      }
      
      logger.info(`[ProjectAIAgent] Using model: ${model.name} (${model.id}) from provider: ${model.provider}`);
      
      // Stream response from the selected AI provider
      const stream = await aiProviderManager.streamChat(
        selectedModelId,
        messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        {
          system: systemPrompt,
          max_tokens: 16384,
          temperature: 0.4,
        }
      );

      let fullResponse = '';

      for await (const chunk of stream) {
        if (chunk) {
          fullResponse += chunk;
          yield chunk;
        }
      }

      // Parse and execute actions from the response
      yield '\n';
      
      // SECURITY: Use strict validation to extract and validate AI actions
      // This prevents prompt injection and arbitrary file access
      const { actions: validActions, rejected } = aiSecurityService.extractValidActions(
        fullResponse,
        projectId
      );
      
      // Log rejected actions for security monitoring
      if (rejected.length > 0) {
        logger.warn('[ProjectAIAgent] Rejected insecure actions');
        yield JSON.stringify({ 
          type: 'security_warning', 
          message: `${rejected.length} actions blocked by security filters`
        }) + '\n';
      }
      
      // SECURITY: Add validated actions to approval queue (database-backed)
      // User must explicitly approve before execution
      for (const action of validActions) {
        const actionId = await aiApprovalQueue.addAction(userId, projectId, action);
        
        yield JSON.stringify({ 
          type: 'action_pending_approval', 
          actionId,
          action,
          message: 'Action requires approval. Use /api/projects/:id/ai/approve/:actionId to approve.'
        }) + '\n';
      }
      
      // Log rejected actions for security monitoring AND send error to frontend
      for (const rejection of rejected) {
        await aiSecurityService.logAction(
          userId,
          projectId,
          rejection.action,
          { success: false, error: `Rejected: ${rejection.reason}` }
        );
        
        // SECURITY: Send rejection message to frontend so user sees why action was blocked
        yield JSON.stringify({ 
          type: 'security_blocked', 
          action: rejection.action,
          reason: rejection.reason,
          message: `⚠️ **Security Block**: ${rejection.reason}\n\nThis action was blocked by Fortune 500 security controls to protect your project.`
        }) + '\n';
      }

    } catch (error: any) {
      logger.error('[ProjectAIAgent] Error processing chat:', error);
      yield JSON.stringify({ 
        type: 'error', 
        content: error.message || 'An error occurred while processing your request' 
      });
    }
  }

  /**
   * Generate build actions from prompt (for autonomous build endpoint)
   * Returns validated actions without executing them
   * Supports multi-provider model selection
   */
  async generateBuildActions(
    userId: string,
    projectId: string,
    prompt: string,
    modelId?: string
  ): Promise<{ actions: ValidatedAction[], rejected: any[] }> {
    try {
      // Get project details
      const project = await this.storage.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get existing files for context
      const files = await this.storage.getProjectFiles(projectId);
      const fileList = files.map(f => f.path).join('\n');

      // Build system prompt for build mode
      const systemPrompt = `You are a world-class full-stack developer and UI designer building a ${project.language} project named "${project.name}".

Current project files:
${fileList || 'No files yet'}

User wants to build:
${prompt}

Generate ALL necessary files with complete, working code. Respond with JSON actions:
{
  "type": "action",
  "action": {
    "type": "create_file",
    "path": "filename.ext",
    "content": "full file content"
  }
}

CRITICAL REQUIREMENTS:
1. Generate a COMPLETE, FEATURE-RICH application — minimum 8-15 files
2. Every HTML file MUST include Tailwind CSS CDN and Inter font
3. Use premium design: gradients (#667eea → #764ba2), glassmorphism, rounded-2xl cards, shadow-xl
4. Include dark mode support, animations (fadeIn), smooth transitions
5. Mobile-first responsive design with proper breakpoints
6. Include ALL necessary files: HTML pages, CSS, JS modules, config, data files
7. NO placeholders, NO TODOs — every file must be complete and production-ready
8. The final result must look like a premium SaaS product, not a basic tutorial app
9. Include a proper footer, navigation, and all sections a real user would expect
10. ALWAYS use real images from Unsplash (https://images.unsplash.com/photo-{ID}?w=800&h=600&fit=crop) or Picsum (https://picsum.photos/800/600?random=N) — NEVER use emoji or placeholder text as images`;

      // Use specified model or intelligently fallback to first available model
      let selectedModel = modelId;
      if (!selectedModel) {
        const availableModels = aiProviderManager.getAvailableModels();
        if (availableModels.length === 0) {
          throw new Error('No AI providers configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or XAI_API_KEY environment variable.');
        }
        selectedModel = availableModels[0].id; // Smart fallback to first available
      }
      
      // Generate response using AIProviderManager (multi-provider support)
      const fullResponse = await aiProviderManager.generateChat(
        selectedModel,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        {
          max_tokens: 16384,
          temperature: 0.4,
        }
      );

      // Extract and validate actions
      const { actions: validActions, rejected } = aiSecurityService.extractValidActions(
        fullResponse,
        projectId
      );

      return { actions: validActions, rejected };
    } catch (error: any) {
      logger.error('[ProjectAIAgent] Error generating build actions:', error);
      throw error;
    }
  }

  /**
   * Execute a validated action (create file, edit file, etc.)
   * Security: Only called after action passes validation
   */
  private async executeAction(projectId: string, action: ValidatedAction): Promise<any> {
    try {
      switch (action.type) {
        case 'create_file':
          return await this.createFile(projectId, action.path, action.content);
        
        case 'edit_file':
          return await this.editFile(projectId, action.path, action.content);
        
        default:
          return { success: false, error: 'Unknown action type' };
      }
    } catch (error: any) {
      logger.error('[ProjectAIAgent] Error executing action:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new file in the project
   */
  private async createFile(projectId: string, filePath: string, content: string): Promise<any> {
    try {
      const fileName = filePath.split('/').pop() || filePath;
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';

      // Convert projectId to number as required by storage interface
      const numericProjectId = parseInt(projectId, 10);
      if (isNaN(numericProjectId)) {
        throw new Error(`Invalid projectId: ${projectId}`);
      }

      const file = await this.storage.createFile({
        projectId: numericProjectId,
        name: fileName,
        path: filePath,
        content,
        parentId: null,
        isDirectory: false,
      });
      
      previewEvents.emit('preview:file-change', { projectId: numericProjectId, filePath: filePath, changeType: 'create' });
      
      return { 
        success: true, 
        file: {
          id: file.id,
          path: file.path,
          name: file.name
        }
      };
    } catch (error: any) {
      logger.error('[ProjectAIAgent] Error creating file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Edit an existing file
   */
  private async editFile(projectId: string, filePath: string, content: string): Promise<any> {
    try {
      // Find the file by path
      const files = await this.storage.getProjectFiles(projectId);
      const file = files.find(f => f.path === filePath);

      if (!file) {
        // File doesn't exist, create it
        return await this.createFile(projectId, filePath, content);
      }

      // Update the file
      await this.storage.updateFile(file.id, { content });
      
      return { 
        success: true, 
        file: {
          id: file.id,
          path: file.path,
          name: file.name
        }
      };
    } catch (error: any) {
      logger.error('[ProjectAIAgent] Error editing file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect programming language from filename
   */
  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
    };
    return languageMap[ext || ''] || 'plaintext';
  }
}

// Export singleton instance
let instance: ProjectAIAgentService | null = null;

export const getProjectAIAgent = (storage: IStorage): ProjectAIAgentService => {
  if (!instance) {
    instance = new ProjectAIAgentService(storage);
  }
  return instance;
};
