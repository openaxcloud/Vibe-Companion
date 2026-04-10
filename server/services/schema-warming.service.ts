/**
 * Schema Warming Service - Background Data Structure Pre-Drafting
 * 
 * Like Replit's approach: Begins drafting the application's data structure
 * in the background while the user is still chatting. By the time the user
 * clicks "Deploy", the core schema is often already "warmed up."
 * 
 * This provides:
 * - Background schema generation while user chats
 * - Pre-warmed database schemas for instant deployment
 * - Status tracking for UI feedback
 * 
 * @author E-Code Platform
 * @version 1.0.0 - Replit-style background warming
 * @since December 2025
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('schema-warming');

export type WarmingStatus = 'idle' | 'analyzing' | 'warming' | 'ready' | 'error';

export interface WarmingProgress {
  status: WarmingStatus;
  progress: number; // 0-100
  message: string;
  schemaPreview?: string;
  estimatedTimeRemaining?: number; // ms
  startedAt?: number;
  completedAt?: number;
}

export interface SchemaTemplate {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey?: boolean;
      references?: string;
    }>;
  }>;
  relations: Array<{
    from: string;
    to: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }>;
}

// Cache for warmed schemas per project
const warmingCache = new Map<string, {
  progress: WarmingProgress;
  schema?: SchemaTemplate;
  prompt?: string;
}>();

class SchemaWarmingService extends EventEmitter {
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;
    logger.info('[SchemaWarming] Service initialized - background schema pre-drafting enabled');
    this.isInitialized = true;
  }

  /**
   * Start background schema warming for a project.
   * Called when user starts typing/chatting.
   */
  async startWarming(projectId: string, prompt: string): Promise<void> {
    const existingCache = warmingCache.get(projectId);
    
    // If already warming with same prompt, skip
    if (existingCache?.prompt === prompt && existingCache.progress.status !== 'error') {
      logger.debug(`[SchemaWarming] Already warming project ${projectId}`);
      return;
    }

    // Initialize warming state
    const progress: WarmingProgress = {
      status: 'analyzing',
      progress: 0,
      message: 'Analyzing your app requirements...',
      startedAt: Date.now(),
    };

    warmingCache.set(projectId, { progress, prompt });
    this.emit('progress', { projectId, progress });

    try {
      // Phase 1: Analyze prompt for data requirements (simulated 500ms)
      await this.analyzePrompt(projectId, prompt);

      // Phase 2: Generate schema template (simulated 1000ms)
      await this.generateSchema(projectId, prompt);

      // Phase 3: Finalize warming
      this.finalizeWarming(projectId);
    } catch (error) {
      this.handleError(projectId, error);
    }
  }

  /**
   * Phase 1: Analyze prompt for data structure hints
   */
  private async analyzePrompt(projectId: string, prompt: string): Promise<void> {
    const cache = warmingCache.get(projectId);
    if (!cache) return;

    cache.progress = {
      ...cache.progress,
      status: 'analyzing',
      progress: 25,
      message: 'Identifying data models from your description...',
    };
    this.emit('progress', { projectId, progress: cache.progress });

    // Simulate analysis delay (in production, this would call AI)
    await new Promise(resolve => setTimeout(resolve, 500));

    cache.progress.progress = 40;
    cache.progress.message = 'Mapping relationships between entities...';
    this.emit('progress', { projectId, progress: cache.progress });
  }

  /**
   * Phase 2: Generate schema template based on analysis
   */
  private async generateSchema(projectId: string, prompt: string): Promise<void> {
    const cache = warmingCache.get(projectId);
    if (!cache) return;

    cache.progress = {
      ...cache.progress,
      status: 'warming',
      progress: 60,
      message: 'Pre-drafting database schema...',
    };
    this.emit('progress', { projectId, progress: cache.progress });

    // Generate schema based on prompt keywords
    const schema = this.inferSchemaFromPrompt(prompt);
    cache.schema = schema;

    await new Promise(resolve => setTimeout(resolve, 800));

    cache.progress.progress = 85;
    cache.progress.message = 'Optimizing schema structure...';
    cache.progress.schemaPreview = this.generateSchemaPreview(schema);
    this.emit('progress', { projectId, progress: cache.progress });

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Infer schema structure from prompt keywords
   */
  private inferSchemaFromPrompt(prompt: string): SchemaTemplate {
    const promptLower = prompt.toLowerCase();
    const tables: SchemaTemplate['tables'] = [];
    const relations: SchemaTemplate['relations'] = [];

    // Always include users table for most apps
    if (promptLower.includes('user') || promptLower.includes('auth') || 
        promptLower.includes('login') || promptLower.includes('account')) {
      tables.push({
        name: 'users',
        columns: [
          { name: 'id', type: 'serial', nullable: false, primaryKey: true },
          { name: 'email', type: 'varchar(255)', nullable: false },
          { name: 'password_hash', type: 'varchar(255)', nullable: true },
          { name: 'name', type: 'varchar(255)', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
      });
    }

    // E-commerce patterns
    if (promptLower.includes('product') || promptLower.includes('store') || 
        promptLower.includes('shop') || promptLower.includes('ecommerce')) {
      tables.push({
        name: 'products',
        columns: [
          { name: 'id', type: 'serial', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar(255)', nullable: false },
          { name: 'description', type: 'text', nullable: true },
          { name: 'price', type: 'decimal(10,2)', nullable: false },
          { name: 'image_url', type: 'varchar(500)', nullable: true },
        ],
      });

      if (promptLower.includes('cart') || promptLower.includes('order')) {
        tables.push({
          name: 'orders',
          columns: [
            { name: 'id', type: 'serial', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'integer', nullable: false, references: 'users.id' },
            { name: 'status', type: 'varchar(50)', nullable: false },
            { name: 'total', type: 'decimal(10,2)', nullable: false },
            { name: 'created_at', type: 'timestamp', nullable: false },
          ],
        });
        relations.push({ from: 'orders', to: 'users', type: 'many-to-many' });
      }
    }

    // Blog/Content patterns
    if (promptLower.includes('blog') || promptLower.includes('post') || 
        promptLower.includes('article') || promptLower.includes('content')) {
      tables.push({
        name: 'posts',
        columns: [
          { name: 'id', type: 'serial', nullable: false, primaryKey: true },
          { name: 'title', type: 'varchar(255)', nullable: false },
          { name: 'content', type: 'text', nullable: false },
          { name: 'author_id', type: 'integer', nullable: true, references: 'users.id' },
          { name: 'published_at', type: 'timestamp', nullable: true },
        ],
      });
      relations.push({ from: 'posts', to: 'users', type: 'many-to-many' });
    }

    // Task/Todo patterns
    if (promptLower.includes('task') || promptLower.includes('todo') || 
        promptLower.includes('checklist') || promptLower.includes('list')) {
      tables.push({
        name: 'tasks',
        columns: [
          { name: 'id', type: 'serial', nullable: false, primaryKey: true },
          { name: 'title', type: 'varchar(255)', nullable: false },
          { name: 'completed', type: 'boolean', nullable: false },
          { name: 'user_id', type: 'integer', nullable: true, references: 'users.id' },
          { name: 'due_date', type: 'timestamp', nullable: true },
        ],
      });
    }

    // Default: at least a generic items table
    if (tables.length === 0) {
      tables.push({
        name: 'items',
        columns: [
          { name: 'id', type: 'serial', nullable: false, primaryKey: true },
          { name: 'name', type: 'varchar(255)', nullable: false },
          { name: 'data', type: 'jsonb', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
      });
    }

    return { tables, relations };
  }

  /**
   * Generate a human-readable schema preview
   */
  private generateSchemaPreview(schema: SchemaTemplate): string {
    const tableNames = schema.tables.map(t => t.name);
    const columnCount = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
    return `${tableNames.length} table${tableNames.length > 1 ? 's' : ''} (${tableNames.join(', ')}) with ${columnCount} columns ready`;
  }

  /**
   * Finalize warming process
   */
  private finalizeWarming(projectId: string): void {
    const cache = warmingCache.get(projectId);
    if (!cache) return;

    cache.progress = {
      ...cache.progress,
      status: 'ready',
      progress: 100,
      message: 'Schema warmed and ready for deployment',
      completedAt: Date.now(),
      estimatedTimeRemaining: 0,
    };

    const duration = cache.progress.completedAt! - cache.progress.startedAt!;
    logger.info(`[SchemaWarming] Project ${projectId} schema warmed in ${duration}ms`, {
      tables: cache.schema?.tables.length,
      preview: cache.progress.schemaPreview,
    });

    this.emit('progress', { projectId, progress: cache.progress });
    this.emit('ready', { projectId, schema: cache.schema });
  }

  /**
   * Handle warming errors
   */
  private handleError(projectId: string, error: unknown): void {
    const cache = warmingCache.get(projectId);
    if (!cache) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    cache.progress = {
      ...cache.progress,
      status: 'error',
      progress: 0,
      message: `Schema warming failed: ${errorMessage}`,
    };

    logger.error(`[SchemaWarming] Error warming project ${projectId}:`, error);
    this.emit('progress', { projectId, progress: cache.progress });
    this.emit('error', { projectId, error: errorMessage });
  }

  /**
   * Get current warming status for a project
   */
  getStatus(projectId: string): WarmingProgress {
    const cache = warmingCache.get(projectId);
    return cache?.progress || {
      status: 'idle',
      progress: 0,
      message: 'Schema not yet warmed',
    };
  }

  /**
   * Get warmed schema for a project
   */
  getWarmerdSchema(projectId: string): SchemaTemplate | undefined {
    return warmingCache.get(projectId)?.schema;
  }

  /**
   * Check if schema is ready for deployment
   */
  isReady(projectId: string): boolean {
    const cache = warmingCache.get(projectId);
    return cache?.progress.status === 'ready';
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId: string): void {
    warmingCache.delete(projectId);
    logger.debug(`[SchemaWarming] Cache cleared for project ${projectId}`);
  }

  /**
   * Get all active warming sessions (for monitoring)
   */
  getActiveWarmingSessions(): Array<{ projectId: string; progress: WarmingProgress }> {
    const sessions: Array<{ projectId: string; progress: WarmingProgress }> = [];
    for (const [projectId, cache] of warmingCache) {
      if (cache.progress.status === 'analyzing' || cache.progress.status === 'warming') {
        sessions.push({ projectId, progress: cache.progress });
      }
    }
    return sessions;
  }
}

export const schemaWarming = new SchemaWarmingService();
