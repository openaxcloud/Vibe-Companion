import express, { Request, Response, NextFunction, Router } from "express";
import { body, param } from "express-validator";
import { StatusCodes } from "http-status-codes";
import { isAuthenticated } from "../middleware/authMiddleware";
import { isAdmin } from "../middleware/adminMiddleware";
import { validateRequest } from "../middleware/validateRequest";
import { Category, CategoryDocument } from "../models/Category";

const router: Router = express.Router();

// Public: GET /categories
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories: CategoryDocument[] = await Category.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean()
        .exec();

      res.status(StatusCodes.OK).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: GET /categories/admin - list all categories (including inactive)
router.get(
  "/admin",
  isAuthenticated,
  isAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories: CategoryDocument[] = await Category.find()
        .sort({ sortOrder: 1, name: 1 })
        .lean()
        .exec();

      res.status(StatusCodes.OK).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validation chains
const createCategoryValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name must be at most 100 characters"),
  body("slug")
    .optional()
    .trim()
    .isSlug()
    .withMessage("Slug must be a valid slug"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("parentId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Parent ID must be a valid Mongo ID"),
  body("sortOrder")
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage("Sort order must be an integer between 0 and 10000"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const updateCategoryValidation = [
  param("id").isMongoId().withMessage("Invalid category ID"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Name must be at most 100 characters"),
  body("slug")
    .optional()
    .trim()
    .isSlug()
    .withMessage("Slug must be a valid slug"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("parentId")
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === "string")
    .withMessage("Parent ID must be null or a string")
    .bail()
    .if(body("parentId").isString())
    .isMongoId()
    .withMessage("Parent ID must be a valid Mongo ID"),
  body("sortOrder")
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage("Sort order must be an integer between 0 and 10000"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

// Admin: POST /categories - create category
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  createCategoryValidation,
  validateRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, slug, description, parentId, sortOrder, isActive } = req.body;

      const existingByName = await Category.findOne({ name }).exec();
      if (existingByName) {
        res.status(StatusCodes.CONFLICT).json({
          success: false,
          message: "Category with this name already exists",
        });
        return;
      }

      if (slug) {
        const existingBySlug = await Category.findOne({ slug }).exec();
        if (existingBySlug) {
          res.status(StatusCodes.CONFLICT).json({
            success: false,
            message: "Category with this slug already exists",
          });
          return;
        }
      }

      let parent: CategoryDocument | null = null;
      if (parentId) {
        parent = await Category.findById(parentId).exec();
        if (!parent) {
          res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: "Parent category not found",
          });
          return;
        }
      }

      const category = new Category({
        name,
        slug,
        description,
        parentId: parent ? parent._id : null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
      });

      const savedCategory = await category.save();

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: savedCategory,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: PUT /categories/:id - update category
router.put(
  "/:id",
  isAuthenticated,
  isAdmin,
  updateCategoryValidation,
  validateRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates: Partial<CategoryDocument> = req.body;

      const category = await Category.findById(id).exec();
      if (!category) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: "Category not found",
        });
        return;
      }

      if (updates.name && updates.name !== category.name) {
        const existingByName = await Category.findOne({
          _id: { $ne: id },
          name: updates.name,
        }).exec();

        if (existingByName) {
          res.status(StatusCodes.CONFLICT).json({
            success: false,
            message: "Another category with this name already exists",
          });
          return;
        }
      }

      if (updates.slug && updates.slug !== category.slug) {
        const existingBySlug = await Category.findOne({
          _id: { $ne: id },
          slug: updates.slug,
        }).exec();

        if (existingBySlug) {
          res.status(StatusCodes.CONFLICT).json({
            success: false,
            message: "Another category with this slug already exists",
          });
          return;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, "parentId")) {
        const newParentId = updates.parentId as unknown as string | null;
        if (newParentId) {
          if (newParentId === id) {
            res.status(StatusCodes.BAD_REQUEST).json({
              success: false,
              message: "Category cannot be its own parent",
            });
            return;
          }
          const parent = await Category.findById(newParentId).exec();
          if (!parent) {
            res.status(StatusCodes.BAD_REQUEST).json({
              success: false,
              message: "Parent category not found",
            });
            return;
          }
          category.parentId = parent._id;
        } else {
          category.parentId = null;
        }
      }

      if (typeof updates.name === "string") category.name = updates.name;
      if (typeof updates.slug === "string") category.slug = updates.slug;
      if (typeof updates.description === "string" || updates.description === null) {
        category.description = updates.description ?? undefined;
      }
      if (typeof updates.sortOrder === "number") category.sortOrder = updates.sortOrder;
      if (typeof updates.isActive === "boolean") category.isActive = updates.isActive;

      const updatedCategory = await category.save();

      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedCategory,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: DELETE /categories/:id - delete category
router.delete(
  "/:id",
  isAuthenticated,
  isAdmin,
  [param("id").isMongoId().withMessage("Invalid category ID")],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const hasChildren = await Category.exists({ parentId: id });
      if (hasChildren) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Cannot delete a category that has child categories",
        });
        return;
      }

      const deletedCategory = await Category.findByIdAndDelete(id).exec