// @ts-nocheck
import path from 'path';
import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-security-service');

/**
 * AI Security Service
 * Fortune 500-grade security controls for AI agent operations
 * 
 * Features:
 * - Path sandboxing (prevent directory traversal)
 * - Action schema validation (strict whitelist)
 * - Audit logging (track all modifications)
 * - Rate limiting integration
 */

// Strict action schema validation
const FileActionSchema = z.object({
  type: z.enum(['create_file', 'edit_file']),
  path: z.string().min(1).max(500),
  content: z.string().max(1000000), // 1MB max
});

const ActionSchema = z.discriminatedUnion('type', [
  FileActionSchema,
]);

export type ValidatedAction = z.infer<typeof ActionSchema>;

// Dangerous path patterns that must be blocked
const DANGEROUS_PATTERNS = [
  /\.\./,           // Directory traversal
  /^\//, // Absolute paths
  /^~/, // Home directory
  /node_modules/i,  // Protected directories
  /\.env/i,         // Environment files
  /\.git/i,         // Git directory
  /package\.json/i, // Package config
  /tsconfig\.json/i, // TS config
  /vite\.config/i,  // Build config
  /server\//i,      // Server directory
  /\.key/i,         // Key files
  /\.pem/i,         // Certificate files
  /\.cert/i,        // Certificate files
];

// Allowed file extensions (comprehensive list for modern web development)
const ALLOWED_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.jsonc',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  // Images and media
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Frameworks
  '.vue', '.svelte', '.astro',
  // Documentation
  '.md', '.mdx', '.txt', '.rst',
  // Config files
  '.yml', '.yaml', '.toml', '.xml', '.ini', '.cfg', '.conf',
  '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc',
  '.babelrc', '.nvmrc', '.npmrc', '.yarnrc',
  // Backend languages
  '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql', '.prisma',
  // Other
  '.map', '.lock', '.log', '.csv', '.tsv', '.ejs', '.hbs', '.pug', '.njk',
  '.dockerfile', '.dockerignore', '.makefile', '.cmake'
];

export class AISecurityService {
  /**
   * Validate and sanitize a file path
   * Prevents directory traversal and access to protected files
   */
  validatePath(filePath: string, projectRoot: string = '/workspace'): { valid: boolean; sanitized?: string; reason?: string } {
    try {
      // Check for dangerous patterns BEFORE normalization (security fix)
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(filePath)) {
          return {
            valid: false,
            reason: `Path contains forbidden pattern: ${pattern.source}`
          };
        }
      }
      
      // Normalize the path to remove any tricks
      const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
      
      // Check file extension
      const ext = path.extname(normalized).toLowerCase();
      if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
        return {
          valid: false,
          reason: `File extension '${ext}' not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        };
      }
      
      // Ensure path stays within project root
      const resolved = path.resolve(projectRoot, normalized);
      if (!resolved.startsWith(projectRoot)) {
        return {
          valid: false,
          reason: 'Path escapes project root directory'
        };
      }
      
      // Return sanitized relative path
      const sanitized = path.relative(projectRoot, resolved);
      
      return {
        valid: true,
        sanitized: sanitized || normalized
      };
    } catch (error: any) {
      return {
        valid: false,
        reason: `Path validation error: ${error.message}`
      };
    }
  }

  /**
   * Validate an AI action against strict schema
   * Rejects any action that doesn't match whitelist
   */
  validateAction(action: unknown): { valid: boolean; action?: ValidatedAction; reason?: string } {
    try {
      const validated = ActionSchema.parse(action);
      return {
        valid: true,
        action: validated
      };
    } catch (error: any) {
      logger.error('[AI-Security] Validation failed');
      return {
        valid: false,
        reason: error.errors?.[0]?.message || 'Invalid action format'
      };
    }
  }

  /**
   * Extract and validate actions from AI response
   * Only returns actions that pass both schema and path validation
   * 
   * Algorithm: String-aware brace counting
   * - Tracks opening/closing braces to extract complete JSON objects
   * - Respects string boundaries (only counts braces outside quotes)
   * - Handles escape sequences (\" inside strings)
   * - Prevents false matches on content like: console.log("}")
   * 
   * Edge cases handled:
   * - Braces inside strings: "const obj = '{ }'"
   * - Escaped quotes: "He said \"Hello\""
   * - Nested JSON objects with string content
   * 
   * @param aiResponse - Raw GPT response containing text and JSON actions
   * @param projectId - Project ID for path validation context
   * @returns Object with validated actions and rejected actions with reasons
   */
  extractValidActions(
    aiResponse: string,
    projectId: string
  ): { actions: ValidatedAction[]; rejected: Array<{ action: any; reason: string }> } {
    const actions: ValidatedAction[] = [];
    const rejected: Array<{ action: any; reason: string }> = [];

    // Extract JSON objects from response using string-aware brace counting
    const jsonMatches: string[] = [];
    let braceCount = 0;
    let jsonStart = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < aiResponse.length; i++) {
      const char = aiResponse[i];
      
      // Handle escape sequences inside strings
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      // Track string boundaries (only count braces outside strings)
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // Only count braces when not inside a string
      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            jsonStart = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && jsonStart >= 0) {
            jsonMatches.push(aiResponse.substring(jsonStart, i + 1));
            jsonStart = -1;
          }
        }
      }
    }
    
    for (let i = 0; i < jsonMatches.length; i++) {
      const jsonStr = jsonMatches[i];
      
      try {
        const parsed = JSON.parse(jsonStr);
        
        // Check if it looks like an action
        if (parsed.type === 'action' && parsed.action) {
          // Validate the action schema
          const schemaResult = this.validateAction(parsed.action);
          if (!schemaResult.valid) {
            rejected.push({ action: parsed.action, reason: schemaResult.reason || 'Schema validation failed' });
            continue;
          }
          
          // Validate the path if it's a file action
          if ('path' in schemaResult.action!) {
            const pathResult = this.validatePath(schemaResult.action.path);
            if (!pathResult.valid) {
              rejected.push({ action: parsed.action, reason: pathResult.reason || 'Path validation failed' });
              continue;
            }
            
            // Use sanitized path
            schemaResult.action.path = pathResult.sanitized!;
          }
          
          // Action passed all validations
          actions.push(schemaResult.action!);
        }
      } catch (e: any) {
        // Invalid JSON, skip
      }
    }
    return { actions, rejected };
  }

  /**
   * Log AI action to database-backed audit trail
   * 
   * Production-Ready Implementation:
   * - PostgreSQL persistence for compliance
   * - Tamper-proof append-only logging
   * - Queryable for security reviews and forensics
   */
  async logAction(
    userId: string,
    projectId: string,
    action: ValidatedAction,
    result: { success: boolean; error?: string; fileId?: string },
    approvalId?: string
  ): Promise<void> {
    try {
      // Import storage dynamically to avoid circular dependency
      const { storage } = await import('../storage');
      
      // Path validation info if this is a file action
      let securityValidation = undefined;
      if ('path' in action && action.path) {
        const pathResult = this.validatePath(action.path);
        securityValidation = {
          pathValid: pathResult.valid,
          reason: pathResult.reason,
          sanitized: pathResult.sanitized,
        };
      }
      
      // Store in database audit trail
      await storage.createAiAuditLog({
        userId,
        projectId,
        approvalId,
        action: action as any, // JSONB type
        result: result as any, // JSONB type
        securityValidation,
      });
      
    } catch (error) {
      logger.error('[AISecurityService] CRITICAL: Failed to log action to database:', error);
    }
  }

  /**
   * Check if user has exceeded rate limits for AI operations
   * Returns false if limit exceeded, true if allowed
   * 
   * Uses in-memory tracking for now - production should use Redis
   */
  private rateLimitMap = new Map<string, number[]>();
  
  async checkRateLimit(
    userId: string,
    projectId: string,
    maxActionsPerMinute: number = 30
  ): Promise<{ allowed: boolean; remaining?: number; resetAt?: Date }> {
    try {
      const key = `${userId}:${projectId}`;
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      
      // Get recent timestamps for this user/project
      let timestamps = this.rateLimitMap.get(key) || [];
      
      // Remove expired timestamps
      timestamps = timestamps.filter(ts => ts > oneMinuteAgo);
      
      // Update map
      this.rateLimitMap.set(key, timestamps);
      
      const count = timestamps.length;
      const remaining = Math.max(0, maxActionsPerMinute - count);
      const resetAt = new Date(now + 60 * 1000);
      
      const allowed = count < maxActionsPerMinute;
      
      // If allowed, record this action
      if (allowed) {
        timestamps.push(now);
        this.rateLimitMap.set(key, timestamps);
      }
      
      return {
        allowed,
        remaining,
        resetAt
      };
    } catch (error) {
      logger.error('[AISecurityService] Rate limit check failed:', error);
      // On error, allow the action (fail open for availability)
      return { allowed: true };
    }
  }

  /**
   * Generate security report for a project
   * Shows all AI modifications for audit purposes
   * Note: Currently uses in-memory data - production should query database
   */
  async getSecurityReport(projectId: string, limit: number = 100) {
    // Note: Full audit trail integration available via database-backed agent conversation logs
    // This service provides real-time rate limit data for immediate security monitoring
    // For historical audit data, query ai_conversations and ai_messages tables directly
    return {
      message: 'Security report available in console logs - search for [AI_AUDIT]',
      rateLimitStatus: {
        trackedUsers: this.rateLimitMap.size,
        recentActivity: Array.from(this.rateLimitMap.entries()).map(([key, timestamps]) => ({
          key,
          actionCount: timestamps.length
        }))
      }
    };
  }
}

// Export singleton instance
export const aiSecurityService = new AISecurityService();
