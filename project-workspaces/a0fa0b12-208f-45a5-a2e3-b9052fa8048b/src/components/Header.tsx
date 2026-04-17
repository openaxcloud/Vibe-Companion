import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, User, Sun, Moon, LogOut, LayoutDashboard, Store } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-card-light dark:bg-card-dark shadow-md dark:shadow-xl glass-effect border-b border-border-light dark:border-border-dark py-4 px-6 md:px-8">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
          <Store size={28} />
          E-Market
        </Link>
        <nav className="flex items-center space-x-4 md:space-x-6">
          <Link to="/products" className="text-text-light dark:text-text-dark hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
            Products
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun size={20} className="text-yellow-400" />
            ) : (
              <Moon size={20} className="text-blue-600" />
            )}
          </button>

          {isAuthenticated() ? (
            <>
              <div className="relative group">
                <Link to="/dashboard" className="flex items-center gap-2 text-text-light dark:text-text-dark hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
                  <User size={20} />
                  <span className="hidden md:inline">{user?.username || 'Profile'}</span>
                </Link>
                {/* Dropdown for user options, if needed */}
              </div>
              {isAdmin() && (
                <Link to="/admin" className="flex items-center gap-2 text-text-light dark:text-text-dark hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
                  <LayoutDashboard size={20} />
                  <span className="hidden md:inline">Admin</span>
                </Link>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
              >
                <LogOut size={20} />
                <span className="hidden md:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="text-text-light dark:text-text-dark hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
              Login
            </Link>
          )}

          <Link to="/cart" className="relative p-1 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors duration-200" aria-label="Shopping Cart">
            <ShoppingCart size={24} className="text-text-light dark:text-text-dark" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
