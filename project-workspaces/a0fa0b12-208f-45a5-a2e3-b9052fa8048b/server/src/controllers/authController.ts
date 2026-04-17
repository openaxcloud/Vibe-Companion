import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findAllUsers, deleteUserById } from '../models/User';
import { findCartByUserId, createCart } from '../models/Cart';
import { UserRole } from '../types';

const generateToken = (id: string, role: UserRole) => {
  return jwt.sign({ userId: id, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
};

export const registerUser = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ message: 'User with that email already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  try {
    const newUser = await createUser({
      username,
      email,
      password: hashedPassword,
      role: 'user',
    });

    // Create a cart for the new user
    await createCart(newUser.id);

    const token = generateToken(newUser.id, newUser.role);
    res.status(201).json({
      message: 'Registration successful',
      user: { _id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password as string);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(user.id, user.role);
  res.status(200).json({
    message: 'Login successful',
    user: { _id: user.id, username: user.username, email: user.email, role: user.role },
    token,
  });
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await findAllUsers();
    res.status(200).json(users.map(user => ({ _id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.created_at })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteUserById(id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
