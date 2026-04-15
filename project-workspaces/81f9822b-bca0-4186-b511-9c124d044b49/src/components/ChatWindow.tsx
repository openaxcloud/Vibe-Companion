import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useChat } from '../context/ChatContext';
import { useTranslation } from 'react-i18next';

const ChatWindow: React.FC = () => {
  const { t } = useTranslation();
  const { currentConversation, loading, error, clearError } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages, loading]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 rounded-xl shadow-2xl p-6 lg:p-8 border border-white/10 overflow-hidden">
      <h1 className="text-3xl font-bold text-slate-50 mb-6 pb-4 border-b border-slate-700">
        {t('chat.title')}
      </h1>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {currentConversation?.messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {!currentConversation?.messages.length && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-lg">
            <p>{t('chat.no_history')}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-800 text-white rounded-md text-sm animate-fade-in">
          {error}
        </div>
      )}

      <ChatInput />
    </div>
  );
};

export default ChatWindow;