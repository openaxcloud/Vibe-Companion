import express, { Request, Response, NextFunction, Router } from "express";
import { body, param, query, ValidationChain, validationResult } from "express-validator";
import { Types } from "mongoose";
import { ProductModel, ProductDocument } from "../models/product.model";
import { isAdminMiddleware, isAuthenticatedMiddleware } from "../middleware/auth.middleware";

const router: Router = express.Router();

// Utility Types
type SortDirection = 1 | -1;

interface ProductQuery {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  limit?: number;
  page?: number;
}

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: "error",
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
    return;
  }
  next();
};

const validateObjectId = (field: string): ValidationChain =>
  param(field)
    .custom((value) => Types.ObjectId.isValid(value))
    .withMessage("Invalid ID format");

// Query validations for GET /products
const validateGetProducts: ValidationChain[] = [
  query("search").optional().isString().trim().isLength({ max: 200 }).withMessage("Search must be a string up to 200 chars"),
  query("category").optional().isString().trim().isLength({ max: 100 }).withMessage("Category must be a string"),
  query("minPrice").optional().isFloat({ min: 0 }).withMessage("minPrice must be a non-negative number"),
  query("maxPrice").optional().isFloat({ min: 0 }).withMessage("maxPrice must be a non-negative number"),
  query("sortBy")
    .optional()
    .isIn(["price", "name", "createdAt"])
    .withMessage("sortBy must be one of 'price', 'name', 'createdAt'"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be 'asc' or 'desc'"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be at least 1"),
];

// Body validations for create/update
const productBodyValidators: ValidationChain[] = [
  body("name").isString().trim().isLength({ min: 1, max: 200 }).withMessage("Name is required and must be <= 200 chars"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be <= 2000 chars"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a non-negative number"),
  body("category").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Category is required and must be <= 100 chars"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  body("stock").optional().isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("images")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Images must be an array with up to 10 URLs")
    .bail()
    .custom((arr: unknown[]) => arr.every((url) => typeof url === "string"))
    .withMessage("Each image must be a string URL"),
];

// GET /products - public, only active products
router.get(
  "/",
  validateGetProducts,
  handleValidationErrors,
  async (req: Request<unknown, unknown, unknown, ProductQuery>, res: Response, next: NextFunction) => {
    try {
      const {
        search,
        category,
        minPrice,
        maxPrice,
        sortBy = "createdAt",
        sortOrder = "desc",
        limit = 20,
        page = 1,
      } = req.query;

      const query: Record<string, unknown> = { isActive: true };

      if (search) {
        query.$text = { $search: search };
      }

      if (category) {
        query.category = category;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        query.price = {};
        if (minPrice !== undefined) (query.price as Record<string, number>).$gte = Number(minPrice);
        if (maxPrice !== undefined) (query.price as Record<string, number>).$lte = Number(maxPrice);
      }

      const sort: Record<string, SortDirection> = {};
      const normalizedSortOrder: SortDirection = sortOrder === "asc" ? 1 : -1;
      sort[sortBy] = normalizedSortOrder;

      const numericLimit = Number(limit);
      const numericPage = Number(page);
      const skip = (numericPage - 1) * numericLimit;

      const [items, total] = await Promise.all([
        ProductModel.find(query).sort(sort).skip(skip).limit(numericLimit).lean<ProductDocument[]>(),
        ProductModel.countDocuments(query),
      ]);

      res.json({
        status: "success",
        data: items,
        meta: {
          total,
          page: numericPage,
          limit: numericLimit,
          pages: Math.ceil(total / numericLimit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /products/:id - public, only active products
router.get(
  "/:id",
  validateObjectId("id"),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const product = await ProductModel.findOne({ _id: id, isActive: true }).lean<ProductDocument | null>();

      if (!product) {
        res.status(404).json({ status: "error", message: "Product not found" });
        return;
      }

      res.json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }
);

// ADMIN ROUTES

// POST /products - create product
router.post(
  "/",
  isAuthenticatedMiddleware,
  isAdminMiddleware,
  productBodyValidators,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, price, category, isActive = true, stock = 0, images = [] } = req.body;

      const product = await ProductModel.create({
        name,
        description,
        price,
        category,
        isActive,
        stock,
        images,
      });

      res.status(201).json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /products/:id - update product
router.put(
  "/:id",
  isAuthenticatedMiddleware,
  isAdminMiddleware,
  validateObjectId("id"),
  productBodyValidators,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, price, category, isActive, stock, images } = req.body;

      const update: Partial<ProductDocument> = {
        name,
        description,
        price,
        category,
        isActive,
        stock,
        images,
      };

      const product = await ProductModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).lean<ProductDocument | null>();

      if (!product) {
        res.status(404).json({ status: "error", message: "Product not found" });
        return;
      }

      res.json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /products/:id - hard delete product
router.delete(
  "/:id",
  isAuthenticatedMiddleware,
  isAdminMiddleware,
  validateObjectId("id"),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const product = await ProductModel.findByIdAndDelete(id).lean<ProductDocument | null>();

      if (!product) {
        res.status(404).json({ status: "error", message: "Product not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;