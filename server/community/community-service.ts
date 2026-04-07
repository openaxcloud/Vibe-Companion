// @ts-nocheck
import { Request, Response } from 'express';
import { SQL, and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  challenges,
  communityCategories,
  communityComments,
  communityFollows,
  communityPostBookmarks,
  communityPostLikes,
  communityPosts,
  users,
} from '@shared/schema';
import { db } from '../db';
import { createLogger } from '../utils/logger';

const logger = createLogger('community-service');

function getRelativeTime(dateInput: Date | string | null): string {
  if (!dateInput) return 'just now';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  const weeks = Math.floor(diffSeconds / 604800);
  if (weeks < 5) {
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  const months = Math.floor(diffSeconds / 2592000);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(diffSeconds / 31536000);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function ensureArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    return [];
  }
  return [];
}

export class CommunityService {
  async getCategories(req: Request, res: Response) {
    try {
      const rows = await db
        .select({
          id: communityCategories.id,
          name: communityCategories.name,
          icon: communityCategories.icon,
          position: communityCategories.position,
          postCount: sql`COUNT(${communityPosts.id})`,
        })
        .from(communityCategories)
        .leftJoin(communityPosts, eq(communityPosts.categoryId, communityCategories.id))
        .groupBy(
          communityCategories.id,
          communityCategories.name,
          communityCategories.icon,
          communityCategories.position,
        )
        .orderBy(asc(communityCategories.position), asc(communityCategories.name));

      const formatted = rows.map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        postCount: Number(row.postCount ?? 0),
      }));

      const totalPosts = formatted.reduce((sum, cat) => sum + cat.postCount, 0);

      res.json([
        { id: 'all', name: 'All Initiatives', icon: 'TrendingUp', postCount: totalPosts },
        ...formatted,
      ]);
    } catch (error) {
      logger.error('Error fetching community categories', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  }

  async getCommunityPosts(req: Request, res: Response) {
    try {
      const { category, search, tag } = req.query;
      const parsedPage = Number.parseInt((req.query.page as string) ?? '', 10);
      const parsedPageSize = Number.parseInt((req.query.pageSize as string) ?? '', 10);
      const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSizeRaw = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 20;
      const pageSize = Math.min(50, pageSizeRaw);
      const offset = (page - 1) * pageSize;
      const currentUserId = req.user?.id as string | undefined;

      const conditions: SQL[] = [];
      if (category && category !== 'all') {
        conditions.push(eq(communityPosts.categoryId, category as string));
      }
      if (search) {
        const term = `%${search}%`;
        conditions.push(
          sql`(${communityPosts.title} ILIKE ${term} OR ${communityPosts.content} ILIKE ${term} OR ${communityPosts.tags}::text ILIKE ${term})`,
        );
      }
      const tagValue = Array.isArray(tag) ? tag[0] : tag;
      if (tagValue) {
        conditions.push(sql`${communityPosts.tags} @> ${JSON.stringify([tagValue])}::jsonb`);
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      let totalQuery = db.select({ total: sql`COUNT(*)` }).from(communityPosts);
      if (whereCondition) {
        totalQuery = totalQuery.where(whereCondition);
      }
      const [{ total }] = await totalQuery;

      let query = db
        .select({
          id: communityPosts.id,
          title: communityPosts.title,
          content: communityPosts.content,
          categoryId: communityPosts.categoryId,
          tags: communityPosts.tags,
          createdAt: communityPosts.createdAt,
          updatedAt: communityPosts.updatedAt,
          viewCount: communityPosts.viewCount,
          projectUrl: communityPosts.projectUrl,
          imageUrl: communityPosts.imageUrl,
          authorId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.profileImageUrl,
          likeCount: sql`COUNT(DISTINCT ${communityPostLikes.userId})`,
          commentCount: sql`COUNT(DISTINCT ${communityComments.id})`,
        })
        .from(communityPosts)
        .leftJoin(users, eq(users.id, communityPosts.authorId))
        .leftJoin(communityPostLikes, eq(communityPostLikes.postId, communityPosts.id))
        .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
        .groupBy(
          communityPosts.id,
          communityPosts.title,
          communityPosts.content,
          communityPosts.categoryId,
          communityPosts.tags,
          communityPosts.createdAt,
          communityPosts.updatedAt,
          communityPosts.viewCount,
          communityPosts.projectUrl,
          communityPosts.imageUrl,
          users.id,
          users.username,
          users.displayName,
          users.profileImageUrl,
        )
        .orderBy(desc(communityPosts.createdAt));

      if (whereCondition) {
        query = query.where(whereCondition);
      }

      query = query.limit(pageSize).offset(offset);

      const posts = await query;
      const postIds = posts.map((post) => post.id).filter((id) => id != null);

      let likedPostIds = new Set<number>();
      let bookmarkedPostIds = new Set<number>();

      if (currentUserId && postIds.length > 0) {
        const liked = await db
          .select({ postId: communityPostLikes.postId })
          .from(communityPostLikes)
          .where(and(eq(communityPostLikes.userId, currentUserId), inArray(communityPostLikes.postId, postIds)));
        likedPostIds = new Set(liked.map((row) => row.postId));

        const bookmarked = await db
          .select({ postId: communityPostBookmarks.postId })
          .from(communityPostBookmarks)
          .where(and(eq(communityPostBookmarks.userId, currentUserId), inArray(communityPostBookmarks.postId, postIds)));
        bookmarkedPostIds = new Set(bookmarked.map((row) => row.postId));
      }

      const response = posts.map((post) => {
        const likeCount = Number(post.likeCount ?? 0);
        const commentCount = Number(post.commentCount ?? 0);
        return {
          id: post.id.toString(),
          title: post.title,
          content: post.content,
          author: {
            id: post.authorId || '',
            username: post.username || 'unknown',
            displayName: post.displayName || post.username || 'Unknown User',
            avatarUrl:
              post.avatarUrl ||
              (post.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}` : undefined),
          reputation: likeCount * 2 + commentCount,
          },
          category: post.categoryId,
          tags: ensureArray(post.tags),
          likes: likeCount,
          comments: commentCount,
          views: Number(post.viewCount ?? 0),
          isLiked: likedPostIds.has(post.id),
          isBookmarked: bookmarkedPostIds.has(post.id),
          createdAt: getRelativeTime(post.createdAt),
          projectUrl: post.projectUrl || undefined,
          imageUrl: post.imageUrl || undefined,
        };
      });

      const totalCount = Number(total ?? 0);

      res.json({
        posts: response,
        pagination: {
          page,
          pageSize,
          total: totalCount,
          totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      });
    } catch (error) {
      logger.error('Error fetching community posts', error);
      res.status(500).json({ message: 'Failed to fetch community posts' });
    }
  }

  async createCommunityPost(req: Request, res: Response) {
    try {
      const { title, content, category, tags = [], projectUrl, imageUrl } = req.body;
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!title || !content || !category) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const categoryExists = await db
        .select({ id: communityCategories.id })
        .from(communityCategories)
        .where(eq(communityCategories.id, category))
        .limit(1);

      if (categoryExists.length === 0) {
        return res.status(400).json({ message: 'Invalid category' });
      }

      const [created] = await db
        .insert(communityPosts)
        .values({
          title,
          content,
          categoryId: category,
          tags,
          authorId: userId,
          projectUrl,
          imageUrl,
        })
        .returning();

      res.status(201).json({
        success: true,
        post: {
          id: created.id.toString(),
          title: created.title,
          category: created.categoryId,
          tags: ensureArray(created.tags),
          createdAt: created.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating community post', error);
      res.status(500).json({ message: 'Failed to create community post' });
    }
  }

  async getCommunityPost(req: Request, res: Response) {
    try {
      const postId = Number(req.params.id);
      if (Number.isNaN(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
      }

      const currentUserId = req.user?.id as string | undefined;

      const [post] = await db
        .select({
          id: communityPosts.id,
          title: communityPosts.title,
          content: communityPosts.content,
          categoryId: communityPosts.categoryId,
          tags: communityPosts.tags,
          createdAt: communityPosts.createdAt,
          updatedAt: communityPosts.updatedAt,
          viewCount: communityPosts.viewCount,
          projectUrl: communityPosts.projectUrl,
          imageUrl: communityPosts.imageUrl,
          authorId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.profileImageUrl,
          likeCount: sql`COUNT(DISTINCT ${communityPostLikes.userId})`,
          commentCount: sql`COUNT(DISTINCT ${communityComments.id})`,
        })
        .from(communityPosts)
        .leftJoin(users, eq(users.id, communityPosts.authorId))
        .leftJoin(communityPostLikes, eq(communityPostLikes.postId, communityPosts.id))
        .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
        .where(eq(communityPosts.id, postId))
        .groupBy(
          communityPosts.id,
          communityPosts.title,
          communityPosts.content,
          communityPosts.categoryId,
          communityPosts.tags,
          communityPosts.createdAt,
          communityPosts.updatedAt,
          communityPosts.viewCount,
          communityPosts.projectUrl,
          communityPosts.imageUrl,
          users.id,
          users.username,
          users.displayName,
          users.profileImageUrl,
        );

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      await db
        .update(communityPosts)
        .set({ viewCount: sql`${communityPosts.viewCount} + 1` })
        .where(eq(communityPosts.id, postId));

      const comments = await db
        .select({
          id: communityComments.id,
          content: communityComments.content,
          createdAt: communityComments.createdAt,
          authorId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.profileImageUrl,
        })
        .from(communityComments)
        .leftJoin(users, eq(users.id, communityComments.authorId))
        .where(eq(communityComments.postId, postId))
        .orderBy(asc(communityComments.createdAt));

      let isLiked = false;
      let isBookmarked = false;
      if (currentUserId) {
        const like = await db
          .select({ postId: communityPostLikes.postId })
          .from(communityPostLikes)
          .where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, currentUserId)))
          .limit(1);
        isLiked = like.length > 0;

        const bookmark = await db
          .select({ postId: communityPostBookmarks.postId })
          .from(communityPostBookmarks)
          .where(and(eq(communityPostBookmarks.postId, postId), eq(communityPostBookmarks.userId, currentUserId)))
          .limit(1);
        isBookmarked = bookmark.length > 0;
      }

      const likeCount = Number(post.likeCount ?? 0);
      const commentCount = Number(post.commentCount ?? 0);

      res.json({
        id: post.id.toString(),
        title: post.title,
        content: post.content,
        category: post.categoryId,
        tags: ensureArray(post.tags),
        createdAt: getRelativeTime(post.createdAt),
        updatedAt: post.updatedAt,
        views: Number(post.viewCount ?? 0) + 1,
        likes: likeCount,
        comments: commentCount,
        projectUrl: post.projectUrl || undefined,
        imageUrl: post.imageUrl || undefined,
        isLiked,
        isBookmarked,
        author: {
          id: post.authorId || '',
          username: post.username || 'unknown',
          displayName: post.displayName || post.username || 'Unknown User',
          avatarUrl:
            post.avatarUrl ||
            (post.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}` : undefined),
          reputation: likeCount * 2 + commentCount,
        },
        commentsData: comments.map((comment) => ({
          id: comment.id.toString(),
          content: comment.content,
          createdAt: getRelativeTime(comment.createdAt),
          author: {
            id: comment.authorId || '',
            username: comment.username || 'unknown',
            displayName: comment.displayName || comment.username || 'Unknown User',
            avatarUrl:
              comment.avatarUrl ||
              (comment.username
                ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.username}`
                : undefined),
          },
        })),
      });
    } catch (error) {
      logger.error('Error fetching community post', error);
      res.status(500).json({ message: 'Failed to fetch post' });
    }
  }

  async likeCommunityPost(req: Request, res: Response) {
    try {
      const postId = Number(req.params.id);
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (Number.isNaN(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
      }

      const exists = await db
        .select({ id: communityPosts.id })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId))
        .limit(1);

      if (exists.length === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const like = await db
        .select({ postId: communityPostLikes.postId })
        .from(communityPostLikes)
        .where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)))
        .limit(1);

      let liked = false;
      if (like.length > 0) {
        await db
          .delete(communityPostLikes)
          .where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)));
      } else {
        await db
          .insert(communityPostLikes)
          .values({ postId, userId })
          .onConflictDoNothing();
        liked = true;
      }

      const [likeCount] = await db
        .select({ count: sql`COUNT(*)` })
        .from(communityPostLikes)
        .where(eq(communityPostLikes.postId, postId));

      res.json({ success: true, liked, totalLikes: Number(likeCount?.count ?? 0) });
    } catch (error) {
      logger.error('Error liking community post', error);
      res.status(500).json({ message: 'Failed to like post' });
    }
  }

  async bookmarkCommunityPost(req: Request, res: Response) {
    try {
      const postId = Number(req.params.id);
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (Number.isNaN(postId)) {
        return res.status(400).json({ message: 'Invalid post id' });
      }

      const exists = await db
        .select({ id: communityPosts.id })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId))
        .limit(1);

      if (exists.length === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const bookmark = await db
        .select({ postId: communityPostBookmarks.postId })
        .from(communityPostBookmarks)
        .where(and(eq(communityPostBookmarks.postId, postId), eq(communityPostBookmarks.userId, userId)))
        .limit(1);

      let bookmarked = false;
      if (bookmark.length > 0) {
        await db
          .delete(communityPostBookmarks)
          .where(and(eq(communityPostBookmarks.postId, postId), eq(communityPostBookmarks.userId, userId)));
      } else {
        await db
          .insert(communityPostBookmarks)
          .values({ postId, userId })
          .onConflictDoNothing();
        bookmarked = true;
      }

      res.json({ success: true, bookmarked });
    } catch (error) {
      logger.error('Error bookmarking community post', error);
      res.status(500).json({ message: 'Failed to bookmark post' });
    }
  }

  async createCommunityReply(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const { content, parentCommentId } = req.body;
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }

      const post = await db
        .select({ id: communityPosts.id })
        .from(communityPosts)
        .where(eq(communityPosts.id, Number(postId)))
        .limit(1);

      if (post.length === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const [created] = await db
        .insert(communityComments)
        .values({
          postId: Number(postId),
          content,
          authorId: userId,
          parentCommentId: parentCommentId ? Number(parentCommentId) : null,
        })
        .returning();

      res.status(201).json({
        success: true,
        reply: {
          id: created.id.toString(),
          content: created.content,
          createdAt: getRelativeTime(created.createdAt),
        },
      });
    } catch (error) {
      logger.error('Error creating community reply', error);
      res.status(500).json({ message: 'Failed to create reply' });
    }
  }

  async getUserProfile(req: Request, res: Response) {
    try {
      const { username } = req.params;
      if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          bio: users.bio,
          website: users.website,
          githubUsername: users.githubUsername,
          twitterUsername: users.twitterUsername,
          profileImageUrl: users.profileImageUrl,
          reputation: users.reputation,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const [postStats] = await db
        .select({
          totalPosts: sql`COUNT(DISTINCT ${communityPosts.id})`,
          totalLikes: sql`COUNT(DISTINCT ${communityPostLikes.userId})`,
          totalComments: sql`COUNT(DISTINCT ${communityComments.id})`,
        })
        .from(communityPosts)
        .leftJoin(communityPostLikes, eq(communityPostLikes.postId, communityPosts.id))
        .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
        .where(eq(communityPosts.authorId, user.id));

      const posts = await db
        .select({
          id: communityPosts.id,
          title: communityPosts.title,
          createdAt: communityPosts.createdAt,
          categoryId: communityPosts.categoryId,
        })
        .from(communityPosts)
        .where(eq(communityPosts.authorId, user.id))
        .orderBy(desc(communityPosts.createdAt))
        .limit(10);

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        bio: user.bio,
        website: user.website,
        githubUsername: user.githubUsername,
        twitterUsername: user.twitterUsername,
        profileImageUrl:
          user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
        reputation: Number(user.reputation ?? 0),
        joinedAt: user.createdAt,
        totals: {
          posts: Number(postStats?.totalPosts ?? 0),
          likes: Number(postStats?.totalLikes ?? 0),
          comments: Number(postStats?.totalComments ?? 0),
        },
        recentPosts: posts.map((post) => ({
          id: post.id.toString(),
          title: post.title,
          category: post.categoryId,
          createdAt: getRelativeTime(post.createdAt),
        })),
      });
    } catch (error) {
      logger.error('Error fetching community user profile', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  }

  async updateUserProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id as string | undefined;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { displayName, bio, website, githubUsername, twitterUsername, profileImageUrl } = req.body;

      const updateData = {
        updatedAt: new Date(),
      } as Partial<typeof users.$inferInsert>;

      if (displayName !== undefined) {
        updateData.displayName = displayName;
      }

      if (bio !== undefined) {
        updateData.bio = bio;
      }

      if (website !== undefined) {
        updateData.website = website;
      }

      if (githubUsername !== undefined) {
        updateData.githubUsername = githubUsername;
      }

      if (twitterUsername !== undefined) {
        updateData.twitterUsername = twitterUsername;
      }

      if (profileImageUrl !== undefined) {
        updateData.profileImageUrl = profileImageUrl;
      }

      await db.update(users).set(updateData).where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating community profile', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }

  async getCodeShowcases(req: Request, res: Response) {
    try {
      const showcases = await db
        .select({
          id: communityPosts.id,
          title: communityPosts.title,
          description: communityPosts.content,
          createdAt: communityPosts.createdAt,
          authorId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.profileImageUrl,
          imageUrl: communityPosts.imageUrl,
          projectUrl: communityPosts.projectUrl,
        })
        .from(communityPosts)
        .leftJoin(users, eq(users.id, communityPosts.authorId))
        .where(eq(communityPosts.categoryId, 'showcase'))
        .orderBy(desc(communityPosts.createdAt))
        .limit(8);

      res.json(
        showcases.map((item) => ({
          id: item.id.toString(),
          title: item.title,
          description: item.description,
          createdAt: getRelativeTime(item.createdAt),
          author: {
            id: item.authorId || '',
            username: item.username || 'unknown',
            displayName: item.displayName || item.username || 'Unknown User',
            avatarUrl:
              item.avatarUrl ||
              (item.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}` : undefined),
          },
          imageUrl: item.imageUrl,
          projectUrl: item.projectUrl,
        })),
      );
    } catch (error) {
      logger.error('Error fetching code showcases', error);
      res.status(500).json({ message: 'Failed to fetch showcases' });
    }
  }

  async createCodeShowcase(req: Request, res: Response) {
    try {
      const userId = req.user?.id as string | undefined;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { title, description, tags = [], projectUrl, imageUrl } = req.body;
      if (!title || !description) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const [post] = await db
        .insert(communityPosts)
        .values({
          title,
          content: description,
          categoryId: 'showcase',
          tags,
          authorId: userId,
          projectUrl,
          imageUrl,
        })
        .returning();

      res.status(201).json({ success: true, id: post.id.toString() });
    } catch (error) {
      logger.error('Error creating code showcase', error);
      res.status(500).json({ message: 'Failed to create showcase' });
    }
  }

  async getCommunityStats(req: Request, res: Response) {
    try {
      const [postCount] = await db.select({ count: sql`COUNT(*)` }).from(communityPosts);
      const [memberCount] = await db.select({ count: sql`COUNT(*)` }).from(users);
      const [commentCount] = await db.select({ count: sql`COUNT(*)` }).from(communityComments);
      const [likeCount] = await db.select({ count: sql`COUNT(*)` }).from(communityPostLikes);

      res.json({
        posts: Number(postCount?.count ?? 0),
        members: Number(memberCount?.count ?? 0),
        comments: Number(commentCount?.count ?? 0),
        likes: Number(likeCount?.count ?? 0),
      });
    } catch (error) {
      logger.error('Error fetching community stats', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  }

  async followUser(req: Request, res: Response) {
    try {
      const followerId = req.user?.id as string | undefined;
      const { targetUserId } = req.params;

      if (!followerId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!targetUserId || followerId === targetUserId) {
        return res.status(400).json({ message: 'Invalid target user' });
      }

      const existing = await db
        .select({ followerId: communityFollows.followerId })
        .from(communityFollows)
        .where(and(eq(communityFollows.followerId, followerId), eq(communityFollows.followeeId, targetUserId)))
        .limit(1);

      let following = false;
      if (existing.length > 0) {
        await db
          .delete(communityFollows)
          .where(and(eq(communityFollows.followerId, followerId), eq(communityFollows.followeeId, targetUserId)));
      } else {
        await db
          .insert(communityFollows)
          .values({ followerId, followeeId: targetUserId })
          .onConflictDoNothing();
        following = true;
      }

      const [followerCount] = await db
        .select({ count: sql`COUNT(*)` })
        .from(communityFollows)
        .where(eq(communityFollows.followeeId, targetUserId));

      res.json({ success: true, following, followerCount: Number(followerCount?.count ?? 0) });
    } catch (error) {
      logger.error('Error following community user', error);
      res.status(500).json({ message: 'Failed to update follow state' });
    }
  }

  async getChallenges(req: Request, res: Response) {
    try {
      const rows = await db
        .select({
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
        .orderBy(desc(challenges.createdAt))
        .limit(12);

      const response = rows.map((challenge) => ({
        id: challenge.id.toString(),
        title: challenge.title,
        description: challenge.description,
        difficulty: (challenge.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        category: challenge.category,
        participants: Math.max(25, Math.round((challenge.points || 0) / 5)),
        submissions: Math.max(10, Math.round((challenge.points || 0) / 8)),
        prize: `${challenge.points || 0} executive points`,
        deadline: challenge.createdAt
          ? new Date(challenge.createdAt.getTime() + 21 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0]
          : new Date().toISOString().split('T')[0],
        status:
          challenge.status === 'archived'
            ? 'ended'
            : challenge.status === 'draft'
              ? 'upcoming'
              : 'active',
      }));

      res.json(response);
    } catch (error) {
      logger.error('Error fetching community challenges', error);
      res.status(500).json({ message: 'Failed to fetch challenges' });
    }
  }

  async getLeaderboard(req: Request, res: Response) {
    try {
      const contributors = await db
        .select({
          userId: communityPosts.authorId,
          postCount: sql`COUNT(DISTINCT ${communityPosts.id})`,
          likesReceived: sql`COUNT(DISTINCT ${communityPostLikes.userId})`,
          commentsReceived: sql`COUNT(DISTINCT ${communityComments.id})`,
          lastPostAt: sql`MAX(${communityPosts.createdAt})`,
        })
        .from(communityPosts)
        .leftJoin(communityPostLikes, eq(communityPostLikes.postId, communityPosts.id))
        .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
        .groupBy(communityPosts.authorId)
        .orderBy(desc(sql`COUNT(DISTINCT ${communityPostLikes.userId}) + COUNT(DISTINCT ${communityComments.id}) + COUNT(DISTINCT ${communityPosts.id})`))
        .limit(10);

      const userIds = contributors.map((row) => row.userId).filter(Boolean);
      const usersResult = userIds.length
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              profileImageUrl: users.profileImageUrl,
            })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];
      const userMap = new Map(usersResult.map((u) => [u.id, u]));

      const response = contributors.map((row, index) => {
        const user = row.userId ? userMap.get(row.userId) : undefined;
        const postCount = Number(row.postCount ?? 0);
        const likesReceived = Number(row.likesReceived ?? 0);
        const commentsReceived = Number(row.commentsReceived ?? 0);
        const score = postCount * 5 + likesReceived * 3 + commentsReceived * 2;
        const badges: string[] = [];
        if (postCount >= 3) badges.push('top-contributor');
        if (likesReceived >= 5) badges.push('challenge-winner');
        if (commentsReceived >= 5) badges.push('mentor');
        if (likesReceived + commentsReceived >= 10) badges.push('helpful');

        return {
          id: row.userId || `unknown-${index}`,
          username: user?.username || 'unknown',
          displayName: user?.displayName || user?.username || 'Unknown User',
          avatarUrl:
            user?.profileImageUrl ||
            (user?.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}` : undefined),
          score,
          rank: index + 1,
          badges,
          streakDays: Math.min(30, Math.max(1, postCount)),
        };
      });

      res.json(response);
    } catch (error) {
      logger.error('Error fetching community leaderboard', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  }
}

export const communityService = new CommunityService();
