import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Conversation, ChatContextType, Document } from '../types/chat';
import { sendMessageToOpenAI, streamGeminiResponse } from '../services/openai'; // Assuming streamGeminiResponse for streaming

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const savedConversations = localStorage.getItem('chatConversations');
    return savedConversations ? JSON.parse(savedConversations) : [];
  });
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>(() => {
    const savedDocuments = localStorage.getItem('chatDocuments');
    return savedDocuments ? JSON.parse(savedDocuments) : [];
  });

  useEffect(() => {
    localStorage.setItem('chatConversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('chatDocuments', JSON.stringify(documents));
  }, [documents]);

  const addMessageToConversation = useCallback(
    (convId: string, message: Message, isStreamingStart: boolean = false) => {
      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === convId
            ? {
                ...conv,
                messages: isStreamingStart
                  ? [...conv.messages, { ...message, isStreaming: true }]
                  : conv.messages.map((msg) =>
                      msg.id === message.id && msg.isStreaming
                        ? { ...message, isStreaming: false }
                        : msg
                    ).some(msg => msg.id === message.id) ? conv.messages.map((msg) =>
                      msg.id === message.id && msg.isStreaming
                        ? { ...message, isStreaming: false }
                        : msg
                    ) : [...conv.messages, message],
              }
            : conv
        )
      );
      if (currentConversation && currentConversation.id === convId) {
        setCurrentConversation((prev) => {
          if (!prev) return null;
          const newMessages = isStreamingStart
            ? [...prev.messages, { ...message, isStreaming: true }]
            : prev.messages.map((msg) =>
                msg.id === message.id && msg.isStreaming
                  ? { ...message, isStreaming: false }
                  : msg
              ).some(msg => msg.id === message.id) ? prev.messages.map((msg) =>
                msg.id === message.id && msg.isStreaming
                  ? { ...message, isStreaming: false }
                  : msg
              ) : [...prev.messages, message];
          return { ...prev, messages: newMessages };
        });
      }
    },
    [currentConversation]
  );

  const updateStreamingMessage = useCallback(
    (convId: string, messageId: string, chunk: string) => {
      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === convId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === messageId && msg.isStreaming
                    ? { ...msg, text: msg.text + chunk }
                    : msg
                ),
              }
            : conv
        )
      );
      if (currentConversation && currentConversation.id === convId) {
        setCurrentConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === messageId && msg.isStreaming
                ? { ...msg, text: msg.text + chunk }
                : msg
            ),
          };
        });
      }
    },
    [currentConversation]
  );

  const stopStreamingMessage = useCallback((convId: string, messageId: string) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === convId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId && msg.isStreaming ? { ...msg, isStreaming: false } : msg
              ),
            }
          : conv
      )
    );
    if (currentConversation && currentConversation.id === convId) {
      setCurrentConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === messageId && msg.isStreaming ? { ...msg, isStreaming: false } : msg
          ),
        };
      });
    }
  }, [currentConversation]);

  const sendMessage = useCallback(async (text: string, conversationId?: string) => {
    setLoading(true);
    setError(null);
    const userMessage: Message = { id: uuidv4(), text, sender: 'user', timestamp: Date.now() };

    let convId = conversationId || currentConversation?.id;
    let newConversationTitle = currentConversation?.title || 'New Chat';

    if (!convId) {
      convId = uuidv4();
      newConversationTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
      const newConversation: Conversation = {
        id: convId,
        title: newConversationTitle,
        messages: [],
        createdAt: Date.now(),
      };
      setConversations((prev) => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
    }

    addMessageToConversation(convId, userMessage);

    const conversationMessages = conversations.find(c => c.id === convId)?.messages || [];
    const messagesForApi = [...conversationMessages, userMessage];

    // Add document context to the messages for RAG simulation
    const documentContext = documents.map(doc => `Document: ${doc.filename}\n${doc.content}`).join('\n\n');
    const messagesWithContext = documentContext
      ? [{ role: 'system', content: `You have access to the following documents:
${documentContext}` }, ...messagesForApi.map(msg => ({ role: msg.sender, content: msg.text }))] as any
      : messagesForApi.map(msg => ({ role: msg.sender, content: msg.text })) as any;

    const aiMessageId = uuidv4();
    addMessageToConversation(convId, { id: aiMessageId, text: '', sender: 'ai', timestamp: Date.now() }, true);

    try {
      const stream = await streamGeminiResponse(messagesWithContext);
      for await (const chunk of stream) {
        updateStreamingMessage(convId, aiMessageId, chunk);
      }
      stopStreamingMessage(convId, aiMessageId);
    } catch (err) {
      console.error('Error streaming AI response:', err);
      setError('Failed to get AI response.');
      stopStreamingMessage(convId, aiMessageId);
      // Remove the partial AI message if an error occurred during streaming
      setConversations(prev => prev.map(conv => 
        conv.id === convId ? { ...conv, messages: conv.messages.filter(msg => msg.id !== aiMessageId) } : conv
      ));
      if (currentConversation?.id === convId) {
        setCurrentConversation(prev => prev ? { ...prev, messages: prev.messages.filter(msg => msg.id !== aiMessageId) } : null);
      }
    } finally {
      setLoading(false);
    }
  }, [conversations, currentConversation, documents, addMessageToConversation, updateStreamingMessage, stopStreamingMessage]);

  const startNewConversation = useCallback(() => {
    setCurrentConversation(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    const conversation = conversations.find((conv) => conv.id === id);
    if (conversation) {
      setCurrentConversation(conversation);
    }
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
    }
  }, [currentConversation]);

  const updateMessage = useCallback(
    (conversationId: string, messageId: string, newText: string) => {
      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, text: newText } : msg
                ),
              }
            : conv
        )
      );
      if (currentConversation?.id === conversationId) {
        setCurrentConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === messageId ? { ...msg, text: newText } : msg
            ),
          };
        });
      }
    },
    [currentConversation]
  );

  const addDocument = useCallback((filename: string, content: string) => {
    setDocuments(prev => [...prev, { filename, content }]);
  }, []);

  const executeCode = useCallback(async (code: string): Promise<string> => {
    // This is a client-side simulation. In a real application, this would involve
    // sending the code to a secure backend sandbox for execution.
    console.log('Executing code:', code);
    try {
      // For demonstration, we'll just return the code as output for now.
      // In a real scenario, this would be the actual output from a sandbox.
      return `Simulated code output for:\n${code}\n\n(Backend execution required for actual results)`;
    } catch (e: any) {
      return `Simulated code error: ${e.message}`; // Simulate error handling
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        loading,
        error,
        sendMessage,
        startNewConversation,
        selectConversation,
        deleteConversation,
        updateMessage,
        addDocument,
        executeCode,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};