import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import {
  listTasks,
  createTask,
  updateTask,
  toggleTaskComplete,
  deleteTask,
} from '../services/tasksService';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z
    .string()
    .datetime()
    .optional(),
  projectId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  dueDate: z
    .string()
    .datetime()
    .nullable()
    .optional(),
  projectId: z.string().uuid().nullable().optional(),
});

const toggleTaskSchema = z.object({
  completed: z.boolean(),
});

const parseIdParam = (req: Request, _res: Response, next: NextFunction): void => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    next(new Error('Task ID is required'));
    return;
  }
  next();
};

const handleZodError = (error: unknown, res: Response): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.flatten(),
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await listTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createTaskSchema.parse(req.body);
    const task = await createTask(parsed);
    res.status(201).json(task);
  } catch (error) {
    handleZodError(error, res);
  }
});

router.put('/:id', parseIdParam, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = updateTaskSchema.parse(req.body);
    const task = await updateTask(id, parsed);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    handleZodError(error, res);
  }
});

router.patch('/:id/toggle', parseIdParam, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = toggleTaskSchema.parse(req.body);
    const task = await toggleTaskComplete(id, parsed.completed);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    handleZodError(error, res);
  }
});

router.delete('/:id', parseIdParam, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const success = await deleteTask(id);
    if (!success) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;