import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-7xl font-extrabold text-white mb-4">404</h1>
      <h2 className="text-3xl font-bold text-slate-200 mb-6">Page Not Found</h2>
      <p className="text-lg text-slate-400 mb-8 max-w-md">
        Oops! The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg shadow-lg
                   hover:bg-primary-700 transition-colors duration-200 transform hover:scale-105"
      >
        <Home className="w-5 h-5 mr-2" /> Go to Homepage
      </Link>
    </div>
  );
}

export default NotFoundPage;
