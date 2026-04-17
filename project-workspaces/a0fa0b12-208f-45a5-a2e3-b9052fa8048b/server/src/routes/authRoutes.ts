import { Router } from 'express';
import { registerUser, loginUser, getUsers, deleteUser } from '../controllers/authController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/users', protect, authorize(['admin']), getUsers); // Admin only
router.delete('/users/:id', protect, authorize(['admin']), deleteUser); // Admin only

export default router;
