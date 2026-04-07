import express, { Router, Request, Response } from 'express';
import authRouter from './auth';
import productsRouter from './products';
import cartRouter from './cart';
import ordersRouter from './orders';
import adminRouter from './admin';
import healthRouter from './health';

const router: Router = express.Router();

const apiV1Router: Router = express.Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/products', productsRouter);
apiV1Router.use('/cart', cartRouter);
apiV1Router.use('/orders', ordersRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/health', healthRouter);

apiV1Router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', version: 'v1' });
});

router.use('/api/v1', apiV1Router);

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('pong');
});

export default router;