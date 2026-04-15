import { Request, Response } from 'express';
import pool from '../db';
import { sendOrderConfirmationEmail } from '../utils/email';

export const createOrder = async (req: Request, res: Response) => {
  const { cartItems, totalAmount } = req.body;
  const userId = req.user?.id; // From authenticateToken middleware

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ message: 'Cart is empty' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the order
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id, created_at',
      [userId, totalAmount, 'completed'] // Assuming 'completed' after successful payment
    );
    const orderId = orderResult.rows[0].id;
    const orderCreatedAt = orderResult.rows[0].created_at;

    // Add order items and update inventory
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.id, item.quantity, item.price]
      );
      // Decrement inventory
      await client.query(
        'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND quantity >= $1',
        [item.quantity, item.id]
      );
      // TODO: Add robust inventory check and rollback if not enough stock
    }

    await client.query('COMMIT');

    // Fetch user email for confirmation
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userResult.rows[0]?.email;
    if (userEmail) {
      await sendOrderConfirmationEmail(userEmail, orderId, totalAmount);
    }

    res.status(201).json({ message: 'Order created successfully', orderId, created_at: orderCreatedAt });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const result = await pool.query(
      `SELECT
        o.id AS order_id,
        o.total_amount,
        o.status,
        o.created_at,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_id', oi.product_id,
            'product_name', p.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'image_url', p.image_url
          )
        ) AS items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const isAdmin = req.user?.is_admin;

  try {
    const result = await pool.query(
      `SELECT
        o.id AS order_id,
        o.user_id,
        u.email AS user_email,
        u.name AS user_name,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_id', oi.product_id,
            'product_name', p.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'image_url', p.image_url
          )
        ) AS items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE o.id = $1
      GROUP BY o.id, u.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = result.rows[0];

    // Ensure user can only see their own orders unless they are admin
    if (!isAdmin && order.user_id !== userId) {
      return res.status(403).json({ message: 'Access denied to this order' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // e.g., 'shipped', 'cancelled'

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};