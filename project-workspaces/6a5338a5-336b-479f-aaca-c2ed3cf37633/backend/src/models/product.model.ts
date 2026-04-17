import { pool } from '../index';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
  created_at?: Date;
  updated_at?: Date;
}

export const createProductTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      image_url VARCHAR(255),
      stock INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const findProductById = async (id: string): Promise<Product | null> => {
  const result = await pool.query<Product>('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const findAllProducts = async (
  search?: string,
  category?: string,
  minPrice?: number,
  maxPrice?: number
): Promise<Product[]> => {
  let query = 'SELECT * FROM products WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (category) {
    query += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }
  if (minPrice !== undefined) {
    query += ` AND price >= $${paramIndex}`;
    params.push(minPrice);
    paramIndex++;
  }
  if (maxPrice !== undefined) {
    query += ` AND price <= $${paramIndex}`;
    params.push(maxPrice);
    paramIndex++;
  }

  const result = await pool.query<Product>(query, params);
  return result.rows;
};

export const insertProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  const result = await pool.query<Product>(
    `INSERT INTO products (name, description, price, image_url, stock, category)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [product.name, product.description, product.price, product.image_url, product.stock, product.category]
  );
  return result.rows[0];
};

export const updateProductStock = async (id: string, newStock: number): Promise<void> => {
  await pool.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, id]);
};
