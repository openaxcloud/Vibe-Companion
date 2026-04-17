import { Router } from 'express';
import { getOrders, getOrderById, createOrder, updateOrderStatusController } from '../controllers/orders.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getOrders);
router.get('/:id', authenticateToken, getOrderById);
router.post('/', authenticateToken, createOrder); // This will be called after successful payment
router.put('/:id/status', authenticateToken, updateOrderStatusController); // For admin to update status

export default router;
