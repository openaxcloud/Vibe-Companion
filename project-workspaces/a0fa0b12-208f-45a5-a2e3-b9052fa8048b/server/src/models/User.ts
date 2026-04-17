import { query } from '../config/db';
import { UserRole } from '../types';

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
};

export const findUserById = async (id: string): Promise<User | null> => {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const createUser = async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> => {
  const id = `user_${Date.now()}`;
  const result = await query(
    'INSERT INTO users (id, username, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
    [id, user.username, user.email, user.password, user.role || 'user']
  );
  return result.rows[0];
};

export const findAllUsers = async (): Promise<User[]> => {
  const result = await query('SELECT id, username, email, role, created_at FROM users', []);
  return result.rows;
};

export const deleteUserById = async (id: string): Promise<void> => {
  await query('DELETE FROM users WHERE id = $1', [id]);
};
