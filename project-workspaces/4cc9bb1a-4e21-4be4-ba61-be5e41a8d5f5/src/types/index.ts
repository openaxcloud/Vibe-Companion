export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
  bio?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  members: string[]; // User IDs
  createdBy: string;
  createdAt: Date;
  lastActivity?: Date;
  pinnedMessages?: string[]; // Message IDs
}

export interface Message {
  id: string;
  channelId?: string;
  recipientId?: string; // For direct messages
  userId: string;
  content: string;
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
  attachments?: Attachment[];
  reactions?: Reaction[];
  threadId?: string; // Parent message ID for threads
  readBy?: string[]; // User IDs who read the message
  mentions?: string[]; // User IDs mentioned in the message
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  url: string;
  size: number;
  mimeType?: string;
  thumbnail?: string;
}

export interface Reaction {
  emoji: string;
  users: string[]; // User IDs
}

export interface TypingIndicator {
  channelId?: string;
  recipientId?: string;
  userId: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'reaction' | 'channel_invite';
  title: string;
  body: string;
  data?: any;
  read: boolean;
  timestamp: Date;
}

export interface DirectMessage {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: Message;
  unreadCount?: number;
}

export interface Thread {
  id: string;
  parentMessageId: string;
  channelId: string;
  messages: Message[];
  participants: string[];
  lastActivity: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    desktop: boolean;
    sound: boolean;
    emailDigest: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    readReceipts: boolean;
  };
}