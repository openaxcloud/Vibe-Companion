import { Router } from 'express';
import authRouter from './auth';
import usersRouter from './users';
import channelsRouter from './channels';
import messagesRouter from './messages';
import uploadsRouter from './uploads';
import notificationsRouter from './notifications';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/channels', channelsRouter);
router.use('/messages', messagesRouter);
router.use('/uploads', uploadsRouter);
router.use('/notifications', notificationsRouter);

export default router;