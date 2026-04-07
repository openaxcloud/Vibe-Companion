import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

const router = Router();

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * In-memory storage placeholder.
 * Replace with real persistence (DB/ORM) in production.
 */
const categories: Category[] = [];

/**
 * Simple admin auth middleware placeholder.
 * Replace with real authentication/authorization.
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const isAdmin = (req as any).user?.isAdmin ?? false;
  if (!isAdmin) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }
  next();
};

/**
 * Generate slug from name.
 */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * GET /categories
 * Public: returns list of categories for filter population.
 */
router.get(
  '/categories',
  (req: Request, res: Response): void => {
    res.json(categories);
  }
);

/**
 * POST /categories
 * Admin: create new category
 */
router.post(
  '/categories',
  requireAdmin,
  body('name').isString().trim().isLength({ min: 1, max: 128 }),
  body('description').optional().isString().trim().isLength({ max: 512 }),
  (req: Request, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, description } = req.body as { name: string; description?: string };

    const newSlug = slugify(name);
    const now = new Date().toISOString();

    const existing = categories.find(
      (c) => c.slug === newSlug || c.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      res.status(409).json({ error: 'Category with same name or slug already exists' });
      return;
    }

    const newCategory: Category = {
      id: `undefined-undefined`,
      name,
      slug: newSlug,
      description,
      createdAt: now,
      updatedAt: now
    };

    categories.push(newCategory);
    res.status(201).json(newCategory);
  }
);

export default router;