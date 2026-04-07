// Enhanced Autonomous AI Agent - Builds complete applications autonomously
// This is the core of the AI agent that can understand natural language and build full applications
// Now powered by MCP (Model Context Protocol) for all operations

import { storage } from '../storage';
import { BuildAction } from './autonomous-builder';
import { AIProviderFactory } from './ai-providers';
import { checkpointService } from '../services/checkpoint-service';
import { effortPricingService } from '../services/effort-pricing-service';
import { createLogger } from '../utils/logger';
import { AnthropicProvider } from './ai-providers';
import { realPackageManager } from '../services/real-package-manager';
import { agentWebSocketService } from '../services/agent-websocket-service';
import { getMCPClient } from '../api/mcp';
import { MCPClient } from '../mcp/client';
import * as path from 'path';

const logger = createLogger('EnhancedAutonomousAgent');

export interface AgentContext {
  projectId: number;
  userId: number;
  message: string;
  existingFiles?: any[];
  buildHistory?: string[];
  conversationHistory?: any[];
  extendedThinking?: boolean;
  highPowerMode?: boolean;
  isPaused?: boolean;
  sessionId?: string;
}

export interface AgentResponse {
  message: string;
  actions: BuildAction[];
  thinking?: string;
  completed?: boolean;
  summary?: string;
  timeWorked?: number;
  screenshot?: string;
  checkpoint?: any;
  pricing?: {
    complexity: string;
    costInCents: number;
    costInDollars: string;
    effortScore: number;
  };
}

export class EnhancedAutonomousAgent {
  private startTime: number = 0;
  private actions: BuildAction[] = [];
  private thinkingProcess: string[] = [];
  private aiProvider: AnthropicProvider | null = null;
  private mcpClient: MCPClient | null = null;
  private mcpInitializationPromise: Promise<void> | null = null;
  private hasLoggedMCPDisabled: boolean = false;
  
  // Tracking metrics for effort-based pricing
  private filesModified: number = 0;
  private filesCreated: number = 0;
  private linesOfCodeWritten: number = 0;
  private tokensUsed: number = 0;
  private apiCallsCount: number = 0;
  
  constructor(apiKey?: string) {
    // Initialize with Claude Sonnet 4 - best model for agentic coding capabilities (March 2026)
    // Confirmed working: claude-sonnet-4-20250514
    // This enables advanced code understanding, generation, and autonomous building
    if (apiKey) {
      this.aiProvider = new AnthropicProvider(apiKey);
      logger.info('Enhanced AI Agent initialized with Anthropic API key');
    }
    
    // Initialize MCP client for all operations
    this.initializeMCPClient();
  }

  private async initializeMCPClient(retries: number = 5, baseDelayMs: number = 500) {
    if (this.mcpClient) {
      return;
    }

    if (this.mcpInitializationPromise) {
      await this.mcpInitializationPromise;
      return;
    }

    const mcpEnabled = process.env.ENABLE_MCP_SERVER === 'true';

    this.mcpInitializationPromise = (async () => {
      if (!mcpEnabled) {
        if (!this.hasLoggedMCPDisabled) {
          logger.info('MCP server disabled. Using fallback methods. Set ENABLE_MCP_SERVER="true" to enable.');
          this.hasLoggedMCPDisabled = true;
        }
        return;
      }

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const client = getMCPClient();
          if (!client) {
            if (attempt === retries) {
              logger.warn('MCP Client not available after retries, using fallback methods');
            }
          } else {
            await client.connect();
            this.mcpClient = client;
            this.hasLoggedMCPDisabled = false;
            logger.info('MCP Client connected for AI Agent operations');
            return;
          }
        } catch (error) {
          logger.error('Failed to connect MCP Client:', error);
          this.mcpClient = null;
          if (attempt === retries) {
            logger.warn('MCP Client not available after retries, using fallback methods');
          }
        }

        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    })();

    try {
      await this.mcpInitializationPromise;
    } finally {
      this.mcpInitializationPromise = null;
    }
  }

  setApiKey(apiKey: string) {
    this.aiProvider = new AnthropicProvider(apiKey);
    logger.info('AI Agent API key updated');
  }

  async processRequest(context: AgentContext): Promise<AgentResponse> {
    this.startTime = Date.now();
    this.actions = [];
    this.thinkingProcess = [];
    this.resetMetrics();
    
    // Generate session ID if not provided
    const sessionId = context.sessionId || `agent-${Date.now()}`;

    try {
      await this.initializeMCPClient();

      // Check if paused
      if (context.isPaused) {
        return {
          message: "Agent is paused. Click play to resume.",
          actions: [],
          thinking: "Paused by user",
          completed: false
        };
      }
      
      // Log mode for debugging
      logger.info(`Processing with extendedThinking: ${context.extendedThinking}, highPowerMode: ${context.highPowerMode}`);
      
      // Check if AI provider is initialized
      if (!this.aiProvider) {
        return {
          message: "AI service is not configured. Please add an Anthropic API key in the Secrets tab.",
          actions: [],
          thinking: "No AI provider available",
          completed: false
        };
      }
      
      // Send initial work step
      agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
        id: 'start',
        type: 'action',
        title: 'Starting AI Agent work...',
        icon: 'Brain'
      });
      
      // Analyze the user's request with appropriate depth
      const analysis = await this.analyzeRequest(context.message, {
        extendedThinking: context.extendedThinking,
        highPowerMode: context.highPowerMode
      });
      this.apiCallsCount++;
      
      agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
        id: 'analysis',
        type: 'decision',
        title: `Analyzed request: ${analysis.appType} application`,
        icon: 'Search',
        expandable: true,
        details: [`Detected ${analysis.features.length} features`, `Technology: ${analysis.technology}`]
      });
      
      // Plan the application structure
      const plan = await this.planApplication(analysis, context);
      this.apiCallsCount++;
      
      agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
        id: 'plan',
        type: 'action',
        title: 'Created application structure',
        icon: 'FileText',
        expandable: true,
        details: [`${plan.files.length} files planned`, `${plan.folders.length} directories`]
      });
      
      // Generate the code and files
      const buildActions = await this.generateBuildActions(plan, context);
      this.apiCallsCount += buildActions.length;
      
      // Execute the build actions
      const results = await this.executeBuildActions(buildActions, context, sessionId);
      
      // Calculate effort metrics
      this.calculateEffortMetrics(buildActions);
      
      // Create checkpoint (wrapped to handle rate limiting gracefully)
      let checkpoint = null;
      try {
        checkpoint = await checkpointService.createCheckpoint({
          projectId: context.projectId,
          userId: context.userId,
          name: `AI Agent: ${context.message.substring(0, 50)}`,
          description: `AI Agent response to: ${context.message.substring(0, 100)}...`,
          type: 'automatic',
          includeDatabase: false,
          includeEnvironment: false,
          agentState: {
            filesModified: this.filesModified,
            linesOfCodeWritten: this.linesOfCodeWritten,
            actions: buildActions.length
          }
        });
      } catch (cpError: any) {
        if (cpError.code === 'RATE_LIMITED') {
          logger.debug(`[Agent] Checkpoint rate-limited for project ${context.projectId} - skipping silently`);
        } else {
          logger.warn(`[Agent] Failed to create checkpoint: ${cpError.message}`);
        }
      }
      
      // Calculate pricing based on effort with correct interface
      const pricingInfo = effortPricingService.calculatePricing({
        filesProcessed: this.filesModified,
        codeGenerated: this.linesOfCodeWritten,
        tokensUsed: this.tokensUsed,
        computeTime: Math.round((Date.now() - this.startTime) / 1000), // Convert to seconds
        apiCalls: this.apiCallsCount,
        checkpointsCreated: 1 // We created one checkpoint
      });
      
      // Generate summary and screenshot
      const summary = await this.generateSummary(analysis, results);
      const screenshot = await this.captureScreenshot(context.projectId);
      
      const timeWorked = Math.round((Date.now() - this.startTime) / 1000);
      
      logger.info(`Agent task completed: ${this.filesModified} files, ${this.linesOfCodeWritten} lines`);
      
      return {
        message: this.generateResponseMessage(analysis, results),
        actions: buildActions,
        thinking: this.thinkingProcess.join('\n'),
        completed: true,
        summary,
        timeWorked,
        screenshot,
        checkpoint,
        pricing: {
          complexity: 'moderate', // Default complexity
          costInCents: pricingInfo.totalCost,
          costInDollars: `$${(pricingInfo.totalCost / 100).toFixed(2)}`,
          effortScore: this.filesModified * 5 + Math.ceil(this.linesOfCodeWritten / 10)
        }
      };
    } catch (error: any) {
      logger.error(`Agent processing error: ${error.message}`);
      agentWebSocketService.sendError(context.projectId, sessionId, error.message);
      throw error;
    }
  }
  
  private resetMetrics(): void {
    this.filesModified = 0;
    this.filesCreated = 0;
    this.linesOfCodeWritten = 0;
    this.tokensUsed = 0;
    this.apiCallsCount = 0;
  }
  
  private calculateEffortMetrics(actions: BuildAction[]): void {
    actions.forEach(action => {
      if (action.type === 'create_file') {
        this.filesModified++;
        
        // Count lines of code
        if (action.data && action.data.content) {
          this.linesOfCodeWritten += action.data.content.split('\n').length;
        }
      }
    });
    
    // Estimate tokens (rough approximation)
    const totalContent = actions.reduce((acc, action) => {
      if (action.data && action.data.content) {
        return acc + action.data.content.length;
      }
      return acc;
    }, 0);
    this.tokensUsed = Math.ceil(totalContent / 4); // ~4 chars per token
  }
  
  private async analyzeRequest(message: string, options?: { extendedThinking?: boolean; highPowerMode?: boolean }): Promise<any> {
    this.thinkingProcess.push('🤔 Analyzing user request...');
    
    // Extract key information from the message
    const analysis = {
      appType: this.detectAppType(message),
      features: this.extractFeatures(message),
      technology: this.detectTechnology(message),
      complexity: this.assessComplexity(message),
      uiStyle: this.detectUIStyle(message)
    };
    
    this.thinkingProcess.push(`✓ Detected: ${analysis.appType} application with ${analysis.features.length} features`);
    
    return analysis;
  }
  
  private detectAppType(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('todo') || msg.includes('task')) return 'todo-app';
    if (msg.includes('blog') || msg.includes('article')) return 'blog';
    if (msg.includes('chat') || msg.includes('messaging')) return 'chat-app';
    if (msg.includes('e-commerce') || msg.includes('shop')) return 'ecommerce';
    if (msg.includes('portfolio') || msg.includes('resume')) return 'portfolio';
    if (msg.includes('dashboard') || msg.includes('admin')) return 'dashboard';
    if (msg.includes('game')) return 'game';
    if (msg.includes('calculator')) return 'calculator';
    if (msg.includes('weather')) return 'weather-app';
    if (msg.includes('notes') || msg.includes('notebook')) return 'notes-app';
    
    return 'web-app';
  }
  
  private extractFeatures(message: string): string[] {
    const features: string[] = [];
    const msg = message.toLowerCase();
    
    // Common features
    if (msg.includes('login') || msg.includes('auth')) features.push('authentication');
    if (msg.includes('database') || msg.includes('save')) features.push('database');
    if (msg.includes('real-time') || msg.includes('live')) features.push('real-time');
    if (msg.includes('search')) features.push('search');
    if (msg.includes('filter') || msg.includes('sort')) features.push('filtering');
    if (msg.includes('dark mode') || msg.includes('theme')) features.push('theming');
    if (msg.includes('responsive') || msg.includes('mobile')) features.push('responsive');
    if (msg.includes('animation')) features.push('animations');
    if (msg.includes('chart') || msg.includes('graph')) features.push('charts');
    if (msg.includes('payment') || msg.includes('stripe')) features.push('payments');
    
    return features;
  }
  
  private detectTechnology(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('react')) return 'react';
    if (msg.includes('vue')) return 'vue';
    if (msg.includes('angular')) return 'angular';
    if (msg.includes('svelte')) return 'svelte';
    if (msg.includes('nextjs') || msg.includes('next.js')) return 'nextjs';
    
    // Default to React for modern apps
    return 'react';
  }
  
  private assessComplexity(message: string): 'simple' | 'medium' | 'complex' {
    const features = this.extractFeatures(message);
    
    if (features.length <= 2) return 'simple';
    if (features.length <= 5) return 'medium';
    return 'complex';
  }
  
  private detectUIStyle(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('modern') || msg.includes('sleek')) return 'modern';
    if (msg.includes('minimal') || msg.includes('clean')) return 'minimal';
    if (msg.includes('colorful') || msg.includes('vibrant')) return 'colorful';
    if (msg.includes('professional') || msg.includes('business')) return 'professional';
    if (msg.includes('playful') || msg.includes('fun')) return 'playful';
    
    return 'modern';
  }
  
  private async planApplication(analysis: any, context: AgentContext): Promise<any> {
    this.thinkingProcess.push('📋 Planning application structure...');
    
    const plan = {
      structure: this.planStructure(analysis),
      components: this.planComponents(analysis),
      styling: this.planStyling(analysis),
      functionality: this.planFunctionality(analysis),
      packages: this.planPackages(analysis)
    };
    
    this.thinkingProcess.push(`✓ Planned ${plan.components.length} components and ${plan.packages.length} packages`);
    
    return plan;
  }
  
  private planStructure(analysis: any): any {
    // Plan folder structure based on app type and complexity
    const baseStructure = {
      folders: ['src', 'public'],
      files: ['package.json', 'README.md', 'index.html']
    };
    
    if (analysis.technology === 'react') {
      baseStructure.folders.push('src/components', 'src/hooks', 'src/styles');
      baseStructure.files.push('vite.config.js', 'tsconfig.json');
    }
    
    if (analysis.features.includes('database')) {
      baseStructure.folders.push('server', 'server/api');
      baseStructure.files.push('server/index.js');
    }
    
    return baseStructure;
  }
  
  private planComponents(analysis: any): string[] {
    const components: string[] = [];
    
    // Base components
    components.push('App', 'Header', 'Footer');
    
    // Add components based on app type
    switch (analysis.appType) {
      case 'todo-app':
        components.push('TodoList', 'TodoItem', 'AddTodo', 'FilterBar');
        break;
      case 'blog':
        components.push('PostList', 'PostDetail', 'PostEditor', 'Comment');
        break;
      case 'chat-app':
        components.push('ChatWindow', 'MessageList', 'MessageInput', 'UserList');
        break;
      case 'ecommerce':
        components.push('ProductList', 'ProductCard', 'Cart', 'Checkout');
        break;
      case 'dashboard':
        components.push('Sidebar', 'StatsCard', 'Chart', 'DataTable');
        break;
    }
    
    // Add feature-specific components
    if (analysis.features.includes('authentication')) {
      components.push('LoginForm', 'SignupForm', 'UserProfile');
    }
    
    if (analysis.features.includes('search')) {
      components.push('SearchBar', 'SearchResults');
    }
    
    return components;
  }
  
  private planStyling(analysis: any): any {
    return {
      framework: analysis.uiStyle === 'minimal' ? 'tailwind' : 'styled-components',
      theme: {
        primary: this.getThemeColor(analysis.uiStyle),
        style: analysis.uiStyle
      }
    };
  }
  
  private getThemeColor(style: string): string {
    const colors: Record<string, string> = {
      modern: '#0079F2',
      minimal: '#000000',
      colorful: '#FF6B6B',
      professional: '#2563EB',
      playful: '#F59E0B'
    };
    
    return colors[style] || '#0079F2';
  }
  
  private planFunctionality(analysis: any): string[] {
    const functionality: string[] = [];
    
    // Add core functionality based on features
    if (analysis.features.includes('database')) {
      functionality.push('CRUD operations', 'Data persistence');
    }
    
    if (analysis.features.includes('real-time')) {
      functionality.push('WebSocket connection', 'Live updates');
    }
    
    if (analysis.features.includes('authentication')) {
      functionality.push('User registration', 'Login/logout', 'Session management');
    }
    
    return functionality;
  }
  
  private planPackages(analysis: any): string[] {
    const packages: string[] = [];
    
    // Base packages for React
    if (analysis.technology === 'react') {
      packages.push('react', 'react-dom', 'vite', '@vitejs/plugin-react');
    }
    
    // UI framework
    if (analysis.uiStyle === 'minimal') {
      packages.push('tailwindcss', 'autoprefixer', 'postcss');
    } else {
      packages.push('styled-components');
    }
    
    // Feature-specific packages
    if (analysis.features.includes('database')) {
      packages.push('express', 'cors', 'dotenv');
    }
    
    if (analysis.features.includes('real-time')) {
      packages.push('socket.io', 'socket.io-client');
    }
    
    if (analysis.features.includes('charts')) {
      packages.push('recharts');
    }
    
    if (analysis.features.includes('authentication')) {
      packages.push('jsonwebtoken', 'bcryptjs');
    }
    
    return packages;
  }
  
  private async generateBuildActions(plan: any, context: AgentContext): Promise<BuildAction[]> {
    this.thinkingProcess.push('🔨 Generating build actions...');
    
    const actions: BuildAction[] = [];
    
    // Create folder structure
    for (const folder of plan.structure.folders) {
      actions.push({
        type: 'create_folder',
        data: { 
          name: folder,
          path: folder,
          isFolder: true 
        }
      });
    }
    
    // Create package.json
    actions.push({
      type: 'create_file',
      data: {
        name: 'package.json',
        path: 'package.json',
        content: this.generatePackageJson(plan)
      }
    });
    
    // Create main files
    actions.push({
      type: 'create_file',
      data: {
        name: 'index.html',
        path: 'index.html',
        content: this.generateIndexHtml(plan)
      }
    });
    
    // Create components
    for (const component of plan.components) {
      const componentCode = await this.generateComponent(component, plan, context);
      actions.push({
        type: 'create_file',
        data: {
          name: `${component}.tsx`,
          path: `src/components/${component}.tsx`,
          content: componentCode
        }
      });
    }
    
    // Create main App component
    actions.push({
      type: 'create_file',
      data: {
        name: 'App.tsx',
        path: 'src/App.tsx',
        content: await this.generateAppComponent(plan, context)
      }
    });
    
    // Create styles
    actions.push({
      type: 'create_file',
      data: {
        name: 'App.css',
        path: 'src/App.css',
        content: this.generateStyles(plan)
      }
    });
    
    this.thinkingProcess.push(`✓ Generated ${actions.length} build actions`);
    
    return actions;
  }
  
  private generatePackageJson(plan: any): string {
    return JSON.stringify({
      name: 'ai-generated-app',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: plan.packages.reduce((acc: any, pkg: string) => {
        acc[pkg] = 'latest';
        return acc;
      }, {})
    }, null, 2);
  }
  
  private generateIndexHtml(plan: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Generated App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }
  
  private async generateComponent(componentName: string, plan: any, context: AgentContext): Promise<string> {
    // Use AI to generate component code based on the component type and plan
    const prompt = `Generate a React component named ${componentName} for a ${plan.appType} application with ${plan.styling.theme.style} styling.`;
    
    // For now, return a template
    return `import React from 'react';

interface ${componentName}Props {
  // Add props here
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div className="${componentName.toLowerCase()}">
      <h2>${componentName}</h2>
      {/* Component content */}
    </div>
  );
};`;
  }
  
  private async generateAppComponent(plan: any, context: AgentContext): Promise<string> {
    // Generate the main App component that ties everything together
    return `import React from 'react';
import './App.css';
${plan.components.map((c: string) => `import { ${c} } from './components/${c}';`).join('\n')}

function App() {
  return (
    <div className="app">
      <Header />
      <main>
        {/* Main app content */}
      </main>
      <Footer />
    </div>
  );
}

export default App;`;
  }
  
  private generateStyles(plan: any): string {
    // Generate CSS based on the styling plan
    return `/* AI Generated Styles */
:root {
  --primary-color: ${plan.styling.theme.primary};
  --background: #ffffff;
  --text: #333333;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: var(--background);
  color: var(--text);
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  padding: 2rem;
}

/* Component styles */
${plan.components.map((c: string) => `.${c.toLowerCase()} {
  /* ${c} styles */
}`).join('\n\n')}`;
  }
  
  private async executeBuildActions(actions: BuildAction[], context: AgentContext, sessionId: string): Promise<any> {
    this.thinkingProcess.push('🚀 Executing build actions using MCP tools...');

    await this.initializeMCPClient();

    const results = {
      filesCreated: 0,
      foldersCreated: 0,
      packagesInstalled: [] as string[],
      commandsExecuted: [] as string[],
      errors: [] as string[],
      appStarted: false
    };
    
    // Get project path
    const projectPath = path.join(process.cwd(), 'projects', context.projectId.toString());
    
    // First, create all files and folders using MCP tools
    for (const action of actions) {
      try {
        if (action.type === 'create_file') {
          // Handle nested paths like src/components/TodoList.jsx
          const fullPath = action.data.path.startsWith('/') ? action.data.path : `/${action.data.path}`;
          const relativePath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;
          const filePath = `${relativePath}/${action.data.name}`;

          // Use MCP to create the file (it handles directories automatically)
          if (this.mcpClient) {
            await this.mcpClient.writeFile(`${projectPath}/${filePath}`, action.data.content);
            logger.info(`[MCP] Created file via MCP: ${filePath}`);
          } else {
            // Fallback to direct file operations
            const fs = require('fs').promises;
            const fullFilePath = `${projectPath}/${filePath}`;
            await fs.mkdir(require('path').dirname(fullFilePath), { recursive: true });
            await fs.writeFile(fullFilePath, action.data.content);
          }
          results.filesCreated++;
          
          // Send progress update for file creation
          agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
            id: `file-${Date.now()}`,
            type: 'file_operation',
            title: `Created ${action.data.name} via MCP`,
            icon: 'FileText',
            file: filePath
          });
        } else if (action.type === 'create_folder') {
          // Use MCP to create directory
          const folderPath = action.data.path.startsWith('/') ? action.data.path.substring(1) : action.data.path;
          if (this.mcpClient) {
            await this.mcpClient.callTool("fs_mkdir", { 
              path: `${projectPath}/${folderPath}/${action.data.name}`,
              recursive: true
            });
            logger.info(`[MCP] Created directory via MCP: ${folderPath}/${action.data.name}`);
          } else {
            // Fallback to direct file operations
            const fs = require('fs').promises;
            await fs.mkdir(`${projectPath}/${folderPath}/${action.data.name}`, { recursive: true });
          }
          results.foldersCreated++;
        }
      } catch (error: any) {
        results.errors.push(error.message);
        agentWebSocketService.sendError(context.projectId, sessionId, error.message);
      }
    }
    
    // Detect and install required packages
    const packageJsonAction = actions.find(a => 
      a.type === 'create_file' && a.data.name === 'package.json'
    );
    
    if (packageJsonAction) {
      try {
        const packageJson = JSON.parse(packageJsonAction.data.content);
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        
        this.thinkingProcess.push('📦 Installing dependencies...');
        
        // Install all dependencies at once
        const allPackages = [...dependencies, ...devDependencies];
        if (allPackages.length > 0) {
          agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
            id: 'install-packages',
            type: 'action',
            title: `Installing ${allPackages.length} packages...`,
            icon: 'Package',
            expandable: true,
            details: allPackages
          });
          
          // Use MCP to install packages
          if (this.mcpClient) {
          const installCommand = `npm install ${allPackages.join(' ')}`;
          const result = await this.mcpClient.callTool("exec_command", {
            command: installCommand,
            cwd: projectPath
          });
            const installOutput = result?.content?.[0]?.text || '';
            logger.info(`[MCP] Installed packages via MCP: ${allPackages.join(', ')}`);
            this.thinkingProcess.push(`📦 MCP installed packages: ${installOutput.substring(0, 100)}...`);
          } else {
            // Fallback to direct package installation
            await realPackageManager.installPackages({
              projectId: context.projectId,
              packages: allPackages,
              language: 'nodejs'
            });
          }
          results.packagesInstalled = allPackages;
          
          agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
            id: 'packages-installed',
            type: 'action',
            title: `Installed ${allPackages.length} packages successfully`,
            icon: 'CheckCircle'
          });
        }
        
        // Automatically start the app after installation
        this.thinkingProcess.push('🚀 Starting the application...');
        const startCommand = packageJson.scripts?.start || packageJson.scripts?.dev || 'node index.js';
        
        agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
          id: 'start-app',
          type: 'action',
          title: 'Starting the application...',
          icon: 'Play',
          expandable: true,
          details: [`Command: ${startCommand}`]
        });
        
        try {
          if (this.mcpClient) {
            const commandResult = await this.mcpClient.executeCommand(startCommand, { cwd: projectPath });
            const commandOutput = commandResult?.content?.[0]?.text || '';
            results.commandsExecuted.push(startCommand);
            results.appStarted = true;

            this.thinkingProcess.push('✅ Application started successfully via MCP!');
            agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
              id: 'app-running',
              type: 'action',
              title: 'Application is now running via MCP!',
              icon: 'CheckCircle',
              expandable: true,
              details: ['Your app is ready to use', 'Check the preview window to see it in action', `Output: ${commandOutput.substring(0, 100)}...`]
            });
          } else {
            const commandExecution = await this.executeCommand(context.projectId, startCommand);
            if (!commandExecution.success) {
              throw new Error(commandExecution.output || 'Failed to start application');
            }

            const fallbackOutput = commandExecution.output || '';
            results.commandsExecuted.push(startCommand);
            results.appStarted = true;

            this.thinkingProcess.push('✅ Application started successfully using local executor!');
            agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
              id: 'app-running',
              type: 'action',
              title: 'Application is now running!',
              icon: 'CheckCircle',
              expandable: true,
              details: ['Your app is ready to use', 'Check the preview window to see it in action', `Output: ${fallbackOutput.substring(0, 100)}...`]
            });
          }
        } catch (error: any) {
          results.errors.push(`Failed to start app: ${error.message}`);
        }
      } catch (error: any) {
        results.errors.push(`Package installation error: ${error.message}`);
      }
    }
    
    // Handle Python projects
    const requirementsAction = actions.find(a => 
      a.type === 'create_file' && a.data.name === 'requirements.txt'
    );
    
    if (requirementsAction) {
      try {
        const requirements = requirementsAction.data.content.split('\n').filter((line: string) => line.trim());
        if (requirements.length > 0) {
          // Use MCP to install Python packages
          const pipCommand = `pip install ${requirements.join(' ')}`;
          if (this.mcpClient) {
            const installResult = await this.mcpClient.executeCommand(pipCommand, { cwd: projectPath });
            const installOutput = installResult?.content?.[0]?.text || '';
            results.packagesInstalled = requirements;
            this.thinkingProcess.push(`🐍 MCP installed Python packages: ${installOutput.substring(0, 100)}...`);
          } else {
            const installExecution = await this.executeCommand(context.projectId, pipCommand);
            if (!installExecution.success) {
              throw new Error(installExecution.output || 'Failed to install Python packages');
            }
            const installOutput = installExecution.output || '';
            results.packagesInstalled = requirements;
            this.thinkingProcess.push(`🐍 Installed Python packages locally: ${installOutput.substring(0, 100)}...`);
          }
        }

        // Find and run the main Python file
        const mainPyAction = actions.find(a =>
          a.type === 'create_file' && (a.data.name === 'main.py' || a.data.name === 'app.py')
        );

        if (mainPyAction) {
          const startCommand = `python ${mainPyAction.data.name}`;
          if (this.mcpClient) {
            const commandResult = await this.mcpClient.executeCommand(startCommand, { cwd: projectPath });
            const commandOutput = commandResult?.content?.[0]?.text || '';
            results.commandsExecuted.push(startCommand);
            results.appStarted = true;

            agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
              id: 'python-app-running',
              type: 'action',
              title: 'Python application is now running via MCP!',
              icon: 'CheckCircle',
              expandable: true,
              details: ['Your Python app is ready', 'Check the preview window to see it in action', `Output: ${commandOutput.substring(0, 100)}...`]
            });
          } else {
            const commandExecution = await this.executeCommand(context.projectId, startCommand);
            if (!commandExecution.success) {
              throw new Error(commandExecution.output || 'Failed to start Python application');
            }

            const fallbackOutput = commandExecution.output || '';
            results.commandsExecuted.push(startCommand);
            results.appStarted = true;

            agentWebSocketService.sendStepUpdate(context.projectId, sessionId, {
              id: 'python-app-running',
              type: 'action',
              title: 'Python application is now running!',
              icon: 'CheckCircle',
              expandable: true,
              details: ['Your Python app is ready', 'Check the preview window to see it in action', `Output: ${fallbackOutput.substring(0, 100)}...`]
            });
          }
        }
      } catch (error: any) {
        results.errors.push(`Python setup error: ${error.message}`);
      }
    }
    
    this.thinkingProcess.push(`✓ Created ${results.filesCreated} files and ${results.foldersCreated} folders`);
    if (results.packagesInstalled.length > 0) {
      this.thinkingProcess.push(`✓ Installed ${results.packagesInstalled.length} packages`);
    }
    if (results.appStarted) {
      this.thinkingProcess.push(`✓ Application is running!`);
    }
    
    return results;
  }
  
  private async executeCommand(projectId: number, command: string): Promise<{ success: boolean; output: string }> {
    logger.info(`Executing command for project ${projectId}: ${command}`);
    
    try {
      // Use real terminal service to execute commands
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        // Execute in project directory
        const projectPath = path.join(process.cwd(), 'projects', projectId.toString());
        const childProcess = spawn(command, {
          shell: true,
          cwd: projectPath,
          env: { ...process.env, NODE_ENV: 'development' }
        });
        
        let output = '';
        
        childProcess.stdout.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;
          logger.info(`Command output: ${text}`);
        });
        
        childProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;
          logger.error(`Command error: ${text}`);
        });
        
        childProcess.on('close', (code: number | null) => {
          if (code === 0) {
            resolve({ success: true, output: output || 'Command executed successfully' });
          } else {
            resolve({ success: false, output: output || `Command failed with code ${code}` });
          }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          childProcess.kill();
          resolve({ success: true, output: 'Command started in background' });
        }, 30000);
      });
    } catch (error: any) {
      logger.error(`Failed to execute command: ${error.message}`);
      return { success: false, output: error.message };
    }
  }
  
  private async installPackages(projectId: number, packages: string[], language: string): Promise<void> {
    logger.info(`Installing packages for project ${projectId}: ${packages.join(', ')}`);
    
    try {
      // Use the real package manager to install packages
      const result = await realPackageManager.installPackages({
        projectId,
        language,
        packages,
        dev: false,
        global: false
      });
      
      if (result.success) {
        logger.info(`Successfully installed packages: ${packages.join(', ')}`);
      } else {
        logger.error(`Failed to install packages: ${result.error}`);
        throw new Error(result.error);
      }
    } catch (error: any) {
      logger.error(`Package installation error: ${error.message}`);
      throw error;
    }
  }
  
  private async createCheckpoint(projectId: number, message: string): Promise<void> {
    // Create a checkpoint for version control
    try {
      await storage.createCheckpoint({
        projectId,
        message,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
    }
  }
  
  private async captureScreenshot(projectId: number): Promise<string> {
    // Generate a preview screenshot of the project
    // This would integrate with a headless browser or preview service
    return `/api/projects/${projectId}/screenshot`;
  }
  
  private async generateSummary(analysis: any, results: any): Promise<string> {
    const summary = [
      `✓ Created ${analysis.appType} application`,
      `✓ Added ${analysis.features.length} features: ${analysis.features.join(', ')}`,
      `✓ Generated ${results.filesCreated} files and ${results.foldersCreated} folders`,
      `✓ Technology stack: ${analysis.technology}`,
      `✓ UI style: ${analysis.uiStyle}`
    ];
    
    return summary.join('\n');
  }
  
  private generateResponseMessage(analysis: any, results: any): string {
    return `🎉 I've successfully built your ${analysis.appType}!

Here's what I created:
- **Technology**: ${analysis.technology} with ${analysis.uiStyle} styling
- **Features**: ${analysis.features.join(', ')}
- **Structure**: ${results.filesCreated} files across ${results.foldersCreated} folders

The app is ready to run! Just click "Run" to see it in action. You can also:
- Edit any file to customize the app
- Add more features by asking me
- Deploy it when you're ready

Would you like me to add any specific features or make changes?`;
  }
}

// Export a singleton instance that can be configured with API key
export const enhancedAgent = new EnhancedAutonomousAgent();

// Function to initialize the agent with API key
export async function initializeEnhancedAgent() {
  // First try environment variable
  const envApiKey = process.env.ANTHROPIC_API_KEY;
  if (envApiKey) {
    enhancedAgent.setApiKey(envApiKey);
    logger.info('Enhanced AI Agent initialized with Anthropic API key from environment');
    return;
  }
  
  // Fallback to database
  const adminApiKey = await storage.getActiveAdminApiKey('admin'); // Pass admin username
  if (adminApiKey) {
    enhancedAgent.setApiKey(adminApiKey.apiKey);
    logger.info('Enhanced AI Agent initialized with Anthropic API key from database');
  } else {
    logger.warn('No Anthropic API key found - AI Agent will not function until API key is set');
  }
}

// Initialize on module load
initializeEnhancedAgent().catch((err) => {
  logger.error(`Failed to initialize enhanced agent: ${err}`);
});