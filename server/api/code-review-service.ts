// @ts-nocheck
import { db } from '../db';
import { codeReviews, reviewComments, reviewApprovals, users, projects } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { AIProviderFactory } from '../ai/ai-provider-factory';

export class CodeReviewService {
  // Create a new code review
  async createCodeReview(data: {
    projectId: number;
    authorId: number;
    title: string;
    description?: string;
    filesChanged: string[];
  }) {
    const [review] = await db
      .insert(codeReviews)
      .values({
        ...data,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return review;
  }

  // Get code reviews for a project
  async getProjectCodeReviews(projectId: number) {
    return await db
      .select({
        id: codeReviews.id,
        title: codeReviews.title,
        description: codeReviews.description,
        status: codeReviews.status,
        filesChanged: codeReviews.filesChanged,
        createdAt: codeReviews.createdAt,
        updatedAt: codeReviews.updatedAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(codeReviews)
      .innerJoin(users, eq(codeReviews.authorId, users.id))
      .where(eq(codeReviews.projectId, projectId))
      .orderBy(desc(codeReviews.createdAt));
  }

  // Get code review details
  async getCodeReview(reviewId: number) {
    const [review] = await db
      .select({
        id: codeReviews.id,
        title: codeReviews.title,
        description: codeReviews.description,
        status: codeReviews.status,
        filesChanged: codeReviews.filesChanged,
        createdAt: codeReviews.createdAt,
        updatedAt: codeReviews.updatedAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        },
        project: {
          id: projects.id,
          name: projects.name
        }
      })
      .from(codeReviews)
      .innerJoin(users, eq(codeReviews.authorId, users.id))
      .innerJoin(projects, eq(codeReviews.projectId, projects.id))
      .where(eq(codeReviews.id, reviewId));

    if (!review) return null;

    // Get comments
    const comments = await db
      .select({
        id: reviewComments.id,
        content: reviewComments.content,
        filePath: reviewComments.filePath,
        lineNumber: reviewComments.lineNumber,
        createdAt: reviewComments.createdAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(reviewComments)
      .innerJoin(users, eq(reviewComments.authorId, users.id))
      .where(eq(reviewComments.reviewId, reviewId))
      .orderBy(reviewComments.createdAt);

    // Get approvals
    const approvals = await db
      .select({
        id: reviewApprovals.id,
        approved: reviewApprovals.approved,
        comment: reviewApprovals.comment,
        createdAt: reviewApprovals.createdAt,
        reviewer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(reviewApprovals)
      .innerJoin(users, eq(reviewApprovals.reviewerId, users.id))
      .where(eq(reviewApprovals.reviewId, reviewId))
      .orderBy(reviewApprovals.createdAt);

    return {
      ...review,
      comments,
      approvals
    };
  }

  // Add comment to code review
  async addReviewComment(data: {
    reviewId: number;
    authorId: number;
    content: string;
    filePath?: string;
    lineNumber?: number;
  }) {
    const [comment] = await db
      .insert(reviewComments)
      .values({
        ...data,
        createdAt: new Date()
      })
      .returning();

    return comment;
  }

  // Add approval/rejection to code review
  async addReviewApproval(data: {
    reviewId: number;
    reviewerId: number;
    approved: boolean;
    comment?: string;
  }) {
    // Check if reviewer already approved/rejected
    const existing = await db
      .select()
      .from(reviewApprovals)
      .where(and(
        eq(reviewApprovals.reviewId, data.reviewId),
        eq(reviewApprovals.reviewerId, data.reviewerId)
      ));

    if (existing.length > 0) {
      // Update existing approval
      const [approval] = await db
        .update(reviewApprovals)
        .set({
          approved: data.approved,
          comment: data.comment,
          createdAt: new Date()
        })
        .where(and(
          eq(reviewApprovals.reviewId, data.reviewId),
          eq(reviewApprovals.reviewerId, data.reviewerId)
        ))
        .returning();

      return approval;
    } else {
      // Create new approval
      const [approval] = await db
        .insert(reviewApprovals)
        .values({
          ...data,
          createdAt: new Date()
        })
        .returning();

      return approval;
    }
  }

  // Update review status
  async updateReviewStatus(reviewId: number, status: 'pending' | 'approved' | 'rejected' | 'changes_requested') {
    const [review] = await db
      .update(codeReviews)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(codeReviews.id, reviewId))
      .returning();

    return review;
  }

  // AI-powered code review
  async performAICodeReview(reviewId: number, fileContents: Record<string, string>) {
    try {
      const aiProvider = AIProviderFactory.createProvider('openai');
      
      const filesContent = Object.entries(fileContents)
        .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
        .join('\n\n');

      const prompt = `
Please perform a comprehensive code review of the following files:

${filesContent}

Provide feedback on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance optimizations
4. Security considerations
5. Maintainability improvements

Format your response as JSON with the following structure:
{
  "overallRating": "good|needs_work|excellent",
  "summary": "Brief overall assessment",
  "issues": [
    {
      "type": "bug|performance|security|style|maintainability",
      "severity": "low|medium|high|critical",
      "file": "filename",
      "line": 0,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "positives": ["List of good practices found"]
}
      `;

      const response = await aiProvider.generateText(prompt);
      const aiReview = JSON.parse(response);

      // Store AI review as a comment
      await this.addReviewComment({
        reviewId,
        authorId: 1, // System user ID
        content: `**AI Code Review**\n\n**Overall Rating:** ${aiReview.overallRating}\n\n**Summary:** ${aiReview.summary}\n\n**Issues Found:**\n${aiReview.issues.map((issue: any) => `- **${issue.type.toUpperCase()}** (${issue.severity}): ${issue.message}\n  *Suggestion: ${issue.suggestion}*`).join('\n')}\n\n**Positive Aspects:**\n${aiReview.positives.map((positive: string) => `- ${positive}`).join('\n')}`
      });

      return aiReview;
    } catch (error) {
      console.error('AI code review failed:', error);
      throw new Error('Failed to perform AI code review');
    }
  }

  // Get user's code review statistics
  async getUserReviewStats(userId: number) {
    const [reviewsCreated] = await db
      .select({ count: count() })
      .from(codeReviews)
      .where(eq(codeReviews.authorId, userId));

    const [reviewsGiven] = await db
      .select({ count: count() })
      .from(reviewApprovals)
      .where(eq(reviewApprovals.reviewerId, userId));

    const [commentsGiven] = await db
      .select({ count: count() })
      .from(reviewComments)
      .where(eq(reviewComments.authorId, userId));

    return {
      reviewsCreated: reviewsCreated.count,
      reviewsGiven: reviewsGiven.count,
      commentsGiven: commentsGiven.count
    };
  }

  // Get trending code reviews
  async getTrendingReviews(limit: number = 10) {
    return await db
      .select({
        id: codeReviews.id,
        title: codeReviews.title,
        description: codeReviews.description,
        status: codeReviews.status,
        createdAt: codeReviews.createdAt,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        },
        project: {
          id: projects.id,
          name: projects.name
        },
        commentCount: count(reviewComments.id)
      })
      .from(codeReviews)
      .innerJoin(users, eq(codeReviews.authorId, users.id))
      .innerJoin(projects, eq(codeReviews.projectId, projects.id))
      .leftJoin(reviewComments, eq(reviewComments.reviewId, codeReviews.id))
      .groupBy(codeReviews.id, users.id, projects.id)
      .orderBy(desc(count(reviewComments.id)))
      .limit(limit);
  }
}

export const codeReviewService = new CodeReviewService();