import { Router } from 'express';
import { createNewOrder, getUserOrders, getAllOrders, updateOrderStatus } from '../controllers/orderController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.post('/', protect, createNewOrder);
router.get('/user/:userId', protect, getUserOrders);

// Admin-only routes
router.get('/', protect, authorize(['admin']), getAllOrders);
router.put('/:id/status', protect, authorize(['admin']), updateOrderStatus);

export default router;
