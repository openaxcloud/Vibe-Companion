import React from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import AboutSection from './components/AboutSection';
import InvestmentPhilosophySection from './components/InvestmentPhilosophySection';
import DataCenterShowcaseSection from './components/DataCenterShowcaseSection';
import TestimonialsSection from './components/TestimonialsSection';
import ContactSection from './components/ContactSection';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-6 py-8 w-full">
        <HeroSection />
        <FeaturesSection />
        <AboutSection />
        <InvestmentPhilosophySection />
        <DataCenterShowcaseSection />
        <TestimonialsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
};

export default App;
