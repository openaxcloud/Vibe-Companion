import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  communityPosts, 
  communityCategories, 
  communityPostLikes, 
  communityPostBookmarks,
  communityComments,
  challenges,
  challengeLeaderboard,
  challengeSubmissions,
  users 
} from '@shared/schema';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';

const router = Router();

router.get('/categories', async (_req: Request, res: Response) => {
  // Default categories to return when database is unavailable
  const defaultCategories = [
    { id: 'showcase', name: 'Showcase', icon: 'Star', postCount: 0 },
    { id: 'help', name: 'Help & Questions', icon: 'MessageSquare', postCount: 0 },
    { id: 'tutorials', name: 'Tutorials', icon: 'Code', postCount: 0 },
    { id: 'challenges', name: 'Challenges', icon: 'Trophy', postCount: 0 },
    { id: 'jobs', name: 'Jobs & Hiring', icon: 'Users', postCount: 0 },
  ];
  
  try {
    // Query without position column to avoid schema mismatch errors
    const categories = await db.select({
      id: communityCategories.id,
      name: communityCategories.name,
      icon: communityCategories.icon,
      description: communityCategories.description,
    }).from(communityCategories);

    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const [countResult] = await db.select({
          count: sql<number>`COUNT(*)`,
        }).from(communityPosts)
          .where(eq(communityPosts.categoryId, cat.id));
        
        return {
          ...cat,
          postCount: Number(countResult?.count || 0),
        };
      })
    );

    if (categoriesWithCounts.length === 0) {
      return res.json(defaultCategories);
    }

    res.json(categoriesWithCounts);
  } catch (error: any) {
    // Handle missing table/column gracefully (42P01 = relation not exist, 42703 = column not exist)
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '42P01' || pgCode === '42703') {
      console.warn('[Community] community_categories table/column missing, returning defaults');
      return res.json(defaultCategories);
    }
    console.error('[Community] Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { category, search, page = '1', pageSize = '20' } = req.query;
    const pageNum = parseInt(String(page), 10);
    const pageSizeNum = parseInt(String(pageSize), 10);
    const offset = (pageNum - 1) * pageSizeNum;

    let whereConditions = [];

    if (category && category !== 'all') {
      whereConditions.push(eq(communityPosts.categoryId, String(category)));
    }

    if (search) {
      const searchTerm = `%${String(search).toLowerCase()}%`;
      whereConditions.push(
        or(
          ilike(communityPosts.title, searchTerm),
          ilike(communityPosts.content, searchTerm)
        )
      );
    }

    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined;

    const posts = await db.select({
      id: communityPosts.id,
      title: communityPosts.title,
      content: communityPosts.content,
      authorId: communityPosts.authorId,
      category: communityPosts.categoryId,
      tags: communityPosts.tags,
      projectUrl: communityPosts.projectUrl,
      imageUrl: communityPosts.imageUrl,
      views: communityPosts.viewCount,
      createdAt: communityPosts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(communityPosts)
    .leftJoin(users, eq(communityPosts.authorId, users.id))
    .where(whereClause)
    .orderBy(desc(communityPosts.createdAt))
    .limit(pageSizeNum)
    .offset(offset);

    // OPTIMIZATION: Batch fetch like and comment counts to avoid N+1 queries
    const postIds = posts.map(p => p.id);
    
    // Single query for all like counts using GROUP BY
    const likeCounts = postIds.length > 0 ? await db.select({
      postId: communityPostLikes.postId,
      count: sql<number>`COUNT(*)`,
    }).from(communityPostLikes)
      .where(sql`${communityPostLikes.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(communityPostLikes.postId) : [];
    
    // Single query for all comment counts using GROUP BY
    const commentCounts = postIds.length > 0 ? await db.select({
      postId: communityComments.postId,
      count: sql<number>`COUNT(*)`,
    }).from(communityComments)
      .where(sql`${communityComments.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(communityComments.postId) : [];
    
    // Build lookup maps for O(1) access
    const likeMap = new Map(likeCounts.map(l => [l.postId, Number(l.count)]));
    const commentMap = new Map(commentCounts.map(c => [c.postId, Number(c.count)]));

    const postsWithCounts = posts.map((post) => ({
      id: String(post.id),
      title: post.title,
      content: post.content,
      author: {
        id: String(post.authorId),
        username: post.authorUsername || 'anonymous',
        displayName: post.authorDisplayName || post.authorUsername || 'Anonymous',
        avatarUrl: post.authorAvatarUrl,
        reputation: 0,
      },
      category: post.category,
      tags: post.tags || [],
      likes: likeMap.get(post.id) || 0,
      comments: commentMap.get(post.id) || 0,
      views: post.views || 0,
      isLiked: false,
      isBookmarked: false,
      createdAt: post.createdAt?.toISOString(),
      projectUrl: post.projectUrl,
      imageUrl: post.imageUrl,
    }));

    const [totalResult] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(communityPosts)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    res.json({
      posts: postsWithCounts,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
        hasMore: offset + pageSizeNum < total,
      },
    });
  } catch (error: any) {
    // Handle missing table/column gracefully - preserve requested pagination values
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '42P01' || pgCode === '42703') {
      const { page = '1', pageSize = '20' } = req.query;
      const pageNum = parseInt(String(page), 10);
      const pageSizeNum = parseInt(String(pageSize), 10);
      console.warn('[Community] community_posts table/column missing, returning empty');
      return res.json({ posts: [], pagination: { page: pageNum, pageSize: pageSizeNum, total: 0, totalPages: 0, hasMore: false } });
    }
    console.error('[Community] Failed to fetch posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/challenges', async (_req: Request, res: Response) => {
  try {
    const activeChallenges = await db.select({
      id: challenges.id,
      title: challenges.title,
      description: challenges.description,
      difficulty: challenges.difficulty,
      category: challenges.category,
      points: challenges.points,
      status: challenges.status,
      createdAt: challenges.createdAt,
    })
    .from(challenges)
    .where(eq(challenges.status, 'published'))
    .orderBy(desc(challenges.createdAt));

    const challengesWithStats = await Promise.all(
      activeChallenges.map(async (challenge) => {
        const [participantCount] = await db.select({
          count: sql<number>`COUNT(DISTINCT user_id)`,
        }).from(challengeSubmissions)
          .where(eq(challengeSubmissions.challengeId, challenge.id));

        const [submissionCount] = await db.select({
          count: sql<number>`COUNT(*)`,
        }).from(challengeSubmissions)
          .where(eq(challengeSubmissions.challengeId, challenge.id));

        return {
          id: String(challenge.id),
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          category: challenge.category,
          participants: Number(participantCount?.count || 0),
          submissions: Number(submissionCount?.count || 0),
          prize: challenge.points ? `${challenge.points} points` : 'N/A',
          deadline: null,
          status: challenge.status,
        };
      })
    );

    res.json(challengesWithStats);
  } catch (error: any) {
    // Handle missing table/column gracefully
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '42P01' || pgCode === '42703') {
      console.warn('[Community] challenges table/column missing, returning empty');
      return res.json([]);
    }
    console.error('[Community] Failed to fetch challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const leaderboard = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      totalScore: sql<number>`COALESCE(SUM(${challengeLeaderboard.bestScore}), 0)`,
      submissionCount: sql<number>`COALESCE(SUM(${challengeLeaderboard.submissionCount}), 0)`,
    })
    .from(challengeLeaderboard)
    .innerJoin(users, eq(challengeLeaderboard.userId, users.id))
    .groupBy(users.id, users.username, users.displayName, users.avatarUrl)
    .orderBy(sql`SUM(${challengeLeaderboard.bestScore}) DESC NULLS LAST`)
    .limit(50);

    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      id: String(entry.id),
      username: entry.username,
      displayName: entry.displayName || entry.username,
      avatarUrl: entry.avatarUrl,
      score: Number(entry.totalScore),
      rank: index + 1,
      badges: [],
      streakDays: 0,
    }));

    res.json(rankedLeaderboard);
  } catch (error: any) {
    // Handle missing table gracefully (code 42P01 = relation does not exist)
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '42P01') {
      console.warn('[Community] challenge_leaderboard table not found, returning empty leaderboard');
      return res.json([]);
    }
    console.error('[Community] Failed to fetch leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.post('/posts/:postId/like', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const postIdNum = parseInt(postId, 10);
    
    const [existing] = await db.select()
      .from(communityPostLikes)
      .where(and(
        eq(communityPostLikes.postId, postIdNum),
        eq(communityPostLikes.userId, userId)
      ));

    if (existing) {
      await db.delete(communityPostLikes)
        .where(and(
          eq(communityPostLikes.postId, postIdNum),
          eq(communityPostLikes.userId, userId)
        ));
      res.json({ success: true, postId, liked: false });
    } else {
      await db.insert(communityPostLikes).values({
        postId: postIdNum,
        userId,
      });
      res.json({ success: true, postId, liked: true });
    }
  } catch (error) {
    console.error('[Community] Failed to toggle like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

router.post('/posts/:postId/bookmark', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const postIdNum = parseInt(postId, 10);
    
    const [existing] = await db.select()
      .from(communityPostBookmarks)
      .where(and(
        eq(communityPostBookmarks.postId, postIdNum),
        eq(communityPostBookmarks.userId, userId)
      ));

    if (existing) {
      await db.delete(communityPostBookmarks)
        .where(and(
          eq(communityPostBookmarks.postId, postIdNum),
          eq(communityPostBookmarks.userId, userId)
        ));
      res.json({ success: true, postId, bookmarked: false });
    } else {
      await db.insert(communityPostBookmarks).values({
        postId: postIdNum,
        userId,
      });
      res.json({ success: true, postId, bookmarked: true });
    }
  } catch (error) {
    console.error('[Community] Failed to toggle bookmark:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

router.get('/posts/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const postIdNum = parseInt(postId, 10);

    if (isNaN(postIdNum)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const [post] = await db.select({
      id: communityPosts.id,
      title: communityPosts.title,
      content: communityPosts.content,
      authorId: communityPosts.authorId,
      category: communityPosts.categoryId,
      tags: communityPosts.tags,
      projectUrl: communityPosts.projectUrl,
      imageUrl: communityPosts.imageUrl,
      views: communityPosts.viewCount,
      createdAt: communityPosts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(communityPosts)
    .leftJoin(users, eq(communityPosts.authorId, users.id))
    .where(eq(communityPosts.id, postIdNum));

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [likeCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(communityPostLikes)
      .where(eq(communityPostLikes.postId, postIdNum));

    const [commentCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(communityComments)
      .where(eq(communityComments.postId, postIdNum));

    const comments = await db.select({
      id: communityComments.id,
      content: communityComments.content,
      authorId: communityComments.authorId,
      createdAt: communityComments.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(communityComments)
    .leftJoin(users, eq(communityComments.authorId, users.id))
    .where(eq(communityComments.postId, postIdNum))
    .orderBy(desc(communityComments.createdAt))
    .limit(50);

    await db.update(communityPosts)
      .set({ viewCount: sql`${communityPosts.viewCount} + 1` })
      .where(eq(communityPosts.id, postIdNum));

    res.json({
      id: String(post.id),
      title: post.title,
      content: post.content,
      author: {
        id: String(post.authorId),
        username: post.authorUsername || 'anonymous',
        displayName: post.authorDisplayName || post.authorUsername || 'Anonymous',
        avatarUrl: post.authorAvatarUrl,
        reputation: 0,
      },
      category: post.category,
      tags: post.tags || [],
      likes: Number(likeCount?.count || 0),
      comments: Number(commentCount?.count || 0),
      views: (post.views || 0) + 1,
      isLiked: false,
      isBookmarked: false,
      createdAt: post.createdAt?.toISOString(),
      projectUrl: post.projectUrl,
      imageUrl: post.imageUrl,
      commentsData: comments.map(c => ({
        id: String(c.id),
        author: {
          id: String(c.authorId),
          username: c.authorUsername || 'anonymous',
          displayName: c.authorDisplayName || c.authorUsername || 'Anonymous',
          avatarUrl: c.authorAvatarUrl,
          reputation: 0,
        },
        content: c.content,
        likes: 0,
        isLiked: false,
        createdAt: c.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Community] Failed to fetch post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user?.id;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const postIdNum = parseInt(postId, 10);

    const [comment] = await db.insert(communityComments).values({
      postId: postIdNum,
      authorId: userId,
      content: content.trim(),
    }).returning();

    res.json({
      success: true,
      comment: {
        id: String(comment.id),
        content: comment.content,
        createdAt: comment.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Community] Failed to add comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Top developers endpoint - returns users with most published templates
router.get('/top-developers', async (_req: Request, res: Response) => {
  try {
    // Get top developers with real metrics from database using raw SQL for correct column names
    const developers = await db.select({
      id: users.id,
      name: users.displayName,
      username: users.username,
      avatar: users.avatarUrl,
      postCount: sql<number>`COUNT(*)`,
      totalViews: sql<number>`COALESCE(SUM(views), 0)`,
      totalLikes: sql<number>`COALESCE(SUM(likes), 0)`,
    })
    .from(users)
    .innerJoin(communityPosts, eq(users.id, communityPosts.authorId))
    .groupBy(users.id, users.displayName, users.username, users.avatarUrl)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

    const result = developers.map((dev, index) => {
      // Calculate rating from real engagement data (views + likes)
      const engagement = Number(dev.totalViews || 0) + Number(dev.totalLikes || 0) * 10;
      const calculatedRating = Math.min(5, Math.max(1, 3 + (engagement / 100)));
      
      return {
        id: dev.id,
        name: dev.name || dev.username || 'Developer',
        avatar: dev.avatar,
        templates: Number(dev.postCount || 0),
        downloads: Number(dev.totalViews || 0),
        rating: Number(calculatedRating.toFixed(1)),
        badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : undefined,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[Community] Failed to fetch top developers:', error);
    res.status(500).json({ error: 'Failed to fetch top developers' });
  }
});

// Collections endpoint - returns template collections
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    // Use raw SQL to avoid schema/DB column name mismatches
    const categories = await db.select({
      id: communityCategories.id,
      name: communityCategories.name,
      description: communityCategories.description,
      icon: communityCategories.icon,
    }).from(communityCategories)
      .orderBy(sql`sort_order`)
      .limit(10);

    const collections = await Promise.all(
      categories.map(async (cat) => {
        // Use raw SQL with actual column name 'category' (not 'category_id')
        const [countResult] = await db.select({
          count: sql<number>`COUNT(*)`,
        }).from(communityPosts)
          .where(sql`category = ${cat.id}`);

        return {
          id: parseInt(cat.id, 10) || 0,
          name: cat.name,
          description: cat.description || `Collection of ${cat.name} templates`,
          templates: Number(countResult?.count || 0),
          iconName: cat.icon?.toLowerCase() || 'sparkles',
          color: 'bg-primary/10',
        };
      })
    );

    res.json(collections);
  } catch (error) {
    console.error('[Community] Failed to fetch collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Activity endpoint - returns recent community activity
router.get('/activity', async (_req: Request, res: Response) => {
  try {
    const recentPosts = await db.select({
      title: communityPosts.title,
      createdAt: communityPosts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(communityPosts)
    .leftJoin(users, eq(communityPosts.authorId, users.id))
    .orderBy(desc(communityPosts.createdAt))
    .limit(10);

    const activity = recentPosts.map((post) => {
      const timeAgo = post.createdAt 
        ? formatTimeAgo(post.createdAt)
        : 'recently';

      return {
        user: post.authorDisplayName || post.authorUsername || 'Anonymous',
        action: 'published',
        template: post.title || 'Untitled',
        time: timeAgo,
      };
    });

    res.json(activity);
  } catch (error) {
    console.error('[Community] Failed to fetch activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Stats endpoint - returns community-wide statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Use raw SQL to avoid column name mismatches between schema and actual DB
    const [postsCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(communityPosts);

    const [usersCount] = await db.select({
      count: sql<number>`COUNT(DISTINCT author_id)`,
    }).from(communityPosts);

    // Use raw SQL with actual column name 'views' (not 'view_count')
    const [viewsSum] = await db.select({
      total: sql<number>`COALESCE(SUM(views), 0)`,
    }).from(communityPosts);

    // Monthly active = users who posted in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
    
    const [monthlyActive] = await db.select({
      count: sql<number>`COUNT(DISTINCT author_id)`,
    }).from(communityPosts)
      .where(sql`created_at > ${thirtyDaysAgoStr}::timestamp`);

    res.json({
      totalTemplates: Number(postsCount?.count || 0),
      totalDevelopers: Number(usersCount?.count || 0),
      totalDownloads: Number(viewsSum?.total || 0),
      monthlyActive: Number(monthlyActive?.count || 0),
    });
  } catch (error) {
    console.error('[Community] Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default router;
