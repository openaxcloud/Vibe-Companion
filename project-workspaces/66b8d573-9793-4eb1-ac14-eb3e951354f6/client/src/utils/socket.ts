import { io, Socket } from 'socket.io-client';
import { Message, Channel, User } from '../types';

interface ServerToClientEvents {
  'channel:created': (channel: Channel) => void;
  'message:new': (message: Message) => void;
  'user:typing': (data: { channelId: string; userId: string }) => void;
  'user:status': (user: User) => void;
  'message:read': (data: { messageId: string; userId: string }) => void;
}

interface ClientToServerEvents {
  'channel:create': (channel: { name: string; isPrivate: boolean }) => void;
  'message:send': (message: Partial<Message>) => void;
  'user:typing': (data: { channelId: string }) => void;
  'message:read': (data: { messageId: string }) => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const initSocket = (token: string) => {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      auth: { token },
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) throw new Error('Socket not initialized');
  return socket;
};
