import React from 'react';
import { Message } from '../../../shared/types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-primary-500 text-white rounded-br-md'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          <p className="text-sm md:text-base whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        <div
          className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'order-1 mr-3' : 'order-2 ml-3'}`}>
        {isUser ? (
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">U</span>
          </div>
        ) : (
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">AI</span>
          </div>
        )}
      </div>
    </div>
  );
};