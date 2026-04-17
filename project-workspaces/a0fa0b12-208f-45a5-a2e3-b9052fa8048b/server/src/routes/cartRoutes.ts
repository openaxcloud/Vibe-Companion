import { Router } from 'express';
import { getUserCart, addItemToUserCart, removeCartItemFromUserCart, updateCartItemQuantityInUserCart, clearUserCart } from '../controllers/cartController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect); // All cart routes require authentication

router.get('/', getUserCart);
router.post('/', addItemToUserCart);
router.delete('/:productId', removeCartItemFromUserCart);
router.put('/:productId', updateCartItemQuantityInUserCart);
router.delete('/clear', clearUserCart);

export default router;
