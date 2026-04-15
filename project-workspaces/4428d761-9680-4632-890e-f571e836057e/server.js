const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slackclone', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['online', 'away', 'busy', 'offline'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Channel Schema
const channelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isPrivate: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const Channel = mongoose.model('Channel', channelSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For DMs
  parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // For threading
  reactions: [{
    emoji: String,
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow images and common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    res.json({ token, user: { id: user._id, username, email, avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    // Update user status to online
    await User.findByIdAndUpdate(user._id, { status: 'online', lastSeen: new Date() });

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        avatar: user.avatar,
        status: 'online'
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Channel routes
app.get('/api/channels', authenticateToken, async (req, res) => {
  try {
    const channels = await Channel.find({
      $or: [
        { isPrivate: false },
        { members: req.user.userId }
      ]
    }).populate('members', 'username email avatar status');
    
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/channels', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    
    const channel = new Channel({
      name,
      description,
      isPrivate,
      members: [req.user.userId],
      admins: [req.user.userId],
      createdBy: req.user.userId
    });
    
    await channel.save();
    await channel.populate('members', 'username email avatar status');
    
    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Message routes
app.get('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({ channel: channelId, parentMessage: null })
      .populate('sender', 'username avatar')
      .populate('reactions.users', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:messageId/replies', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const replies = await Message.find({ parentMessage: messageId })
      .populate('sender', 'username avatar')
      .populate('reactions.users', 'username')
      .sort({ createdAt: 1 });
    
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/direct-messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username avatar')
    .populate('reactions.users', 'username')
    .sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload route
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
const connectedUsers = new Map();
const typingUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      
      connectedUsers.set(decoded.userId, socket.id);
      
      // Update user status to online
      await User.findByIdAndUpdate(decoded.userId, { 
        status: 'online', 
        lastSeen: new Date() 
      });
      
      // Join user to their channels
      const channels = await Channel.find({ members: decoded.userId });
      channels.forEach(channel => {
        socket.join(channel._id.toString());
      });
      
      // Notify others about user's online status
      socket.broadcast.emit('user-status-changed', {
        userId: decoded.userId,
        status: 'online'
      });
      
    } catch (error) {
      console.error('Authentication error:', error);
    }
  });

  socket.on('join-channel', (channelId) => {
    socket.join(channelId);
  });

  socket.on('leave-channel', (channelId) => {
    socket.leave(channelId);
  });

  socket.on('send-message', async (data) => {
    try {
      const { content, channelId, recipientId, parentMessageId, attachments } = data;
      
      const message = new Message({
        content,
        sender: socket.userId,
        channel: channelId || null,
        recipient: recipientId || null,
        parentMessage: parentMessageId || null,
        attachments: attachments || []
      });
      
      await message.save();
      await message.populate('sender', 'username avatar');
      
      if (channelId) {
        io.to(channelId).emit('new-message', message);
      } else if (recipientId) {
        const recipientSocketId = connectedUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('new-message', message);
        }
        socket.emit('new-message', message);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('typing', (data) => {
    const { channelId, recipientId } = data;
    const typingKey = channelId || recipientId;
    
    if (!typingUsers.has(typingKey)) {
      typingUsers.set(typingKey, new Set());
    }
    
    typingUsers.get(typingKey).add(socket.userId);
    
    if (channelId) {
      socket.to(channelId).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        channelId
      });
    } else if (recipientId) {
      const recipientSocketId = connectedUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user-typing', {
          userId: socket.userId,
          username: socket.username
        });
      }
    }
  });

  socket.on('stop-typing', (data) => {
    const { channelId, recipientId } = data;
    const typingKey = channelId || recipientId;
    
    if (typingUsers.has(typingKey)) {
      typingUsers.get(typingKey).delete(socket.userId);
    }
    
    if (channelId) {
      socket.to(channelId).emit('user-stopped-typing', {
        userId: socket.userId,
        channelId
      });
    } else if (recipientId) {
      const recipientSocketId = connectedUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user-stopped-typing', {
          userId: socket.userId
        });
      }
    }
  });

  socket.on('add-reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      
      const message = await Message.findById(messageId);
      if (!message) return;
      
      const existingReaction = message.reactions.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        if (existingReaction.users.includes(socket.userId)) {
          existingReaction.users = existingReaction.users.filter(
            userId => userId.toString() !== socket.userId
          );
          if (existingReaction.users.length === 0) {
            message.reactions = message.reactions.filter(r => r.emoji !== emoji);
          }
        } else {
          existingReaction.users.push(socket.userId);
        }
      } else {
        message.reactions.push({
          emoji,
          users: [socket.userId]
        });
      }
      
      await message.save();
      await message.populate('reactions.users', 'username');
      
      const targetRoom = message.channel || connectedUsers.get(message.recipient?.toString());
      if (message.channel) {
        io.to(message.channel.toString()).emit('reaction-updated', {
          messageId,
          reactions: message.reactions
        });
      } else if (targetRoom) {
        io.to(targetRoom).emit('reaction-updated', {
          messageId,
          reactions: message.reactions
        });
        socket.emit('reaction-updated', {
          messageId,
          reactions: message.reactions
        });
      }
      
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  });

  socket.on('mark-as-read', async (data) => {
    try {
      const { messageId } = data;
      
      const message = await Message.findById(messageId);
      if (!message) return;
      
      const existingRead = message.readBy.find(
        r => r.user.toString() === socket.userId
      );
      
      if (!existingRead) {
        message.readBy.push({
          user: socket.userId,
          readAt: new Date()
        });
        await message.save();
        
        // Notify sender about read receipt
        const senderSocketId = connectedUsers.get(message.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message-read', {
            messageId,
            readBy: socket.userId,
            readAt: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      
      // Update user status to offline
      await User.findByIdAndUpdate(socket.userId, { 
        status: 'offline', 
        lastSeen: new Date() 
      });
      
      // Notify others about user's offline status
      socket.broadcast.emit('user-status-changed', {
        userId: socket.userId,
        status: 'offline'
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});