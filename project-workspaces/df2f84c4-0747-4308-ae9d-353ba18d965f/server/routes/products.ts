import { Router } from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getCategories } from '../controllers/productController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/categories', getCategories);

// Admin routes
router.post('/', authenticateToken, authorizeAdmin, createProduct);
router.put('/:id', authenticateToken, authorizeAdmin, updateProduct);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteProduct);

export default router;