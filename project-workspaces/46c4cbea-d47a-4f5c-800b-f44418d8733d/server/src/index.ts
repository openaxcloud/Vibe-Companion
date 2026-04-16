import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import cartRoutes from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';
import stripeRoutes from './routes/stripeRoutes';
import { errorHandler } from './middleware/error';

dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Middleware
// Stripe webhook needs raw body, so apply json middleware conditionally or use a separate route
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stripe', stripeRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is healthy' });
});

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});