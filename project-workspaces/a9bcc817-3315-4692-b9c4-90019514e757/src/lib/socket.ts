import { io, Socket } from 'socket.io-client';
import { Message, Reaction } from '../types';

// Wrap socket creation for reuse

const URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const socket: Socket = io(URL, {
  autoConnect: false,
  withCredentials: true,
});

// define client side socket events typings
type ClientToServerEvents = {
  'message:send': (payload: Message) => void;
  'reaction:add': (payload: { messageId: string; reaction: Reaction }) => void;
  'typing:start': (payload: { channelId: string | null }) => void;
  'typing:stop': (payload: { channelId: string | null }) => void;
};

type ServerToClientEvents = {
  'message:new': (message: Message) => void;
  'reaction:update': (payload: { messageId: string; reactions: Reaction[] }) => void;
  'typing:update': (payload: { channelId: string | null; userId: string; isTyping: boolean }) => void;
  'presence:update': (payload: { userId: string; status: string }) => void;
};

export default socket as Socket<ClientToServerEvents, ServerToClientEvents>;
