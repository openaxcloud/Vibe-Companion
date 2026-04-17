import { Router } from 'express';
import { getProducts, getProductById, createProduct, updateProduct } from '../controllers/products.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
// Admin routes (would add admin role check in authenticateToken for real app)
router.post('/', authenticateToken, createProduct);
router.put('/:id', authenticateToken, updateProduct);

export default router;
