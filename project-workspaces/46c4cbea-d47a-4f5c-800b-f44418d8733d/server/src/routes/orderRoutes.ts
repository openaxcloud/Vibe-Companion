import { Router } 'express';
import { createOrder, getOrders, getOrderById, updateOrderStatus } from '../controllers/orderController';
import { protect, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.route('/')
  .post(protect, createOrder) // Authenticated users can create orders
  .get(protect, authorizeAdmin, getOrders); // Admins can view all orders

router.route('/:id')
  .get(protect, getOrderById) // Users can view their own orders, Admins any order
  .put(protect, authorizeAdmin, updateOrderStatus); // Admins can update order status

export default router;