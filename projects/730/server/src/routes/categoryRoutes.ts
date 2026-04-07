import express, { Request, Response, NextFunction, Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import Category from "../models/Category";
import { authMiddleware, requireAdmin } from "../middleware/authMiddleware";

const router: Router = express.Router();

interface TypedRequestQuery<T> extends Request {
  query: T;
}

interface TypedRequestBody<T> extends Request {
  body: T;
}

interface CategoryQuery {
  search?: string;
  parentId?: string;
  active?: string;
  page?: string;
  limit?: string;
}

const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const handleAsync =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

// GET /api/categories
// Public: List categories with optional filters for search, parentId and active
router.get(
  "/",
  [
    query("search").optional().isString().trim().isLength({ min: 1 }).withMessage("Search must be a non-empty string"),
    query("parentId")
      .optional()
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid parentId"),
    query("active")
      .optional()
      .isIn(["true", "false"])
      .withMessage("active must be 'true' or 'false'"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
  ],
  validateRequest,
  handleAsync(async (req: TypedRequestQuery<CategoryQuery>, res: Response) => {
    const { search, parentId, active, page = "1", limit = "50" } = req.query;

    const filter: Record<string, unknown> = {};
    if (typeof search === "string" && search.trim().length > 0) {
      filter.name = { $regex: search.trim(), $options: "i" };
    }
    if (typeof parentId === "string") {
      filter.parentId = parentId;
    }
    if (typeof active === "string") {
      filter.active = active === "true";
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Category.find(filter)
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      Category.countDocuments(filter),
    ]);

    res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  })
);

// GET /api/categories/:id
// Public: Fetch single category by id
router.get(
  "/:id",
  [
    param("id")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid category id"),
  ],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const category = await Category.findById(id).lean().exec();
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.json(category);
  })
);

// ADMIN ROUTES BELOW

// POST /api/categories
// Admin: Create new category
router.post(
  "/",
  authMiddleware,
  requireAdmin,
  [
    body("name").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Name is required and must be <= 100 characters"),
    body("slug")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Slug must be <= 100 characters"),
    body("description").optional().isString().trim().isLength({ max: 500 }).withMessage("Description must be <= 500 characters"),
    body("parentId")
      .optional({ nullable: true })
      .custom((value) => (value === null ? true : Types.ObjectId.isValid(value)))
      .withMessage("Invalid parentId"),
    body("imageUrl").optional().isString().trim().isLength({ max: 500 }).withMessage("Image URL must be <= 500 characters"),
    body("order").optional().isInt({ min: 0 }).withMessage("Order must be a non-negative integer"),
    body("active").optional().isBoolean().withMessage("Active must be a boolean"),
  ],
  validateRequest,
  handleAsync(async (req: TypedRequestBody<any>, res: Response) => {
    const { name, slug, description, parentId, imageUrl, order, active } = req.body;

    if (slug) {
      const existingSlug = await Category.findOne({ slug }).lean().exec();
      if (existingSlug) {
        res.status(409).json({ message: "Slug already in use" });
        return;
      }
    }

    const category = new Category({
      name: name.trim(),
      slug: slug?.trim(),
      description: description?.trim(),
      parentId: parentId || null,
      imageUrl: imageUrl?.trim(),
      order: typeof order === "number" ? order : 0,
      active: typeof active === "boolean" ? active : true,
    });

    await category.save();
    res.status(201).json(category);
  })
);

// PUT /api/categories/:id
// Admin: Update category
router.put(
  "/:id",
  authMiddleware,
  requireAdmin,
  [
    param("id")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid category id"),
    body("name").optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage("Name must be <= 100 characters"),
    body("slug")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Slug must be <= 100 characters"),
    body("description").optional().isString().trim().isLength({ max: 500 }).withMessage("Description must be <= 500 characters"),
    body("parentId")
      .optional({ nullable: true })
      .custom((value) => (value === null ? true : Types.ObjectId.isValid(value)))
      .withMessage("Invalid parentId"),
    body("imageUrl").optional().isString().trim().isLength({ max: 500 }).withMessage("Image URL must be <= 500 characters"),
    body("order").optional().isInt({ min: 0 }).withMessage("Order must be a non-negative integer"),
    body("active").optional().isBoolean().withMessage("Active must be a boolean"),
  ],
  validateRequest,
  handleAsync(async (req: TypedRequestBody<any>, res: Response) => {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    const { name, slug, description, parentId, imageUrl, order, active } = req.body;

    if (typeof name === "string") updates.name = name.trim();
    if (typeof slug === "string") updates.slug = slug.trim();
    if (typeof description === "string") updates.description = description.trim();
    if (typeof imageUrl === "string") updates.imageUrl = imageUrl.trim();
    if (parentId !== undefined) updates.parentId = parentId || null;
    if (typeof order === "number") updates.order = order;
    if (typeof active === "boolean") updates.active = active;

    if (updates.slug) {
      const existingSlug = await Category.findOne({ slug: updates.slug, _id: { $ne: id } }).lean().exec();
      if (existingSlug) {
        res.status(409).json({ message: "Slug already in use" });
        return;
      }
    }

    const category = await Category.findByIdAndUpdate(id, updates, { new: true }).exec();
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.json(category);
  })
);

// DELETE /api/categories/:id
// Admin: Delete category (soft delete via active=false or hard delete based on business rules)
router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  [
    param("id")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid category id"),