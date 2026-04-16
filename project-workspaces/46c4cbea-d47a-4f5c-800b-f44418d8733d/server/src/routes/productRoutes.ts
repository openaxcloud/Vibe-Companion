import { Router } from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { authorizeAdmin, protect } from '../middleware/auth';

const router = Router();

router.route('/')
  .get(getProducts) // Publicly accessible
  .post(protect, authorizeAdmin, createProduct); // Admin only

router.route('/:id')
  .get(getProductById) // Publicly accessible
  .put(protect, authorizeAdmin, updateProduct) // Admin only
  .delete(protect, authorizeAdmin, deleteProduct); // Admin only

export default router;