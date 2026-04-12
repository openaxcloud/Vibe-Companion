import React, { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Forum from './pages/Forum.jsx';

export default function App() {
  const [user, setUser] = useState({ name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?u=alice.johnson' });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <Header user={user} />
      <div className="flex flex-1 max-w-7xl mx-auto w-full overflow-hidden rounded-lg mt-4 shadow-card-glass bg-white/5 backdrop-blur-xl border border-white/10">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          <Forum user={user} />
        </main>
      </div>
    </div>
  );
}
