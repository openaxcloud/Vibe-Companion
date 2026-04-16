import pool from '../config/db';
import { User } from '../types';

export const createUser = async (username: string, email: string, passwordHash: string): Promise<User> => {
  const result = await pool.query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role, created_at, updated_at',
    [username, email, passwordHash]
  );
  return result.rows[0];
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const result = await pool.query('SELECT id, username, email, password, role, created_at, updated_at FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

export const findUserById = async (id: string): Promise<User | undefined> => {
  const result = await pool.query('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1', [id]);
  return result.rows[0];
};
