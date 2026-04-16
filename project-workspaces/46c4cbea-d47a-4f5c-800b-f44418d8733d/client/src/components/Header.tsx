import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Assuming dark mode by default

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const cartItemCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <header className="bg-gradient-to-r from-slate-900 to-slate-800 shadow-lg sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-primary-400 flex items-center gap-2">
          <img src="/logo.svg" alt="E-commerce Logo" className="h-8 w-8" />
          E-Commerce
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link to="/products" className="text-slate-200 hover:text-primary-300 transition-colors text-lg font-medium">
            Products
          </Link>
          {user && user.role === 'admin' && (
            <Link to="/dashboard" className="text-slate-200 hover:text-primary-300 transition-colors text-lg font-medium">
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-slate-300 hover:bg-slate-700 hover:text-primary-300 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link to="/cart" className="relative p-2 rounded-full text-slate-300 hover:bg-slate-700 hover:text-primary-300 transition-colors">
            <ShoppingCart size={20} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse-fast">
                {cartItemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 text-slate-300 hover:text-primary-300 transition-colors p-2 rounded-full hover:bg-slate-700">
                <User size={20} />
                <span className="hidden md:inline font-medium">{user.username}</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform scale-95 group-hover:scale-100 origin-top-right">
                <Link to="/profile" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">Profile</Link>
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-all duration-200 ease-out hover:scale-105"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button onClick={toggleMobileMenu} className="md:hidden p-2 rounded-full text-slate-300 hover:bg-slate-700 hover:text-primary-300 transition-colors">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-800 pb-4 animate-fade-in animate-slide-up">
          <div className="flex flex-col items-center space-y-4">
            <Link
              to="/products"
              onClick={toggleMobileMenu}
              className="w-full text-center py-2 text-slate-200 hover:bg-slate-700 hover:text-primary-300 transition-colors text-lg"
            >
              Products
            </Link>
            {user && user.role === 'admin' && (
              <Link
                to="/dashboard"
                onClick={toggleMobileMenu}
                className="w-full text-center py-2 text-slate-200 hover:bg-slate-700 hover:text-primary-300 transition-colors text-lg"
              >
                Dashboard
              </Link>
            )}
            {!user && (
              <Link
                to="/register"
                onClick={toggleMobileMenu}
                className="w-full text-center py-2 text-slate-200 hover:bg-slate-700 hover:text-primary-300 transition-colors text-lg"
              >
                Register
              </Link>
            )}
            {user && (
              <button
                onClick={() => { logout(); toggleMobileMenu(); }}
                className="w-full text-center py-2 text-red-400 hover:bg-slate-700 transition-colors text-lg"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;