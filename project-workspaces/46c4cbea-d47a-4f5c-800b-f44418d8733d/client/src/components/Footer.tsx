import React from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-r from-slate-900 to-slate-800 text-slate-400 py-8 mt-12 shadow-inner">
      <div className="container mx-auto px-4 text-center md:flex md:justify-between md:items-center">
        <div className="mb-4 md:mb-0">
          <p className="text-lg font-semibold text-primary-400 mb-2">E-Commerce Marketplace</p>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>

        <div className="flex justify-center space-x-6 mb-4 md:mb-0">
          <a href="#" className="hover:text-primary-300 transition-colors duration-200" aria-label="Twitter">
            <Twitter size={24} />
          </a>
          <a href="#" className="hover:text-primary-300 transition-colors duration-200" aria-label="Github">
            <Github size={24} />
          </a>
          <a href="#" className="hover:text-primary-300 transition-colors duration-200" aria-label="LinkedIn">
            <Linkedin size={24} />
          </a>
        </div>

        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-6">
          <a href="#" className="hover:text-primary-300 transition-colors duration-200">Privacy Policy</a>
          <a href="#" className="hover:text-primary-300 transition-colors duration-200">Terms of Service</a>
          <a href="#" className="hover:text-primary-300 transition-colors duration-200">Contact Us</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;