import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { generateToken } from '../services/userService'; // Import generateToken
import { JwtPayload } from '../types';

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password } = req.body;
  try {
    const user = await userService.registerUser(username, email, password);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error: any) {
    next(error);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  try {
    const { token, user } = await userService.loginUser(email, password);
    res.status(200).json({ token, user });
  } catch (error: any) {
    next(error);
  }
};

export const verifyUserToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user; // Set by protect middleware
    const user = await userService.getUserProfile(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error: any) {
    next(error);
  }
};
