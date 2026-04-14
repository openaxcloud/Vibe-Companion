export interface User {
  id: string;
  username: string;
  email: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  socketId: string;
  joinedAt: Date;
  lastSeen?: Date;
}

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private';
  description?: string;
  members: string[];
  createdBy?: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  username: string;
  channelId?: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  reactions: { [emoji: string]: string[] };
  replies: string[];
  parentMessageId?: string;
  timestamp: Date;
}

export interface DirectMessage {
  id: string;
  content: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  reactions: { [emoji: string]: string[] };
  timestamp: Date;
}

export interface TypingUser {
  userId: string;
  username: string;
  channelId: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'mention' | 'dm';
  data?: any;
  timestamp: Date;
}