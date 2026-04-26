/**
 * OpenAPI/Swagger Documentation Configuration
 * Fortune 500 Standard - Complete API Documentation
 *
 * Features:
 * - OpenAPI 3.0 specification
 * - Interactive Swagger UI
 * - Authentication schemes documented
 * - Request/Response examples
 * - Error codes documented
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

/**
 * OpenAPI Specification
 */
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'E-Code Platform API',
    version: '2.0.0',
    description: 'Fortune 500-grade AI-powered development platform API documentation',
    contact: {
      name: 'E-Code Support',
      email: 'support@e-code.ai',
      url: 'https://e-code.ai/support'
    },
    license: {
      name: 'Enterprise',
      url: 'https://e-code.ai/license'
    }
  },
  servers: [
    {
      url: 'https://e-code.ai/api',
      description: 'Production server'
    },
    {
      url: 'https://staging.e-code.ai/api',
      description: 'Staging server'
    },
    {
      url: 'http://localhost:5000/api',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /auth/login endpoint'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for programmatic access'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ecode.sid',
        description: 'Session cookie for browser-based authentication'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['error'],
            example: 'error'
          },
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR'
          },
          message: {
            type: 'string',
            example: 'Invalid input data'
          },
          details: {
            type: 'object',
            additionalProperties: true
          },
          requestId: {
            type: 'string',
            format: 'uuid'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          username: {
            type: 'string',
            example: 'john_doe'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com'
          },
          displayName: {
            type: 'string',
            example: 'John Doe'
          },
          profileImageUrl: {
            type: 'string',
            format: 'uri',
            nullable: true
          },
          isAdmin: {
            type: 'boolean'
          },
          twoFactorEnabled: {
            type: 'boolean'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Project: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            example: 'My Awesome Project'
          },
          description: {
            type: 'string',
            example: 'A full-stack web application'
          },
          visibility: {
            type: 'string',
            enum: ['public', 'private', 'unlisted']
          },
          language: {
            type: 'string',
            enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']
          },
          ownerId: {
            type: 'string',
            format: 'uuid'
          },
          views: {
            type: 'integer'
          },
          likes: {
            type: 'integer'
          },
          forks: {
            type: 'integer'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      AIModel: {
        type: 'string',
        description: 'Supported AI models - March 2026 catalog (GPT-4.1.x via ModelFarm free tier)',
        enum: [
          'gpt-4.1',
          'gpt-4.1-mini',
          'gpt-4.1-nano',
          'gpt-4o',
          'gpt-4o-mini',
          'o3',
          'o4-mini',
          'claude-opus-4-7',
          'claude-sonnet-4-6',
          'claude-haiku-4-5-20251001',
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'grok-4-1-fast-reasoning',
          'grok-4-1-fast',
          'grok-4',
          'kimi-k2-thinking',
          'kimi-k2-thinking-turbo',
          'kimi-k2-turbo-preview',
          'kimi-k2-0905-preview'
        ]
      },
      AgentPlan: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          title: {
            type: 'string',
            example: 'Create Login Page'
          },
          description: {
            type: 'string'
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string'
                },
                action: {
                  type: 'string',
                  enum: ['create-file', 'modify-file', 'delete-file', 'run-command']
                },
                path: {
                  type: 'string'
                },
                description: {
                  type: 'string'
                },
                estimatedTime: {
                  type: 'string'
                }
              }
            }
          },
          estimatedDuration: {
            type: 'string',
            example: '2h 30m'
          },
          model: {
            $ref: '#/components/schemas/AIModel'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
              timestamp: '2025-01-14T10:30:00Z'
            }
          }
        }
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints'
    },
    {
      name: 'Users',
      description: 'User management operations'
    },
    {
      name: 'Projects',
      description: 'Project CRUD operations'
    },
    {
      name: 'Files',
      description: 'File management within projects'
    },
    {
      name: 'AI Agent',
      description: 'AI-powered development agent operations'
    },
    {
      name: 'Workspace',
      description: 'Development workspace operations (LSP, builds, tests)'
    },
    {
      name: 'Collaboration',
      description: 'Real-time collaboration features'
    },
    {
      name: 'Deployment',
      description: 'Application deployment operations'
    },
    {
      name: 'Admin',
      description: 'Administrative operations (admin only)'
    },
    {
      name: 'Health',
      description: 'Service health and monitoring'
    }
  ],
  paths: {
    '/health/liveness': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Kubernetes liveness probe - checks if application is running',
        responses: {
          '200': {
            description: 'Application is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number', example: 12345.67 },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health/readiness': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Kubernetes readiness probe - checks if application is ready to serve traffic',
        responses: {
          '200': {
            description: 'Application is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ready' },
                    checks: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                          responseTime: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '503': {
            description: 'Application is not ready'
          }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 30 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  displayName: { type: 'string' }
                }
              },
              example: {
                username: 'john_doe',
                email: 'john@example.com',
                password: 'SecurePassword123!',
                displayName: 'John Doe'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '409': {
            description: 'Username or email already exists'
          },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '423': {
            description: 'Account locked due to too many failed attempts'
          },
          '429': { $ref: '#/components/responses/RateLimitExceeded' }
        }
      }
    },
    '/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List projects',
        description: 'Get list of projects accessible to the authenticated user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'visibility',
            in: 'query',
            schema: { type: 'string', enum: ['public', 'private', 'unlisted'] }
          }
        ],
        responses: {
          '200': {
            description: 'Projects list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projects: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Project' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      },
      post: {
        tags: ['Projects'],
        summary: 'Create project',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  visibility: { type: 'string', enum: ['public', 'private', 'unlisted'], default: 'private' },
                  language: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Project created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Project' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/agent/plan': {
      post: {
        tags: ['AI Agent'],
        summary: 'Generate AI development plan',
        description: 'Generate a development plan from natural language requirements using AI',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt', 'model'],
                properties: {
                  prompt: {
                    type: 'string',
                    example: 'Create a login page with email and password fields'
                  },
                  model: { $ref: '#/components/schemas/AIModel' },
                  projectContext: {
                    type: 'object',
                    additionalProperties: true
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Plan generated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AgentPlan' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '503': {
            description: 'AI service unavailable'
          }
        }
      }
    }
  }
};

/**
 * Swagger JSDoc options
 */
const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './server/routes/*.ts',
    './server/api/*.ts'
  ]
};

/**
 * Generate OpenAPI specification
 */
export const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI
 */
export function setupSwaggerDocs(app: Express): void {
  // Swagger JSON endpoint
  app.get('/api/docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'E-Code Platform API Documentation',
      customfavIcon: '/favicon.ico'
    })
  );

  console.log('📚 API Documentation available at /api/docs');
}

export default {
  swaggerSpec,
  setupSwaggerDocs
};
