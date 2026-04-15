import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Product } from '../types';

const router = Router();

// Get all products with optional search and filter
router.get('/', async (req: Request, res: Response) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (category) {
    query += ` AND category = $${paramIndex}`;
    queryParams.push(category as string);
    paramIndex++;
  }

  try {
    const { rows } = await pool.query<Product>(query, queryParams);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query<Product>('SELECT * FROM products WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new product (Auth: Seller/Admin)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'seller' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only sellers or admins can create products' });
  }

  const { name, description, price, imageUrl, category, stock } = req.body;

  if (!name || !description || !price || !category || stock === undefined) {
    return res.status(400).json({ message: 'Please provide all required product fields' });
  }

  try {
    const newProduct = await pool.query(
      'INSERT INTO products (name, description, price, image_url, category, stock, seller_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *' ,
      [name, description, price, imageUrl, category, stock, req.user.id]
    );
    res.status(201).json(newProduct.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a product (Auth: Seller/Admin - only their own products or any for admin)
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, category, stock } = req.body;

  try {
    const productResult = await pool.query<Product>('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = productResult.rows[0];

    if (req.user?.role !== 'admin' && product.sellerId !== req.user?.id) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own products' });
    }

    const updatedProduct = await pool.query(
      'UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, category = $5, stock = $6, updated_at = NOW() WHERE id = $7 RETURNING *' ,
      [name || product.name, description || product.description, price || product.price, imageUrl || product.imageUrl, category || product.category, stock !== undefined ? stock : product.stock, id]
    );
    res.json(updatedProduct.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a product (Auth: Seller/Admin - only their own products or any for admin)
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const productResult = await pool.query<Product>('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = productResult.rows[0];

    if (req.user?.role !== 'admin' && product.sellerId !== req.user?.id) {
      return res.status(403).json({ message: 'Forbidden: You can only delete your own products' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(204).send(); // No Content
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
