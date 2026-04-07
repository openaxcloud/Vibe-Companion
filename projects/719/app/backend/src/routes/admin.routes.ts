import express, { Request, Response, NextFunction, Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";

type ObjectId = Types.ObjectId | string;

interface Product {
  _id: ObjectId;
  name: string;
  description?: string;
  price: number;
  category: ObjectId;
  sku: string;
  stock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  _id: ObjectId;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItem {
  product: ObjectId;
  quantity: number;
  price: number;
}

interface Order {
  _id: ObjectId;
  total: number;
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled";
  items: OrderItem[];
  createdAt: Date;
}

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  lowStockCount: number;
  recentSales: {
    date: string;
    total: number;
  }[];
}

interface ProductService {
  createProduct(data: Partial<Product>): Promise<Product>;
  getProductById(id: string): Promise<Product | null>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | null>;
  deleteProduct(id: string): Promise<void>;
  listProducts(filter?: {
    search?: string;
    category?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: Product[]; total: number; page: number; limit: number }>;
  adjustInventory(id: string, delta: number): Promise<Product | null>;
  getLowStock(threshold: number, limit: number): Promise<Product[]>;
}

interface CategoryService {
  createCategory(data: Partial<Category>): Promise<Category>;
  getCategoryById(id: string): Promise<Category | null>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category | null>;
  deleteCategory(id: string): Promise<void>;
  listCategories(filter?: {
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: Category[]; total: number; page: number; limit: number }>;
}

interface AdminStatsService {
  getDashboardStats(options: {
    from?: Date;
    to?: Date;
  }): Promise<DashboardStats>;
}

interface Services {
  productService: ProductService;
  categoryService: CategoryService;
  adminStatsService: AdminStatsService;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      error: "ValidationError",
      details: errors.array(),
    });
    return;
  }
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  next();
};

export const createAdminRouter = (services: Services): Router => {
  const { productService, categoryService, adminStatsService } = services;
  const router = express.Router();

  router.use(requireAdmin);

  router.post(
    "/products",
    body("name").isString().trim().isLength({ min: 1, max: 255 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("price").isFloat({ gt: 0 }),
    body("category").isString().custom(isValidObjectId),
    body("sku").isString().trim().isLength({ min: 1, max: 64 }),
    body("stock").isInt({ min: 0 }),
    body("active").optional().isBoolean(),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const product = await productService.createProduct({
          name: req.body.name,
          description: req.body.description,
          price: Number(req.body.price),
          category: req.body.category,
          sku: req.body.sku,
          stock: Number(req.body.stock),
          active: typeof req.body.active === "boolean" ? req.body.active : true,
        });
        res.status(201).json(product);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/products",
    query("search").optional().isString(),
    query("category").optional().isString().custom(isValidObjectId),
    query("active").optional().isBoolean().toBoolean(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { search, category, active, page = 1, limit = 20 } = req.query as {
          search?: string;
          category?: string;
          active?: string;
          page?: string;
          limit?: string;
        };

        const result = await productService.listProducts({
          search,
          category,
          active: active !== undefined ? active === "true" : undefined,
          page: Number(page) || 1,
          limit: Number(limit) || 20,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/products/:id",
    param("id").isString().custom(isValidObjectId),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const product = await productService.getProductById(req.params.id);
        if (!product) {
          res.status(404).json({ error: "NotFound", message: "Product not found" });
          return;
        }
        res.json(product);
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    "/products/:id",
    param("id").isString().custom(isValidObjectId),
    body("name").optional().isString().trim().isLength({ min: 1, max: 255 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("price").optional().isFloat({ gt: 0 }),
    body("category").optional().isString().custom(isValidObjectId),
    body("sku").optional().isString().trim().isLength({ min: 1, max: 64 }),
    body("stock").optional().isInt({ min: 0 }),
    body("active").optional().isBoolean(),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const updates: Partial<Product> = {};
        if (req.body.name !== undefined) updates.name = req.body.name;
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.price !== undefined) updates.price = Number(req.body.price);
        if (req.body.category !== undefined) updates.category = req.body.category;
        if (req.body.sku !== undefined) updates.sku = req.body.sku;
        if (req.body.stock !== undefined) updates.stock = Number(req.body.stock);
        if (req.body.active !== undefined) updates.active = req.body.active;

        const product = await productService.updateProduct(req.params.id, updates);
        if (!product) {
          res.status(404).json({ error: "NotFound", message: "Product not found" });
          return;
        }
        res.json(product);
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    "/products/:id",
    param("id").isString().custom(isValidObjectId),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await productService.deleteProduct(req.params.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/products/:id/inventory",
    param("id").isString().custom(isValidObjectId),
    body("delta").isInt(),
    handleValidation,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const delta = Number(req.body.delta);
        const product = await productService.adjustInventory(req.params.id, delta);
        if (!product) {
          res.status(404).json({ error: "NotFound", message: "Product not found" });
          return;
        }
        res.json(product);
      } catch (err