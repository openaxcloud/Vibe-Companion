import { Router } from 'express';
import authRouter from './auth';
import projectsRouter from './projects';
import boardsRouter from './boards';
import tasksRouter from './tasks';
import sprintsRouter from './sprints';
import timeEntriesRouter from './timeEntries';
import commentsRouter from './comments';
import attachmentsRouter from './attachments';
import activitiesRouter from './activities';
import workflowsRouter from './workflows';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/boards', boardsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/sprints', sprintsRouter);
apiRouter.use('/time-entries', timeEntriesRouter);
apiRouter.use('/comments', commentsRouter);
apiRouter.use('/attachments', attachmentsRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/workflows', workflowsRouter);

const rootRouter = Router();

rootRouter.use('/api', apiRouter);

export default rootRouter;