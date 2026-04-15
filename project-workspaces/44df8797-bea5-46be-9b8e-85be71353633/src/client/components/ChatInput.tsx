import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message...",
  maxLength = 2000 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px height
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const remainingChars = maxLength - message.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-end space-x-3">
        <div className="flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              disabled={disabled}
              className={`
                w-full px-4 py-3 pr-12 border rounded-2xl resize-none
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isOverLimit ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
              `}
              rows={1}
              style={{ minHeight: '48px' }}
              maxLength={maxLength}
            />
            
            {/* Character counter */}
            {message.length > maxLength * 0.8 && (
              <div className={`
                absolute bottom-2 right-12 text-xs
                ${isOverLimit ? 'text-red-500' : 'text-gray-400'}
              `}>
                {remainingChars}
              </div>
            )}
          </div>
          
          {/* Error message for over limit */}
          {isOverLimit && (
            <div className="text-red-500 text-sm mt-1">
              Message is too long. Please reduce by {Math.abs(remainingChars)} characters.
            </div>
          )}
        </div>
        
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim() || isOverLimit}
          className={`
            p-3 rounded-full transition-all duration-200
            ${disabled || !message.trim() || isOverLimit
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-600'
              : 'bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
            }
          `}
          title="Send message (Enter)"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>
      
      {/* Keyboard shortcut hint */}
      <div className="text-xs text-gray-500 mt-2 text-center dark:text-gray-400">
        Press Enter to send • Shift+Enter for new line
      </div>
    </div>
  );
}