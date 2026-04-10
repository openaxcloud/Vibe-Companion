/**
 * Figma MCP Server
 * Provides Figma integration capabilities
 */

import fetch from 'node-fetch';

export class FigmaMCPServer {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.figma.com/v1';
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      this.apiKey = process.env.FIGMA_API_KEY || null;
      if (this.apiKey) {
        this.initialized = true;
      }
    } catch (error) {
      console.error('[figma-mcp] Failed to initialize:', error);
    }
  }

  private async makeRequest(endpoint: string, method = 'GET', body?: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Figma API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'X-Figma-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.statusText}`);
    }

    return response.json() as Promise<any>;
  }

  // Get file information
  async getFile(params: { fileKey: string }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const data = await this.makeRequest(`/files/${params.fileKey}`);
      return {
        name: data.name,
        lastModified: data.lastModified,
        version: data.version,
        thumbnailUrl: data.thumbnailUrl,
        components: data.components,
        styles: data.styles,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get file error:', error);
      return { error: error.message };
    }
  }

  // Get file nodes
  async getFileNodes(params: {
    fileKey: string;
    nodeIds: string[];
  }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const ids = params.nodeIds.join(',');
      const data = await this.makeRequest(`/files/${params.fileKey}/nodes?ids=${ids}`);
      return {
        nodes: data.nodes,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get file nodes error:', error);
      return { error: error.message };
    }
  }

  // Get images from file
  async getImages(params: {
    fileKey: string;
    nodeIds: string[];
    format?: string;
    scale?: number;
  }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const ids = params.nodeIds.join(',');
      const format = params.format || 'png';
      const scale = params.scale || 1;
      
      const data = await this.makeRequest(
        `/images/${params.fileKey}?ids=${ids}&format=${format}&scale=${scale}`
      );
      
      return {
        images: data.images,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get images error:', error);
      return { error: error.message };
    }
  }

  // Get team projects
  async getTeamProjects(params: { teamId: string }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const data = await this.makeRequest(`/teams/${params.teamId}/projects`);
      return {
        projects: data.projects,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get team projects error:', error);
      return { error: error.message };
    }
  }

  // Get project files
  async getProjectFiles(params: { projectId: string }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const data = await this.makeRequest(`/projects/${params.projectId}/files`);
      return {
        files: data.files,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get project files error:', error);
      return { error: error.message };
    }
  }

  // Get comments on a file
  async getComments(params: { fileKey: string }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const data = await this.makeRequest(`/files/${params.fileKey}/comments`);
      return {
        comments: data.comments,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Get comments error:', error);
      return { error: error.message };
    }
  }

  // Post a comment
  async postComment(params: {
    fileKey: string;
    message: string;
    clientMeta?: {
      x?: number;
      y?: number;
      node_id?: string;
    };
  }) {
    if (!this.initialized) {
      return { error: 'Figma not initialized. Please set FIGMA_API_KEY.' };
    }

    try {
      const data = await this.makeRequest(
        `/files/${params.fileKey}/comments`,
        'POST',
        {
          message: params.message,
          client_meta: params.clientMeta,
        }
      );
      
      return {
        comment: data.comment,
      };
    } catch (error: any) {
      console.error('[figma-mcp] Post comment error:', error);
      return { error: error.message };
    }
  }

  // Get tool definitions
  getTools() {
    return [
      {
        name: 'figma_get_file',
        description: 'Get Figma file information',
        inputSchema: {
          type: 'object',
          properties: {
            fileKey: { type: 'string', description: 'Figma file key' },
          },
          required: ['fileKey'],
        },
      },
      {
        name: 'figma_get_nodes',
        description: 'Get specific nodes from a Figma file',
        inputSchema: {
          type: 'object',
          properties: {
            fileKey: { type: 'string', description: 'Figma file key' },
            nodeIds: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Node IDs to retrieve' 
            },
          },
          required: ['fileKey', 'nodeIds'],
        },
      },
      {
        name: 'figma_get_images',
        description: 'Export images from Figma nodes',
        inputSchema: {
          type: 'object',
          properties: {
            fileKey: { type: 'string', description: 'Figma file key' },
            nodeIds: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Node IDs to export' 
            },
            format: { type: 'string', description: 'Image format (png, jpg, svg, pdf)' },
            scale: { type: 'number', description: 'Scale factor (0.01 to 4)' },
          },
          required: ['fileKey', 'nodeIds'],
        },
      },
      {
        name: 'figma_get_team_projects',
        description: 'Get projects in a Figma team',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Figma team ID' },
          },
          required: ['teamId'],
        },
      },
      {
        name: 'figma_get_project_files',
        description: 'Get files in a Figma project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Figma project ID' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'figma_get_comments',
        description: 'Get comments on a Figma file',
        inputSchema: {
          type: 'object',
          properties: {
            fileKey: { type: 'string', description: 'Figma file key' },
          },
          required: ['fileKey'],
        },
      },
      {
        name: 'figma_post_comment',
        description: 'Post a comment on a Figma file',
        inputSchema: {
          type: 'object',
          properties: {
            fileKey: { type: 'string', description: 'Figma file key' },
            message: { type: 'string', description: 'Comment message' },
            clientMeta: {
              type: 'object',
              properties: {
                x: { type: 'number', description: 'X coordinate' },
                y: { type: 'number', description: 'Y coordinate' },
                node_id: { type: 'string', description: 'Node ID to attach comment to' },
              },
            },
          },
          required: ['fileKey', 'message'],
        },
      },
    ];
  }
}

export const figmaMCP = new FigmaMCPServer();