import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import { authenticate } from "../middleware/authenticate";
import { requireAuth } from "../middleware/requireAuth";
import { ChannelModel, IChannel, ChannelVisibility } from "../models/Channel";
import { UserModel } from "../models/User";
import { ChannelMemberModel, IChannelMember, ChannelRole } from "../models/ChannelMember";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles?: string[];
  };
}

const validateRequest =
  (validations: any[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        errors: errors.array().map((e) => ({
          field: e.param,
          message: e.msg,
        })),
      });
      return;
    }

    next();
  };

const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const asyncHandler =
  (
    fn: (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) => Promise<void>
  ) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

router.post(
  "/",
  authenticate,
  requireAuth,
  validateRequest([
    body("name")
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage("Channel name must be between 3 and 50 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Description must be at most 200 characters long"),
    body("visibility")
      .optional()
      .isIn(["public", "private"])
      .withMessage("Visibility must be 'public' or 'private'"),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, description, visibility } = req.body;
    const userId = req.user!.id;

    const existing = await ChannelModel.findOne({
      name: new RegExp(`^undefined$`, "i"),
    });

    if (existing) {
      res.status(409).json({ message: "Channel with this name already exists" });
      return;
    }

    const channel: IChannel = await ChannelModel.create({
      name: name.trim(),
      description: description?.trim() || "",
      visibility: (visibility as ChannelVisibility) || "public",
      createdBy: new Types.ObjectId(userId),
    });

    const member: IChannelMember = await ChannelMemberModel.create({
      channelId: channel._id,
      userId: new Types.ObjectId(userId),
      role: ChannelRole.OWNER,
    });

    res.status(201).json({
      channel: {
        id: channel._id.toString(),
        name: channel.name,
        description: channel.description,
        visibility: channel.visibility,
        createdBy: channel.createdBy.toString(),
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      },
      membership: {
        id: member._id.toString(),
        channelId: member.channelId.toString(),
        userId: member.userId.toString(),
        role: member.role,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      },
    });
  })
);

router.get(
  "/",
  authenticate,
  requireAuth,
  validateRequest([
    query("visibility")
      .optional()
      .isIn(["public", "private"])
      .withMessage("visibility must be 'public' or 'private'"),
    query("search")
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage("search must be between 1 and 50 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("offset must be >= 0"),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const visibility = req.query.visibility as ChannelVisibility | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const membershipFilter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    const memberChannelIds = await ChannelMemberModel.distinct("channelId", membershipFilter);

    const channelFilter: Record<string, unknown> = {
      _id: { $in: memberChannelIds },
    };

    if (visibility) {
      channelFilter.visibility = visibility;
    }

    if (search) {
      channelFilter.name = { $regex: search, $options: "i" };
    }

    const [channels, total] = await Promise.all([
      ChannelModel.find(channelFilter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      ChannelModel.countDocuments(channelFilter),
    ]);

    res.json({
      total,
      limit,
      offset,
      results: channels.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        description: c.description,
        visibility: c.visibility,
        createdBy: c.createdBy.toString(),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  })
);

router.get(
  "/:channelId",
  authenticate,
  requireAuth,
  validateRequest([
    param("channelId")
      .custom((value) => isValidObjectId(value))
      .withMessage("Invalid channelId"),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { channelId } = req.params;
    const userId = req.user!.id;

    const channel = await ChannelModel.findById(channelId);
    if (!channel) {
      res.status(404).json({ message: "Channel not found" });
      return;
    }

    if (channel.visibility === "private") {
      const membership = await ChannelMemberModel.findOne({
        channelId: channel._id,
        userId: new Types.ObjectId(userId),
      });

      if (!membership) {
        res.status(403).json({ message: "Access to this channel is restricted" });
        return;
      }
    }

    res.json({
      id: channel._id.toString(),
      name: channel.name,
      description: channel.description,
      visibility: channel.visibility,
      createdBy: channel.createdBy.toString(),
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    });
  })
);

router.post(
  "/:channelId/join",
  authenticate,
  requireAuth,
  validateRequest([
    param("channelId")
      .custom((value) => isValidObjectId(value))
      .withMessage("Invalid channelId"),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { channelId } = req.params;
    const userId = req.user!.id;

    const channel = await ChannelModel.findById(channelId);
    if (!channel) {
      res.status(404).json({ message: "Channel not found" });
      return;
    }

    if (channel.visibility !== "public") {
      res.status(403).json({ message: "Cannot join a private channel without invitation" });
      return;
    }

    const existingMembership = await ChannelMemberModel.findOne({
      channelId: channel._id,
      userId: new Types.ObjectId(userId),
    });

    if (existingMembership) {
      res.status(200).json({
        membership: {
          id: existingMembership._id.toString(),
          channelId: existingMembership.channelId.toString(),
          userId: existingMembership.userId.toString(),
          role: existingMembership.role,
          createdAt: existingMembership.createdAt,
          updatedAt: existingMembership.updatedAt,
        },
      });
      return;
    }

    const membership: IChannelMember = await ChannelMemberModel.create({
      channelId: channel._id,
      userId: new Types.ObjectId(userId),
      role: ChannelRole.MEMBER,
    });

    res.status(201).json({
      membership: {
        id: membership._id.toString(),
        channelId: membership.channelId.toString(),
        userId: membership.userId.toString(),
        role: membership.role,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
    });
  })
);

router.post(
  "/:channel