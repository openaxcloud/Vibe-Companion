import express, { Request, Response, NextFunction, Router } from "express";
import { body, validationResult } from "express-validator";
import { verifyAuthToken } from "../middleware/authMiddleware";
import { AuthController } from "../controllers/authController";

const router: Router = express.Router();

const validateRequest =
  (validations: any[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        status: "fail",
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
      return;
    }

    next();
  };

const registrationValidation = [
  body("email")
    .isEmail()
    .withMessage("Email must be a valid email address")
    .normalizeEmail(),
  body("password")
    .isString()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("name")
    .optional()
    .isString()
    .withMessage("Name must be a string")
    .isLength({ max: 100 })
    .withMessage("Name must be at most 100 characters long"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Email must be a valid email address")
    .normalizeEmail(),
  body("password").isString().withMessage("Password is required"),
];

router.post(
  "/register",
  validateRequest(registrationValidation),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await AuthController.register(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/login",
  validateRequest(loginValidation),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await AuthController.login(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/logout",
  verifyAuthToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await AuthController.logout(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/me",
  verifyAuthToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await AuthController.getCurrentUser(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export default router;