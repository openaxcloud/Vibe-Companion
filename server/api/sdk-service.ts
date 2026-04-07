// @ts-nocheck
import { randomBytes, createHash } from 'crypto';
import { db } from '../db';
import { apiKeys, apiUsage, users } from '@shared/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('sdk-service');

export class SDKService {
  // Generate API key
  async generateApiKey(userId: number, name: string, permissions: string[] = [], expiresAt?: Date): Promise<string> {
    const keyId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const apiKey = `ecode_${keyId}_${secret}`;
    
    await db.insert(apiKeys).values({
      userId,
      name,
      key: createHash('sha256').update(apiKey).digest('hex'), // Store hashed version
      permissions,
      expiresAt
    });

    return apiKey; // Return unhashed version to user
  }

  // Validate API key
  async validateApiKey(apiKey: string): Promise<{ isValid: boolean; userId?: number; permissions?: string[] }> {
    try {
      const hashedKey = createHash('sha256').update(apiKey).digest('hex');
      
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.key, hashedKey),
          eq(apiKeys.isActive, true)
        ));

      if (!keyRecord) {
        return { isValid: false };
      }

      // Check expiration
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return { isValid: false };
      }

      // Update last used
      await db
        .update(apiKeys)
        .set({ lastUsed: new Date() })
        .where(eq(apiKeys.id, keyRecord.id));

      return {
        isValid: true,
        userId: keyRecord.userId,
        permissions: keyRecord.permissions || []
      };
    } catch (error) {
      logger.error('[SDKService] Error validating API key:', error);
      return { isValid: false };
    }
  }

  // Get user's API keys
  async getUserApiKeys(userId: number) {
    return await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        permissions: apiKeys.permissions,
        isActive: apiKeys.isActive,
        lastUsed: apiKeys.lastUsed,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        keyPreview: sql<string>`CONCAT(LEFT(${apiKeys.key}, 8), '...')`
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  // Revoke API key
  async revokeApiKey(userId: number, keyId: number): Promise<boolean> {
    const result = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      ));

    return result.rowCount > 0;
  }

  // Log API usage
  async logApiUsage(apiKeyId: number, endpoint: string, method: string, statusCode: number, responseTime?: number) {
    await db.insert(apiUsage).values({
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date()
    });
  }

  // Get API usage statistics
  async getApiUsageStats(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalRequests] = await db
      .select({ count: count() })
      .from(apiUsage)
      .innerJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
      .where(and(
        eq(apiKeys.userId, userId),
        sql`${apiUsage.timestamp} >= ${startDate}`
      ));

    const endpointStats = await db
      .select({
        endpoint: apiUsage.endpoint,
        method: apiUsage.method,
        requestCount: count(),
        avgResponseTime: sql<number>`AVG(${apiUsage.responseTime})`
      })
      .from(apiUsage)
      .innerJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
      .where(and(
        eq(apiKeys.userId, userId),
        sql`${apiUsage.timestamp} >= ${startDate}`
      ))
      .groupBy(apiUsage.endpoint, apiUsage.method)
      .orderBy(desc(count()));

    return {
      totalRequests: totalRequests.count,
      endpointStats,
      period: `${days} days`
    };
  }

  // Get SDK documentation
  getSDKDocumentation() {
    return {
      authentication: {
        description: "All API requests must include your API key in the Authorization header",
        example: "Authorization: Bearer ecode_abc123_def456"
      },
      endpoints: {
        projects: {
          list: { method: "GET", path: "/api/v1/projects", description: "List user projects" },
          create: { method: "POST", path: "/api/v1/projects", description: "Create new project" },
          get: { method: "GET", path: "/api/v1/projects/:id", description: "Get project details" },
          update: { method: "PUT", path: "/api/v1/projects/:id", description: "Update project" },
          delete: { method: "DELETE", path: "/api/v1/projects/:id", description: "Delete project" }
        },
        files: {
          list: { method: "GET", path: "/api/v1/projects/:id/files", description: "List project files" },
          create: { method: "POST", path: "/api/v1/projects/:id/files", description: "Create file" },
          get: { method: "GET", path: "/api/v1/files/:id", description: "Get file content" },
          update: { method: "PUT", path: "/api/v1/files/:id", description: "Update file content" },
          delete: { method: "DELETE", path: "/api/v1/files/:id", description: "Delete file" }
        },
        execution: {
          run: { method: "POST", path: "/api/v1/projects/:id/run", description: "Execute project" },
          stop: { method: "POST", path: "/api/v1/projects/:id/stop", description: "Stop execution" },
          status: { method: "GET", path: "/api/v1/projects/:id/status", description: "Get execution status" }
        }
      },
      sdks: {
        javascript: {
          installation: "npm install @ecode/sdk",
          quickStart: `
const ECode = require('@ecode/sdk');
const ecode = new ECode('your-api-key');

// List projects
const projects = await ecode.projects.list();

// Create project
const project = await ecode.projects.create({
  name: 'My Project',
  language: 'javascript'
});
          `
        },
        python: {
          installation: "pip install ecode-sdk",
          quickStart: `
from ecode import ECode

ecode = ECode('your-api-key')

# List projects
projects = ecode.projects.list()

# Create project
project = ecode.projects.create(
    name='My Project',
    language='python'
)
          `
        }
      }
    };
  }

  // Generate SDK code examples
  generateSDKExamples(language: 'javascript' | 'python' | 'go' | 'ruby') {
    const examples = {
      javascript: {
        setup: `
const ECode = require('@ecode/sdk');
const ecode = new ECode(process.env.ECODE_API_KEY);
        `,
        createProject: `
const project = await ecode.projects.create({
  name: 'My Web App',
  description: 'A simple web application',
  language: 'javascript',
  visibility: 'private'
});
        `,
        uploadFile: `
await ecode.files.create(project.id, {
  name: 'index.html',
  path: '/index.html',
  content: '<html><body>Hello World</body></html>'
});
        `,
        runProject: `
const execution = await ecode.projects.run(project.id);
console.log('Project running at:', execution.url);
        `
      },
      python: {
        setup: `
from ecode import ECode
import os

ecode = ECode(os.environ['ECODE_API_KEY'])
        `,
        createProject: `
project = ecode.projects.create(
    name='My Python App',
    description='A Python application',
    language='python',
    visibility='private'
)
        `,
        uploadFile: `
ecode.files.create(project['id'], {
    'name': 'main.py',
    'path': '/main.py',
    'content': 'print("Hello World")'
})
        `,
        runProject: `
execution = ecode.projects.run(project['id'])
print(f'Project running at: {execution["url"]}')
        `
      }
    };

    return examples[language] || examples.javascript;
  }
}

export const sdkService = new SDKService();