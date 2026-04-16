import { Router } from 'express';
import { registerUser, loginUser, verifyUserToken } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/verify-token', protect, verifyUserToken);

export default router;