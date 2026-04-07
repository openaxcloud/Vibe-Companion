// @ts-nocheck
import { db } from '../db';
import { challenges, challengeSubmissions, challengeLeaderboard, users } from '@shared/schema';
import { eq, and, desc, count, avg, max } from 'drizzle-orm';
import { AIProviderFactory } from '../ai/ai-provider-factory';

export class ChallengesService {
  // Create a new challenge
  async createChallenge(data: {
    title: string;
    description: string;
    difficulty: string;
    category: string;
    points: number;
    starterCode?: string;
    solutionCode?: string;
    testCases: any[];
    tags: string[];
    createdBy: number;
  }) {
    const [challenge] = await db
      .insert(challenges)
      .values({
        ...data,
        status: 'published',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return challenge;
  }

  // Get all challenges with filters
  async getChallenges(filters: {
    difficulty?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        difficulty: challenges.difficulty,
        category: challenges.category,
        points: challenges.points,
        tags: challenges.tags,
        status: challenges.status,
        createdAt: challenges.createdAt,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        },
        submissionCount: count(challengeSubmissions.id)
      })
      .from(challenges)
      .innerJoin(users, eq(challenges.createdBy, users.id))
      .leftJoin(challengeSubmissions, eq(challengeSubmissions.challengeId, challenges.id))
      .where(eq(challenges.status, 'published'))
      .groupBy(challenges.id, users.id);

    const results = await query
      .orderBy(desc(challenges.createdAt))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    // Apply client-side filtering for complex conditions
    return results.filter(challenge => {
      if (filters.difficulty && challenge.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters.category && challenge.category !== filters.category) {
        return false;
      }
      if (filters.tags && filters.tags.length > 0) {
        const challengeTags = challenge.tags || [];
        if (!filters.tags.some(tag => challengeTags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }

  // Get challenge details
  async getChallenge(challengeId: number) {
    const [challenge] = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        difficulty: challenges.difficulty,
        category: challenges.category,
        points: challenges.points,
        starterCode: challenges.starterCode,
        testCases: challenges.testCases,
        tags: challenges.tags,
        status: challenges.status,
        createdAt: challenges.createdAt,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(challenges)
      .innerJoin(users, eq(challenges.createdBy, users.id))
      .where(eq(challenges.id, challengeId));

    if (!challenge) return null;

    // Get leaderboard for this challenge
    const leaderboard = await db
      .select({
        userId: challengeLeaderboard.userId,
        bestScore: challengeLeaderboard.bestScore,
        bestTime: challengeLeaderboard.bestTime,
        submissionCount: challengeLeaderboard.submissionCount,
        lastSubmission: challengeLeaderboard.lastSubmission,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl
        }
      })
      .from(challengeLeaderboard)
      .innerJoin(users, eq(challengeLeaderboard.userId, users.id))
      .where(eq(challengeLeaderboard.challengeId, challengeId))
      .orderBy(desc(challengeLeaderboard.bestScore))
      .limit(10);

    return {
      ...challenge,
      leaderboard
    };
  }

  // Submit solution to challenge
  async submitSolution(data: {
    challengeId: number;
    userId: number;
    code: string;
  }) {
    // Get the challenge to run tests
    const challenge = await this.getChallenge(data.challengeId);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Run the code against test cases
    const testResults = await this.executeTests(data.code, challenge.testCases);
    const score = this.calculateScore(testResults);
    const executionTime = testResults.reduce((total: number, result: any) => total + (result.time || 0), 0);

    // Create submission
    const [submission] = await db
      .insert(challengeSubmissions)
      .values({
        challengeId: data.challengeId,
        userId: data.userId,
        code: data.code,
        status: score > 0 ? 'accepted' : 'rejected',
        score,
        executionTime,
        testResults,
        submittedAt: new Date()
      })
      .returning();

    // Update leaderboard
    await this.updateLeaderboard(data.challengeId, data.userId, score, executionTime);

    return {
      submission,
      testResults,
      score,
      passed: score > 0
    };
  }

  // Execute test cases against code
  private async executeTests(code: string, testCases: any[]): Promise<any[]> {
    // In a real implementation, this would run in a sandboxed environment
    // For now, we'll simulate test execution
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        const memBefore = process.memoryUsage().heapUsed;
        
        const result = {
          input: testCase.input,
          expected: testCase.expected,
          actual: testCase.expected,
          passed: true,
          time: Date.now() - startTime,
          memory: Math.max(0, Math.round((process.memoryUsage().heapUsed - memBefore) / 1024))
        };
        
        results.push(result);
      } catch (error) {
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: null,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          time: 0,
          memory: 0
        });
      }
    }
    
    return results;
  }

  // Calculate score based on test results
  private calculateScore(testResults: any[]): number {
    const passedTests = testResults.filter(result => result.passed).length;
    const totalTests = testResults.length;
    return Math.floor((passedTests / totalTests) * 100);
  }

  // Update leaderboard
  private async updateLeaderboard(challengeId: number, userId: number, score: number, executionTime: number) {
    // Check if user already has an entry
    const [existing] = await db
      .select()
      .from(challengeLeaderboard)
      .where(and(
        eq(challengeLeaderboard.challengeId, challengeId),
        eq(challengeLeaderboard.userId, userId)
      ));

    if (existing) {
      // Update if this is a better score or faster time
      const shouldUpdate = score > existing.bestScore || 
        (score === existing.bestScore && executionTime < (existing.bestTime || Infinity));

      if (shouldUpdate) {
        await db
          .update(challengeLeaderboard)
          .set({
            bestScore: Math.max(score, existing.bestScore),
            bestTime: existing.bestTime ? Math.min(executionTime, existing.bestTime) : executionTime,
            submissionCount: existing.submissionCount + 1,
            lastSubmission: new Date()
          })
          .where(and(
            eq(challengeLeaderboard.challengeId, challengeId),
            eq(challengeLeaderboard.userId, userId)
          ));
      } else {
        // Just increment submission count
        await db
          .update(challengeLeaderboard)
          .set({
            submissionCount: existing.submissionCount + 1,
            lastSubmission: new Date()
          })
          .where(and(
            eq(challengeLeaderboard.challengeId, challengeId),
            eq(challengeLeaderboard.userId, userId)
          ));
      }
    } else {
      // Create new leaderboard entry
      await db
        .insert(challengeLeaderboard)
        .values({
          challengeId,
          userId,
          bestScore: score,
          bestTime: executionTime,
          submissionCount: 1,
          lastSubmission: new Date()
        });
    }
  }

  // Get user's submissions for a challenge
  async getUserSubmissions(challengeId: number, userId: number) {
    return await db
      .select({
        id: challengeSubmissions.id,
        code: challengeSubmissions.code,
        status: challengeSubmissions.status,
        score: challengeSubmissions.score,
        executionTime: challengeSubmissions.executionTime,
        testResults: challengeSubmissions.testResults,
        submittedAt: challengeSubmissions.submittedAt
      })
      .from(challengeSubmissions)
      .where(and(
        eq(challengeSubmissions.challengeId, challengeId),
        eq(challengeSubmissions.userId, userId)
      ))
      .orderBy(desc(challengeSubmissions.submittedAt));
  }

  // Get challenge categories
  async getCategories() {
    const categoriesResult = await db
      .select({
        category: challenges.category,
        count: count()
      })
      .from(challenges)
      .where(eq(challenges.status, 'published'))
      .groupBy(challenges.category)
      .orderBy(desc(count()));

    return categoriesResult.map(result => ({
      name: result.category,
      count: result.count,
      description: this.getCategoryDescription(result.category)
    }));
  }

  // Get popular tags
  async getPopularTags() {
    const allChallenges = await db
      .select({ tags: challenges.tags })
      .from(challenges)
      .where(eq(challenges.status, 'published'));

    const tagCounts: Record<string, number> = {};
    
    allChallenges.forEach(challenge => {
      const tags = challenge.tags || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }

  // Get challenge statistics
  async getChallengeStats() {
    const [totalChallenges] = await db
      .select({ count: count() })
      .from(challenges)
      .where(eq(challenges.status, 'published'));

    const [totalSubmissions] = await db
      .select({ count: count() })
      .from(challengeSubmissions);

    const [acceptedSubmissions] = await db
      .select({ count: count() })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.status, 'accepted'));

    const difficultyStats = await db
      .select({
        difficulty: challenges.difficulty,
        count: count()
      })
      .from(challenges)
      .where(eq(challenges.status, 'published'))
      .groupBy(challenges.difficulty);

    return {
      totalChallenges: totalChallenges.count,
      totalSubmissions: totalSubmissions.count,
      acceptedSubmissions: acceptedSubmissions.count,
      acceptanceRate: totalSubmissions.count > 0 
        ? Math.round((acceptedSubmissions.count / totalSubmissions.count) * 100) 
        : 0,
      difficultyDistribution: difficultyStats
    };
  }

  // Generate AI-powered challenge
  async generateAIChallenge(prompt: string, difficulty: string, category: string) {
    try {
      const aiProvider = AIProviderFactory.createProvider('openai');
      
      const aiPrompt = `
Generate a coding challenge based on this prompt: "${prompt}"

Requirements:
- Difficulty: ${difficulty}
- Category: ${category}
- Include title, description, starter code, solution, and test cases
- Make it educational and engaging

Respond with JSON in this format:
{
  "title": "Challenge Title",
  "description": "Detailed description of the problem",
  "starterCode": "// Starting code template",
  "solutionCode": "// Complete solution",
  "testCases": [
    {"input": "test input", "expected": "expected output", "description": "what this tests"}
  ],
  "tags": ["tag1", "tag2"],
  "points": 100
}
      `;

      const response = await aiProvider.generateText(aiPrompt);
      const challengeData = JSON.parse(response);

      return challengeData;
    } catch (error) {
      console.error('AI challenge generation failed:', error);
      throw new Error('Failed to generate AI challenge');
    }
  }

  // Get category description
  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      'algorithms': 'Data structures and algorithm problems',
      'web-development': 'Frontend and backend web development challenges',
      'data-science': 'Data analysis and machine learning problems',
      'mobile': 'Mobile app development challenges',
      'game-development': 'Game programming and logic challenges',
      'system-design': 'Architecture and system design problems',
      'database': 'SQL and database design challenges',
      'security': 'Cybersecurity and encryption problems',
      'ai-ml': 'Artificial intelligence and machine learning',
      'math': 'Mathematical and computational problems'
    };

    return descriptions[category] || 'Programming challenges';
  }
}

export const challengesService = new ChallengesService();