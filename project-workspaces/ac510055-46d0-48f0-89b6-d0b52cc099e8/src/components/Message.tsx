
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message as MessageType } from '../store/chat';
import { Bot, User, Loader2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock'; // Assuming CodeBlock component exists

interface MessageProps {
  message: MessageType;
  isLast: boolean;
}

export const Message: React.FC<MessageProps> = ({ message, isLast }) => {
  const isUser = message.role === 'user';
  const messageClasses = isUser
    ? 'bg-indigo-700 text-white rounded-br-none ml-auto'
    : 'bg-gray-700 text-gray-100 rounded-bl-none mr-auto';

  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <Bot className="h-7 w-7 text-indigo-400" />
        </div>
      )}
      <div className={`p-3 rounded-xl max-w-3xl shadow-md ${messageClasses}`}>
        {isLast && message.content === '' && message.role === 'assistant' ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1 last:mb-0" {...props} />,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0">
          <User className="h-7 w-7 text-gray-300" />
        </div>
      )}
    </div>
  );
};
