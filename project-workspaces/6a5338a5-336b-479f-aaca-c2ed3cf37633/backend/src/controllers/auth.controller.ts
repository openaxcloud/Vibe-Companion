import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, insertUser, findUserById } from '../models/user.model';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const register = async (req: Request, res: Response) => {
  const { email, password, name, address, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Please provide email, password, and name' });
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const newUser = await insertUser({ email, password, name, address, phone });
    const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await findUserById(req.userId as string);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user; // Exclude password from response
    res.status(200).json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};
