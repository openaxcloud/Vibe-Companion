import React from 'react';
import { Link } from 'react-router-dom';
import { Frown } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center py-20 animate-fade-in">
      <Frown size={80} className="text-primary-400 mb-6" />
      <h1 className="text-5xl font-extrabold text-slate-50 mb-4">404 - Page Not Found</h1>
      <p className="text-xl text-slate-300 mb-8 max-w-md leading-relaxed">
        Oops! The page you are looking for does not exist.
        It might have been moved or deleted.
      </p>
      <Link
        to="/"
        className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 ease-out hover:scale-105"
      >
        Go to Homepage
      </Link>
    </div>
  );
};

export default NotFoundPage;