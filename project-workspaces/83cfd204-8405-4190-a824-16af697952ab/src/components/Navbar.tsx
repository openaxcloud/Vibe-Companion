import React, { useState } from 'react';
import { Menu, X, ChevronDown, Rocket } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <a href="#" className="flex items-center space-x-2 text-white text-2xl font-bold">
            <Rocket className="text-primary-400" size={32} />
            <span>AI Invest</span>
          </a>
        </div>

        <div className="hidden lg:flex items-center space-x-8">
          <a href="#features" className="text-slate-300 hover:text-primary-400 transition-colors duration-200">Features</a>
          <a href="#about" className="text-slate-300 hover:text-primary-400 transition-colors duration-200">About Us</a>
          <div className="relative">
            <button
              onClick={() => setIsSolutionsOpen(!isSolutionsOpen)}
              className="flex items-center text-slate-300 hover:text-primary-400 transition-colors duration-200 focus:outline-none"
            >
              Solutions <ChevronDown className={`ml-1 h-4 w-4 transform transition-transform duration-200 ${isSolutionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSolutionsOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                <a href="#ai-data-centers" className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400 transition-colors duration-200">AI Data Centers</a>
                <a href="#private-equity" className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400 transition-colors duration-200">Private Equity</a>
                <a href="#venture-capital" className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400 transition-colors duration-200">Venture Capital</a>
              </div>
            )}
          </div>
          <a href="#testimonials" className="text-slate-300 hover:text-primary-400 transition-colors duration-200">Testimonials</a>
          <a href="#contact" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-full transition-all duration-200 shadow-md hover:shadow-lg">Contact Us</a>
        </div>

        <div className="lg:hidden">
          <button onClick={() => setIsOpen(!isOpen)} className="text-white focus:outline-none">
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-slate-900/90 backdrop-blur-md pb-4">
          <div className="px-4 pt-2 pb-3 space-y-2 sm:px-3 flex flex-col items-center">
            <a href="#features" onClick={() => setIsOpen(false)} className="block text-slate-300 hover:text-primary-400 py-2">Features</a>
            <a href="#about" onClick={() => setIsOpen(false)} className="block text-slate-300 hover:text-primary-400 py-2">About Us</a>
            <div className="w-full text-center">
              <button
                onClick={() => setIsSolutionsOpen(!isSolutionsOpen)}
                className="flex items-center justify-center w-full text-slate-300 hover:text-primary-400 py-2 focus:outline-none"
              >
                Solutions <ChevronDown className={`ml-1 h-4 w-4 transform transition-transform duration-200 ${isSolutionsOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSolutionsOpen && (
                <div className="mt-2 space-y-1 bg-slate-800 border border-white/10 rounded-md py-1">
                  <a href="#ai-data-centers" onClick={() => setIsOpen(false)} className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400">AI Data Centers</a>
                  <a href="#private-equity" onClick={() => setIsOpen(false)} className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400">Private Equity</a>
                  <a href="#venture-capital" onClick={() => setIsOpen(false)} className="block px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-primary-400">Venture Capital</a>
                </div>
              )}
            </div>
            <a href="#testimonials" onClick={() => setIsOpen(false)} className="block text-slate-300 hover:text-primary-400 py-2">Testimonials</a>
            <a href="#contact" onClick={() => setIsOpen(false)} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-full transition-all duration-200 shadow-md hover:shadow-lg w-fit mt-4">Contact Us</a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
