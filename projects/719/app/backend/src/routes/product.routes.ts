import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import { ProductModel, ProductDocument } from '../models/product.model';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { ApiError } from '../utils/ApiError';

const router = Router();

type ProductFilters = {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
};

type PaginationParams = {
  page: number;
  limit: number;
};

type SortParams = {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

type ListProductsQuery = ProductFilters & PaginationParams & SortParams;

const validateRequest = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors
      .array()
      .map(err => (err.msg ? `undefined: undefined` : err.msg))
      .join(', ');
    next(new ApiError(400, messages || 'Validation error'));
    return;
  }
  next();
};

const parseListQuery = (req: Request): ListProductsQuery => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    inStock,
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filters: ProductFilters = {};
  if (typeof search === 'string' && search.trim()) {
    filters.search = search.trim();
  }
  if (typeof category === 'string' && category.trim()) {
    filters.category = category.trim();
  }
  if (typeof minPrice === 'string' && !Number.isNaN(Number(minPrice))) {
    filters.minPrice = Number(minPrice);
  }
  if (typeof maxPrice === 'string' && !Number.isNaN(Number(maxPrice))) {
    filters.maxPrice = Number(maxPrice);
  }
  if (typeof inStock === 'string') {
    if (inStock.toLowerCase() === 'true') filters.inStock = true;
    if (inStock.toLowerCase() === 'false') filters.inStock = false;
  }

  const pagination: PaginationParams = {
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(100, Math.max(1, Number(limit) || 20)),
  };

  const sort: SortParams = {
    sortBy: typeof sortBy === 'string' ? sortBy : 'createdAt',
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  };

  return {
    ...filters,
    ...pagination,
    ...sort,
  };
};

const buildMongoFilter = (filters: ProductFilters): Record<string, unknown> => {
  const mongoFilter: Record<string, unknown> = {};

  if (filters.search) {
    mongoFilter.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }

  if (filters.category) {
    mongoFilter.category = filters.category;
  }

  if (typeof filters.inStock === 'boolean') {
    if (filters.inStock) {
      mongoFilter.stock = { $gt: 0 };
    } else {
      mongoFilter.stock = { $lte: 0 };
    }
  }

  if (typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number') {
    mongoFilter.price = {};
    if (typeof filters.minPrice === 'number') {
      (mongoFilter.price as Record<string, number>).$gte = filters.minPrice;
    }
    if (typeof filters.maxPrice === 'number') {
      (mongoFilter.price as Record<string, number>).$lte = filters.maxPrice;
    }
  }

  return mongoFilter;
};

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be non-negative'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be non-negative'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('sortOrder must be asc or desc'),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, sortBy, sortOrder, ...filterParams } = parseListQuery(req);
      const filter = buildMongoFilter(filterParams);

      const sort: Record<string, 1 | -1> = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1,
      };

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        ProductModel.find(filter).sort(sort).skip(skip).limit(limit).lean<ProductDocument[]>(),
        ProductModel.countDocuments(filter),
      ]);

      res.json({
        data: items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  [param('id').custom(value => Types.ObjectId.isValid(value)).withMessage('Invalid product id'), validateRequest],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await ProductModel.findById(req.params.id).lean<ProductDocument | null>();
      if (!product) {
        throw new ApiError(404, 'Product not found');
      }
      res.json({ data: product });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString().trim(),
    body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('category').isString().trim().notEmpty().withMessage('Category is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('images').optional().isArray().withMessage('Images must be an array of URLs'),
    body('images.*').optional().isString().trim(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, description, price, category, stock, images } = req.body;

      const product = await ProductModel.create({
        name,
        description,
        price,
        category,
        stock,
        images,
      });

      res.status(201).json({ data: product });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    param('id').custom(value => Types.ObjectId.isValid(value)).withMessage('Invalid product id'),
    body('name').optional().isString().trim().notEmpty().withMessage('Name must not be empty'),
    body('description').optional().isString().trim(),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('category').optional().isString().trim().notEmpty().withMessage('Category must not be empty'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('images').optional().isArray().withMessage('Images must be an array of URLs'),
    body('images.*').optional().isString().trim(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updateData: Partial<ProductDocument> = {};
      const { name, description, price, category, stock, images } = req.body;

      if (typeof name === 'string') updateData.name = name;
      if (typeof description === 'string') updateData.description = description;
      if (typeof price === 'number') updateData.price = price;
      if (typeof category === 'string') updateData.category = category;
      if (typeof stock === 'number') updateData.stock = stock;
      if (Array.isArray(images)) updateData.images = images;

      const product = await ProductModel.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean<ProductDocument | null>();