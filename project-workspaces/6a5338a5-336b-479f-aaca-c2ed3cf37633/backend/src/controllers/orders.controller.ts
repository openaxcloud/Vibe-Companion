import { Request, Response } from 'express';
import { insertOrder, insertOrderItem, findOrdersByUserId, findOrderById, findOrderItemsByOrderId, updateOrderStatus } from '../models/order.model';
import { findProductById, updateProductStock } from '../models/product.model';
import { sendOrderConfirmationEmail } from '../services/email.service';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  const { items, shippingAddress, billingAddress, paymentIntentId, totalAmount } = req.body;
  const userId = req.userId;

  if (!userId || !items || items.length === 0 || !shippingAddress || !billingAddress || !paymentIntentId || !totalAmount) {
    return res.status(400).json({ message: 'Missing required order details' });
  }

  try {
    // Check product availability and reduce stock
    for (const item of items) {
      const product = await findProductById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ message: `Product ${product?.name || item.productId} is out of stock or insufficient quantity` });
      }
    }

    // Create order
    const newOrder = await insertOrder({
      user_id: userId,
      total_amount: totalAmount,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      payment_intent_id: paymentIntentId,
    });

    // Add order items and update stock
    for (const item of items) {
      await insertOrderItem({
        order_id: newOrder.id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price, // Store price at the time of order
      });
      const product = await findProductById(item.productId);
      if (product) {
        await updateProductStock(item.productId, product.stock - item.quantity);
      }
    }

    // Send order confirmation email
    // In a real app, this would be an async background task to not block the response
    const userEmail = (await findUserById(userId))?.email;
    if (userEmail) {
      sendOrderConfirmationEmail(userEmail, newOrder.id, items);
    }

    res.status(201).json({ message: 'Order created successfully', order: newOrder });
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

export const getOrders = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const orders = await findOrdersByUserId(userId);
    res.status(200).json(orders);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const order = await findOrderById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    // Ensure user can only view their own orders (or if they are admin)
    if (order.user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orderItems = await findOrderItemsByOrderId(id);
    res.status(200).json({ ...order, items: orderItems });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching order details', error: error.message });
  }
};

export const updateOrderStatusController = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'paid', 'shipped', 'delivered', 'cancelled'

  if (!status) {
    return res.status(400).json({ message: 'Order status is required' });
  }
  // In a real app, you'd check if the authenticated user has admin privileges
  // For now, any authenticated user can technically try to update status.

  try {
    await updateOrderStatus(id, status);
    res.status(200).json({ message: `Order ${id} status updated to ${status}` });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
