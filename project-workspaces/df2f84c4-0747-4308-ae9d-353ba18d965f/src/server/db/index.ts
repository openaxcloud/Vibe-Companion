import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Use this for Render's default self-signed certs
  },
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Database schema initialization (run once)
export const initializeDatabase = async () => {
  try {
    // Create Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" ensured.');

    // Create Products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        "imageUrl" VARCHAR(255),
        category VARCHAR(100),
        stock INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" ensured.');

    // Create Orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        items JSONB NOT NULL, -- Array of { productId, name, price, quantity, imageUrl }
        "totalAmount" NUMERIC(10, 2) NOT NULL,
        "shippingAddress" JSONB NOT NULL, -- { address, city, state, zip, country }
        status VARCHAR(50) DEFAULT 'pending',
        "stripeSessionId" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "orders" ensured.');

    // Add sample data if tables are empty (optional, for development)
    const userCount = await query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log('Inserting sample user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );
      await query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['testuser', 'user@example.com', hashedPassword, 'user']
      );
      console.log('Sample users inserted.');
    }

    const productCount = await query('SELECT COUNT(*) FROM products');
    if (parseInt(productCount.rows[0].count) === 0) {
      console.log('Inserting sample products...');
      await query(
        'INSERT INTO products (name, description, price, "imageUrl", category, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'Stylish Backpack',
          'A durable and fashionable backpack for daily use.',
          59.99,
          'https://images.unsplash.com/photo-1553062407-98eeb640c46f?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          'accessories',
          50
        ]
      );
      await query(
        'INSERT INTO products (name, description, price, "imageUrl", category, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'Wireless Headphones',
          'High-fidelity sound with noise-cancelling features.',
          199.99,
          'https://images.unsplash.com/photo-1505740420928-5e560c06f2e0?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          'electronics',
          30
        ]
      );
      await query(
        'INSERT INTO products (name, description, price, "imageUrl", category, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'Vintage Leather Wallet',
          'Handcrafted leather wallet with multiple card slots.',
          34.50,
          'https://images.unsplash.com/photo-1627964177727-2ac83a0058e3?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          'accessories',
          100
        ]
      );
      await query(
        'INSERT INTO products (name, description, price, "imageUrl", category, stock) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'Smartwatch X1',
          'Track your fitness, notifications, and more with this sleek smartwatch.',
          249.00,
          'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          'electronics',
          25
        ]
      );
      console.log('Sample products inserted.');
    }

  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

// Call initialization function. This should ideally be called once on server startup.
// For development, it's fine here. In production, manage migrations carefully.
initializeDatabase();