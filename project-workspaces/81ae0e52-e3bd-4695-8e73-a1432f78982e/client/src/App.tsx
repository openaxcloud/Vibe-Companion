import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import ChatLayout from './components/ChatLayout';
import { useSocket } from './contexts/SocketContext';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (socket) {
      socket.on('user_authenticated', (data) => {
        setUser(data.user);
      });

      return () => {
        socket.off('user_authenticated');
      };
    }
  }, [socket]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Login onLogin={setUser} />
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <ChatLayout user={user} />
      <Toaster position="top-right" />
    </div>
  );
}

export default App;