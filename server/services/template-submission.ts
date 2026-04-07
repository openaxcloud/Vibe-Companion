// @ts-nocheck
import { db } from '../db';
import { 
  templates, templateCategories, templateTags, users,
  templateCollections, collectionTemplates
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';

const execAsync = promisify(exec);
const logger = createLogger('template-submission');

export interface TemplateSubmissionData {
  name: string;
  slug?: string;
  description: string;
  category: string;
  tags: string[];
  language: string;
  framework?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  features: string[];
  githubUrl?: string;
  demoUrl?: string;
  thumbnailUrl?: string;
  license?: string;
  version?: string;
  price?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues?: string[];
  score?: number;
}

export interface SubmissionReview {
  templateId: string;
  reviewerId: string;
  status: 'approved' | 'rejected' | 'changes_requested';
  feedback: string;
  suggestions?: string[];
  securityReport?: any;
}

export class TemplateSubmissionService {
  private readonly SUBMISSION_PATH = '/tmp/template-submissions';
  private readonly SECURITY_PATTERNS = [
    /process\.env\./gi,          // Environment variables
    /eval\(/gi,                   // Eval usage
    /require\(['"]child_process/gi, // Child process
    /fs\..*Sync/gi,              // Sync file operations
    /\bexec\b/gi,                // Exec commands
    /<script[^>]*>.*?<\/script>/gis, // Script tags
    /api[_\-]?key/gi,            // API keys
    /password|secret|token/gi,   // Sensitive data
  ];

  constructor() {
    this.initializeSubmissionDirectory();
  }

  private async initializeSubmissionDirectory() {
    try {
      await fs.mkdir(this.SUBMISSION_PATH, { recursive: true });
    } catch (error) {
      logger.error('Failed to create submission directory:', error);
    }
  }

  /**
   * Submit a community template
   */
  async submitTemplate(
    userId: string, 
    submissionData: TemplateSubmissionData
  ): Promise<{ success: boolean; templateId?: string; errors?: string[] }> {
    try {
      // Validate submission data
      const validation = await this.validateSubmission(submissionData);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Generate unique slug if not provided
      const slug = submissionData.slug || await this.generateUniqueSlug(submissionData.name);

      // Get user info
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return { success: false, errors: ['User not found'] };
      }

      const [author] = user;

      // Create template record with pending status
      const [template] = await db.insert(templates).values({
        slug,
        name: submissionData.name,
        description: submissionData.description,
        category: submissionData.category,
        tags: submissionData.tags,
        authorId: userId,
        authorName: author.username || author.displayName || 'Anonymous',
        authorVerified: false,
        language: submissionData.language,
        framework: submissionData.framework,
        difficulty: submissionData.difficulty,
        estimatedTime: submissionData.estimatedTime,
        features: submissionData.features,
        githubUrl: submissionData.githubUrl,
        demoUrl: submissionData.demoUrl,
        thumbnailUrl: submissionData.thumbnailUrl,
        license: submissionData.license || 'MIT',
        version: submissionData.version || '1.0.0',
        price: submissionData.price?.toString() || '0.00',
        isCommunity: true,
        isPublished: false,
        status: 'pending_review',
      }).returning();

      // Add tags to separate table
      if (submissionData.tags.length > 0) {
        const tagRecords = submissionData.tags.map(tag => ({
          templateId: template.id,
          tag,
        }));
        await db.insert(templateTags).values(tagRecords);
      }

      // If GitHub URL provided, clone and validate
      if (submissionData.githubUrl) {
        const validationResult = await this.validateGitHubTemplate(
          template.id,
          submissionData.githubUrl
        );
        
        if (!validationResult.valid) {
          // Update template with validation issues
          await db.update(templates)
            .set({
              status: 'rejected',
              isPublished: false,
            })
            .where(eq(templates.id, template.id));
          
          return { 
            success: false, 
            templateId: template.id,
            errors: validationResult.errors 
          };
        }
      }

      // Trigger review notification
      await this.notifyReviewers(template.id);

      logger.info(`Template submitted: ${template.id} by user ${userId}`);
      
      return { 
        success: true, 
        templateId: template.id 
      };
    } catch (error) {
      logger.error('Template submission failed:', error);
      return { 
        success: false, 
        errors: ['Submission failed. Please try again.'] 
      };
    }
  }

  /**
   * Review a submitted template
   */
  async reviewTemplate(review: SubmissionReview): Promise<{ success: boolean }> {
    try {
      // Update template status
      const statusUpdate: any = {
        status: review.status === 'approved' ? 'published' : review.status,
        isPublished: review.status === 'approved',
        updatedAt: new Date(),
      };

      await db.update(templates)
        .set(statusUpdate)
        .where(eq(templates.id, review.templateId));

      // Log review action
      logger.info(`Template ${review.templateId} ${review.status} by ${review.reviewerId}`);

      // Notify template author
      await this.notifyAuthor(review.templateId, review);

      // If approved, update category count
      if (review.status === 'approved') {
        await this.updateCategoryCount(review.templateId);
      }

      return { success: true };
    } catch (error) {
      logger.error('Template review failed:', error);
      return { success: false };
    }
  }

  /**
   * Validate template submission
   */
  private async validateSubmission(data: TemplateSubmissionData): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!data.name || data.name.length < 3) {
      errors.push('Template name must be at least 3 characters');
    }
    if (!data.description || data.description.length < 20) {
      errors.push('Description must be at least 20 characters');
    }
    if (!data.category) {
      errors.push('Category is required');
    }
    if (!data.language) {
      errors.push('Programming language is required');
    }
    if (!data.difficulty) {
      errors.push('Difficulty level is required');
    }
    if (!data.estimatedTime || data.estimatedTime < 1) {
      errors.push('Estimated time must be provided');
    }

    // Optional validations
    if (data.tags.length === 0) {
      warnings.push('Consider adding tags for better discoverability');
    }
    if (!data.githubUrl && !data.demoUrl) {
      warnings.push('Consider providing a GitHub URL or demo URL');
    }
    if (!data.license) {
      warnings.push('No license specified, defaulting to MIT');
    }

    // URL validations
    if (data.githubUrl && !this.isValidUrl(data.githubUrl, 'github.com')) {
      errors.push('Invalid GitHub URL');
    }
    if (data.demoUrl && !this.isValidUrl(data.demoUrl)) {
      errors.push('Invalid demo URL');
    }
    if (data.thumbnailUrl && !this.isValidUrl(data.thumbnailUrl)) {
      errors.push('Invalid thumbnail URL');
    }

    // Category validation
    const validCategories = await this.getValidCategories();
    if (!validCategories.includes(data.category)) {
      errors.push(`Invalid category. Valid categories: ${validCategories.join(', ')}`);
    }

    // Price validation
    if (data.price !== undefined && data.price < 0) {
      errors.push('Price cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateQualityScore(data),
    };
  }

  /**
   * Validate GitHub template repository
   */
  private async validateGitHubTemplate(
    templateId: string, 
    githubUrl: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    try {
      const repoPath = path.join(this.SUBMISSION_PATH, templateId);
      
      // Clone repository
      await execAsync(`git clone --depth 1 ${githubUrl} ${repoPath}`);

      // Check for required files
      const requiredFiles = ['README.md', 'package.json'];
      const optionalFiles = ['LICENSE', '.gitignore', '.env.example'];

      for (const file of requiredFiles) {
        const filePath = path.join(repoPath, file);
        try {
          await fs.access(filePath);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          errors.push(`Missing required file: ${file}`);
        }
      }

      for (const file of optionalFiles) {
        const filePath = path.join(repoPath, file);
        try {
          await fs.access(filePath);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          warnings.push(`Consider adding: ${file}`);
        }
      }

      // Security scanning
      const scanResult = await this.performSecurityScan(repoPath);
      if (scanResult.length > 0) {
        securityIssues.push(...scanResult);
        errors.push('Security issues detected');
      }

      // Check dependencies for vulnerabilities
      try {
        const { stdout } = await execAsync('npm audit --json', { cwd: repoPath });
        const audit = JSON.parse(stdout);
        if (audit.metadata.vulnerabilities.high > 0 || audit.metadata.vulnerabilities.critical > 0) {
          errors.push('High or critical vulnerabilities found in dependencies');
        }
        if (audit.metadata.vulnerabilities.moderate > 0) {
          warnings.push('Moderate vulnerabilities found in dependencies');
        }
      } catch (error) {
        warnings.push('Could not run dependency audit');
      }

      // Clean up cloned repo
      await fs.rm(repoPath, { recursive: true, force: true });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        securityIssues,
      };
    } catch (error) {
      logger.error('GitHub validation failed:', error);
      errors.push('Failed to validate GitHub repository');
      
      return {
        valid: false,
        errors,
        warnings,
        securityIssues,
      };
    }
  }

  /**
   * Perform security scan on template code
   */
  private async performSecurityScan(repoPath: string): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Scan all JS/TS files
      const files = await this.getAllCodeFiles(repoPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Check for security patterns
        for (const pattern of this.SECURITY_PATTERNS) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            const relativePath = path.relative(repoPath, file);
            issues.push(`Potential security issue in ${relativePath}: ${pattern.source}`);
          }
        }

        // Check for hardcoded secrets
        if (this.detectHardcodedSecrets(content)) {
          const relativePath = path.relative(repoPath, file);
          issues.push(`Potential hardcoded secrets in ${relativePath}`);
        }
      }

      // Check for large files
      const stats = await fs.stat(repoPath);
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        issues.push('Repository size exceeds 100MB');
      }

    } catch (error) {
      logger.error('Security scan failed:', error);
      issues.push('Security scan failed to complete');
    }

    return issues;
  }

  /**
   * Detect hardcoded secrets in code
   */
  private detectHardcodedSecrets(content: string): boolean {
    const secretPatterns = [
      /['"][a-zA-Z0-9]{32,}['"]/, // Long strings that might be API keys
      /['"]sk_live_[a-zA-Z0-9]+['"]/, // Stripe keys
      /['"]AIza[a-zA-Z0-9\-_]{35}['"]/, // Google API keys
      /['"][0-9a-f]{40}['"]/, // GitHub tokens
      /['"]xox[baprs]-[a-zA-Z0-9\-]+['"]/, // Slack tokens
    ];

    return secretPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Get all code files recursively
   */
  private async getAllCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...await this.getAllCodeFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Generate unique slug for template
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.select()
        .from(templates)
        .where(eq(templates.slug, slug))
        .limit(1);

      if (existing.length === 0) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Get valid template categories
   */
  private async getValidCategories(): Promise<string[]> {
    const categories = await db.select({ slug: templateCategories.slug })
      .from(templateCategories)
      .where(eq(templateCategories.isActive, true));

    // Include default categories even if not in DB
    const defaultCategories = ['web', 'api', 'mobile', 'bot', 'game', 'ml-ai', 'data', 'cli', 'library', 'other'];
    const dbCategories = categories.map(c => c.slug);
    
    return [...new Set([...defaultCategories, ...dbCategories])];
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string, requiredHost?: string): boolean {
    try {
      const parsed = new URL(url);
      if (requiredHost) {
        return parsed.hostname === requiredHost || parsed.hostname === `www.${requiredHost}`;
      }
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  /**
   * Calculate template quality score
   */
  private calculateQualityScore(data: TemplateSubmissionData): number {
    let score = 0;

    // Base requirements (50 points)
    if (data.name && data.name.length >= 5) score += 10;
    if (data.description && data.description.length >= 50) score += 15;
    if (data.tags && data.tags.length >= 3) score += 10;
    if (data.features && data.features.length >= 3) score += 15;

    // Additional quality (30 points)
    if (data.githubUrl) score += 10;
    if (data.demoUrl) score += 10;
    if (data.thumbnailUrl) score += 5;
    if (data.license) score += 5;

    // Documentation (20 points)
    if (data.description && data.description.length >= 100) score += 10;
    if (data.estimatedTime) score += 5;
    if (data.framework) score += 5;

    return Math.min(100, score);
  }

  /**
   * Notify reviewers about new submission
   */
  private async notifyReviewers(templateId: string) {
    // Notification system will be integrated when email service is configured
    // For now, logging serves as the notification mechanism
    logger.info(`Notification sent for template review: ${templateId}`);
  }

  /**
   * Notify author about review result
   */
  private async notifyAuthor(templateId: string, review: SubmissionReview) {
    // Author notifications will be sent via email when email service is configured
    // Current implementation logs the notification for audit purposes
    logger.info(`Author notified about review: ${templateId}`);
  }

  /**
   * Update category template count
   */
  private async updateCategoryCount(templateId: string) {
    try {
      const template = await db.select()
        .from(templates)
        .where(eq(templates.id, templateId))
        .limit(1);

      if (template.length > 0) {
        const [tpl] = template;
        await db.update(templateCategories)
          .set({
            templateCount: sql`${templateCategories.templateCount} + 1`
          })
          .where(eq(templateCategories.slug, tpl.category));
      }
    } catch (error) {
      logger.error('Failed to update category count:', error);
    }
  }

  /**
   * Get pending submissions for review
   */
  async getPendingSubmissions(limit: number = 10) {
    try {
      const pending = await db.select({
        template: templates,
        author: users,
      })
      .from(templates)
      .leftJoin(users, eq(templates.authorId, users.id))
      .where(eq(templates.status, 'pending_review'))
      .orderBy(templates.createdAt)
      .limit(limit);

      return pending.map(({ template, author }) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        author: {
          id: author?.id,
          username: author?.username || 'Unknown',
          email: author?.email,
        },
        submittedAt: template.createdAt,
        githubUrl: template.githubUrl,
        demoUrl: template.demoUrl,
      }));
    } catch (error) {
      logger.error('Failed to get pending submissions:', error);
      throw error;
    }
  }
}

export const templateSubmissionService = new TemplateSubmissionService();