import { Router, Request, Response, NextFunction } from "express";
import { authController } from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";

const router: Router = Router();

router.post(
  "/signup",
  (req: Request, res: Response, next: NextFunction) =>
    authController.signup(req, res, next)
);

router.post(
  "/login",
  (req: Request, res: Response, next: NextFunction) =>
    authController.login(req, res, next)
);

router.post(
  "/logout",
  (req: Request, res: Response, next: NextFunction) =>
    authController.logout(req, res, next)
);

router.get(
  "/me",
  authMiddleware,
  (req: Request, res: Response, next: NextFunction) =>
    authController.getMe(req, res, next)
);

export default router;