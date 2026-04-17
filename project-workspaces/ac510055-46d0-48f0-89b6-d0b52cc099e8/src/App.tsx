
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { useChatStore, Message } from './store/chat';
import { useTranslation } from 'react-i18next';
import './i18n';

function AppContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { conversations, currentConversationId, setCurrentConversation, newConversation } = useChatStore();

  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      setCurrentConversation(conversationId);
    } else if (!conversationId && currentConversationId) {
      navigate(`/chat/${currentConversationId}`);
    } else if (!conversationId && !currentConversationId && conversations.length === 0) {
      // Create a new conversation if none exists
      const initialMessage: Message = {
        id: 'initial',
        role: 'assistant',
        content: t('welcome_message'),
        timestamp: Date.now(),
      };
      newConversation(initialMessage);
      // The navigate will happen in the next render cycle due to state update
    }
  }, [conversationId, currentConversationId, conversations.length, navigate, setCurrentConversation, newConversation, t]);

  const currentConversation = conversationId
    ? conversations.find((conv) => conv.id === conversationId)
    : null;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <ChatWindow conversation={currentConversation} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t('select_or_create_conversation')}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/chat/:conversationId" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;
