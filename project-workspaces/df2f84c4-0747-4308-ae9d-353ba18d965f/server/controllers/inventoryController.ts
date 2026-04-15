import { Request, Response } from 'express';
import pool from '../db';

export const updateInventory = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ message: 'Quantity must be a non-negative number' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO inventory (product_id, quantity) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET quantity = $2, updated_at = CURRENT_TIMESTAMP RETURNING *',
      [productId, quantity]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInventoryByProductId = async (req: Request, res: Response) => {
  const { productId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE product_id = $1', [productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory for product not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching inventory by product ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};