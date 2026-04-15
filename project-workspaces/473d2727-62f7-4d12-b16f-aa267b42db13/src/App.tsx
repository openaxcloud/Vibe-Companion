import React from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Hero />
      <Features />
      <Footer />
    </div>
  );
}

export default App;