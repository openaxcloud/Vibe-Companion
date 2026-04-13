import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/product.routes';
import authRoutes from './routes/auth.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import stripeRoutes from './routes/stripe.routes';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stripe', stripeRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
