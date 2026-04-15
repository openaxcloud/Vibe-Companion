import React from 'react';
import { Message } from '../../types/index';
import { formatDistanceToNow } from '../utils/dateUtils';

interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
}

export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[80%]">
        <div
          className={`
            px-4 py-3 rounded-2xl break-words
            ${isUser 
              ? 'bg-primary-600 text-white ml-auto rounded-br-md' 
              : 'bg-gray-100 text-gray-900 mr-auto rounded-bl-md dark:bg-gray-700 dark:text-gray-100'
            }
          `}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
          
          {message.metadata?.tokens && (
            <div className={`text-xs mt-2 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
              {message.metadata.tokens} tokens
              {message.metadata.processingTime && 
                ` • ${message.metadata.processingTime}ms`
              }
            </div>
          )}
        </div>
        
        {showTimestamp && (
          <div className={`text-xs text-gray-500 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {formatDistanceToNow(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}