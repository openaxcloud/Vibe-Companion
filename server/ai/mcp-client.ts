/**
 * MCP Client for AI Agent Integration
 * This client connects the AI agent to the MCP server for all operations
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('MCPClient');

export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

export class MCPClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://127.0.0.1:3200') {
    this.baseUrl = baseUrl;
    logger.info(`MCP Client initialized with base URL: ${baseUrl}`);
  }
  
  /**
   * Execute an MCP tool
   */
  async executeTool(toolName: string, args: any): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      
      if (!response.ok) {
        throw new Error(`MCP tool execution failed: ${response.statusText}`);
      }
      
      const result = await response.json() as MCPToolResult;
      return result;
    } catch (error) {
      logger.error(`Failed to execute MCP tool ${toolName}: ${error}`);
      throw error;
    }
  }
  
  /**
   * File System Operations
   */
  async readFile(path: string): Promise<string> {
    const result = await this.executeTool('fs_read', { path });
    return result.content[0]?.text || '';
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    await this.executeTool('fs_write', { path, content });
  }
  
  async deleteFile(path: string): Promise<void> {
    await this.executeTool('fs_delete', { path });
  }
  
  async listDirectory(path: string): Promise<string[]> {
    const result = await this.executeTool('fs_list', { path });
    const text = result.content[0]?.text || '[]';
    try {
      return JSON.parse(text);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return [];
    }
  }
  
  async createDirectory(path: string): Promise<void> {
    await this.executeTool('fs_mkdir', { path });
  }
  
  async moveFile(source: string, destination: string): Promise<void> {
    await this.executeTool('fs_move', { source, destination });
  }
  
  async copyFile(source: string, destination: string): Promise<void> {
    await this.executeTool('fs_copy', { source, destination });
  }
  
  async searchFiles(pattern: string, path?: string): Promise<string[]> {
    const result = await this.executeTool('fs_search', { pattern, path: path || '.' });
    const text = result.content[0]?.text || '[]';
    try {
      return JSON.parse(text);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return [];
    }
  }
  
  /**
   * Command Execution
   */
  async executeCommand(command: string, cwd?: string): Promise<string> {
    const result = await this.executeTool('exec_command', { 
      command, 
      cwd: cwd || process.cwd() 
    });
    return result.content[0]?.text || '';
  }
  
  async spawnProcess(command: string, args: string[], cwd?: string): Promise<number> {
    const result = await this.executeTool('exec_spawn', { 
      command, 
      args, 
      cwd: cwd || process.cwd() 
    });
    return result.content[0]?.data?.pid || 0;
  }
  
  async killProcess(pid: number): Promise<void> {
    await this.executeTool('process_kill', { pid });
  }
  
  /**
   * Database Operations
   */
  async executeQuery(query: string, params?: any[]): Promise<any> {
    const result = await this.executeTool('db_query', { 
      query, 
      params,
      operation: 'raw'
    });
    return result.content[0]?.data || [];
  }
  
  async executeTransaction(queries: Array<{ query: string; params?: any[] }>): Promise<any> {
    const result = await this.executeTool('db_transaction', { queries });
    return result.content[0]?.data || [];
  }
  
  /**
   * Git Operations
   */
  async getGitStatus(cwd?: string): Promise<any> {
    const result = await this.executeTool('git_status', { cwd: cwd || process.cwd() });
    return result.content[0]?.data || {};
  }
  
  /**
   * System Information
   */
  async getSystemInfo(): Promise<any> {
    const result = await this.executeTool('system_info', {});
    return result.content[0]?.data || {};
  }
  
  /**
   * Environment Variables
   */
  async getEnvVar(name: string): Promise<string> {
    const result = await this.executeTool('env_get', { name });
    return result.content[0]?.text || '';
  }
  
  async setEnvVar(name: string, value: string): Promise<void> {
    await this.executeTool('env_set', { name, value });
  }
  
  /**
   * AI Completion (for enhanced agent operations)
   */
  async getAICompletion(prompt: string, model?: string): Promise<string> {
    const result = await this.executeTool('ai_complete', { 
      prompt, 
      model: model || 'claude-sonnet-4-6'
    });
    return result.content[0]?.text || '';
  }
  
  /**
   * Package Management Helper
   */
  async installPackages(packages: string[], projectPath: string): Promise<string> {
    const packageList = packages.join(' ');
    const command = `npm install ${packageList}`;
    return await this.executeCommand(command, projectPath);
  }
  
  /**
   * Project Helper Methods
   */
  async createProjectFile(projectPath: string, relativePath: string, content: string): Promise<void> {
    const fullPath = `${projectPath}/${relativePath}`;
    
    // Create directories if needed
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir && dir !== projectPath) {
      try {
        await this.createDirectory(dir);
      } catch (err: any) { console.error("[catch]", err?.message || err);
        // Directory might already exist
      }
    }
    
    // Write the file
    await this.writeFile(fullPath, content);
  }
  
  async createProjectDirectory(projectPath: string, relativePath: string): Promise<void> {
    const fullPath = `${projectPath}/${relativePath}`;
    await this.createDirectory(fullPath);
  }
  
  /**
   * Health Check
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }
  
  /**
   * List Available Tools
   */
  async listTools(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tools`);
      if (response.ok) {
        return await response.json() as any[];
      }
      return [];
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return [];
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClient();