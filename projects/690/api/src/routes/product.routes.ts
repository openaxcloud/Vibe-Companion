import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  sku?: string;
  stock?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

type SortDirection = 'asc' | 'desc';

interface ProductFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  sortBy?: keyof Product;
  sortDirection?: SortDirection;
  page?: number;
  limit?: number;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'user' | 'admin';
  };
}

// In-memory mock data for demonstration.
// In production, inject a real repository/service instead.
const mockProducts: Product[] = [];
const mockCategories: Category[] = [];

// Middleware: basic error wrapper
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

// Middleware: validation result handler
const handleValidation =
  (validations: any[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  };

// Middleware: simple admin check
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: admin access required' });
    return;
  }
  next();
};

// Utility: paginate array
const paginate = <T>(items: T[], page: number, limit: number): PaginatedResponse<T> => {
  const total = items.length;
  const safeLimit = limit > 0 ? limit : 10;
  const safePage = page > 0 ? page : 1;
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;

  return {
    data: items.slice(start, end),
    total,
    page: safePage,
    limit: safeLimit,
  };
};

// Utility: apply filters to in-memory list
const filterProducts = (products: Product[], filters: ProductFilters): Product[] => {
  let result = [...products];

  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.sku && p.sku.toLowerCase().includes(term))
    );
  }

  if (filters.categoryId) {
    result = result.filter((p) => p.categoryId === filters.categoryId);
  }

  if (typeof filters.isActive === 'boolean') {
    result = result.filter((p) => p.isActive === filters.isActive);
  }

  if (typeof filters.minPrice === 'number') {
    result = result.filter((p) => p.price >= filters.minPrice!);
  }

  if (typeof filters.maxPrice === 'number') {
    result = result.filter((p) => p.price <= filters.maxPrice!);
  }

  if (filters.sortBy) {
    const dir = filters.sortDirection === 'desc' ? -1 : 1;
    const key = filters.sortBy;
    result.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === undefined || av === null) return -1 * dir;
      if (bv === undefined || bv === null) return 1 * dir;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });
  }

  return result;
};

// Validation rules
const listProductsValidation = [
  query('search').optional().isString().isLength({ max: 255 }).trim(),
  query('categoryId').optional().isString().isLength({ max: 64 }).trim(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('isActive').optional().isBoolean().toBoolean(),
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'createdAt', 'updatedAt', 'sku', 'categoryId', 'isActive']),
  query('sortDirection').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const productIdValidation = [param('id').isString().isLength({ min: 1, max: 64 }).trim()];

const createProductValidation = [
  body('name').isString().isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isString().isLength({ max: 2000 }).trim(),
  body('price').isFloat({ min: 0 }),
  body('categoryId').isString().isLength({ min: 1, max: 64 }).trim(),
  body('sku').optional().isString().isLength({ max: 128 }).trim(),
  body('stock').optional().isInt({ min: 0 }).toInt(),
  body('isActive').optional().isBoolean().toBoolean(),
];

const updateProductValidation = [
  body('name').optional().isString().isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isString().isLength({ max: 2000 }).trim(),
  body('price').optional().isFloat({ min: 0 }),
  body('categoryId').optional().isString().isLength({ min: 1, max: 64 }).trim(),
  body('sku').optional().isString().isLength({ max: 128 }).trim(),
  body('stock').optional().isInt({ min: 0 }).toInt(),
  body('isActive').optional().isBoolean().toBoolean(),
];

// Routes

// GET /products - list products with search/filters
router.get(
  '/products',
  handleValidation(listProductsValidation),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      isActive,
      sortBy,
      sortDirection,
      page = 1,
      limit = 20,
    } = req.query;

    const filters: ProductFilters = {
      search: typeof search === 'string' ? search : undefined,
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      minPrice: typeof minPrice === 'string' ? parseFloat(minPrice) : undefined,
      maxPrice: typeof maxPrice === 'string' ? parseFloat(maxPrice) : undefined,
      isActive: typeof isActive === 'boolean' ? isActive : undefined,
      sortBy: typeof sortBy === 'string' ? (sortBy as keyof Product) : undefined,
      sortDirection: typeof sortDirection === 'string' ? (sortDirection as SortDirection) : 'asc',
      page: typeof page === 'number' ? page : parseInt(String(page), 10) || 1,
      limit: typeof limit === 'number' ? limit : parseInt(String(limit), 10) || 20,
    };

    const filtered = filterProducts(mockProducts, filters);
    const paginated = paginate(filtered, filters.page || 1, filters.limit || 20);

    res.json(paginated);
  })
);

// GET /products/:id - get product by id
router.get(
  '/products/:id',
  handleValidation(productIdValidation),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const product = mockProducts.find((p) => p.id === id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });