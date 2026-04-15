import { Router } from 'express';
import { updateInventory, getInventoryByProductId } from '../controllers/inventoryController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Admin only routes
router.put('/:productId', authenticateToken, authorizeAdmin, updateInventory);
router.get('/:productId', authenticateToken, authorizeAdmin, getInventoryByProductId);

export default router;