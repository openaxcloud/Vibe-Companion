import { Router } from 'express';
import { getProducts, getProductById, createNewProduct, updateExistingProduct, deleteProduct } from '../controllers/productController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin-only routes for product management
router.post('/', protect, authorize(['admin']), createNewProduct);
router.put('/:id', protect, authorize(['admin']), updateExistingProduct);
router.delete('/:id', protect, authorize(['admin']), deleteProduct);

export default router;
