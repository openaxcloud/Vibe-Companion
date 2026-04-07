import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

const router = Router();

/**
 * Zod Schemas
 */

const productQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  minPrice: z
    .string()
    .transform((val) => (val === "" ? undefined : Number(val)))
    .pipe(z.number().nonnegative().optional())
    .optional(),
  maxPrice: z
    .string()
    .transform((val) => (val === "" ? undefined : Number(val)))
    .pipe(z.number().nonnegative().optional())
    .optional(),
  sort: z
    .enum(["price_asc", "price_desc", "name_asc", "name_desc", "newest"], {
      invalid_type_error: "Invalid sort option",
    })
    .optional(),
  page: z
    .string()
    .transform((val) => (val === "" ? undefined : Number(val)))
    .pipe(z.number().int().positive().optional())
    .optional(),
  pageSize: z
    .string()
    .transform((val) => (val === "" ? undefined : Number(val)))
    .pipe(z.number().int().positive().max(100).optional())
    .optional(),
});

const productIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Product id is required"),
});

const updateInventoryBodySchema = z.object({
  adjustment: z
    .number()
    .int()
    .min(-100000, "Adjustment too low")
    .max(100000, "Adjustment too high"),
});

type ProductQuery = z.infer<typeof productQuerySchema>;
type ProductIdParams = z.infer<typeof productIdParamSchema>;
type UpdateInventoryBody = z.infer<typeof updateInventoryBodySchema>;

/**
 * Helper types and mock services
 * In a real application these would be replaced with concrete implementations.
 */

type SortOption = NonNullable<ProductQuery["sort"]>;

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  inStock: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProductFilter {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  page: number;
  pageSize: number;
}

interface ProductService {
  findMany: (filter: ProductFilter) => Promise<PaginatedResult<Product>>;
  findById: (id: string) => Promise<Product | null>;
  adjustInventory: (id: string, adjustment: number) => Promise<Product | null>;
}

/**
 * Example in-memory product service.
 * Replace with a real database-backed implementation in production.
 */

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Example Product A",
    category: "general",
    description: "Example description A",
    price: 19.99,
    inStock: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    name: "Example Product B",
    category: "general",
    description: "Example description B",
    price: 29.99,
    inStock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const productService: ProductService = {
  async findMany(filter: ProductFilter): Promise<PaginatedResult<Product>> {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      sort = "newest",
      page,
      pageSize,
    } = filter;

    let data = [...mockProducts];

    if (q) {
      const qLower = q.toLowerCase();
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(qLower) ||
          p.description.toLowerCase().includes(qLower)
      );
    }

    if (category) {
      data = data.filter((p) => p.category === category);
    }

    if (typeof minPrice === "number") {
      data = data.filter((p) => p.price >= minPrice);
    }

    if (typeof maxPrice === "number") {
      data = data.filter((p) => p.price <= maxPrice);
    }

    switch (sort) {
      case "price_asc":
        data.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        data.sort((a, b) => b.price - a.price);
        break;
      case "name_asc":
        data.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        data.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "newest":
      default:
        data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    const total = data.length;
    const offset = (page - 1) * pageSize;
    const pagedItems = data.slice(offset, offset + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items: pagedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async findById(id: string): Promise<Product | null> {
    return mockProducts.find((p) => p.id === id) ?? null;
  },

  async adjustInventory(id: string, adjustment: number): Promise<Product | null> {
    const product = mockProducts.find((p) => p.id === id);
    if (!product) return null;

    const newStock = product.inStock + adjustment;
    if (newStock < 0) {
      throw new Error("Resulting stock cannot be negative");
    }

    product.inStock = newStock;
    product.updatedAt = new Date();
    return product;
  },
};

/**
 * Middleware helpers
 */

const validateQuery =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed as unknown as Request["query"];
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid query parameters",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  };

const validateParams =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.params);
      req.params = parsed as unknown as Request["params"];
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid route parameters",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  };

const validateBody =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request body",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  };

/**
 * Placeholder admin authentication middleware.
 * Replace with real auth/role-check logic in production.
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // Example placeholder: check for an "x-admin" header
  const isAdminHeader = req.header("x-admin");
  if (isAdminHeader === "true") {
    next();
    return;
  }
  res.status(403).json({ error: "Admin privileges required" });
};

/**
 * Routes
 */

// GET /products
router.get(
  "/",
  validateQuery(productQuerySchema),
  async (
    req: Request<unknown, unknown, unknown, ProductQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        q,
        category,
        minPrice,
        maxPrice,
        sort,
        page = 1,
        pageSize = 20,
      } = req.query;

      const result = await productService.findMany({
        q,
        category,
        minPrice,
        maxPrice,
        sort,
        page,
        pageSize,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /products/:id
router.get(
  "/:id",
  validateParams(productIdParamSchema),
  async (
    req: Request<Product