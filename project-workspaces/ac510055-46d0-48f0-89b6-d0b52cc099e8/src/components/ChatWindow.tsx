
import React, { useState, useRef, useEffect } from 'react';
import { Message, Conversation, useChatStore } from '../store/chat';
import { getAIResponseStream } from '../lib/openai';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send, Loader2, Download } from 'lucide-react';
import { Message as MessageComponent } from './Message';
import { generatePdf } from '../lib/pdfGenerator';
import { useTranslation } from 'react-i18next';
import { FileUpload } from './FileUpload';

interface ChatWindowProps {
  conversation: Conversation;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversation }) => {
  const { t } = useTranslation();
  const [inputMessage, setInputMessage] = useState('');
  const { addMessage, updateMessageContent, setIsTyping, isTyping } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === '') return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: inputMessage,
      timestamp: Date.now(),
    };

    addMessage(conversation.id, userMessage);
    setInputMessage('');
    setIsTyping(true);

    try {
      const stream = await getAIResponseStream([...conversation.messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      })));

      let assistantMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      addMessage(conversation.id, assistantMessage); // Add placeholder message

      for await (const chunk of stream) {
        const newContent = chunk.choices[0]?.delta?.content || '';
        if (newContent) {
          assistantMessage.content += newContent;
          updateMessageContent(conversation.id, assistantMessage.id, assistantMessage.content);
          scrollToBottom();
        }
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      updateMessageContent(conversation.id, assistantMessage.id, t('error_fetching_response'));
    } finally {
      setIsTyping(false);
    }
  };

  const handleExportPdf = () => {
    generatePdf(conversation);
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-900">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">{conversation.title}</h2>
        <div className="flex space-x-2">
          <FileUpload onFileUpload={(file) => console.log('File uploaded:', file)} />
          <Button onClick={handleExportPdf} variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <Download className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {conversation.messages.map((message, index) => (
          <MessageComponent key={message.id} message={message} isLast={index === conversation.messages.length - 1} />
        ))}
        {isTyping && (
          <div className="flex items-center space-x-2 p-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-gray-400 italic">{t('ai_is_typing')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="mt-4 flex space-x-2">
        <Input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={t('type_your_message')}
          className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
          disabled={isTyping}
        />
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isTyping}>
          {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
