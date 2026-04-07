import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import { isAuthenticated } from "../middleware/authMiddleware";
import { isAdmin } from "../middleware/adminMiddleware";
import {
  createProduct,
  deleteProductById,
  getAllCategories,
  getProductById,
  getProductBySlug,
  listProducts,
  updateInventory,
  updateProductById,
} from "../controllers/productController";

const router = Router();

const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Public routes

router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("category").optional().isString().trim(),
    query("search").optional().isString().trim(),
    query("sort")
      .optional()
      .isIn(["price_asc", "price_desc", "newest", "popular"])
      .withMessage("Invalid sort option"),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  listProducts,
);

router.get(
  "/categories",
  (req: Request, res: Response, next: NextFunction) => {
    next();
  },
  getAllCategories,
);

router.get(
  "/id/:id",
  [param("id").isString().withMessage("Invalid product id")],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  getProductById,
);

router.get(
  "/slug/:slug",
  [param("slug").isString().withMessage("Invalid product slug")],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  getProductBySlug,
);

// Admin routes

router.post(
  "/",
  isAuthenticated,
  isAdmin,
  [
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("slug")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Slug is required"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be greater than 0"),
    body("category")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Category is required"),
    body("inventory")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Inventory must be a non-negative integer"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("images")
      .optional()
      .isArray()
      .withMessage("Images must be an array of URLs"),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  createProduct,
);

router.put(
  "/:id",
  isAuthenticated,
  isAdmin,
  [
    param("id").isString().withMessage("Invalid product id"),
    body("name").optional().isString().trim().notEmpty(),
    body("slug").optional().isString().trim().notEmpty(),
    body("description").optional().isString().trim().notEmpty(),
    body("price").optional().isFloat({ gt: 0 }),
    body("category").optional().isString().trim().notEmpty(),
    body("inventory").optional().isInt({ min: 0 }),
    body("isActive").optional().isBoolean(),
    body("images").optional().isArray(),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  updateProductById,
);

router.delete(
  "/:id",
  isAuthenticated,
  isAdmin,
  [param("id").isString().withMessage("Invalid product id")],
  (req: Request, res: Response, next: NextFunction) => {
    handleValidationErrors(req, res, next);
  },
  deleteProductById,
);

router.patch(
  "/:id/inventory",
  isAuthenticated,
  isAdmin,
  [
    param("id").isString().withMessage("Invalid product id"),
    body("delta")
      .optional()
      .isInt()
      .withMessage("delta must be an integer"),
    body("set")
      .optional()
      .isInt({ min: 0 })
      .withMessage("set must be a non-negative integer"),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.delta === undefined && req.body.set === undefined) {
      res.status(400).json({
        message: "Either 'delta' or 'set' must be provided",
      });
      return;
    }
    handleValidationErrors(req, res, next);
  },
  updateInventory,
);

export default router;