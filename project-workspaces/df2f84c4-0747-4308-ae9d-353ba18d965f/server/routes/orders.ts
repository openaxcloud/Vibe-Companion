import { Router } from 'express';
import { createOrder, getUserOrders, getOrderById, updateOrderStatus } from '../controllers/orderController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createOrder);
router.get('/', authenticateToken, getUserOrders);
router.get('/:id', authenticateToken, getOrderById); // Users can view their own, admin can view any
router.put('/:id/status', authenticateToken, authorizeAdmin, updateOrderStatus); // Admin only

export default router;