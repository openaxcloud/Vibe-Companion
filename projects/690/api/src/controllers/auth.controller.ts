import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { RegisterInput, LoginInput } from '../types/auth.types';

export const register = async (
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    const { user, accessToken, refreshToken } = await authService.register({
      email,
      password,
      name,
    });

    res.status(201).json({
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken } = await authService.login({
      email,
      password,
    });

    res.status(200).json({
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await authService.me(currentUser.id);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: incomingToken } = req.body as { refreshToken?: string };

    if (!incomingToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refreshToken(incomingToken);

    res.status(200).json({
      user,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: incomingToken } = req.body as { refreshToken?: string };

    if (!incomingToken) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    await authService.logout(incomingToken);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};