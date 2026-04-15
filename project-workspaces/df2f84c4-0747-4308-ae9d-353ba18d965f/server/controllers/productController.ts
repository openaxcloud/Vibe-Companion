import { Request, Response } from 'express';
import pool from '../db';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, category, minPrice, maxPrice, sortBy, order } = req.query;
    let query = `
      SELECT
        p.id, p.name, p.description, p.price, p.image_url, p.created_at, p.updated_at,
        c.name AS category_name,
        i.quantity AS stock_quantity
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    if (category) {
      query += ` AND c.name ILIKE $${paramIndex}`;
      queryParams.push(`%${category}%`);
      paramIndex++;
    }
    if (minPrice) {
      query += ` AND p.price >= $${paramIndex}`;
      queryParams.push(minPrice);
      paramIndex++;
    }
    if (maxPrice) {
      query += ` AND p.price <= $${paramIndex}`;
      queryParams.push(maxPrice);
      paramIndex++;
    }

    const orderBy = sortBy ? String(sortBy) : 'created_at';
    const sortOrder = order && String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${orderBy} ${sortOrder}`;

    const result = await pool.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.name, p.description, p.price, p.image_url, p.created_at, p.updated_at,
        c.name AS category_name,
        i.quantity AS stock_quantity
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const { name, description, price, image_url, category_name, quantity } = req.body;
  try {
    let categoryResult = await pool.query('SELECT id FROM categories WHERE name = $1', [category_name]);
    let category_id;

    if (categoryResult.rows.length === 0) {
      const newCategory = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category_name]);
      category_id = newCategory.rows[0].id;
    } else {
      category_id = categoryResult.rows[0].id;
    }

    const productResult = await pool.query(
      'INSERT INTO products (name, description, price, image_url, category_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, price, image_url, category_id]
    );
    const newProduct = productResult.rows[0];

    await pool.query('INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)', [newProduct.id, quantity || 0]);

    res.status(201).json({ ...newProduct, category_name, stock_quantity: quantity || 0 });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, image_url, category_name, quantity } = req.body;
  try {
    let category_id;
    if (category_name) {
      let categoryResult = await pool.query('SELECT id FROM categories WHERE name = $1', [category_name]);
      if (categoryResult.rows.length === 0) {
        const newCategory = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category_name]);
        category_id = newCategory.rows[0].id;
      } else {
        category_id = categoryResult.rows[0].id;
      }
    }

    const productResult = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        image_url = COALESCE($4, image_url),
        category_id = COALESCE($5, category_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 RETURNING *`,
      [name, description, price, image_url, category_id, id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (quantity !== undefined) {
      await pool.query('UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2', [quantity, id]);
    }

    const updatedProduct = { ...productResult.rows[0], category_name: category_name || (await pool.query('SELECT name FROM categories WHERE id = $1', [productResult.rows[0].category_id])).rows[0].name, stock_quantity: quantity || (await pool.query('SELECT quantity FROM inventory WHERE product_id = $1', [id])).rows[0].quantity };

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM inventory WHERE product_id = $1', [id]);
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(204).send(); // No content
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};