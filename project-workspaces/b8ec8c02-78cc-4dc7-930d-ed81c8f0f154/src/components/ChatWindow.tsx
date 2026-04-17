import React, { useState, useEffect, useRef } from 'react';
import { User, Channel, Message } from '../types';
import { Paperclip, Send, Smile, Loader as LoaderIcon, ThumbsUp } from 'lucide-react';

interface ChatWindowProps {
  user: User;
  channel: Channel;
  messages: Message[];
  socket: import('socket.io-client').Socket;
}

const ReactionPicker: React.FC<{ onSelect: (emoji: string) => void }> = ({ onSelect }) => {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '👀'];
  return (
    <div className="absolute bottom-full mb-1 flex gap-2 bg-white/10 rounded backdrop-blur-lg p-1">
      {emojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-lg hover:scale-110 transition-transform"
          aria-label={`Add reaction ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({ user, channel, messages, socket }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;
    if (isTyping) {
      socket.emit('typing', { channelId: channel.id, isTyping: true });
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        socket.emit('typing', { channelId: channel.id, isTyping: false });
      }, 3000);
    }
    return () => {
      clearTimeout(typingTimeout);
      socket.emit('typing', { channelId: channel.id, isTyping: false });
    };
  }, [isTyping, socket, channel.id]);

  useEffect(() => {
    socket.on('typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: isTyping }));
    });
    return () => {
      socket.off('typing');
    };
  }, [socket]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    socket.emit('send-message', { channelId: channel.id, content: newMessage.trim() });
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let fileType: 'image' | 'file' = 'file';
      if (file.type.startsWith('image/')) {
        fileType = 'image';
      }
      socket.emit('send-message', {
        channelId: channel.id,
        content: '',
        file: { url: reader.result, type: fileType, name: file.name },
      });
    };
    reader.readAsDataURL(file);

    // Reset the input
    e.target.value = '';
  };

  const toggleReactionPicker = (messageId: string) => {
    setShowReactionPickerFor(showReactionPickerFor === messageId ? null : messageId);
  };

  const handleReactionSelect = (emoji: string) => {
    if (!showReactionPickerFor) return;
    socket.emit('react-message', { channelId: channel.id, messageId: showReactionPickerFor, emoji, add: true });
    setShowReactionPickerFor(null);
  };

  return (
    <main className="flex flex-col flex-grow bg-white/5 backdrop-blur-xl border border-white/10 shadow-glow rounded-lg m-4 p-4 max-w-4xl mx-auto">
      <header className="border-b border-white/10 pb-4 mb-4">
        <h2 className="text-4xl font-bold text-primary-400">{channel.displayName}</h2>
        {/* Typing indicator */}
        <div className="text-sm text-slate-400 mt-1">
          {Object.entries(typingUsers)
            .filter(([uid, typing]) => typing && uid !== user.id)
            .map(([uid]) => uid)
            .map(uid => {
              const typer = uid; // for demo
              return <span key={uid}>{typer} is typing...</span>;
            })}
        </div>
      </header>
      <div className="flex flex-col flex-grow overflow-y-auto max-h-[60vh] gap-3">
        {messages.map(msg => (
          <article key={msg.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded p-3 shadow-glow relative">
            <div className="flex items-center gap-3 mb-2">
              <img src={msg.author.avatar} alt={msg.author.username} className="w-10 h-10 rounded-full border-2 border-primary-400" />
              <div>
                <h3 className="font-semibold text-lg text-white">{msg.author.username}</h3>
                <time className="text-xs text-slate-400" dateTime={msg.createdAt}>
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </time>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-white text-lg mb-2">
              {msg.content}
              {msg.file && msg.file.type === 'image' && (
                <img src={msg.file.url} alt={msg.file.name} className="mt-2 max-w-xs rounded-lg" />
              )}
              {msg.file && msg.file.type === 'file' && (
                <a href={msg.file.url} download={msg.file.name} className="flex items-center gap-2 text-primary-300 hover:underline">
                  <Paperclip className="w-5 h-5" /> {msg.file.name}
                </a>
              )}
            </div>
            <footer className="flex items-center gap-4 text-sm text-slate-400">
              <button
                onClick={() => toggleReactionPicker(msg.id)}
                className="flex items-center gap-1 hover:text-primary-400 transition-colors"
                aria-label="React to message"
              >
                <Smile className="w-4 h-4" /> React
              </button>
              <div className="flex gap-2">
                {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                  <button
                    key={emoji}
                    className={`flex items-center gap-1 ${userIds.includes(user.id) ? 'text-primary-400 font-semibold' : ''}`}
                    onClick={() => {
                      const add = !userIds.includes(user.id);
                      socket.emit('react-message', { channelId: channel.id, messageId: msg.id, emoji, add });
                    }}
                    aria-label={`Toggle reaction ${emoji}`}
                  >
                    <span>{emoji}</span> {userIds.length}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-xs">
                Read by {msg.isReadBy.length}
              </div>
            </footer>
            {showReactionPickerFor === msg.id && (
              <ReactionPicker onSelect={handleReactionSelect} />
            )}
          </article>
        ))}
      </div>
      <footer className="mt-4 border-t border-white/10 pt-4 flex items-center gap-3">
        <textarea
          className="flex-grow rounded bg-white/10 resize-none p-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Type a message..."
          rows={2}
          value={newMessage}
          onChange={(e) => { setNewMessage(e.target.value); setIsTyping(true); }}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
        />
        <button
          onClick={handleSendMessage}
          className="bg-primary-500 hover:bg-primary-600 active:scale-95 transition-transform rounded p-2 text-white"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary-500 hover:bg-primary-600 active:scale-95 transition-transform rounded p-2 text-white"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          aria-label="File input"
        />
      </footer>
    </main>
  );
};

export default ChatWindow;
