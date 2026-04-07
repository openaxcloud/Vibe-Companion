import { createLogger } from '../utils/logger';
import { checkpointService } from './checkpoint-service';

const logger = createLogger('FeedbackService');

export interface AgentFeedback {
  id: string;
  projectId: number;
  userId: number;
  conversationId?: string;
  taskId?: string;
  type: 'positive' | 'negative' | 'suggestion' | 'bug';
  category: 'accuracy' | 'speed' | 'usefulness' | 'interface' | 'other';
  rating?: number; // 1-5
  message: string;
  context?: {
    code?: string;
    error?: string;
    action?: string;
    result?: string;
  };
  metadata?: {
    model?: string;
    tokensUsed?: number;
    responseTime?: number;
    browserInfo?: string;
  };
  status: 'pending' | 'reviewed' | 'resolved' | 'archived';
  response?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  feedbackByCategory: Record<string, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  topIssues: Array<{
    category: string;
    count: number;
    averageRating: number;
  }>;
}

export class FeedbackService {
  private feedbackItems: Map<string, AgentFeedback> = new Map();
  private feedbackByProject: Map<number, Set<string>> = new Map();
  private feedbackByUser: Map<number, Set<string>> = new Map();

  async submitFeedback(params: {
    projectId: number;
    userId: number;
    conversationId?: string;
    taskId?: string;
    type: AgentFeedback['type'];
    category: AgentFeedback['category'];
    rating?: number;
    message: string;
    context?: AgentFeedback['context'];
    metadata?: AgentFeedback['metadata'];
  }): Promise<AgentFeedback> {
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const feedback: AgentFeedback = {
      id: feedbackId,
      projectId: params.projectId,
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      type: params.type,
      category: params.category,
      rating: params.rating,
      message: params.message,
      context: params.context,
      metadata: params.metadata,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store feedback
    this.feedbackItems.set(feedbackId, feedback);

    // Track by project
    if (!this.feedbackByProject.has(params.projectId)) {
      this.feedbackByProject.set(params.projectId, new Set());
    }
    this.feedbackByProject.get(params.projectId)!.add(feedbackId);

    // Track by user
    if (!this.feedbackByUser.has(params.userId)) {
      this.feedbackByUser.set(params.userId, new Set());
    }
    this.feedbackByUser.get(params.userId)!.add(feedbackId);

    logger.info(`Feedback submitted: ${feedbackId} - Type: ${params.type}, Category: ${params.category}`);

    // Create checkpoint for important feedback
    if (params.type === 'negative' || params.type === 'bug') {
      await checkpointService.createAgentCheckpoint(
        params.projectId,
        params.userId,
        `User feedback: ${params.type} - ${params.category}`,
        { feedbackId, rating: params.rating }
      );
    }

    return feedback;
  }

  async getFeedback(feedbackId: string): Promise<AgentFeedback | null> {
    return this.feedbackItems.get(feedbackId) || null;
  }

  async getProjectFeedback(projectId: number, options?: {
    type?: AgentFeedback['type'];
    category?: AgentFeedback['category'];
    status?: AgentFeedback['status'];
    limit?: number;
    offset?: number;
  }): Promise<AgentFeedback[]> {
    const feedbackIds = this.feedbackByProject.get(projectId) || new Set();
    let feedbackList: AgentFeedback[] = [];

    for (const id of feedbackIds) {
      const feedback = this.feedbackItems.get(id);
      if (feedback && 
          (!options?.type || feedback.type === options.type) &&
          (!options?.category || feedback.category === options.category) &&
          (!options?.status || feedback.status === options.status)) {
        feedbackList.push(feedback);
      }
    }

    // Sort by creation date (newest first)
    feedbackList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const start = options?.offset || 0;
    const end = start + (options?.limit || 50);

    return feedbackList.slice(start, end);
  }

  async getUserFeedback(userId: number, options?: {
    limit?: number;
    offset?: number;
  }): Promise<AgentFeedback[]> {
    const feedbackIds = this.feedbackByUser.get(userId) || new Set();
    const feedbackList: AgentFeedback[] = [];

    for (const id of feedbackIds) {
      const feedback = this.feedbackItems.get(id);
      if (feedback) {
        feedbackList.push(feedback);
      }
    }

    // Sort by creation date (newest first)
    feedbackList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const start = options?.offset || 0;
    const end = start + (options?.limit || 50);

    return feedbackList.slice(start, end);
  }

  async updateFeedbackStatus(feedbackId: string, status: AgentFeedback['status'], response?: string): Promise<void> {
    const feedback = this.feedbackItems.get(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback ${feedbackId} not found`);
    }

    feedback.status = status;
    feedback.response = response;
    feedback.updatedAt = new Date();

    logger.info(`Updated feedback ${feedbackId} status to ${status}`);
  }

  async getProjectStats(projectId: number): Promise<FeedbackStats> {
    const feedbackList = await this.getProjectFeedback(projectId);

    // Calculate stats
    const totalFeedback = feedbackList.length;
    const ratingsSum = feedbackList.reduce((sum, f) => sum + (f.rating || 0), 0);
    const ratingsCount = feedbackList.filter(f => f.rating !== undefined).length;
    const averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;

    // Count by type
    const feedbackByType: Record<string, number> = {};
    const feedbackByCategory: Record<string, number> = {};
    const categoryRatings: Record<string, { sum: number; count: number }> = {};

    for (const feedback of feedbackList) {
      // By type
      feedbackByType[feedback.type] = (feedbackByType[feedback.type] || 0) + 1;
      
      // By category
      feedbackByCategory[feedback.category] = (feedbackByCategory[feedback.category] || 0) + 1;
      
      // Category ratings
      if (feedback.rating) {
        if (!categoryRatings[feedback.category]) {
          categoryRatings[feedback.category] = { sum: 0, count: 0 };
        }
        categoryRatings[feedback.category].sum += feedback.rating;
        categoryRatings[feedback.category].count += 1;
      }
    }

    // Calculate top issues (categories with low ratings)
    const topIssues = Object.entries(categoryRatings)
      .map(([category, data]) => ({
        category,
        count: feedbackByCategory[category] || 0,
        averageRating: data.count > 0 ? data.sum / data.count : 0
      }))
      .filter(issue => issue.averageRating < 3.5) // Issues with low ratings
      .sort((a, b) => a.averageRating - b.averageRating)
      .slice(0, 5);

    // Determine trend (simplified)
    const recentFeedback = feedbackList.slice(0, 10);
    const olderFeedback = feedbackList.slice(10, 20);
    
    const recentAverage = this.calculateAverageRating(recentFeedback);
    const olderAverage = this.calculateAverageRating(olderFeedback);
    
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAverage > olderAverage + 0.2) {
      recentTrend = 'improving';
    } else if (recentAverage < olderAverage - 0.2) {
      recentTrend = 'declining';
    }

    return {
      totalFeedback,
      averageRating: Math.round(averageRating * 10) / 10,
      feedbackByType,
      feedbackByCategory,
      recentTrend,
      topIssues
    };
  }

  async searchFeedback(params: {
    projectId?: number;
    query: string;
    type?: AgentFeedback['type'];
    category?: AgentFeedback['category'];
    minRating?: number;
    maxRating?: number;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<AgentFeedback[]> {
    let results: AgentFeedback[] = [];
    const query = params.query.toLowerCase();

    // Search through all feedback or project-specific
    const feedbackToSearch = params.projectId 
      ? await this.getProjectFeedback(params.projectId)
      : Array.from(this.feedbackItems.values());

    for (const feedback of feedbackToSearch) {
      // Text search
      const matchesQuery = feedback.message.toLowerCase().includes(query) ||
                          feedback.response?.toLowerCase().includes(query) ||
                          feedback.context?.action?.toLowerCase().includes(query);

      if (!matchesQuery) continue;

      // Filter by type
      if (params.type && feedback.type !== params.type) continue;

      // Filter by category
      if (params.category && feedback.category !== params.category) continue;

      // Filter by rating
      if (feedback.rating !== undefined) {
        if (params.minRating && feedback.rating < params.minRating) continue;
        if (params.maxRating && feedback.rating > params.maxRating) continue;
      }

      // Filter by date
      if (params.dateFrom && feedback.createdAt < params.dateFrom) continue;
      if (params.dateTo && feedback.createdAt > params.dateTo) continue;

      results.push(feedback);
    }

    // Sort by relevance (simple - exact matches first)
    results.sort((a, b) => {
      const aExact = a.message.toLowerCase() === query;
      const bExact = b.message.toLowerCase() === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return results.slice(0, params.limit || 50);
  }

  async exportFeedback(projectId: number, format: 'json' | 'csv'): Promise<string> {
    const feedbackList = await this.getProjectFeedback(projectId);

    if (format === 'json') {
      return JSON.stringify(feedbackList, null, 2);
    }

    // CSV format
    const headers = ['ID', 'Type', 'Category', 'Rating', 'Message', 'Status', 'Created At'];
    const rows = feedbackList.map(f => [
      f.id,
      f.type,
      f.category,
      f.rating || '',
      f.message.replace(/"/g, '""'), // Escape quotes
      f.status,
      f.createdAt.toISOString()
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  async analyzeSentiment(feedbackId: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    keywords: string[];
  }> {
    const feedback = this.feedbackItems.get(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback ${feedbackId} not found`);
    }

    // Simple sentiment analysis (in production, use NLP)
    const positiveWords = ['great', 'excellent', 'good', 'helpful', 'amazing', 'love', 'perfect', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'broken', 'bug', 'error', 'fail'];
    
    const words = feedback.message.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;
    const keywords: string[] = [];

    for (const word of words) {
      if (positiveWords.includes(word)) {
        positiveScore++;
        keywords.push(word);
      }
      if (negativeWords.includes(word)) {
        negativeScore++;
        keywords.push(word);
      }
    }

    // Consider rating
    if (feedback.rating) {
      if (feedback.rating >= 4) positiveScore += 2;
      if (feedback.rating <= 2) negativeScore += 2;
    }

    // Consider type
    if (feedback.type === 'positive') positiveScore += 3;
    if (feedback.type === 'negative' || feedback.type === 'bug') negativeScore += 3;

    // Determine sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 0.5;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      confidence = Math.min(0.9, 0.5 + (positiveScore - negativeScore) * 0.1);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      confidence = Math.min(0.9, 0.5 + (negativeScore - positiveScore) * 0.1);
    }

    return {
      sentiment,
      confidence: Math.round(confidence * 100) / 100,
      keywords: keywords.slice(0, 5)
    };
  }

  private calculateAverageRating(feedbackList: AgentFeedback[]): number {
    const ratings = feedbackList.filter(f => f.rating !== undefined).map(f => f.rating!);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }
}

export const feedbackService = new FeedbackService();