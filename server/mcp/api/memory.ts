// @ts-nocheck
import { Router } from 'express';
import { ensureAuthenticated } from '../../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { memoryMCP } from '../servers/memory-mcp';

const router = Router();

const toIsoString = (value: any) => {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

// Search memory
router.post('/search', ensureAuthenticated, async (req, res) => {
  try {
    const { query, type, limit } = req.body ?? {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a search query.',
      });
    }

    const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const nodes = await memoryMCP.searchNodes(query, type, normalizedLimit);

    const results = await Promise.all(
      nodes.map(async (node) => {
        const edges = await memoryMCP.getEdges(node.id, 'both');

        return {
          id: node.id,
          type: node.type,
          content: node.content,
          metadata: node.metadata || {},
          connections: edges.length,
          createdAt: toIsoString(node.createdAt),
          lastAccessed: toIsoString(node.updatedAt),
        };
      }),
    );

    res.json(results);
  } catch (error: any) {
    console.error('Memory MCP search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
});

// Get conversation history
router.get('/conversations', ensureAuthenticated, async (req, res) => {
  try {
    const userId = String(req.user!.id);
    const sessionId = req.query.sessionId as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 200, 1), 500);

    const history = await memoryMCP.getConversationHistory(userId, sessionId, limit);
    const conversations = new Map();

    for (const entry of history) {
      const existing = conversations.get(entry.sessionId) || {
        id: entry.sessionId,
        title: entry.metadata?.title || undefined,
        messages: 0,
        lastMessage: '',
        lastTimestamp: null as Date | null,
        firstTimestamp: null as Date | null,
      };

      existing.messages += 1;

      const timestamp = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
      if (!existing.firstTimestamp || timestamp < existing.firstTimestamp) {
        existing.firstTimestamp = timestamp;
      }
      if (!existing.lastTimestamp || timestamp > existing.lastTimestamp) {
        existing.lastTimestamp = timestamp;
        existing.lastMessage = entry.content;
        if (!existing.title && entry.metadata?.title) {
          existing.title = entry.metadata.title;
        }
      }

      if (!existing.title && entry.role === 'user') {
        existing.title = entry.content.slice(0, 80);
      }

      conversations.set(entry.sessionId, existing);
    }

    const response = Array.from(conversations.values())
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title || `Conversation ${conversation.id.slice(0, 8)}`,
        messages: conversation.messages,
        lastMessage: conversation.lastMessage,
        createdAt: toIsoString(conversation.firstTimestamp),
        updatedAt: toIsoString(conversation.lastTimestamp),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(response);
  } catch (error: any) {
    console.error('Memory MCP conversations error:', error);
    res.status(500).json({
      error: 'Failed to fetch conversations',
      message: error.message,
    });
  }
});

// Create memory node
router.post('/nodes', ensureAuthenticated, async (req, res) => {
  try {
    const { type, content, metadata, embedding } = req.body ?? {};

    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        error: 'Type is required',
        message: 'Please provide a valid node type.',
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Content is required',
        message: 'Please provide node content.',
      });
    }

    const userId = req.user?.id;
    const username = req.user?.username || 'system';
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const node = await memoryMCP.createNode({
      type,
      content,
      metadata: {
        ...(metadata || {}),
        createdBy: req.user?.username || req.user?.id,
        userId: req.user?.id,
      },
      embedding,
    });

    res.status(201).json({
      id: node.id,
      type: node.type,
      content: node.content,
      metadata: node.metadata || {},
      connections: 0,
      createdAt: toIsoString(node.createdAt),
      lastAccessed: toIsoString(node.updatedAt),
      createdAt: (node.createdAt instanceof Date ? node.createdAt : new Date(node.createdAt)).toISOString(),
      lastAccessed: (node.updatedAt instanceof Date ? node.updatedAt : new Date(node.updatedAt)).toISOString(),
    });
  } catch (error: any) {
    console.error('Memory MCP create node error:', error);
    res.status(500).json({
      error: 'Failed to create memory node',
      message: error.message,
    });
  }
});

// Create edge between nodes
router.post('/edges', ensureAuthenticated, async (req, res) => {
  try {
    const { fromId, toId, relationship, weight, metadata } = req.body ?? {};

    if (!fromId || !toId || !relationship) {
      return res.status(400).json({
        error: 'Invalid edge payload',
        message: 'fromId, toId, and relationship are required to create an edge.',
      });
    }

    const edge = await memoryMCP.createEdge(fromId, toId, relationship, weight, {
      ...(metadata || {}),
      createdBy: req.user?.username || req.user?.id,
      createdAt: new Date().toISOString(),
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      id: edge.id,
      fromId: edge.sourceId,
      toId: edge.targetId,
      relationship: edge.relationship,
      weight: edge.weight,
      metadata: edge.metadata || {},
      createdAt: toIsoString(edge.createdAt),
      createdAt: (edge.createdAt instanceof Date ? edge.createdAt : new Date(edge.createdAt)).toISOString(),
    });
  } catch (error: any) {
    console.error('Memory MCP create edge error:', error);
    res.status(500).json({
      error: 'Failed to create connection',
      message: error.message,
    });
  }
});

// Save conversation
router.post('/conversations', ensureAuthenticated, async (req, res) => {
  try {
    const { title, messages, sessionId: providedSessionId } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Messages required',
        message: 'Provide at least one conversation message to persist.',
      });
    }

    const sessionId = providedSessionId || uuidv4();
    const userId = String(req.user!.id);
    const persistedMessages: any[] = [];

    for (const message of messages) {
      if (!message || typeof message.content !== 'string' || !message.role) {
        return res.status(400).json({
          error: 'Invalid message',
          message: 'Each message must include a role and content.',
        });
      }

      const saved = await memoryMCP.saveConversation(
        userId,
        sessionId,
        message.role,
        message.content,
        {
          ...(message.metadata || {}),
          title: message.metadata?.title || title,
        },
      );

      persistedMessages.push(saved);
    }

    const firstMessage = persistedMessages[0];
    const lastMessage = persistedMessages[persistedMessages.length - 1];

    res.status(201).json({
      id: sessionId,
      title: title || lastMessage?.metadata?.title || firstMessage?.content?.slice(0, 80) || 'Conversation',
      messages: persistedMessages.length,
      userId,
      createdAt: toIsoString(firstMessage?.timestamp),
      updatedAt: toIsoString(lastMessage?.timestamp),
      createdAt: (firstMessage?.timestamp instanceof Date
        ? firstMessage.timestamp
        : new Date(firstMessage?.timestamp || Date.now())
      ).toISOString(),
      updatedAt: (lastMessage?.timestamp instanceof Date
        ? lastMessage.timestamp
        : new Date(lastMessage?.timestamp || Date.now())
      ).toISOString(),
    });
  } catch (error: any) {
    console.error('Memory MCP save conversation error:', error);
    res.status(500).json({
      error: 'Failed to save conversation',
      message: error.message,
    });
  }
});

export default router;
