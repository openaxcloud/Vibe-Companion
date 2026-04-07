import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { validationResult, param, body, query } from 'express-validator';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ArticleService } from '../services/article.service';

type AnyObject = Record<string, unknown>;

interface StandardResponse<T = AnyObject> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: AnyObject | AnyObject[];
  };
}

const buildSuccess = <T = AnyObject>(data: T): StandardResponse<T> => ({
  success: true,
  data,
});

const buildError = (
  message: string,
  code?: string,
  details?: AnyObject | AnyObject[],
): StandardResponse => ({
  success: false,
  error: { message, code, details },
});

const handleExpressValidation = (req: Request) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    (error as any).status = httpStatus.BAD_REQUEST;
    (error as any).details = errors.array();
    throw error;
  }
};

const asyncHandler =
  (
    fn: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<Response | void>,
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export const userValidation = {
  createUser: [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password too short'),
    body('name').isString().isLength({ min: 1 }).withMessage('Name is required'),
  ],
  getUserById: [param('id').isUUID().withMessage('Invalid user id')],
  listUsers: [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  updateUser: [
    param('id').isUUID().withMessage('Invalid user id'),
    body('name').optional().isString().isLength({ min: 1 }),
    body('password').optional().isLength({ min: 8 }),
  ],
  deleteUser: [param('id').isUUID().withMessage('Invalid user id')],
};

export const authValidation = {
  login: [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
  ],
  refreshToken: [body('refreshToken').isString().isLength({ min: 1 })],
};

export const articleValidation = {
  createArticle: [
    body('title').isString().isLength({ min: 1 }).withMessage('Title is required'),
    body('content').isString().isLength({ min: 1 }).withMessage('Content is required'),
  ],
  getArticleById: [param('id').isUUID().withMessage('Invalid article id')],
  listArticles: [
    query('authorId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  updateArticle: [
    param('id').isUUID().withMessage('Invalid article id'),
    body('title').optional().isString().isLength({ min: 1 }),
    body('content').optional().isString().isLength({ min: 1 }),
  ],
  deleteArticle: [param('id').isUUID().withMessage('Invalid article id')],
};

export class UserController {
  private userService: UserService;

  constructor(userService?: UserService) {
    this.userService = userService ?? new UserService();
  }

  createUser = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { email, password, name } = req.body;
    const user = await this.userService.createUser({ email, password, name });

    return res.status(httpStatus.CREATED).json(buildSuccess(user));
  });

  getUserById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { id } = req.params;
    const user = await this.userService.getUserById(id);

    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json(buildError('User not found', 'USER_NOT_FOUND'));
    }

    return res.status(httpStatus.OK).json(buildSuccess(user));
  });

  listUsers = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await this.userService.listUsers({ limit, offset });

    return res.status(httpStatus.OK).json(buildSuccess(result));
  });

  updateUser = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { id } = req.params;
    const { name, password } = req.body;

    const updated = await this.userService.updateUser(id, { name, password });

    if (!updated) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json(buildError('User not found', 'USER_NOT_FOUND'));
    }

    return res.status(httpStatus.OK).json(buildSuccess(updated));
  });

  deleteUser = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { id } = req.params;
    const deleted = await this.userService.deleteUser(id);

    if (!deleted) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json(buildError('User not found', 'USER_NOT_FOUND'));
    }

    return res.status(httpStatus.NO_CONTENT).send();
  });
}

export class AuthController {
  private authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService ?? new AuthService();
  }

  login = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { email, password } = req.body;
    const result = await this.authService.login(email, password);

    if (!result) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json(buildError('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    return res.status(httpStatus.OK).json(buildSuccess(result));
  });

  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { refreshToken } = req.body;
    const result = await this.authService.refreshToken(refreshToken);

    if (!result) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json(buildError('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));
    }

    return res.status(httpStatus.OK).json(buildSuccess(result));
  });
}

export class ArticleController {
  private articleService: ArticleService;

  constructor(articleService?: ArticleService) {
    this.articleService = articleService ?? new ArticleService();
  }

  createArticle = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { title, content } = req.body;
    const authorId = (req as any).user?.id as string | undefined;

    if (!authorId) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json(buildError('Unauthorized', 'UNAUTHORIZED'));
    }

    const article = await this.articleService.createArticle({
      title,
      content,
      authorId,
    });

    return res.status(httpStatus.CREATED).json(buildSuccess(article));
  });

  getArticleById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const { id } = req.params;
    const article = await this.articleService.getArticleById(id);

    if (!article) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json(buildError('Article not found', 'ARTICLE_NOT_FOUND'));
    }

    return res.status(httpStatus.OK).json(buildSuccess(article));
  });

  listArticles = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    handleExpressValidation(req);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const authorId = req.query.authorId as string | undefined;

    const result = await this.articleService.listArticles({
      limit,
      offset,
      authorId,
    });

    return res.status(httpStatus.OK).json(buildSuccess(result));
  });

  updateArticle = asyncHandler(async (req: Request, res: