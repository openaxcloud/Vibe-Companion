import { Router, Request, Response } from 'express';
import authRouter from './auth';
import usersRouter from './users';
import productsRouter from './products';
import cartRouter from './cart';
import ordersRouter from './orders';
import paymentsRouter from './payments';
import webhookRouter from './webhook';

const apiRouter = Router();

// Health check / status
apiRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount feature routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/webhook', webhookRouter);

const createRootRouter = (): Router => {
  const rootRouter = Router();
  rootRouter.use('/api', apiRouter);

  // Base route
  rootRouter.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      name: 'API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        users: '/api/users',
        products: '/api/products',
        cart: '/api/cart',
        orders: '/api/orders',
        payments: '/api/payments',
        webhook: '/api/webhook',
      },
    });
  });

  return rootRouter;
};

export default createRootRouter;
export { apiRouter };