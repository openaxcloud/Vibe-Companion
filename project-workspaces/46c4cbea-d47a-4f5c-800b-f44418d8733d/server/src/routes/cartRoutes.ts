import { Router } from 'express';
import { getCart, addItem, updateItem, removeItem } from '../controllers/cartController';
import { protect } from '../middleware/auth';

const router = Router();

// These routes are illustrative. A real backend might handle cart state differently
// e.g., by persisting user carts in the database or relying more on client-side state
// for anonymous carts, and merging them on login.

router.route('/')
  .get(protect, getCart)
  .post(protect, addItem);

router.route('/:productId')
  .put(protect, updateItem)
  .delete(protect, removeItem);

export default router;