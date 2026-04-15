import React from 'react';
import { Link } from 'react-router-dom';
import { Message } from '../lib/api';

interface SidebarProps {
  conversations: { id: string; title: string; messages: Message[]; createdAt: string; }[];
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  currentChatId: string | null;
  onSearch: (query: string) => void;
  searchQuery: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  onNewChat,
  onSelectChat,
  currentChatId,
  onSearch,
  searchQuery,
}) => {
  return (
    <div className="flex flex-col bg-slate-900 border-r border-slate-800 p-4 w-72 flex-shrink-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-indigo-400">AI Chatbot</h2>
        <button
          onClick={onNewChat}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
          title="Start New Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search conversations..."
          className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
        {conversations.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No conversations yet.</p>
        ) : (
          conversations.map((conv) => (
            <Link
              key={conv.id}
              to={`/chat/${conv.id}`}
              onClick={() => onSelectChat(conv.id)}
              className={`block p-3 mb-2 rounded-lg transition-colors duration-200 \
                ${conv.id === currentChatId ? 'bg-indigo-700/50 border border-indigo-600' : 'bg-slate-800 hover:bg-slate-700'}
              `}
            >
              <p className="text-slate-100 font-medium truncate">{conv.title || 'Untitled Chat'}</p>
              <p className="text-slate-400 text-xs mt-1">{new Date(conv.createdAt).toLocaleString()}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
