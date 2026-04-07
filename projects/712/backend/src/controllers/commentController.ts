import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import Comment from '../models/commentModel';
import ActivityService from '../services/activityService';
import { AuthenticatedRequest } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

type CreateCommentBody = {
  content: string;
  entityId: string;
  entityType: string;
  parentCommentId?: string | null;
};

type UpdateCommentBody = {
  content: string;
};

type CommentQuery = {
  entityId?: string;
  entityType?: string;
  parentCommentId?: string | null;
  page?: string;
  limit?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

const parsePagination = (query: CommentQuery) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const createComment = async (
  req: AuthenticatedRequest<CreateCommentBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { content, entityId, entityType, parentCommentId } = req.body;

    if (!content || !content.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Content is required');
    }
    if (!entityId || !Types.ObjectId.isValid(entityId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Valid entityId is required');
    }
    if (!entityType) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'entityType is required');
    }

    let parentComment = null;
    if (parentCommentId) {
      if (!Types.ObjectId.isValid(parentCommentId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parentCommentId');
      }
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Parent comment not found');
      }
    }

    const comment = await Comment.create({
      content: content.trim(),
      entityId,
      entityType,
      parentCommentId: parentComment ? parentComment._id : null,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
    });

    try {
      await ActivityService.logCommentCreated({
        actorId: req.user!.id,
        entityId,
        entityType,
        commentId: comment._id.toString(),
        content: comment.content,
        parentCommentId: parentComment ? parentComment._id.toString() : null,
      });
    } catch (activityError) {
      logger.error('Failed to log comment creation activity', {
        error: activityError,
        commentId: comment._id,
      });
    }

    res.status(httpStatus.CREATED).json(comment);
  } catch (error) {
    next(error);
  }
};

export const getComments = async (
  req: Request<unknown, unknown, unknown, CommentQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { entityId, entityType, parentCommentId, sortBy = 'createdAt', sortOrder = 'asc' } =
      req.query;

    const filter: Record<string, unknown> = {};

    if (entityId) {
      if (!Types.ObjectId.isValid(entityId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid entityId');
      }
      filter.entityId = entityId;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    if (parentCommentId !== undefined) {
      if (parentCommentId === '' || parentCommentId === null) {
        filter.parentCommentId = null;
      } else {
        if (!Types.ObjectId.isValid(parentCommentId as string)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parentCommentId');
        }
        filter.parentCommentId = parentCommentId;
      }
    }

    const { page, limit, skip } = parsePagination(req.query);

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [items, total] = await Promise.all([
      Comment.find(filter).sort(sort).skip(skip).limit(limit),
      Comment.countDocuments(filter),
    ]);

    res.status(httpStatus.OK).json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getCommentById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment id');
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
    }

    res.status(httpStatus.OK).json(comment);
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (
  req: AuthenticatedRequest<UpdateCommentBody, { id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment id');
    }
    if (!content || !content.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Content is required');
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
    }

    if (comment.createdBy.toString() !== req.user!.id && !req.user!.roles?.includes('admin')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to update this comment');
    }

    const previousContent = comment.content;

    comment.content = content.trim();
    comment.updatedBy = req.user!.id;
    await comment.save();

    try {
      await ActivityService.logCommentUpdated({
        actorId: req.user!.id,
        entityId: comment.entityId.toString(),
        entityType: comment.entityType,
        commentId: comment._id.toString(),
        previousContent,
        newContent: comment.content,
      });
    } catch (activityError) {
      logger.error('Failed to log comment update activity', {
        error: activityError,
        commentId: comment._id,
      });
    }

    res.status(httpStatus.OK).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: AuthenticatedRequest<unknown, { id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment id');
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
    }

    if (comment.createdBy.toString() !== req.user!.id && !req.user!.roles?.includes('admin')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to delete this comment');
    }

    await Comment.deleteOne({ _id: id });

    try {
      await ActivityService.logCommentDeleted({
        actorId: req.user!.id,
        entityId: comment.entityId.toString(),
        entityType: comment.entityType,
        commentId: comment._id.toString(),
        content: comment.content,
      });
    } catch (activityError) {
      logger.error('Failed to log comment deletion activity', {
        error: activityError,
        commentId: comment._id,
      });
    }

    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

export default {
  createComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
};