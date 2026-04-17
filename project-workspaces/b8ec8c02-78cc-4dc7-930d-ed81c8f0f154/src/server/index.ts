import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { User, Channel, Message } from '../types';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(express.static(path.join(__dirname, '../../dist')));

// In-memory data store
const users = new Map<string, User>();
const channels = new Map<string, Channel>();
const messages = new Map<string, Message[]>();

// Sample initial data
const createUser = (id: string, username: string, avatar: string): User => ({
  id,
  username,
  avatar,
  status: 'offline',
});

const user1 = createUser(uuidv4(), 'alice', 'https://i.pravatar.cc/150?img=1');
const user2 = createUser(uuidv4(), 'bob', 'https://i.pravatar.cc/150?img=2');
users.set(user1.id, user1);
users.set(user2.id, user2);

const defaultChannel: Channel = {
  id: uuidv4(),
  name: 'general',
  displayName: 'General',
  isPrivate: false,
  members: [],
  type: 'public',
};
channels.set(defaultChannel.id, defaultChannel);
messages.set(defaultChannel.id, []);

// Middleware for file upload
app.use(express.json({ limit: '10mb' }));

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Here you might ask user to authenticate or identify
  // For simplicity assume userId passed by client
  const userId = socket.handshake.query.userId as string;
  if (!userId || !users.has(userId)) {
    socket.disconnect();
    return;
  }

  const user = users.get(userId)!;
  user.status = 'online';
  io.emit('user-status', { userId, status: 'online' });

  // Join user to all their channels
  channels.forEach(channel => {
    if (!channel.isPrivate || channel.members.includes(userId)) {
      socket.join(channel.id);
    }
  });

  // Send initial data
  socket.emit('init', {
    user,
    users: Array.from(users.values()),
    channels: Array.from(channels.values()),
    messages: Array.from(messages.entries()).reduce((acc, [cid, msgs]) => {
      acc[cid] = msgs;
      return acc;
    }, {} as Record<string, Message[]>),
  });

  // Handle new message
  socket.on('send-message', (data: { channelId: string; content: string; replyTo?: string; file?: any }) => {
    const { channelId, content, replyTo, file } = data;
    if (!channels.has(channelId)) return;
    if (!content && !file) return;

    const msg: Message = {
      id: uuidv4(),
      channelId,
      author: user,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      reactions: {},
      isReadBy: [userId],
      replyTo,
    };

    if (file) {
      msg.file = {
        url: file.url,
        type: file.type,
        name: file.name,
      };
    }

    messages.get(channelId)!.push(msg);

    io.to(channelId).emit('new-message', msg);
  });

  // Handle typing indicator
  socket.on('typing', (data: { channelId: string; isTyping: boolean }) => {
    socket.to(data.channelId).emit('typing', {
      userId,
      isTyping: data.isTyping,
    });
  });

  // Handle reaction
  socket.on('react-message', (data: { messageId: string; channelId: string; emoji: string; add: boolean }) => {
    const { messageId, channelId, emoji, add } = data;
    const channelMessages = messages.get(channelId);
    if (!channelMessages) return;

    const msg = channelMessages.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    if (add) {
      if (!msg.reactions[emoji].includes(userId)) {
        msg.reactions[emoji].push(userId);
      }
    } else {
      msg.reactions[emoji] = msg.reactions[emoji].filter(u => u !== userId);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    }

    io.to(channelId).emit('message-reacted', { messageId, emoji, userId, add });
  });

  // Handle read receipt
  socket.on('read-message', (data: { channelId: string; messageId: string }) => {
    const { channelId, messageId } = data;
    const channelMessages = messages.get(channelId);
    if (!channelMessages) return;
    const msg = channelMessages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.isReadBy.includes(userId)) {
      msg.isReadBy.push(userId);
    }
    io.to(channelId).emit('message-read', { messageId, userId });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    user.status = 'offline';
    io.emit('user-status', { userId, status: 'offline' });
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
