import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { IncomingMessage } from 'http';

type UserPayload = {
  id: string;
  email?: string;
  roles?: string[];
} & JwtPayload;

export interface AuthenticatedSocket extends Socket {
  user?: UserPayload;
}

export interface SocketServerOptions {
  corsOrigin?: string | string[];
  jwtSecret: string;
  path?: string;
}

let io: SocketIOServer | null = null;

const getTokenFromHandshake = (socket: Socket): string | null => {
  const { auth, headers } = socket.handshake;

  if (auth && typeof auth === 'object' && typeof auth.token === 'string') {
    return auth.token;
  }

  const authHeader = headers?.authorization || headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const tokenQuery = socket.handshake.query?.token;
  if (typeof tokenQuery === 'string') {
    return tokenQuery;
  }

  return null;
};

const authenticateSocket = (socket: AuthenticatedSocket, jwtSecret: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const token = getTokenFromHandshake(socket);

    if (!token) {
      return reject(new Error('Authentication token missing'));
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err || !decoded) {
        return reject(new Error('Invalid authentication token'));
      }

      socket.user = decoded as UserPayload;
      resolve();
    });
  });
};

const getClientIp = (socket: Socket): string | undefined => {
  const handshakeAddress = socket.handshake.address;
  const headers = socket.handshake.headers;
  const xForwardedFor = headers['x-forwarded-for'];

  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0].split(',')[0].trim();
  }

  if (typeof handshakeAddress === 'string') {
    return handshakeAddress;
  }

  if (typeof handshakeAddress === 'object' && handshakeAddress && 'address' in handshakeAddress) {
    return (handshakeAddress as IncomingMessage['socket']).remoteAddress || undefined;
  }

  return undefined;
};

export const initSocketServer = (httpServer: HttpServer, options: SocketServerOptions): SocketIOServer => {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: options.path || '/socket.io',
    cors: {
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
    allowEIO3: false
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      await authenticateSocket(socket, options.jwtSecret);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const ip = getClientIp(socket);
    const userId = socket.user?.id || 'unknown';

    // Example: join user-specific room
    if (socket.user?.id) {
      socket.join(`user:undefined`);
    }

    socket.emit('connected', {
      message: 'Socket connection established',
      userId: socket.user?.id,
      ip
    });

    socket.on('disconnect', (reason: string) => {
      // Cleanup or logging can be added here
    });

    socket.on('error', (err: Error) => {
      // Error handling / logging hook
    });
  });

  return io;
};

export const getSocketServer = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO server has not been initialized. Call initSocketServer first.');
  }
  return io;
};

export type { SocketIOServer as IOServer };