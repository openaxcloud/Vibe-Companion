// @ts-nocheck
import { createLogger } from '../../utils/logger';
import { db } from '../../db';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const logger = createLogger('memory-mcp');

export interface MemoryNode {
  id: string;
  type: 'concept' | 'entity' | 'event' | 'fact' | 'idea';
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  weight: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ConversationMemory {
  id: string;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class MemoryMCPServer {
  constructor() {
    this.initializeSchema();
  }

  private async initializeSchema() {
    try {
      // Create tables if they don't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          embedding FLOAT[],
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
          target_id TEXT NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
          relationship TEXT NOT NULL,
          weight FLOAT DEFAULT 1.0,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(source_id, target_id, relationship)
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS conversation_memory (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes for better query performance (each index separately for resilience)
      const indexStatements = [
        sql`CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_graph_nodes(type)`,
        sql`CREATE INDEX IF NOT EXISTS idx_nodes_content ON knowledge_graph_nodes USING gin(to_tsvector('english', content))`,
        sql`CREATE INDEX IF NOT EXISTS idx_edges_relationship ON knowledge_graph_edges(relationship)`,
        sql`CREATE INDEX IF NOT EXISTS idx_user_session ON conversation_memory(user_id, session_id)`,
        sql`CREATE INDEX IF NOT EXISTS idx_created_at ON conversation_memory(created_at)`
      ];

      for (const indexSql of indexStatements) {
        try {
          await db.execute(indexSql);
        } catch (indexError: any) {
          // Index creation may fail if column doesn't exist - log and continue
          logger.warn(`Index creation skipped: ${indexError.message || 'unknown error'}`);
        }
      }

      logger.info('Memory schema initialized');
    } catch (error: any) {
      logger.error('Failed to initialize memory schema:', error?.message || String(error));
      // Non-blocking - continue even if schema init fails partially
    }
  }

  // Node operations
  async createNode(node: Omit<MemoryNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryNode> {
    try {
      const id = this.generateId();
      const now = new Date();
      
      await db.insert(schema.knowledgeGraphNodes).values({
        id,
        type: node.type,
        content: node.content,
        metadata: node.metadata,
        embedding: node.embedding,
        createdAt: now,
        updatedAt: now
      });

      return {
        id,
        ...node,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      logger.error('Failed to create node:', error);
      throw error;
    }
  }

  async getNode(id: string): Promise<MemoryNode | null> {
    try {
      const [node] = await db
        .select()
        .from(schema.knowledgeGraphNodes)
        .where(eq(schema.knowledgeGraphNodes.id, id));
      
      return node || null;
    } catch (error) {
      logger.error('Failed to get node:', error);
      throw error;
    }
  }

  async updateNode(id: string, updates: Partial<Omit<MemoryNode, 'id' | 'createdAt'>>): Promise<MemoryNode> {
    try {
      const [updated] = await db
        .update(schema.knowledgeGraphNodes)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(schema.knowledgeGraphNodes.id, id))
        .returning();

      return updated;
    } catch (error) {
      logger.error('Failed to update node:', error);
      throw error;
    }
  }

  async deleteNode(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.knowledgeGraphNodes)
        .where(eq(schema.knowledgeGraphNodes.id, id));
      
      return true;
    } catch (error) {
      logger.error('Failed to delete node:', error);
      throw error;
    }
  }

  async searchNodes(query: string, type?: string, limit: number = 10): Promise<MemoryNode[]> {
    try {
      let conditions = [];
      
      // Full-text search on content
      conditions.push(sql`to_tsvector('english', content) @@ plainto_tsquery('english', ${query})`);
      
      if (type) {
        conditions.push(eq(schema.knowledgeGraphNodes.type, type));
      }

      const nodes = await db
        .select()
        .from(schema.knowledgeGraphNodes)
        .where(and(...conditions))
        .limit(limit);

      return nodes;
    } catch (error) {
      logger.error('Failed to search nodes:', error);
      throw error;
    }
  }

  // Edge operations
  async createEdge(
    sourceId: string,
    targetId: string,
    relationship: string,
    weight: number = 1.0,
    metadata?: Record<string, any>
  ): Promise<MemoryEdge> {
    try {
      const id = this.generateId();
      const now = new Date();

      await db.insert(schema.knowledgeGraphEdges).values({
        id,
        sourceId,
        targetId,
        relationship,
        weight,
        metadata,
        createdAt: now
      });

      return {
        id,
        sourceId,
        targetId,
        relationship,
        weight,
        metadata,
        createdAt: now
      };
    } catch (error) {
      logger.error('Failed to create edge:', error);
      throw error;
    }
  }

  async getEdges(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<MemoryEdge[]> {
    try {
      let conditions = [];

      if (direction === 'out' || direction === 'both') {
        conditions.push(eq(schema.knowledgeGraphEdges.sourceId, nodeId));
      }
      if (direction === 'in' || direction === 'both') {
        conditions.push(eq(schema.knowledgeGraphEdges.targetId, nodeId));
      }

      const edges = await db
        .select()
        .from(schema.knowledgeGraphEdges)
        .where(or(...conditions));

      return edges;
    } catch (error) {
      logger.error('Failed to get edges:', error);
      throw error;
    }
  }

  async deleteEdge(id: string): Promise<boolean> {
    try {
      await db
        .delete(schema.knowledgeGraphEdges)
        .where(eq(schema.knowledgeGraphEdges.id, id));
      
      return true;
    } catch (error) {
      logger.error('Failed to delete edge:', error);
      throw error;
    }
  }

  // Graph operations
  async getSubgraph(nodeId: string, depth: number = 2): Promise<{
    nodes: MemoryNode[];
    edges: MemoryEdge[];
  }> {
    try {
      const visitedNodes = new Set<string>();
      const collectedNodes: MemoryNode[] = [];
      const collectedEdges: MemoryEdge[] = [];
      
      const queue: { id: string; level: number }[] = [{ id: nodeId, level: 0 }];

      while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        
        if (visitedNodes.has(id) || level > depth) continue;
        visitedNodes.add(id);

        // Get node
        const node = await this.getNode(id);
        if (node) {
          collectedNodes.push(node);

          // Get edges if not at max depth
          if (level < depth) {
            const edges = await this.getEdges(id, 'both');
            
            for (const edge of edges) {
              collectedEdges.push(edge);
              
              // Add connected nodes to queue
              if (edge.sourceId === id && !visitedNodes.has(edge.targetId)) {
                queue.push({ id: edge.targetId, level: level + 1 });
              }
              if (edge.targetId === id && !visitedNodes.has(edge.sourceId)) {
                queue.push({ id: edge.sourceId, level: level + 1 });
              }
            }
          }
        }
      }

      return { nodes: collectedNodes, edges: collectedEdges };
    } catch (error) {
      logger.error('Failed to get subgraph:', error);
      throw error;
    }
  }

  async findPath(sourceId: string, targetId: string, maxDepth: number = 5): Promise<string[] | null> {
    try {
      // BFS to find shortest path
      const queue: { id: string; path: string[] }[] = [{ id: sourceId, path: [sourceId] }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        
        if (path.length > maxDepth) continue;
        if (id === targetId) return path;
        if (visited.has(id)) continue;
        
        visited.add(id);

        const edges = await this.getEdges(id, 'out');
        for (const edge of edges) {
          if (!visited.has(edge.targetId)) {
            queue.push({
              id: edge.targetId,
              path: [...path, edge.targetId]
            });
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find path:', error);
      throw error;
    }
  }

  // Conversation memory operations
  async saveConversation(
    userId: string,
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<ConversationMemory> {
    try {
      const id = this.generateId();
      const now = new Date();

      await db.insert(schema.conversationMemory).values({
        id,
        userId,
        sessionId,
        role,
        content,
        metadata,
        timestamp: now
      });

      return {
        id,
        userId,
        sessionId,
        role,
        content,
        metadata,
        timestamp: now
      };
    } catch (error) {
      logger.error('Failed to save conversation:', error);
      throw error;
    }
  }

  async getConversationHistory(
    userId: string,
    sessionId?: string,
    limit: number = 50
  ): Promise<ConversationMemory[]> {
    try {
      let conditions = [eq(schema.conversationMemory.userId, userId)];
      
      if (sessionId) {
        conditions.push(eq(schema.conversationMemory.sessionId, sessionId));
      }

      const history = await db
        .select()
        .from(schema.conversationMemory)
        .where(and(...conditions))
        .orderBy(desc(schema.conversationMemory.timestamp))
        .limit(limit);

      return history.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Failed to get conversation history:', error);
      throw error;
    }
  }

  async summarizeConversation(userId: string, sessionId: string): Promise<string> {
    try {
      const history = await this.getConversationHistory(userId, sessionId);
      
      // Extract key points from conversation
      const keyPoints: string[] = [];
      const topics = new Set<string>();
      
      for (const message of history) {
        if (message.role === 'assistant') {
          // Extract important information from assistant responses
          const sentences = message.content.split(/[.!?]+/);
          for (const sentence of sentences) {
            if (sentence.length > 50) { // Likely contains meaningful information
              keyPoints.push(sentence.trim());
            }
          }
        } else if (message.role === 'user') {
          // Extract topics from user queries
          const words = message.content.toLowerCase().split(/\s+/);
          for (const word of words) {
            if (word.length > 5) { // Filter out short words
              topics.add(word);
            }
          }
        }
      }

      const summary = `Conversation Summary:
Topics discussed: ${Array.from(topics).slice(0, 10).join(', ')}
Key points: ${keyPoints.slice(0, 5).join('; ')}
Total messages: ${history.length}`;

      return summary;
    } catch (error) {
      logger.error('Failed to summarize conversation:', error);
      throw error;
    }
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async clearMemory(userId?: string): Promise<void> {
    try {
      if (userId) {
        // Clear only user's memory
        await db
          .delete(schema.conversationMemory)
          .where(eq(schema.conversationMemory.userId, userId));
      } else {
        // Clear all memory (use with caution)
        await db.delete(schema.conversationMemory);
        await db.delete(schema.knowledgeGraphEdges);
        await db.delete(schema.knowledgeGraphNodes);
      }
      
      logger.info(`Memory cleared${userId ? ` for user ${userId}` : ' completely'}`);
    } catch (error) {
      logger.error('Failed to clear memory:', error);
      throw error;
    }
  }

  async exportMemory(userId: string): Promise<{
    nodes: MemoryNode[];
    edges: MemoryEdge[];
    conversations: ConversationMemory[];
  }> {
    try {
      const nodes = await db.select().from(schema.knowledgeGraphNodes);
      const edges = await db.select().from(schema.knowledgeGraphEdges);
      const conversations = await this.getConversationHistory(userId);

      return {
        nodes,
        edges,
        conversations
      };
    } catch (error) {
      logger.error('Failed to export memory:', error);
      throw error;
    }
  }

  async importMemory(data: {
    nodes: MemoryNode[];
    edges: MemoryEdge[];
    conversations: ConversationMemory[];
  }): Promise<void> {
    try {
      // Import nodes
      for (const node of data.nodes) {
        await db.insert(schema.knowledgeGraphNodes).values(node).onConflictDoNothing();
      }

      // Import edges
      for (const edge of data.edges) {
        await db.insert(schema.knowledgeGraphEdges).values(edge).onConflictDoNothing();
      }

      // Import conversations
      for (const conv of data.conversations) {
        await db.insert(schema.conversationMemory).values(conv).onConflictDoNothing();
      }

      logger.info('Memory imported successfully');
    } catch (error) {
      logger.error('Failed to import memory:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const memoryMCP = new MemoryMCPServer();