import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white/5 backdrop-blur-xl border-t border-white/10 mt-16 py-6 text-center text-slate-400 text-sm">
      <p>
        &copy; {new Date().getFullYear()} AI Data Invest. All rights reserved.
      </p>
    </footer>
  );
};

export default Footer;
