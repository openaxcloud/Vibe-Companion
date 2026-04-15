import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { Conversation } from '../../types/index';

interface ChatWindowProps {
  conversation: Conversation | null;
  isTyping: boolean;
  showTimestamps?: boolean;
}

export function ChatWindow({ conversation, isTyping, showTimestamps = true }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, isTyping]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center dark:bg-primary-900">
            <svg 
              className="w-8 h-8 text-primary-600 dark:text-primary-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-white">
            Welcome to AI Chatbot
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto dark:text-gray-400">
            Start a conversation by creating a new chat or selecting an existing one from the sidebar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-white p-4 scrollbar-thin dark:bg-gray-900"
    >
      <div className="max-w-4xl mx-auto">
        {/* Conversation header */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2 dark:text-white">
            {conversation.title}
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Model: {conversation.settings.model} • 
            Temperature: {conversation.settings.temperature} • 
            Max Tokens: {conversation.settings.maxTokens}
          </div>
        </div>

        {/* Messages */}
        {conversation.messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center dark:bg-gray-800">
              <svg 
                className="w-6 h-6 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" 
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversation.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamps}
              />
            ))}
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}