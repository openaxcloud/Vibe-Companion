import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './db'; // For initial DB connection check
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import stripeRoutes from './routes/stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Adjust based on your frontend URL
  credentials: true
}));

// Stripe webhook needs raw body, so apply express.json() selectively
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next(); // Skip express.json() for webhook route
  } else {
    express.json()(req, res, next);
  }
});


// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
  } else {
    console.log('Successfully connected to PostgreSQL at:', res.rows[0].now);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stripe', stripeRoutes); // Stripe webhook route is handled internally by stripeRoutes

app.get('/', (req, res) => {
  res.send('E-commerce API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});