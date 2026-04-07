import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, ValidationChain, validationResult } from "express-validator";
import { Types } from "mongoose";
import Product from "../models/Product";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

interface TypedRequestQuery<T> extends Request {
  query: T;
}

interface TypedRequestBody<T> extends Request {
  body: T;
}

interface ProductQuery {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: string;
  limit?: string;
}

interface CreateProductBody {
  name: string;
  description?: string;
  category?: string;
  price: number;
  stock: number;
  images?: string[];
  isActive?: boolean;
}

interface UpdateProductBody {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  images?: string[];
  isActive?: boolean;
}

const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
      return;
    }

    next();
  };
};

const productQueryValidators: ValidationChain[] = [
  query("search").optional().isString().trim().isLength({ max: 256 }).withMessage("Search must be a string up to 256 characters"),
  query("category").optional().isString().trim().isLength({ max: 128 }).withMessage("Category must be a string up to 128 characters"),
  query("minPrice").optional().isFloat({ min: 0 }).withMessage("minPrice must be a positive number"),
  query("maxPrice").optional().isFloat({ min: 0 }).withMessage("maxPrice must be a positive number"),
  query("sortBy")
    .optional()
    .isIn(["name", "price", "createdAt"])
    .withMessage("sortBy must be one of name, price, createdAt"),
  query("sortOrder").optional().isIn(["asc", "desc"]).withMessage("sortOrder must be asc or desc"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer greater than 0"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be an integer between 1 and 100"),
];

const productIdParamValidators: ValidationChain[] = [
  param("id")
    .custom((value) => Types.ObjectId.isValid(value))
    .withMessage("Invalid product ID"),
];

const createProductValidators: ValidationChain[] = [
  body("name").exists().withMessage("Name is required").isString().trim().isLength({ min: 1, max: 256 }).withMessage("Name must be between 1 and 256 characters"),
  body("description").optional().isString().trim().isLength({ max: 4096 }).withMessage("Description must be up to 4096 characters"),
  body("category").optional().isString().trim().isLength({ max: 128 }).withMessage("Category must be up to 128 characters"),
  body("price").exists().withMessage("Price is required").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("stock").exists().withMessage("Stock is required").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("images").optional().isArray().withMessage("Images must be an array of URLs"),
  body("images.*").optional().isString().trim().isURL().withMessage("Each image must be a valid URL"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

const updateProductValidators: ValidationChain[] = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 256 }).withMessage("Name must be between 1 and 256 characters"),
  body("description").optional().isString().trim().isLength({ max: 4096 }).withMessage("Description must be up to 4096 characters"),
  body("category").optional().isString().trim().isLength({ max: 128 }).withMessage("Category must be up to 128 characters"),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("stock").optional().isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("images").optional().isArray().withMessage("Images must be an array of URLs"),
  body("images.*").optional().isString().trim().isURL().withMessage("Each image must be a valid URL"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

router.get(
  "/",
  validate(productQueryValidators),
  async (req: TypedRequestQuery<ProductQuery>, res: Response): Promise<void> => {
    try {
      const {
        search,
        category,
        minPrice,
        maxPrice,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        limit = "20",
      } = req.query;

      const pageNum = parseInt(page || "1", 10);
      const limitNum = parseInt(limit || "20", 10);
      const skip = (pageNum - 1) * limitNum;

      const filter: Record<string, unknown> = { isActive: true };

      if (search) {
        filter.$text = { $search: search };
      }

      if (category) {
        filter.category = category;
      }

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) {
          (filter.price as { $gte?: number }).$gte = parseFloat(minPrice);
        }
        if (maxPrice) {
          (filter.price as { $lte?: number }).$lte = parseFloat(maxPrice);
        }
      }

      const sortField = sortBy || "createdAt";
      const sortDirection = sortOrder === "asc" ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

      const [items, total] = await Promise.all([
        Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
        Product.countDocuments(filter),
      ]);

      res.json({
        items,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  }
);

router.get(
  "/:id",
  validate(productIdParamValidators),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await Product.findById(req.params.id).lean();

      if (!product || product.isActive === false) {
        res.status(404).json({ message: "Product not found" });
        return;
      }

      res.json(product);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  validate(createProductValidators),
  async (req: TypedRequestBody<CreateProductBody>, res: Response): Promise<void> => {
    try {
      const { name, description, category, price, stock, images, isActive } = req.body;

      const product = new Product({
        name,
        description,
        category,
        price,
        stock,
        images: images || [],
        isActive: isActive !== undefined ? isActive : true,
      });

      const saved = await product.save();
      res.status(201).json(saved);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  validate([...productIdParamValidators, ...updateProductValidators]),
  async (req: TypedRequestBody<UpdateProductBody>, res: Response): Promise<void> => {
    try {
      const updateData: Partial<UpdateProductBody> = {};
      const allowedFields: (keyof UpdateProductBody)[] = [
        "name",
        "description",
        "category",
        "price",
        "stock",
        "images",
        "isActive",