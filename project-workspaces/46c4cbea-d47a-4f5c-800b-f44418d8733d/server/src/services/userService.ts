import { User } from '../types';
import * as UserModel from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
};

export const registerUser = async (username: string, email: string, password: string): Promise<Omit<User, 'password'>> => {
  const existingUser = await UserModel.findUserByEmail(email);
  if (existingUser) {
    throw new Error('User with that email already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await UserModel.createUser(username, email, hashedPassword);
  // Omit password from returned user object
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

export const loginUser = async (email: string, password: string): Promise<{ token: string; user: Omit<User, 'password'> }> => {
  const user = await UserModel.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken(user.id, user.role);
  const { password: _, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
};

export const getUserProfile = async (userId: string): Promise<Omit<User, 'password'> | undefined> => {
  const user = await UserModel.findUserById(userId);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return undefined;
};
