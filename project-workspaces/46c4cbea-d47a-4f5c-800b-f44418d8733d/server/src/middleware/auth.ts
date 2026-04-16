import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const protect = (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      (req as any).user = decoded.id; // Attach user ID to request
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  // In a real application, you would fetch the user from the DB using req.user.id
  // and check their role. For this example, we'll assume the JWT payload can contain role.
  // This is simplified and should be made more robust for production.
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    // Assuming decoded.role exists and is 'admin' for admin users
    if (decoded.role === 'admin') {
      (req as any).user = decoded.id;
      (req as any).userRole = decoded.role;
      next();
    } else {
      res.status(403).json({ message: 'Not authorized as an admin' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};
