import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import * as emailService from '../services/emailService';
import { CheckoutItem, ShippingAddress } from '../types';

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user; // From protect middleware
  const { cartItems, shippingAddress } = req.body;
  const userEmail = (req as any).userEmail; // Assuming userEmail is set by auth middleware, or fetch from DB

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (!cartItems || cartItems.length === 0 || !shippingAddress) {
    return res.status(400).json({ message: 'Missing order details' });
  }

  try {
    // In a real app, you'd fetch the user email from the DB using userId
    const userFromDb = await (await import('../models/User')).findUserById(userId);
    if (!userFromDb) {
      return res.status(404).json({ message: 'User not found for order creation' });
    }

    const newOrder = await orderService.createNewOrder(userId, userFromDb.email, shippingAddress, cartItems);
    await emailService.sendConfirmationEmail(newOrder);
    res.status(201).json(newOrder);
  } catch (error: any) {
    next(error);
  }
};

export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user; // From protect middleware
  const userRole = (req as any).userRole; // From authorizeAdmin or protect middleware

  try {
    let orders;
    if (userRole === 'admin') {
      orders = await orderService.getOrders(); // Get all orders for admin
    } else {
      orders = await orderService.getOrders(userId); // Get user's own orders
    }
    res.status(200).json(orders);
  } catch (error: any) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;
  const userRole = (req as any).userRole;
  const { id } = req.params;

  try {
    const order = await orderService.getOrderDetails(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ensure user can only view their own orders unless they are an admin
    if (userRole !== 'admin' && order.userId !== userId) {
      return res.status(403).json({ message: 'Access denied to this order' });
    }

    res.status(200).json(order);
  } catch (error: any) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { status } = req.body; // New status: 'Pending', 'Completed', 'Cancelled'

  try {
    const updatedOrder = await orderService.updateOrderStatus(id, status);
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json(updatedOrder);
  } catch (error: any) {
    next(error);
  }
};
