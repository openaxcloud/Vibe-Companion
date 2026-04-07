import { Router, Request, Response } from 'express';
import authRouter from './auth';
import productsRouter from './products';
import cartRouter from './cart';
import checkoutRouter from './checkout';
import ordersRouter from './orders';
import inventoryRouter from './inventory';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRouter);
router.use('/products', productsRouter);
router.use('/cart', cartRouter);
router.use('/checkout', checkoutRouter);
router.use('/orders', ordersRouter);
router.use('/inventory', inventoryRouter);

router.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route undefined undefined does not exist`,
  });
});

export default router;