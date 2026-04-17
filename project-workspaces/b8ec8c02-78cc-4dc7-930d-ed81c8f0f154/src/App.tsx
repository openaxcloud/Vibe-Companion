import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Channel, Message } from './types';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import { Loader } from './components/Loader';

interface InitData {
  user: User;
  users: User[];
  channels: Channel[];
  messages: Record<string, Message[]>;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Simulate login: choose 1 of the server users
    const loginUserId = prompt('Enter your user ID (for demo use alice or bob ID):');
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { userId: loginUserId },
    });

    socketRef.current = socket;

    socket.on('init', (data: InitData) => {
      setUser(data.user);
      setUsers(data.users);
      setChannels(data.channels);
      setMessages(data.messages);
      if (data.channels.length > 0) {
        setCurrentChannelId(data.channels[0].id);
      }
      setIsLoading(false);
    });

    // New message received
    socket.on('new-message', (message: Message) => {
      setMessages(prev => ({
        ...prev,
        [message.channelId]: [...(prev[message.channelId] || []), message],
      }));
    });

    // User status update
    socket.on('user-status', ({ userId, status }) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    });

    // Typing indicator
    socket.on('typing', ({ userId, isTyping }) => {
      // For simplicity, not implemented here
    });

    // Reaction update
    socket.on('message-reacted', ({ messageId, emoji, userId, add }) => {
      setMessages(prev => {
        const newMessages = { ...prev };
        for (const channelId in newMessages) {
          newMessages[channelId] = newMessages[channelId].map(m => {
            if (m.id === messageId) {
              const reactions = { ...m.reactions };
              if (add) {
                if (!reactions[emoji]) reactions[emoji] = [];
                if (!reactions[emoji].includes(userId)) reactions[emoji].push(userId);
              } else {
                reactions[emoji] = reactions[emoji].filter(uid => uid !== userId);
                if (reactions[emoji].length === 0) delete reactions[emoji];
              }
              return { ...m, reactions };
            }
            return m;
          });
        }
        return newMessages;
      });
    });

    // Read receipt update
    socket.on('message-read', ({ messageId, userId }) => {
      setMessages(prev => {
        const newMessages = { ...prev };
        for (const channelId in newMessages) {
          newMessages[channelId] = newMessages[channelId].map(m => {
            if (m.id === messageId) {
              const isReadBy = m.isReadBy.includes(userId) ? m.isReadBy : [...m.isReadBy, userId];
              return { ...m, isReadBy };
            }
            return m;
          });
        }
        return newMessages;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (isLoading || !user) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen max-w-7xl mx-auto">
      <Sidebar
        user={user}
        users={users}
        channels={channels}
        currentChannelId={currentChannelId}
        onChannelSelect={setCurrentChannelId}
      />
      {currentChannelId && (
        <ChatWindow
          user={user}
          channel={channels.find(c => c.id === currentChannelId)!}
          messages={messages[currentChannelId] || []}
          socket={socketRef.current!}
        />
      )}
    </div>
  );
};

export default App;
