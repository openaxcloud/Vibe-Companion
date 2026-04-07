import { Request, Response, NextFunction } from "express";
import { validationResult, body, param, query } from "express-validator";
import httpStatus from "http-status";
import { ProductService } from "../services/product.service";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

export interface TypedRequestQuery<T> extends Request {
  query: T;
}

export interface TypedRequestBody<T> extends Request {
  body: T;
}

export interface TypedRequestParams<T> extends Request {
  params: T;
}

export interface PaginatedQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc" | string;
}

export interface ProductListQuery extends PaginatedQuery {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  isActive?: string;
}

export interface CreateProductBody {
  name: string;
  description?: string;
  price: number;
  sku?: string;
  categoryId?: string;
  stock?: number;
  isActive?: boolean;
  images?: string[];
  attributes?: Record<string, unknown>;
}

export interface UpdateProductBody {
  name?: string;
  description?: string;
  price?: number;
  sku?: string;
  categoryId?: string;
  stock?: number;
  isActive?: boolean;
  images?: string[];
  attributes?: Record<string, unknown>;
}

const productService = new ProductService();

const handleValidationErrors = (req: Request) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Validation error", errors.array());
  }
};

export const validateGetProducts = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("sortBy")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("sortBy must be a string up to 50 characters"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be 'asc' or 'desc'"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("search must be a string up to 255 characters"),
  query("category")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("category must be a string up to 100 characters"),
  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("minPrice must be a number greater than or equal to 0"),
  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("maxPrice must be a number greater than or equal to 0"),
  query("inStock")
    .optional()
    .isBoolean()
    .withMessage("inStock must be a boolean"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const validateGetProductById = [
  param("id").isString().trim().notEmpty().withMessage("Product id is required"),
];

export const validateCreateProduct = [
  body("name")
    .exists()
    .withMessage("name is required")
    .bail()
    .isString()
    .withMessage("name must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("name must be between 1 and 255 characters"),
  body("description")
    .optional()
    .isString()
    .withMessage("description must be a string")
    .bail()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("description must not exceed 5000 characters"),
  body("price")
    .exists()
    .withMessage("price is required")
    .bail()
    .isFloat({ gt: 0 })
    .withMessage("price must be a number greater than 0"),
  body("sku")
    .optional()
    .isString()
    .withMessage("sku must be a string")
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage("sku must not exceed 100 characters"),
  body("categoryId")
    .optional()
    .isString()
    .withMessage("categoryId must be a string")
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage("categoryId must not exceed 100 characters"),
  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("stock must be an integer greater than or equal to 0"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  body("images")
    .optional()
    .isArray({ max: 20 })
    .withMessage("images must be an array with up to 20 items"),
  body("images.*")
    .optional()
    .isString()
    .withMessage("each image must be a string")
    .bail()
    .isLength({ max: 2048 })
    .withMessage("image URL must not exceed 2048 characters"),
  body("attributes")
    .optional()
    .isObject()
    .withMessage("attributes must be an object"),
];

export const validateUpdateProduct = [
  param("id").isString().trim().notEmpty().withMessage("Product id is required"),
  body("name")
    .optional()
    .isString()
    .withMessage("name must be a string")
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("name must be between 1 and 255 characters"),
  body("description")
    .optional()
    .isString()
    .withMessage("description must be a string")
    .bail()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("description must not exceed 5000 characters"),
  body("price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("price must be a number greater than 0"),
  body("sku")
    .optional()
    .isString()
    .withMessage("sku must be a string")
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage("sku must not exceed 100 characters"),
  body("categoryId")
    .optional()
    .isString()
    .withMessage("categoryId must be a string")
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage("categoryId must not exceed 100 characters"),
  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("stock must be an integer greater than or equal to 0"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  body("images")
    .optional()
    .isArray({ max: 20 })
    .withMessage("images must be an array with up to 20 items"),
  body("images.*")
    .optional()
    .isString()
    .withMessage("each image must be a string")
    .bail()
    .isLength({ max: 2048 })
    .withMessage("image URL must not exceed 2048 characters"),
  body("attributes")
    .optional()
    .isObject()
    .withMessage("attributes must be an object"),
];

export const validateDeleteProduct = [
  param("id").isString().trim().notEmpty().withMessage("Product id is required"),
];

export const getProducts = async (
  req: TypedRequestQuery<ProductListQuery>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    handleValidationErrors(req);

    const {
      page = "1",
      limit = "20",
      sortBy,
      sortOrder,
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      isActive,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const minPriceNum = minPrice !== undefined ? parseFloat(minPrice) : undefined;
    const maxPriceNum = maxPrice !== undefined ? parseFloat(maxPrice) : undefined;
    const inStockBool = inStock !== undefined ? inStock === "true" : undefined;
    const isActiveBool = isActive !== undefined ? isActive === "true" : undefined;

    const result = await productService.getProducts({
      page: pageNum,