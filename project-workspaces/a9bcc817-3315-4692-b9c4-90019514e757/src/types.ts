export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface Message {
  id: string;
  channelId: string | null; // null for direct message
  senderId: string;
  content: string;
  createdAt: string;
  type: 'text' | 'image' | 'file';
  threadRootId?: string; // points to parent message id for threads
  reactions?: Reaction[];
  readBy: string[]; // userIds
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  memberIds: string[];
  description?: string;
}
