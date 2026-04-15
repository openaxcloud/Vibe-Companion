import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Get token from header
  const token = req.header('Authorization');

  // Check if not token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;
    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET as string) as { id: string; role: 'buyer' | 'seller' | 'admin' };
    
    // Attach user to the request object
    req.user = { id: decoded.id, role: decoded.role, email: '' }; // Email and name are not in token, will need to fetch if needed
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
