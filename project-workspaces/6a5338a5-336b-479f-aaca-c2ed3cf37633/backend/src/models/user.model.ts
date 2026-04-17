import { pool } from '../index';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password?: string; // Optional for when fetching without password hash
  name: string;
  address?: string;
  phone?: string;
  created_at?: Date;
  updated_at?: Date;
}

export const createUserTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      address TEXT,
      phone VARCHAR(20),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query<User>('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
};

export const findUserById = async (id: string): Promise<User | null> => {
  const result = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const insertUser = async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> => {
  const hashedPassword = await bcrypt.hash(user.password!, 10);
  const result = await pool.query<User>(
    `INSERT INTO users (email, password, name, address, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, address, phone, created_at, updated_at`,
    [user.email, hashedPassword, user.name, user.address, user.phone]
  );
  return result.rows[0];
};
