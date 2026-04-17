
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chat';
import { Button } from './ui/button';
import { Plus, Search, MessageSquare, Trash2, Globe } from 'lucide-react';
import { Input } from './ui/input';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversations, newConversation, currentConversationId, clearConversations, searchConversations } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');

  const handleNewConversation = () => {
    const initialMessage = {
      id: 'initial',
      role: 'assistant',
      content: t('welcome_message'),
      timestamp: Date.now(),
    };
    newConversation(initialMessage);
    navigate(`/chat/${currentConversationId}`); // This might need a slight delay or useEffect in App.tsx
  };

  const filteredConversations = searchTerm ? searchConversations(searchTerm) : conversations;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col p-4 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white tracking-wide">
          <span className="text-indigo-500">AI</span> Chatbot
        </h1>
        <Button onClick={handleNewConversation} variant="ghost" size="icon" className="text-indigo-400 hover:bg-indigo-900 hover:text-white">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder={t('search_conversations')}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:border-indigo-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredConversations
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((conv) => (
            <NavLink
              key={conv.id}
              to={`/chat/${conv.id}`}
              className={({ isActive }) =>
                `flex items-center p-3 rounded-lg text-gray-300 hover:bg-gray-800 mb-2 transition-colors duration-200 ${
                  isActive ? 'bg-indigo-700 text-white' : ''
                }`
              }
            >
              <MessageSquare className="h-4 w-4 mr-3" />
              <span className="flex-1 truncate">{conv.title}</span>
            </NavLink>
          ))}
        {filteredConversations.length === 0 && searchTerm && (
          <p className="text-gray-500 text-center mt-4">{t('no_conversations_found')}</p>
        )}
        {filteredConversations.length === 0 && !searchTerm && (
          <p className="text-gray-500 text-center mt-4">{t('start_new_conversation')}</p>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-400">{t('language')}</span>
          <div className="flex space-x-2">
            <Button
              onClick={() => changeLanguage('en')}
              variant="ghost"
              size="sm"
              className={`text-gray-400 hover:text-white ${i18n.language === 'en' ? 'bg-indigo-700 text-white' : ''}`}
            >
              EN
            </Button>
            <Button
              onClick={() => changeLanguage('es')}
              variant="ghost"
              size="sm"
              className={`text-gray-400 hover:text-white ${i18n.language === 'es' ? 'bg-indigo-700 text-white' : ''}`}
            >
              ES
            </Button>
          </div>
        </div>
        <Button
          onClick={clearConversations}
          variant="ghost"
          className="w-full text-red-400 hover:bg-red-900 hover:text-white justify-start"
        >
          <Trash2 className="h-4 w-4 mr-3" />
          {t('clear_all_conversations')}
        </Button>
      </div>
    </div>
  );
};
