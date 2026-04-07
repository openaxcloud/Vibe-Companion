import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, ValidationChain, validationResult } from 'express-validator';

const productsRouter = Router();

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  isActive?: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    [key: string]: unknown;
  };
}

const mockProducts: Product[] = [];

const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: admin access required' });
    return;
  }
  next();
};

const handleValidation =
  (chains: ValidationChain[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Validation error', errors: errors.array() });
      return;
    }
    next();
  };

const productQueryValidation: ValidationChain[] = [
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('category').optional().isString().trim().isLength({ max: 100 }),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('tags')
    .optional()
    .customSanitizer((value) => {
      if (typeof value === 'string') {
        return value.split(',').map((tag: string) => tag.trim());
      }
      return value;
    }),
  query('isActive').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'createdAt', 'updatedAt', 'category']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const productIdValidation: ValidationChain[] = [param('id').isString().trim().notEmpty()];

const productCreateValidation: ValidationChain[] = [
  body('name').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('price').isFloat({ min: 0 }),
  body('currency').isString().trim().isLength({ min: 1, max: 10 }),
  body('category').optional().isString().trim().isLength({ max: 100 }),
  body('tags')
    .optional()
    .isArray({ max: 50 })
    .custom((tags: unknown[]) => tags.every((tag) => typeof tag === 'string')),
  body('isActive').optional().isBoolean(),
  body('stock').optional().isInt({ min: 0 }),
];

const productUpdateValidation: ValidationChain[] = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('price').optional().isFloat({ min: 0 }),
  body('currency').optional().isString().trim().isLength({ min: 1, max: 10 }),
  body('category').optional().isString().trim().isLength({ max: 100 }),
  body('tags')
    .optional()
    .isArray({ max: 50 })
    .custom((tags: unknown[]) => tags.every((tag) => typeof tag === 'string')),
  body('isActive').optional().isBoolean(),
  body('stock').optional().isInt({ min: 0 }),
];

const applyProductFilters = (products: Product[], filters: ProductFilters): Product[] => {
  let result = [...products];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
    );
  }

  if (filters.category) {
    result = result.filter((p) => p.category === filters.category);
  }

  if (filters.minPrice !== undefined) {
    result = result.filter((p) => p.price >= filters.minPrice!);
  }

  if (filters.maxPrice !== undefined) {
    result = result.filter((p) => p.price <= filters.maxPrice!);
  }

  if (filters.tags && filters.tags.length > 0) {
    result = result.filter(
      (p) => p.tags && filters.tags!.every((tag) => p.tags!.includes(tag))
    );
  }

  if (filters.isActive !== undefined) {
    result = result.filter((p) => p.isActive === filters.isActive);
  }

  return result;
};

const sortProducts = (
  products: Product[],
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Product[] => {
  if (!sortBy) return products;

  const sorted = [...products];
  sorted.sort((a, b) => {
    let valA: unknown = (a as Record<string, unknown>)[sortBy];
    let valB: unknown = (b as Record<string, unknown>)[sortBy];

    if (valA instanceof Date && valB instanceof Date) {
      const diff = valA.getTime() - valB.getTime();
      return sortOrder === 'asc' ? diff : -diff;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      const diff = valA - valB;
      return sortOrder === 'asc' ? diff : -diff;
    }

    const strA = String(valA ?? '').toLowerCase();
    const strB = String(valB ?? '').toLowerCase();
    if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
    if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
};

const paginate = <T>(
  items: T[],
  page: number,
  limit: number
): PaginatedResult<T> => {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const offset = (currentPage - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    page: currentPage,
    limit,
    total,
    totalPages,
  };
};

productsRouter.get(
  '/products',
  handleValidation(productQueryValidation),
  (req: Request, res: Response): void => {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      tags,
      isActive,
      page = 1,
      limit = 20,
      sortBy,
      sortOrder = 'asc',
    } = req.query as {
      search?: string;
      category?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string[] | string;
      isActive?: string;
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filters: ProductFilters = {
      search,
      category,
      minPrice: minPrice !== undefined ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : undefined,
      tags: Array.isArray(tags)
        ? (tags as string[])
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim())
        : undefined,
      isActive:
        isActive !== undefined
          ? isActive === 'true' || isActive === '1'
          : undefined,
    };

    let filtered = applyProductFilters(mockProducts, filters);
    filtered = sortProducts(filtered, sortBy, sortOrder || 'asc');

    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 20;

    const result = paginate(filtered, pageNum, limitNum);

    res.json(result);
  }
);

products