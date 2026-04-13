import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/5 border border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-primary-500 hover:text-primary-400 transition">
          AI Data Invest
        </a>
        <div className="hidden md:flex space-x-8">
          <a href="#features" className="hover:text-primary-400 transition">
            Features
          </a>
          <a href="#about" className="hover:text-primary-400 transition">
            About
          </a>
          <a href="#investment" className="hover:text-primary-400 transition">
            Investment Philosophy
          </a>
          <a href="#data-centers" className="hover:text-primary-400 transition">
            Data Centers
          </a>
          <a href="#testimonials" className="hover:text-primary-400 transition">
            Testimonials
          </a>
          <a href="#contact" className="hover:text-primary-400 transition">
            Contact
          </a>
        </div>
        <button
          className="md:hidden p-2 rounded-md hover:bg-white/10 transition"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {isOpen && (
        <div className="md:hidden px-6 pb-4 space-y-2 backdrop-blur-xl bg-white/5 border-t border-white/10">
          <a href="#features" className="block py-2 hover:text-primary-400 transition">
            Features
          </a>
          <a href="#about" className="block py-2 hover:text-primary-400 transition">
            About
          </a>
          <a href="#investment" className="block py-2 hover:text-primary-400 transition">
            Investment Philosophy
          </a>
          <a href="#data-centers" className="block py-2 hover:text-primary-400 transition">
            Data Centers
          </a>
          <a href="#testimonials" className="block py-2 hover:text-primary-400 transition">
            Testimonials
          </a>
          <a href="#contact" className="block py-2 hover:text-primary-400 transition">
            Contact
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
