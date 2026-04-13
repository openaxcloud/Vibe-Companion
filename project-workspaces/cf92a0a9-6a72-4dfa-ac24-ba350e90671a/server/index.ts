import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import stripeRoutes from './routes/stripe';

dotenv.config();

const app = express();

app.use(cors({ origin: '*'}));
app.use(express.json());

app.get('/', (_, res) => {
  res.json({ message: 'E-commerce Marketplace API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stripe', stripeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
