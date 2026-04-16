import { Link } from 'react-router-dom';
import { Rss } from 'lucide-react';

function Header() {
  return (
    <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center max-w-4xl">
        <Link to="/" className="text-2xl font-bold text-white hover:text-primary-400 transition-colors duration-200">
          My Blog
        </Link>
        <nav>
          <ul className="flex items-center space-x-6">
            <li>
              <Link to="/" className="text-slate-300 hover:text-primary-300 transition-colors duration-200 text-lg">
                Home
              </Link>
            </li>
            <li>
              <a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-primary-300 transition-colors duration-200 flex items-center gap-2 text-lg">
                <Rss className="w-5 h-5" /> RSS
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;
