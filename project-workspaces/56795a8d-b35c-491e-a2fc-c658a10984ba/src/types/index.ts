export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface Message {
  id: string;
  sender: User;
  channelId: string;
  content: string;
  timestamp: string;
  reactions: { [key: string]: string[] }; // e.g., { ':heart:': ['user1_id', 'user2_id'] }
  threadId?: string; // If part of a thread
  file?: FileAttachment;
  image?: ImageAttachment;
}

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  members: string[]; // array of user IDs
  lastMessage?: string;
  unreadCount?: number;
  topic?: string;
}

export interface FileAttachment {
  filename: string;
  url: string;
  filetype: string;
  size: number;
}

export interface ImageAttachment {
  filename: string;
  url: string;
  width: number;
  height: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface ChatState {
  channels: Channel[];
  directMessages: Channel[];
  selectedChannelId: string | null;
  messages: Message[];
  usersOnline: string[]; // array of user IDs
  typingUsers: { [channelId: string]: string[] }; // { 'channel1': ['user1', 'user2'] }
  unreadMessages: { [channelId: string]: number };
  threads: { [messageId: string]: Message[] }; // messages in a thread
}
