import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-8 mt-12">
      <div className="container mx-auto text-center max-w-7xl px-4 md:px-6">
        <p className="text-lg font-semibold text-primary-400 mb-4">E-Commerce Marketplace</p>
        <p className="text-sm mb-2">&copy; {new Date().getFullYear()} All rights reserved.</p>
        <p className="text-xs">Built with ❤️ by Your Name/AI Agent</p>
        <div className="flex justify-center space-x-4 mt-4">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <span className="text-slate-600">|</span>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
