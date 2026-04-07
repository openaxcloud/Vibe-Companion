import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

interface JwtUserPayload extends JwtPayload {
  id: string;
  email?: string;
  role?: string;
}

interface SocketUser {
  id: string;
  email?: string;
  role?: string;
}

interface ServerToClientEvents {
  'connection:authenticated': (payload: { user: SocketUser }) => void;
  'connection:error': (payload: { message: string }) => void;
  'room:joined': (payload: { room: string }) => void;
  'room:left': (payload: { room: string }) => void;
  'room:error': (payload: { message: string; room?: string }) => void;
  'message:receive': (payload: {
    room: string;
    sender: SocketUser;
    content: string;
    createdAt: string;
    messageId: string;
  }) => void;
  'user:joined': (payload: { room: string; user: SocketUser }) => void;
  'user:left': (payload: { room: string; user: SocketUser }) => void;
  'heartbeat:pong': (payload: { timestamp: number }) => void;
}

interface ClientToServerEvents {
  'connection:handshake': (payload: { token?: string }) => void;
  'room:join': (payload: { room: string }, callback?: (response: { ok: boolean; error?: string }) => void) => void;
  'room:leave': (payload: { room: string }, callback?: (response: { ok: boolean; error?: string }) => void) => void;
  'message:send': (
    payload: { room: string; content: string },
    callback?: (response: { ok: boolean; error?: string; messageId?: string }) => void
  ) => void;
  'heartbeat:ping': (payload: { timestamp: number }) => void;
}

interface InterServerEvents {
  'room:broadcast': (payload: {
    room: string;
    event: string;
    data: unknown;
  }) => void;
}

interface SocketData {
  user?: SocketUser;
  authenticated: boolean;
}

export interface SocketServerConfig {
  httpServer: HttpServer;
  jwtSecret: string;
  corsOrigin?: string | RegExp | Array<string | RegExp>;
  corsCredentials?: boolean;
  path?: string;
}

export type TypedIOServer = IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_CORS_CREDENTIALS = true;
const DEFAULT_SOCKET_PATH = '/socket.io';

function extractTokenFromSocket(socket: TypedSocket): string | undefined {
  const queryToken = typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : undefined;

  if (queryToken) return queryToken;

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (typeof cookieHeader === 'string') {
    try {
      const cookies = parseCookie(cookieHeader);
      if (cookies && typeof cookies.token === 'string') {
        return cookies.token;
      }
      if (cookies && typeof cookies.access_token === 'string') {
        return cookies.access_token;
      }
    } catch {
      // ignore cookie parse errors
    }
  }

  return undefined;
}

function verifyJwtToken(token: string, jwtSecret: string): SocketUser | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtUserPayload;
    if (!decoded || typeof decoded !== 'object' || !decoded.id) {
      return null;
    }
    const user: SocketUser = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return user;
  } catch {
    return null;
  }
}

function setupAuthentication(io: TypedIOServer, jwtSecret: string): void {
  io.use((socket, next) => {
    socket.data.authenticated = false;

    const token = extractTokenFromSocket(socket);
    if (!token) {
      return next();
    }

    const user = verifyJwtToken(token, jwtSecret);
    if (!user) {
      return next();
    }

    socket.data.user = user;
    socket.data.authenticated = true;
    return next();
  });
}

function handleConnectionEvents(socket: TypedSocket): void {
  socket.on('connection:handshake', () => {
    if (socket.data.authenticated && socket.data.user) {
      socket.emit('connection:authenticated', { user: socket.data.user });
    } else {
      socket.emit('connection:error', { message: 'Unauthenticated socket connection' });
    }
  });
}

function handleRoomEvents(io: TypedIOServer, socket: TypedSocket): void {
  socket.on('room:join', (payload, callback) => {
    if (!socket.data.authenticated || !socket.data.user) {
      if (callback) callback({ ok: false, error: 'Unauthorized' });
      socket.emit('room:error', { message: 'Unauthorized' });
      return;
    }

    const room = payload?.room?.trim();
    if (!room) {
      if (callback) callback({ ok: false, error: 'Room is required' });
      socket.emit('room:error', { message: 'Room is required' });
      return;
    }

    socket.join(room);
    socket.emit('room:joined', { room });
    socket.to(room).emit('user:joined', { room, user: socket.data.user });

    if (callback) callback({ ok: true });
  });

  socket.on('room:leave', (payload, callback) => {
    if (!socket.data.authenticated || !socket.data.user) {
      if (callback) callback({ ok: false, error: 'Unauthorized' });
      socket.emit('room:error', { message: 'Unauthorized' });
      return;
    }

    const room = payload?.room?.trim();
    if (!room) {
      if (callback) callback({ ok: false, error: 'Room is required' });
      socket.emit('room:error', { message: 'Room is required' });
      return;
    }

    socket.leave(room);
    socket.emit('room:left', { room });
    socket.to(room).emit('user:left', { room, user: socket.data.user });

    if (callback) callback({ ok: true });
  });

  io.on('room:broadcast', ({ room, event, data }) => {
    io.to(room).emit(event, data);
  });
}

function handleMessageEvents(io: TypedIOServer, socket: TypedSocket): void {
  socket.on('message:send', (payload, callback) => {
    if (!socket.data.authenticated || !socket.data.user) {
      if (callback) callback({ ok: false, error: 'Unauthorized' });
      socket.emit('room:error', { message: 'Unauthorized' });
      return;
    }

    const room = payload?.room?.trim();
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';

    if (!room) {
      if (callback) callback({ ok: false, error: 'Room is required' });
      socket.emit('room:error', { message: 'Room is required' });
      return;
    }

    if (!content) {
      if (callback) callback({ ok: false, error: 'Message content is required' });
      return;
    }

    const createdAt = new Date().toISOString();
    const messageId = `undefined-undefined`;

    io.to(room).emit('message:receive', {
      room,
      sender: socket.data.user,
      content,
      createdAt,
      messageId,
    });

    if (callback) callback({ ok: true, messageId });
  });
}

function handleHeartbeatEvents(socket: TypedSocket): void {
  socket.on('heartbeat:ping', (payload) => {
    const timestamp = typeof payload?.timestamp === 'number' ? payload.timestamp : Date.now();
    socket.emit('heartbeat:pong', { timestamp });
  });
}

function registerSocketHandlers(io: TypedIOServer): void {
  io.on('connection', (socket: TypedSocket) => {
    handleConnectionEvents(socket);
    handleRoomEvents(io, socket);
    handleMessageEvents(io, socket);
    handleHeartbeatEvents(socket);

    socket.on('disconnect', () => {
      // Reserved for future cleanup logic if necessary
    });
  });
}

export function createSocketServer(config: SocketServerConfig): TypedIOServer {
  const {
    httpServer,
    jwtSecret,
    corsOrigin = DEFAULT_CORS_ORIGIN,
    corsCredentials = DEFAULT_CORS_CREDENTIALS,
    path = DEFAULT_SOCKET_PATH,
  } = config;

  const io: TypedIOServer = new IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      path,
      cors: {
        origin: cors