export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
}

export interface Channel {
  _id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: User[];
  admins: User[];
  createdBy: User;
  createdAt: Date;
}

export interface Reaction {
  emoji: string;
  users: User[];
}

export interface Attachment {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface ReadReceipt {
  user: User;
  readAt: Date;
}

export interface Message {
  _id: string;
  content: string;
  sender: User;
  channel?: Channel;
  recipient?: User;
  parentMessage?: Message;
  reactions: Reaction[];
  attachments: Attachment[];
  readBy: ReadReceipt[];
  edited: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export interface DirectMessageConversation {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
}