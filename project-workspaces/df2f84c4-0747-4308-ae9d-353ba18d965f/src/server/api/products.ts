import { Router } from 'express';
import { query } from '../db';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products');
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching products.' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching product.' });
  }
});

// Create a new product (Admin only)
router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
  const { name, description, price, imageUrl, category, stock } = req.body;
  if (!name || !description || !price || !imageUrl || !category || stock === undefined) {
    return res.status(400).json({ success: false, message: 'All product fields are required.' });
  }
  try {
    const result = await query(
      'INSERT INTO products (name, description, price, imageUrl, category, stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING * ',
      [name, description, price, imageUrl, category, stock]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Server error creating product.' });
  }
});

// Update a product (Admin only)
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, category, stock } = req.body;
  try {
    const result = await query(
      'UPDATE products SET name = $1, description = $2, price = $3, imageUrl = $4, category = $5, stock = $6 WHERE id = $7 RETURNING * ',
      [name, description, price, imageUrl, category, stock, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error updating product.' });
  }
});

// Delete a product (Admin only)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.status(200).json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting product.' });
  }
});

export default router;