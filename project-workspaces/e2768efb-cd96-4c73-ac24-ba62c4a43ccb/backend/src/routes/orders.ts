import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { pool } from '../db';
import { Order } from '../types';
import { sendOrderConfirmationEmail } from '../services/email'; // Placeholder

const router = Router();

// Create a new order (Auth: User)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { items, total, shippingAddress, paymentIntentId } = req.body;
  const userId = req.user?.id;

  if (!userId || !items || !total || !shippingAddress || !paymentIntentId) {
    return res.status(400).json({ message: 'Missing required order details' });
  }

  try {
    // Start a transaction for atomicity
    await pool.query('BEGIN');

    const newOrder = await pool.query(
      'INSERT INTO orders (user_id, total, shipping_address, payment_intent_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *' ,
      [userId, total, shippingAddress, paymentIntentId, 'completed'] // Assuming payment is already successful
    );

    const orderId = newOrder.rows[0].id;

    for (const item of items) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES ($1, $2, $3, $4, $5)',
        [orderId, item.productId, item.name, item.quantity, item.price]
      );
      // Decrease product stock (inventory tracking)
      await pool.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.quantity, item.productId]
      );
      // TODO: Handle case where stock is insufficient (rollback transaction)
    }

    await pool.query('COMMIT');

    // Send order confirmation email (non-blocking)
    sendOrderConfirmationEmail(req.user?.email || '', orderId, total).catch(console.error);

    res.status(201).json(newOrder.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error during order creation' });
  }
});

// Get user's orders (Auth: User)
router.get('/user', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const { rows } = await pool.query<Order>('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders (Auth: Admin)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can view all orders' });
  }

  try {
    const { rows } = await pool.query<Order>('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status (Auth: Admin)
router.put('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only admins can update order status' });
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    const updatedOrder = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *' ,
      [status, id]
    );
    if (updatedOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(updatedOrder.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
