import { Router } from 'express';
import { query } from '../db';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';
import { sendOrderConfirmationEmail } from '../email';

const router = Router();

interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'user' | 'admin';
}

// Create a new order (after successful Stripe payment redirection)
// This endpoint will be hit by Stripe webhook or after successful client-side payment confirmation
// For simplicity, directly creating an order here. In a real app, this would be a webhook endpoint.
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const { items, totalAmount, shippingAddress, stripeSessionId } = req.body;
  const userId = req.userId;

  if (!userId || !items || items.length === 0 || !totalAmount || !shippingAddress) {
    return res.status(400).json({ success: false, message: 'Missing required order details.' });
  }

  try {
    // Deduct stock for each item
    for (const item of items) {
      await query('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1', [item.quantity, item.productId]);
    }

    const result = await query(
      'INSERT INTO orders (userId, items, totalAmount, shippingAddress, status, "stripeSessionId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING * ',
      [userId, JSON.stringify(items), totalAmount, JSON.stringify(shippingAddress), 'completed', stripeSessionId]
    );
    const newOrder = result.rows[0];

    // Send order confirmation email (async, fire-and-forget)
    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length > 0) {
      const userEmail = userResult.rows[0].email;
      sendOrderConfirmationEmail(userEmail, newOrder).catch(console.error);
    }

    res.status(201).json({ success: true, data: newOrder });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error creating order.' });
  }
});

// Get all orders (Admin only)
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY "createdAt" DESC');
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching orders.' });
  }
});

// Get orders for a specific user
router.get('/user/:userId', authenticateToken, async (req: AuthRequest, res) => {
  const { userId } = req.params;
  // Ensure a user can only fetch their own orders, or admin can fetch any user's orders
  if (req.userId !== userId && req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access Denied.' });
  }
  try {
    const result = await query('SELECT * FROM orders WHERE userId = $1 ORDER BY "createdAt" DESC', [userId]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user orders.' });
  }
});

// Update order status (Admin only)
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Order status is required.' });
  }

  const validStatuses = ['pending', 'completed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status.' });
  }

  try {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING * ',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ success: false, message: 'Server error updating order.' });
  }
});

export default router;