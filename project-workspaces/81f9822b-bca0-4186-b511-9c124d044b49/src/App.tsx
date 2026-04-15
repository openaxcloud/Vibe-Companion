import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatWindow from './components/ChatWindow';
import ConversationHistory from './components/ConversationHistory';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  return (
    <Router>
      <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1">
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<ChatWindow />} />
              <Route path="/history" element={<ConversationHistory />} />
              {/* Future routes for settings, integrations etc. */}
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
