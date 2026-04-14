const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync('./server/uploads')) {
  fs.mkdirSync('./server/uploads', { recursive: true });
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './server/uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// In-memory data store (in production, use a database)
let users = new Map();
let channels = new Map();
let messages = new Map();
let directMessages = new Map();
let onlineUsers = new Map();
let typingUsers = new Map();
let readReceipts = new Map();

// Initialize default channels
channels.set('general', {
  id: 'general',
  name: 'general',
  type: 'public',
  description: 'General discussion',
  members: [],
  createdAt: new Date()
});

channels.set('random', {
  id: 'random',
  name: 'random',
  type: 'public',
  description: 'Random chat',
  members: [],
  createdAt: new Date()
});

// Helper functions
const generateUserId = () => uuidv4();
const generateChannelId = () => uuidv4();
const generateMessageId = () => uuidv4();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User authentication and setup
  socket.on('user_join', (userData) => {
    const userId = generateUserId();
    const user = {
      id: userId,
      username: userData.username,
      email: userData.email,
      status: 'online',
      socketId: socket.id,
      joinedAt: new Date()
    };
    
    users.set(userId, user);
    onlineUsers.set(socket.id, userId);
    socket.userId = userId;
    
    // Join default channels
    channels.forEach((channel) => {
      if (channel.type === 'public') {
        channel.members.push(userId);
        socket.join(channel.id);
      }
    });
    
    socket.emit('user_authenticated', { user, channels: Array.from(channels.values()) });
    socket.broadcast.emit('user_online', user);
    
    // Send online users list
    const onlineUsersList = Array.from(users.values()).filter(u => u.status === 'online');
    io.emit('online_users_updated', onlineUsersList);
  });

  // Channel management
  socket.on('create_channel', (channelData) => {
    const channelId = generateChannelId();
    const channel = {
      id: channelId,
      name: channelData.name,
      type: channelData.type || 'public',
      description: channelData.description || '',
      members: [socket.userId],
      createdBy: socket.userId,
      createdAt: new Date()
    };
    
    channels.set(channelId, channel);
    socket.join(channelId);
    
    if (channel.type === 'public') {
      io.emit('channel_created', channel);
    } else {
      socket.emit('channel_created', channel);
    }
  });

  socket.on('join_channel', (channelId) => {
    const channel = channels.get(channelId);
    if (channel && !channel.members.includes(socket.userId)) {
      channel.members.push(socket.userId);
      socket.join(channelId);
      socket.emit('channel_joined', channel);
      socket.to(channelId).emit('user_joined_channel', {
        channelId,
        user: users.get(socket.userId)
      });
    }
  });

  // Message handling
  socket.on('send_message', (messageData) => {
    const messageId = generateMessageId();
    const message = {
      id: messageId,
      content: messageData.content,
      userId: socket.userId,
      username: users.get(socket.userId)?.username,
      channelId: messageData.channelId,
      type: messageData.type || 'text',
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      reactions: {},
      replies: [],
      parentMessageId: messageData.parentMessageId,
      timestamp: new Date()
    };
    
    messages.set(messageId, message);
    
    // If it's a reply, add to parent message
    if (messageData.parentMessageId) {
      const parentMessage = messages.get(messageData.parentMessageId);
      if (parentMessage) {
        parentMessage.replies.push(messageId);
      }
    }
    
    io.to(messageData.channelId).emit('new_message', message);
    
    // Mark as read for sender
    if (!readReceipts.has(messageId)) {
      readReceipts.set(messageId, new Set());
    }
    readReceipts.get(messageId).add(socket.userId);
  });

  // Direct messages
  socket.on('send_direct_message', (messageData) => {
    const messageId = generateMessageId();
    const conversationId = [socket.userId, messageData.recipientId].sort().join('-');
    
    const message = {
      id: messageId,
      content: messageData.content,
      senderId: socket.userId,
      senderUsername: users.get(socket.userId)?.username,
      recipientId: messageData.recipientId,
      type: messageData.type || 'text',
      fileUrl: messageData.fileUrl,
      fileName: messageData.fileName,
      reactions: {},
      timestamp: new Date()
    };
    
    if (!directMessages.has(conversationId)) {
      directMessages.set(conversationId, []);
    }
    directMessages.get(conversationId).push(message);
    
    // Send to both users
    const recipientUser = users.get(messageData.recipientId);
    if (recipientUser) {
      io.to(recipientUser.socketId).emit('new_direct_message', message);
    }
    socket.emit('new_direct_message', message);
  });

  // Message reactions
  socket.on('add_reaction', (data) => {
    const { messageId, emoji } = data;
    const message = messages.get(messageId);
    
    if (message) {
      if (!message.reactions[emoji]) {
        message.reactions[emoji] = [];
      }
      
      if (!message.reactions[emoji].includes(socket.userId)) {
        message.reactions[emoji].push(socket.userId);
        io.to(message.channelId).emit('reaction_added', {
          messageId,
          emoji,
          userId: socket.userId,
          reactions: message.reactions
        });
      }
    }
  });

  socket.on('remove_reaction', (data) => {
    const { messageId, emoji } = data;
    const message = messages.get(messageId);
    
    if (message && message.reactions[emoji]) {
      message.reactions[emoji] = message.reactions[emoji].filter(id => id !== socket.userId);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
      
      io.to(message.channelId).emit('reaction_removed', {
        messageId,
        emoji,
        userId: socket.userId,
        reactions: message.reactions
      });
    }
  });

  // Typing indicators
  socket.on('typing_start', (data) => {
    const { channelId } = data;
    const typingKey = `${channelId}-${socket.userId}`;
    
    typingUsers.set(typingKey, {
      userId: socket.userId,
      username: users.get(socket.userId)?.username,
      channelId,
      timestamp: Date.now()
    });
    
    socket.to(channelId).emit('user_typing', {
      userId: socket.userId,
      username: users.get(socket.userId)?.username,
      channelId
    });
  });

  socket.on('typing_stop', (data) => {
    const { channelId } = data;
    const typingKey = `${channelId}-${socket.userId}`;
    
    typingUsers.delete(typingKey);
    
    socket.to(channelId).emit('user_stopped_typing', {
      userId: socket.userId,
      channelId
    });
  });

  // Read receipts
  socket.on('mark_message_read', (messageId) => {
    if (!readReceipts.has(messageId)) {
      readReceipts.set(messageId, new Set());
    }
    readReceipts.get(messageId).add(socket.userId);
    
    const message = messages.get(messageId);
    if (message) {
      socket.to(message.channelId).emit('message_read', {
        messageId,
        userId: socket.userId,
        readBy: Array.from(readReceipts.get(messageId))
      });
    }
  });

  // Status updates
  socket.on('update_status', (status) => {
    const user = users.get(socket.userId);
    if (user) {
      user.status = status;
      io.emit('user_status_updated', { userId: socket.userId, status });
    }
  });

  // Get channel messages
  socket.on('get_channel_messages', (channelId) => {
    const channelMessages = Array.from(messages.values())
      .filter(msg => msg.channelId === channelId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    socket.emit('channel_messages', { channelId, messages: channelMessages });
  });

  // Get direct messages
  socket.on('get_direct_messages', (recipientId) => {
    const conversationId = [socket.userId, recipientId].sort().join('-');
    const conversation = directMessages.get(conversationId) || [];
    socket.emit('direct_messages', { recipientId, messages: conversation });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      const user = users.get(userId);
      if (user) {
        user.status = 'offline';
        user.lastSeen = new Date();
        socket.broadcast.emit('user_offline', { userId, lastSeen: user.lastSeen });
      }
      onlineUsers.delete(socket.id);
    }
    
    // Clean up typing indicators
    for (let [key, typing] of typingUsers) {
      if (typing.userId === userId) {
        typingUsers.delete(key);
        socket.broadcast.emit('user_stopped_typing', {
          userId,
          channelId: typing.channelId
        });
      }
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype
  });
});

// Clean up old typing indicators
setInterval(() => {
  const now = Date.now();
  for (let [key, typing] of typingUsers) {
    if (now - typing.timestamp > 3000) { // 3 seconds timeout
      typingUsers.delete(key);
      io.to(typing.channelId).emit('user_stopped_typing', {
        userId: typing.userId,
        channelId: typing.channelId
      });
    }
  }
}, 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});