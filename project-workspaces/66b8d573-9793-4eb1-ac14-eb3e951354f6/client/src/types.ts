export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away' | 'dnd';
}

export interface Message {
  id: string;
  channelId: string;
  sender: User;
  content: string;
  createdAt: string;
  reactions: Record<string, string[]>; // emoji -> array of userIds
  parentId?: string; // if thread
  attachments?: Attachment[];
  readBy: string[]; // userIds who have read
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  members: string[]; // userIds
  lastMessage?: Message;
}
