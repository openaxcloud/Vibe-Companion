import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { requireAdmin } from '../middleware/requireAdmin';
import { validateRequest } from '../middleware/validateRequest';
import { ProductModel } from '../models/Product';
import { CategoryModel } from '../models/Category';
import { InventoryAdjustmentModel } from '../models/InventoryAdjustment';
import { Types } from 'mongoose';

const router = Router();

const isObjectId = (value: string): boolean => Types.ObjectId.isValid(value);

const handleAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// Validation chains
const productIdParam = param('productId')
  .custom(isObjectId)
  .withMessage('Invalid productId');

const categoryIdParam = param('categoryId')
  .custom(isObjectId)
  .withMessage('Invalid categoryId');

const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ min: 1 }),
  query('categoryId').optional().custom(isObjectId).withMessage('Invalid categoryId'),
];

// Admin: List products with filters
router.get(
  '/products',
  requireAdmin,
  paginationQuery,
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const page = (req.query.page as number) || 1;
    const limit = (req.query.limit as number) || 20;
    const search = (req.query.search as string | undefined) || undefined;
    const categoryId = (req.query.categoryId as string | undefined) || undefined;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (categoryId) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }

    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .populate('categoryId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      ProductModel.countDocuments(filter).exec(),
    ]);

    res.json({
      data: items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// Admin: Create product
router.post(
  '/products',
  requireAdmin,
  [
    body('name').isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().trim().isLength({ max: 5000 }),
    body('price').isFloat({ min: 0 }),
    body('currency').isString().trim().isLength({ min: 3, max: 3 }),
    body('sku').optional().isString().trim().isLength({ max: 100 }),
    body('categoryId')
      .optional()
      .custom(isObjectId)
      .withMessage('Invalid categoryId'),
    body('stock').optional().isInt({ min: 0 }).toInt(),
    body('isActive').optional().isBoolean().toBoolean(),
    body('metadata').optional().isObject(),
    body('images').optional().isArray(),
    body('images.*').optional().isURL(),
  ],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const {
      name,
      description,
      price,
      currency,
      sku,
      categoryId,
      stock,
      isActive,
      metadata,
      images,
    } = req.body;

    if (categoryId) {
      const categoryExists = await CategoryModel.exists({ _id: categoryId });
      if (!categoryExists) {
        return res.status(400).json({ errors: [{ message: 'Category not found', field: 'categoryId' }] });
      }
    }

    const product = await ProductModel.create({
      name,
      description,
      price,
      currency,
      sku,
      categoryId: categoryId || null,
      stock: stock ?? 0,
      isActive: isActive ?? true,
      metadata: metadata || {},
      images: images || [],
    });

    res.status(201).json(product);
  })
);

// Admin: Get product by ID
router.get(
  '/products/:productId',
  requireAdmin,
  [productIdParam],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;

    const product = await ProductModel.findById(productId)
      .populate('categoryId')
      .lean()
      .exec();

    if (!product) {
      return res.status(404).json({ errors: [{ message: 'Product not found' }] });
    }

    res.json(product);
  })
);

// Admin: Update product
router.put(
  '/products/:productId',
  requireAdmin,
  [
    productIdParam,
    body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().trim().isLength({ max: 5000 }),
    body('price').optional().isFloat({ min: 0 }),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }),
    body('sku').optional().isString().trim().isLength({ max: 100 }),
    body('categoryId')
      .optional({ values: 'falsy' })
      .custom((value) => (value ? isObjectId(value) : true))
      .withMessage('Invalid categoryId'),
    body('stock').optional().isInt({ min: 0 }).toInt(),
    body('isActive').optional().isBoolean().toBoolean(),
    body('metadata').optional().isObject(),
    body('images').optional().isArray(),
    body('images.*').optional().isURL(),
  ],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const updates = req.body as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(updates, 'categoryId')) {
      const categoryId = updates.categoryId as string | null;
      if (categoryId) {
        const categoryExists = await CategoryModel.exists({ _id: categoryId });
        if (!categoryExists) {
          return res.status(400).json({ errors: [{ message: 'Category not found', field: 'categoryId' }] });
        }
      } else {
        updates.categoryId = null;
      }
    }

    const product = await ProductModel.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('categoryId')
      .exec();

    if (!product) {
      return res.status(404).json({ errors: [{ message: 'Product not found' }] });
    }

    res.json(product);
  })
);

// Admin: Delete product
router.delete(
  '/products/:productId',
  requireAdmin,
  [productIdParam],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;

    const product = await ProductModel.findByIdAndDelete(productId).exec();

    if (!product) {
      return res.status(404).json({ errors: [{ message: 'Product not found' }] });
    }

    res.status(204).send();
  })
);

// Admin: Adjust inventory
router.post(
  '/products/:productId/inventory-adjustment',
  requireAdmin,
  [
    productIdParam,
    body('delta').isInt().withMessage('delta must be an integer'),
    body('reason')
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('reason is required'),
    body('metadata').optional().isObject(),
  ],
  validateRequest,
  handleAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const { delta, reason, metadata } = req.body;

    const product = await ProductModel.findById(productId).exec();

    if (!product) {
      return res.status(404).json({ errors: [{ message: 'Product not found' }] });
    }

    const newStock = (product.stock ?? 0) + delta;

    if (newStock < 0) {
      return res.status(400).json({
        errors: [
          {
            message: 'Inventory adjustment would result in negative stock',
            field: 'delta',
          },
        ],
      });
    }

    product.stock = newStock;
    await product.save();

    const adjustment = await InventoryAdjustmentModel.create({
      productId: product._id,
      delta,
      reason,
      metadata: metadata || {},
      resultingStock: newStock,
    });

    res