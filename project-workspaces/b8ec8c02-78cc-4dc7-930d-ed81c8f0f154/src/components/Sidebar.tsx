import React from 'react';
import { User, Channel } from '../types';
import { Users, Hash, MessageCircle } from 'lucide-react';

interface SidebarProps {
  user: User;
  users: User[];
  channels: Channel[];
  currentChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, users, channels, currentChannelId, onChannelSelect }) => {
  return (
    <aside className="w-full md:w-72 bg-white/5 backdrop-blur-xl border border-white/10 shadow-glow flex flex-col p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary-400">ChatSphere</h1>
        <img
          src={user.avatar}
          alt={user.username}
          className="w-10 h-10 rounded-full border-2 border-primary-400"
          title={`${user.username} (${user.status})`}
        />
      </header>
      <nav className="flex-1 overflow-y-auto">
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-slate-400">Channels</h2>
          <ul>
            {channels.filter(c => c.type !== 'direct').map(channel => (
              <li
                key={channel.id}
                onClick={() => onChannelSelect(channel.id)}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer select-none transition-all duration-200 ease-out hover:bg-primary-600 hover:text-white ${
                  currentChannelId === channel.id ? 'bg-primary-700 text-white font-semibold' : 'text-slate-300'
                }`}
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') onChannelSelect(channel.id); }}
                aria-current={currentChannelId === channel.id ? 'true' : undefined}
              >
                <Hash className="w-5 h-5" />
                <span>{channel.displayName}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2 text-slate-400">Direct Messages</h2>
          <ul>
            {channels.filter(c => c.type === 'direct' && c.members.includes(user.id)).map(channel => {
              const otherUserId = channel.members.find(uid => uid !== user.id) as string;
              const otherUser = users.find(u => u.id === otherUserId) || { username: 'Unknown', avatar: '', status: 'offline' };
              const isActive = currentChannelId === channel.id;
              return (
                <li
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer select-none transition-all duration-200 ease-out hover:bg-primary-600 hover:text-white ${
                    isActive ? 'bg-primary-700 text-white font-semibold' : 'text-slate-300'
                  }`}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') onChannelSelect(channel.id); }}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <img src={otherUser.avatar} alt={otherUser.username} className="w-6 h-6 rounded-full" />
                  <span>{otherUser.username}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </nav>
    </aside>
  );
};

export default Sidebar;
