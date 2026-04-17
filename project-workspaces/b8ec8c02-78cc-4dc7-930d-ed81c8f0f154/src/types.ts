export interface User {
  id: string;
  username: string;
  avatar: string;
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  createdAt: string;
  reactions: Record<string, string[]>; // emoji to array of userIds
  thread?: Message[];
  isReadBy: string[]; // userIds
  file?: {
    url: string;
    type: 'image' | 'file';
    name: string;
  };
  replyTo?: string; // message id
}

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  members: string[]; // userIds
  type: 'public' | 'private' | 'direct';
  displayName: string; // shown in UI
}
