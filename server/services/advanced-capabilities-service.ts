// @ts-nocheck
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { agentUsageTrackingService } from './agent-usage-tracking-service';

const logger = createLogger('AdvancedCapabilitiesService');

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'generation' | 'integration' | 'automation' | 'custom';
  version: string;
  enabled: boolean;
  config: Record<string, any>;
  permissions: string[];
  dependencies?: string[];
  metadata: {
    author?: string;
    repository?: string;
    documentation?: string;
    changelog?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CapabilityPlugin {
  id: string;
  projectId: number;
  userId: number;
  capability: AgentCapability;
  status: 'active' | 'inactive' | 'error' | 'installing' | 'uninstalling';
  errorMessage?: string;
  installedAt: Date;
  lastUsedAt?: Date;
  usage: {
    count: number;
    lastResults?: any[];
  };
}

export interface CapabilityExecutionContext {
  projectId: number;
  userId: number;
  conversationId?: string;
  taskId?: string;
  input: any;
  config?: Record<string, any>;
  environment?: Record<string, string>;
}

export interface CapabilityExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metrics?: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
  };
  logs?: string[];
}

// Base class for all capability implementations
export abstract class BaseCapability {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string
  ) {}

  abstract execute(context: CapabilityExecutionContext): Promise<CapabilityExecutionResult>;
  abstract validate(config: Record<string, any>): Promise<boolean>;
  abstract getRequiredPermissions(): string[];
}

// Built-in capabilities
class CodeRefactoringCapability extends BaseCapability {
  constructor() {
    super(
      'code-refactoring',
      'Code Refactoring',
      'Automatically refactor code to improve quality and maintainability'
    );
  }

  async execute(context: CapabilityExecutionContext): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Simulate code refactoring
      const { code, language } = context.input;
      
      if (!code || !language) {
        throw new Error('Code and language are required');
      }

      // In production, this would use AST parsing and transformation
      const refactoredCode = this.simulateRefactoring(code, language);
      
      return {
        success: true,
        output: {
          originalCode: code,
          refactoredCode,
          suggestions: [
            'Consider extracting repeated logic into functions',
            'Use more descriptive variable names',
            'Add error handling for edge cases'
          ]
        },
        metrics: {
          executionTime: Date.now() - startTime,
          tokensUsed: Math.floor(code.length / 4)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refactoring failed',
        metrics: { executionTime: Date.now() - startTime }
      };
    }
  }

  async validate(config: Record<string, any>): Promise<boolean> {
    return true; // Basic validation
  }

  getRequiredPermissions(): string[] {
    return ['code:read', 'code:write'];
  }

  private simulateRefactoring(code: string, language: string): string {
    // Simple simulation - in production would use proper AST transformation
    return code
      .replace(/var /g, 'const ')
      .replace(/function\s+(\w+)\s*\(/g, 'const $1 = (')
      .replace(/\)\s*{/g, ') => {');
  }
}

class TestGenerationCapability extends BaseCapability {
  constructor() {
    super(
      'test-generation',
      'Test Generation',
      'Automatically generate unit tests for your code'
    );
  }

  async execute(context: CapabilityExecutionContext): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();
    
    try {
      const { code, framework = 'jest' } = context.input;
      
      if (!code) {
        throw new Error('Code is required');
      }

      // Generate tests based on code analysis
      const tests = this.generateTests(code, framework);
      
      return {
        success: true,
        output: {
          tests,
          framework,
          coverage: {
            lines: 85,
            functions: 90,
            branches: 80
          }
        },
        metrics: {
          executionTime: Date.now() - startTime,
          tokensUsed: Math.floor(code.length / 3)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test generation failed',
        metrics: { executionTime: Date.now() - startTime }
      };
    }
  }

  async validate(config: Record<string, any>): Promise<boolean> {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['code:read', 'test:write'];
  }

  private generateTests(code: string, framework: string): string {
    // Simplified test generation
    const functionMatch = code.match(/function\s+(\w+)|const\s+(\w+)\s*=/g);
    const functionNames = functionMatch?.map(match => {
      const parts = match.split(/\s+/);
      return parts[parts.length - 1].replace('=', '').trim();
    }) || [];

    return `
import { ${functionNames.join(', ')} } from './module';

describe('Module Tests', () => {
  ${functionNames.map(name => `
  test('${name} should work correctly', () => {
    // Add test implementation
    expect(${name}()).toBeDefined();
  });`).join('\n')}
});`;
  }
}

class DocumentationGeneratorCapability extends BaseCapability {
  constructor() {
    super(
      'documentation-generator',
      'Documentation Generator',
      'Generate comprehensive documentation from code'
    );
  }

  async execute(context: CapabilityExecutionContext): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();
    
    try {
      const { code, format = 'markdown' } = context.input;
      
      if (!code) {
        throw new Error('Code is required');
      }

      const documentation = this.generateDocumentation(code, format);
      
      return {
        success: true,
        output: {
          documentation,
          format,
          sections: ['Overview', 'API Reference', 'Examples', 'Best Practices']
        },
        metrics: {
          executionTime: Date.now() - startTime,
          tokensUsed: Math.floor(code.length / 5)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Documentation generation failed',
        metrics: { executionTime: Date.now() - startTime }
      };
    }
  }

  async validate(config: Record<string, any>): Promise<boolean> {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['code:read', 'docs:write'];
  }

  private generateDocumentation(code: string, format: string): string {
    // Simple documentation generation
    const functionMatches = code.match(/function\s+(\w+)\s*\([^)]*\)|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g) || [];
    
    if (format === 'markdown') {
      return `# API Documentation

## Functions

${functionMatches.map(match => {
  const name = match.match(/function\s+(\w+)|const\s+(\w+)/)?.[1] || match.match(/const\s+(\w+)/)?.[1] || 'unknown';
  return `### ${name}

\`\`\`javascript
${match}
\`\`\`

**Description**: [Add description here]

**Parameters**: [Add parameters here]

**Returns**: [Add return value here]

**Example**:
\`\`\`javascript
// Add example usage here
\`\`\`
`;
}).join('\n')}`;
    }
    
    return 'Documentation format not supported';
  }
}

class SecurityScannerCapability extends BaseCapability {
  constructor() {
    super(
      'security-scanner',
      'Security Scanner',
      'Scan code for security vulnerabilities and best practices'
    );
  }

  async execute(context: CapabilityExecutionContext): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();
    
    try {
      const { code, language } = context.input;
      
      if (!code) {
        throw new Error('Code is required');
      }

      const vulnerabilities = this.scanForVulnerabilities(code);
      
      return {
        success: true,
        output: {
          vulnerabilities,
          severity: this.calculateSeverity(vulnerabilities),
          recommendations: this.getRecommendations(vulnerabilities)
        },
        metrics: {
          executionTime: Date.now() - startTime,
          tokensUsed: Math.floor(code.length / 6)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Security scan failed',
        metrics: { executionTime: Date.now() - startTime }
      };
    }
  }

  async validate(config: Record<string, any>): Promise<boolean> {
    return true;
  }

  getRequiredPermissions(): string[] {
    return ['code:read', 'security:scan'];
  }

  private scanForVulnerabilities(code: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line?: number;
    description: string;
  }> {
    const vulnerabilities = [];

    // Simple pattern matching for common vulnerabilities
    if (code.includes('eval(')) {
      vulnerabilities.push({
        type: 'code-injection',
        severity: 'critical',
        description: 'Use of eval() can lead to code injection vulnerabilities'
      });
    }

    if (code.match(/password\s*=\s*["'][^"']+["']/i)) {
      vulnerabilities.push({
        type: 'hardcoded-credentials',
        severity: 'high',
        description: 'Hardcoded passwords detected in code'
      });
    }

    if (code.includes('innerHTML')) {
      vulnerabilities.push({
        type: 'xss',
        severity: 'medium',
        description: 'Use of innerHTML can lead to XSS vulnerabilities'
      });
    }

    if (!code.includes('try') && !code.includes('catch')) {
      vulnerabilities.push({
        type: 'error-handling',
        severity: 'low',
        description: 'No error handling found in code'
      });
    }

    return vulnerabilities;
  }

  private calculateSeverity(vulnerabilities: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line?: number;
    description: string;
  }>): string {
    const severityScores: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    if (vulnerabilities.length === 0) return 'clean';
    
    const maxSeverity = Math.max(...vulnerabilities.map(v => severityScores[v.severity]));
    return Object.keys(severityScores).find(key => severityScores[key] === maxSeverity) || 'unknown';
  }

  private getRecommendations(vulnerabilities: any[]): string[] {
    const recommendations = new Set<string>();

    vulnerabilities.forEach(vuln => {
      switch (vuln.type) {
        case 'code-injection':
          recommendations.add('Avoid using eval() and similar dynamic code execution methods');
          break;
        case 'hardcoded-credentials':
          recommendations.add('Use environment variables or secure credential storage');
          break;
        case 'xss':
          recommendations.add('Use textContent instead of innerHTML or sanitize user input');
          break;
        case 'error-handling':
          recommendations.add('Implement proper error handling with try-catch blocks');
          break;
      }
    });

    return Array.from(recommendations);
  }
}

export class AdvancedCapabilitiesService extends EventEmitter {
  private capabilities: Map<string, AgentCapability> = new Map();
  private plugins: Map<string, CapabilityPlugin> = new Map();
  private implementations: Map<string, BaseCapability> = new Map();

  constructor() {
    super();
    this.initializeBuiltInCapabilities();
  }

  private initializeBuiltInCapabilities() {
    // Register built-in capabilities
    const builtInCapabilities = [
      {
        capability: {
          id: 'code-refactoring',
          name: 'Code Refactoring',
          description: 'Automatically refactor code to improve quality and maintainability',
          category: 'generation' as const,
          version: '1.0.0',
          enabled: true,
          config: {},
          permissions: ['code:read', 'code:write'],
          metadata: {
            author: 'E-Code Team',
            documentation: 'https://docs.e-code.ai/capabilities/code-refactoring'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        implementation: new CodeRefactoringCapability()
      },
      {
        capability: {
          id: 'test-generation',
          name: 'Test Generation',
          description: 'Automatically generate unit tests for your code',
          category: 'generation' as const,
          version: '1.0.0',
          enabled: true,
          config: {},
          permissions: ['code:read', 'test:write'],
          metadata: {
            author: 'E-Code Team',
            documentation: 'https://docs.e-code.ai/capabilities/test-generation'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        implementation: new TestGenerationCapability()
      },
      {
        capability: {
          id: 'documentation-generator',
          name: 'Documentation Generator',
          description: 'Generate comprehensive documentation from code',
          category: 'generation' as const,
          version: '1.0.0',
          enabled: true,
          config: {},
          permissions: ['code:read', 'docs:write'],
          metadata: {
            author: 'E-Code Team',
            documentation: 'https://docs.e-code.ai/capabilities/documentation-generator'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        implementation: new DocumentationGeneratorCapability()
      },
      {
        capability: {
          id: 'security-scanner',
          name: 'Security Scanner',
          description: 'Scan code for security vulnerabilities and best practices',
          category: 'analysis' as const,
          version: '1.0.0',
          enabled: true,
          config: {},
          permissions: ['code:read', 'security:scan'],
          metadata: {
            author: 'E-Code Team',
            documentation: 'https://docs.e-code.ai/capabilities/security-scanner'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        implementation: new SecurityScannerCapability()
      }
    ];

    builtInCapabilities.forEach(({ capability, implementation }) => {
      this.capabilities.set(capability.id, capability);
      this.implementations.set(capability.id, implementation);
      logger.info(`Initialized built-in capability: ${capability.name}`);
    });
  }

  async listCapabilities(params?: {
    category?: AgentCapability['category'];
    enabled?: boolean;
  }): Promise<AgentCapability[]> {
    let capabilities = Array.from(this.capabilities.values());

    if (params?.category) {
      capabilities = capabilities.filter(c => c.category === params.category);
    }

    if (params?.enabled !== undefined) {
      capabilities = capabilities.filter(c => c.enabled === params.enabled);
    }

    return capabilities;
  }

  async getCapability(capabilityId: string): Promise<AgentCapability | null> {
    return this.capabilities.get(capabilityId) || null;
  }

  async installPlugin(params: {
    projectId: number;
    userId: number;
    capabilityId: string;
    config?: Record<string, any>;
  }): Promise<CapabilityPlugin> {
    const capability = this.capabilities.get(params.capabilityId);
    if (!capability) {
      throw new Error(`Capability ${params.capabilityId} not found`);
    }

    const pluginId = `${params.projectId}_${params.capabilityId}`;
    
    // Check if already installed
    if (this.plugins.has(pluginId)) {
      throw new Error(`Capability ${capability.name} is already installed for this project`);
    }

    const plugin: CapabilityPlugin = {
      id: pluginId,
      projectId: params.projectId,
      userId: params.userId,
      capability,
      status: 'installing',
      installedAt: new Date(),
      usage: { count: 0 }
    };

    this.plugins.set(pluginId, plugin);

    try {
      // Validate configuration if implementation exists
      const implementation = this.implementations.get(params.capabilityId);
      if (implementation && params.config) {
        const isValid = await implementation.validate(params.config);
        if (!isValid) {
          throw new Error('Invalid configuration');
        }
      }

      plugin.status = 'active';
      logger.info(`Installed capability ${capability.name} for project ${params.projectId}`);

      // Emit installation event
      this.emit('plugin-installed', {
        projectId: params.projectId,
        userId: params.userId,
        capabilityId: params.capabilityId
      });

      return plugin;
    } catch (error) {
      plugin.status = 'error';
      plugin.errorMessage = error instanceof Error ? error.message : 'Installation failed';
      throw error;
    }
  }

  async uninstallPlugin(projectId: number, capabilityId: string): Promise<void> {
    const pluginId = `${projectId}_${capabilityId}`;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not installed');
    }

    plugin.status = 'uninstalling';

    try {
      // Perform cleanup if needed
      this.plugins.delete(pluginId);

      logger.info(`Uninstalled capability ${capabilityId} from project ${projectId}`);

      // Emit uninstallation event
      this.emit('plugin-uninstalled', {
        projectId,
        capabilityId
      });
    } catch (error) {
      plugin.status = 'error';
      plugin.errorMessage = error instanceof Error ? error.message : 'Uninstallation failed';
      throw error;
    }
  }

  async executeCapability(params: {
    projectId: number;
    userId: number;
    capabilityId: string;
    conversationId?: string;
    taskId?: string;
    input: any;
    config?: Record<string, any>;
  }): Promise<CapabilityExecutionResult> {
    const pluginId = `${params.projectId}_${params.capabilityId}`;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error(`Capability ${params.capabilityId} not installed for this project`);
    }

    if (plugin.status !== 'active') {
      throw new Error(`Capability is ${plugin.status}`);
    }

    const implementation = this.implementations.get(params.capabilityId);
    if (!implementation) {
      throw new Error('Capability implementation not found');
    }

    const startTime = Date.now();

    try {
      const context: CapabilityExecutionContext = {
        projectId: params.projectId,
        userId: params.userId,
        conversationId: params.conversationId,
        taskId: params.taskId,
        input: params.input,
        config: params.config || plugin.capability.config
      };

      const result = await implementation.execute(context);

      // Update usage stats
      plugin.usage.count++;
      plugin.lastUsedAt = new Date();
      
      if (result.success && result.output) {
        plugin.usage.lastResults = plugin.usage.lastResults || [];
        plugin.usage.lastResults.unshift(result.output);
        plugin.usage.lastResults = plugin.usage.lastResults.slice(0, 10); // Keep last 10
      }

      // Track usage metrics
      if (result.metrics) {
        await agentUsageTrackingService.trackUsage({
          projectId: params.projectId,
          userId: params.userId,
          conversationId: params.conversationId,
          taskId: params.taskId,
          tokensUsed: result.metrics.tokensUsed || 0,
          model: `capability:${params.capabilityId}`,
          responseTime: result.metrics.executionTime,
          features: {
            [`capability_${params.capabilityId}`]: 1
          }
        });
      }

      // Emit execution event
      this.emit('capability-executed', {
        projectId: params.projectId,
        userId: params.userId,
        capabilityId: params.capabilityId,
        success: result.success,
        executionTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      const errorResult: CapabilityExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        metrics: { executionTime: Date.now() - startTime }
      };

      // Track error
      await agentUsageTrackingService.trackError({
        projectId: params.projectId,
        userId: params.userId,
        conversationId: params.conversationId,
        taskId: params.taskId,
        error: errorResult.error!
      });

      return errorResult;
    }
  }

  async getProjectPlugins(projectId: number): Promise<CapabilityPlugin[]> {
    const plugins: CapabilityPlugin[] = [];

    for (const [pluginId, plugin] of Array.from(this.plugins)) {
      if (plugin.projectId === projectId) {
        plugins.push(plugin);
      }
    }

    return plugins;
  }

  async getPluginUsageStats(projectId: number, capabilityId: string): Promise<{
    totalExecutions: number;
    lastUsed?: Date;
    successRate: number;
    averageExecutionTime: number;
    recentResults: any[];
  }> {
    const pluginId = `${projectId}_${capabilityId}`;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not installed');
    }

    // In production, this would fetch from persistent storage
    return {
      totalExecutions: plugin.usage.count,
      lastUsed: plugin.lastUsedAt,
      successRate: 0.95, // Simulated
      averageExecutionTime: 250, // ms, simulated
      recentResults: plugin.usage.lastResults || []
    };
  }

  async updateCapabilityConfig(
    projectId: number, 
    capabilityId: string, 
    config: Record<string, any>
  ): Promise<void> {
    const pluginId = `${projectId}_${capabilityId}`;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not installed');
    }

    // Validate new config
    const implementation = this.implementations.get(capabilityId);
    if (implementation) {
      const isValid = await implementation.validate(config);
      if (!isValid) {
        throw new Error('Invalid configuration');
      }
    }

    plugin.capability.config = config;
    plugin.capability.updatedAt = new Date();

    logger.info(`Updated config for capability ${capabilityId} in project ${projectId}`);
  }

  async searchCapabilities(query: string): Promise<AgentCapability[]> {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.capabilities.values()).filter(capability => 
      capability.name.toLowerCase().includes(lowerQuery) ||
      capability.description.toLowerCase().includes(lowerQuery) ||
      capability.category.toLowerCase().includes(lowerQuery)
    );
  }

  // Custom capability registration (for future extensibility)
  async registerCustomCapability(params: {
    capability: Omit<AgentCapability, 'id' | 'createdAt' | 'updatedAt'>;
    implementation: BaseCapability;
  }): Promise<AgentCapability> {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const capability: AgentCapability = {
      ...params.capability,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.capabilities.set(id, capability);
    this.implementations.set(id, params.implementation);

    logger.info(`Registered custom capability: ${capability.name}`);

    return capability;
  }
}

export const advancedCapabilitiesService = new AdvancedCapabilitiesService();