import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './api/auth';
import productRoutes from './api/products';
import orderRoutes from './api/orders';
import stripeRoutes from './stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/stripe', stripeRoutes);

app.get('/', (req, res) => {
  res.send('E-Commerce Marketplace Backend');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});